// What the waiter's Tables screen shows for each table: free, or the colour of what the table needs.
// Pure, so the timing rules are tested without a browser. Times are ISO strings, as the API sends them.

// A table counts as "just ordered" for this long after its latest round...
export const ORDERED_WINDOW_MS = 10 * 60_000;
// ...and "paying is slow" once the guest asked for the bill this long ago.
export const SLOW_PAY_MS = 5 * 60_000;

export type TableState = "free" | "ordered" | "bill" | "slowPay" | "quiet";

export type ReadyRound = {
  orderId: string;
  createdAt: string;
  lines: { name: string; qty: number }[];
};

// One open tab, as GET /api/waiter/tabels returns it.
export type OpenTab = {
  sessionId: string;
  tableId: string;
  tableLabel: string;
  openedAt: string;
  totalUSD: string;
  totalLBP: string;
  orderCount: number;
  lastOrderAt: string | null;
  billRequestedAt: string | null;
  readyOrders: ReadyRound[];
};

export type FloorTable = { id: string; label: string; isDisabled: boolean };

export type FloorTile = {
  tableId: string;
  label: string;
  state: TableState;
  // When the current state started (null for a free table).
  since: string | null;
  readyCount: number;
  tab: OpenTab | null;
};

const at = (iso: string) => new Date(iso).getTime();

// Asking for the bill wins over everything else; otherwise the latest round decides. A tab where nothing was
// ordered yet (the guest only scanned) is quiet since it opened.
export function tableState(tab: OpenTab, now: number): { state: Exclude<TableState, "free">; since: string } {
  if (tab.billRequestedAt) {
    const slow = now - at(tab.billRequestedAt) >= SLOW_PAY_MS;
    return { state: slow ? "slowPay" : "bill", since: tab.billRequestedAt };
  }
  if (tab.lastOrderAt && now - at(tab.lastOrderAt) < ORDERED_WINDOW_MS) {
    return { state: "ordered", since: tab.lastOrderAt };
  }
  return { state: "quiet", since: tab.lastOrderAt ?? tab.openedAt };
}

const byLabel = (a: FloorTile, b: FloorTile) => a.label.localeCompare(b.label, undefined, { numeric: true });

// Every table in label order (T2 before T10), so each one keeps its place on the screen. A disabled table is
// hidden unless it still has an open tab to settle.
export function buildFloor(tables: FloorTable[], tabs: OpenTab[], now: number): FloorTile[] {
  const tabByTable = new Map(tabs.map((tab) => [tab.tableId, tab]));
  const tiles: FloorTile[] = [];

  for (const table of tables) {
    const tab = tabByTable.get(table.id) ?? null;
    tabByTable.delete(table.id);
    if (!tab && table.isDisabled) continue;
    tiles.push(tile(table.id, table.label, tab, now));
  }
  // A tab whose table the list didn't include (added a moment ago): still show it rather than lose a bill.
  for (const tab of tabByTable.values()) tiles.push(tile(tab.tableId, tab.tableLabel, tab, now));

  return tiles.sort(byLabel);
}

function tile(tableId: string, label: string, tab: OpenTab | null, now: number): FloorTile {
  if (!tab) return { tableId, label, state: "free", since: null, readyCount: 0, tab: null };
  const { state, since } = tableState(tab, now);
  return { tableId, label, state, since, readyCount: tab.readyOrders.length, tab };
}

// "just now", "4 min", "1 h 5 min"
export function elapsedLabel(since: string, now: number): string {
  const minutes = Math.floor((now - at(since)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export const STATE_LABEL: Record<TableState, string> = {
  free: "Free",
  ordered: "Just ordered",
  bill: "Wants to pay",
  slowPay: "Paying is slow",
  quiet: "Quiet a while",
};
