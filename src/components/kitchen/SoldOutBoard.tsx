"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { formatLBP, formatUSD } from "@/components/dashboard/menu/menuApi";
import { ApiError } from "@/components/dashboard/api";
import { SignedInElsewhere } from "@/components/staff/SignedInElsewhere";
import { Button, Card, StatusBadge, TextField, Toast } from "@/components/ui";
import { FloatingToast } from "@/components/ui/FloatingToast";
import { applySoldOut, soldOutView, type BoardItem } from "@/utils/soldOutBoard";
import { kitchenApi, kitchenSentenceFor, type BoardCategory } from "./kitchenApi";

// Re-read the menu now and then, so a switch flipped on another screen (or by the owner) shows here too.
const REFRESH_MS = 10_000;

type Loaded = { categories: BoardCategory[]; items: BoardItem[] };
type Notice = { id: number; tone: "success" | "error"; title: string };

// The kitchen's Sold out screen: the owner's menu layout (category tabs, item rows with prices), plus a search,
// with one switch per item. The switch flips at once; if the server refuses, it flips back and says why.
export function SoldOutBoard() {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [otherAccount, setOtherAccount] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeCount = useRef(0);
  const dismissNotice = useCallback(() => setNotice(null), []);
  // Only the newest read may answer, and none while a switch is waiting for the server, so a slow refresh
  // can't flip a switch back under the cook's finger.
  const latest = useRef(0);
  const pending = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const [categories, items] = await Promise.all([kitchenApi.categories(), kitchenApi.items()]);
      if (request !== latest.current || pending.current > 0) return;
      setData({ categories, items });
      setFilter((selected) => (selected === "all" || categories.some((c) => c.id === selected) ? selected : "all"));
      setLoadFailed(false);
      setOtherAccount(false);
    } catch (error) {
      if (request !== latest.current) return;
      if (error instanceof ApiError && error.status === 403) setOtherAccount(true);
      else setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  async function toggle(item: BoardItem) {
    const soldOut = !item.soldOut;
    pending.current += 1;
    setBusy((current) => new Set(current).add(item.id));
    setData((current) => current && { ...current, items: applySoldOut(current.items, item.id, soldOut) });
    try {
      await kitchenApi.setSoldOut(item.id, soldOut);
      setNotice({
        id: ++noticeCount.current,
        tone: "success",
        title: soldOut ? `${item.name} is sold out` : `${item.name} is back on the menu`,
      });
    } catch (error) {
      setData((current) => current && { ...current, items: applySoldOut(current.items, item.id, !soldOut) });
      setNotice({ id: ++noticeCount.current, tone: "error", title: kitchenSentenceFor(error) });
    } finally {
      pending.current -= 1;
      setBusy((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
      if (pending.current === 0) void load();
    }
  }

  const view = data ? soldOutView(data.items, filter, search) : null;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Sold out</h1>
        {view && (
          <p className="text-sm text-ink-muted" aria-live="polite">
            {view.soldOutCount === 0
              ? "Everything is available"
              : `${view.soldOutCount} ${view.soldOutCount === 1 ? "item" : "items"} off the menu`}
          </p>
        )}
      </div>

      {otherAccount && <SignedInElsewhere role="kitchen" />}

      {notice && (
        <FloatingToast
          key={notice.id}
          tone={notice.tone}
          title={notice.title}
          duration={notice.tone === "error" ? 6000 : 3000}
          onDismiss={dismissNotice}
        />
      )}

      {!data && loadFailed && (
        <Card className="flex flex-col items-start gap-3">
          <Toast tone="error" title="We couldn't load the menu. Check the connection and try again." />
          <Button onClick={() => void load()}>Try again</Button>
        </Card>
      )}
      {!data && !loadFailed && !otherAccount && <p className="text-sm text-ink-muted">Loading the menu…</p>}

      {data && data.categories.length === 0 && (
        <Card>
          <p className="text-ink-muted">The menu is empty. The owner adds items from their Menu screen.</p>
        </Card>
      )}

      {data && view && data.categories.length > 0 && (
        <>
          {loadFailed && (
            <p className="text-sm font-semibold text-danger">No connection. The list may be out of date.</p>
          )}
          <TextField
            label="Search the menu"
            type="search"
            placeholder="Item name"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            icon={<SearchIcon className="size-5 shrink-0 text-ink-muted" aria-hidden="true" />}
          />
          <CategoryTabs
            categories={[{ id: "all", name: "All" }, ...data.categories]}
            activeId={filter}
            onSelect={setFilter}
          />
          {view.items.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-muted">
                {search.trim() ? `No items match “${search.trim()}”.` : "No items in this category."}
              </p>
            </Card>
          ) : (
            <ul role="tabpanel" id={`panel-${filter}`} aria-labelledby={`tab-${filter}`} className="flex flex-col gap-2.5">
              {view.items.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 rounded-2xl border border-border-subtle p-4 ${
                    item.soldOut ? "bg-surface-muted" : "bg-surface"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className={`text-base font-semibold ${item.soldOut ? "text-ink-muted" : "text-ink"}`}>{item.name}</p>
                    <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
                      <span className={`text-[17px] font-bold ${item.soldOut ? "text-ink-muted" : "text-ink"}`}>
                        {formatUSD(item.priceUSD)}
                      </span>
                      <span className="text-[13px] text-ink-muted">{formatLBP(item.priceLBP)}</span>
                    </p>
                  </div>
                  {item.soldOut && <StatusBadge status="SOLD_OUT" className="shrink-0" />}
                  <AvailabilitySwitch item={item} busy={busy.has(item.id)} onToggle={() => void toggle(item)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// On (green) = guests can order it; off (grey) = sold out. A 44 px tap area around the track.
function AvailabilitySwitch({ item, busy, onToggle }: { item: BoardItem; busy: boolean; onToggle: () => void }) {
  const on = !item.soldOut;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${item.name} available`}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={onToggle}
      className="flex min-h-11 min-w-14 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
    >
      <span className={`relative h-7 w-12 rounded-full transition-colors ${on ? "bg-primary" : "bg-border-strong"}`}>
        <span
          className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-[left] ${on ? "left-6" : "left-1"}`}
        />
      </span>
    </button>
  );
}
