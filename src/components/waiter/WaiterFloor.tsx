"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, Card, Toast } from "@/components/ui";
import { FloatingToast } from "@/components/ui/FloatingToast";
import { buildFloor, STATE_LABEL, updatedAgoLabel, type FloorTile, type TableState } from "@/utils/waiterFloor";
import { TableSheet } from "./TableSheet";
import { TableTile, TILE_LOOK } from "./TableTile";
import { useWaiterFloor } from "./useWaiterFloor";

const LEGEND: TableState[] = ["ordered", "bill", "slowPay", "quiet", "free"];

// The waiter's Tables screen: every table, coloured by what it needs, refreshed every few seconds.
// Tapping a table with guests opens its bill.
export function WaiterFloor() {
  const { tables, tabs, now, updatedAt, stale, refresh } = useWaiterFloor();
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: number; title: string } | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const floor = useMemo(() => (tables && tabs ? buildFloor(tables, tabs, now) : null), [tables, tabs, now]);
  // Follow the open bill by its tab, so the sheet keeps the latest tile as the floor refreshes.
  const openTile = floor?.find((tile) => tile.tab?.sessionId === openSessionId) ?? null;
  const [closingTile, setClosingTile] = useState<FloorTile | null>(null);
  const sheetTile = openTile ?? closingTile;

  function open(tile: FloorTile) {
    setOpenSessionId(tile.tab!.sessionId);
    setClosingTile(tile);
  }

  function closeSheet(closedLabel?: string) {
    setOpenSessionId(null);
    setClosingTile(null);
    if (closedLabel) setNotice({ id: Date.now(), title: `${closedLabel} is closed and paid.` });
    void refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Tables</h1>
        {updatedAt && (
          <p className={`text-xs ${stale ? "font-semibold text-danger" : "text-ink-muted"}`}>
            {stale ? "No connection. " : ""}Updated {updatedAgoLabel(updatedAt, now)}
          </p>
        )}
      </div>

      {notice && <FloatingToast key={notice.id} title={notice.title} onDismiss={dismissNotice} />}

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-label="Colour key">
        {LEGEND.map((state) => (
          <li key={state} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className={`size-3 rounded-sm ${TILE_LOOK[state]}`} aria-hidden />
            {STATE_LABEL[state]}
          </li>
        ))}
      </ul>

      {!floor && stale && (
        <Card className="flex flex-col items-start gap-3">
          <Toast tone="error" title="We couldn't load your tables. Check your connection and try again." />
          <Button onClick={() => void refresh()}>Try again</Button>
        </Card>
      )}
      {!floor && !stale && <p className="text-sm text-ink-muted">Loading tables…</p>}

      {floor && floor.length === 0 && (
        <Card>
          <p className="text-sm text-ink-muted">No tables yet. The owner adds them under Tables.</p>
        </Card>
      )}

      {floor && floor.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-4 xl:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
          {floor.map((tile) => (
            <li key={tile.tableId} className="flex min-w-0 flex-col [&>*]:flex-1">
              <TableTile tile={tile} now={now} onOpen={open} />
            </li>
          ))}
        </ul>
      )}

      {sheetTile?.tab && (
        <TableSheet
          key={sheetTile.tab.sessionId}
          tile={sheetTile}
          refreshKey={updatedAt}
          onChanged={() => void refresh()}
          onClose={closeSheet}
        />
      )}
    </div>
  );
}
