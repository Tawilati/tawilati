import { describe, expect, it } from "vitest";
import { buildFloor, elapsedLabel, tableState, updatedAgoLabel, type OpenTab } from "@/utils/waiterFloor";

const NOW = new Date("2026-11-03T13:00:00.000Z").getTime();
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

function tab(overrides: Partial<OpenTab> = {}): OpenTab {
  return {
    sessionId: "s1",
    tableId: "t1",
    tableLabel: "T1",
    openedAt: minutesAgo(40),
    totalUSD: "12.10",
    totalLBP: "1082950.00",
    orderCount: 2,
    lastOrderAt: minutesAgo(3),
    billRequestedAt: null,
    readyOrders: [],
    ...overrides,
  };
}

describe("tableState", () => {
  it("is 'ordered' for 10 minutes after the latest round", () => {
    expect(tableState(tab({ lastOrderAt: minutesAgo(0) }), NOW)).toEqual({ state: "ordered", since: minutesAgo(0) });
    expect(tableState(tab({ lastOrderAt: minutesAgo(9.9) }), NOW).state).toBe("ordered");
  });

  it("is 'quiet' from 10 minutes after the latest round", () => {
    expect(tableState(tab({ lastOrderAt: minutesAgo(10) }), NOW)).toEqual({ state: "quiet", since: minutesAgo(10) });
  });

  it("is 'quiet' since the tab opened when nothing was ordered yet", () => {
    expect(tableState(tab({ lastOrderAt: null, orderCount: 0 }), NOW)).toEqual({ state: "quiet", since: minutesAgo(40) });
  });

  it("is 'bill' for 5 minutes after the guest asked, whatever the last round", () => {
    const asked = tab({ billRequestedAt: minutesAgo(4.9), lastOrderAt: minutesAgo(1) });
    expect(tableState(asked, NOW)).toEqual({ state: "bill", since: minutesAgo(4.9) });
  });

  it("is 'slowPay' from 5 minutes after the guest asked", () => {
    expect(tableState(tab({ billRequestedAt: minutesAgo(5) }), NOW)).toEqual({ state: "slowPay", since: minutesAgo(5) });
  });
});

describe("buildFloor", () => {
  const tables = [
    { id: "t10", label: "T10", isDisabled: false },
    { id: "t2", label: "T2", isDisabled: false },
    { id: "t1", label: "T1", isDisabled: false },
    { id: "off", label: "Old", isDisabled: true },
    { id: "offOpen", label: "Patio", isDisabled: true },
  ];

  it("lists every table in label order, free ones without a tab", () => {
    const floor = buildFloor(tables, [tab({ tableId: "t2", tableLabel: "T2" })], NOW);

    expect(floor.map((tile) => [tile.label, tile.state])).toEqual([
      ["T1", "free"],
      ["T2", "ordered"],
      ["T10", "free"],
    ]);
  });

  it("hides a disabled table unless it still has an open tab", () => {
    const floor = buildFloor(tables, [tab({ tableId: "offOpen", tableLabel: "Patio" })], NOW);

    expect(floor.map((tile) => tile.label)).toEqual(["Patio", "T1", "T2", "T10"]);
  });

  it("counts the rounds waiting to be served", () => {
    const ready = [
      { orderId: "o1", createdAt: minutesAgo(2), lines: [] },
      { orderId: "o2", createdAt: minutesAgo(1), lines: [] },
    ];
    const [tile] = buildFloor([tables[2]], [tab({ readyOrders: ready })], NOW);

    expect(tile).toMatchObject({ readyCount: 2, tab: { sessionId: "s1" } });
  });

  it("still shows a tab whose table isn't in the table list", () => {
    const floor = buildFloor([], [tab({ tableId: "gone", tableLabel: "Bar" })], NOW);

    expect(floor.map((tile) => [tile.tableId, tile.label, tile.state])).toEqual([["gone", "Bar", "ordered"]]);
  });
});

describe("elapsedLabel", () => {
  it.each([
    [0.2, "just now"],
    [1, "1 min"],
    [25.7, "25 min"],
    [60, "1 h"],
    [65, "1 h 5 min"],
  ])("%s minutes → %s", (minutes, label) => {
    expect(elapsedLabel(minutesAgo(minutes), NOW)).toBe(label);
  });
});

describe("updatedAgoLabel", () => {
  it.each([
    [0, "just now"],
    [4_000, "just now"],
    [5_000, "5 s ago"],
    [59_000, "59 s ago"],
    [60_000, "1 min ago"],
    [5 * 60_000 + 30_000, "5 min ago"],
    [65 * 60_000, "1 h 5 min ago"],
  ])("%s ms after the last update → %s", (ms, label) => {
    expect(updatedAgoLabel(NOW - ms, NOW)).toBe(label);
  });
});
