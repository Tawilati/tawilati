import { describe, expect, it } from "vitest";
import { applySoldOut, soldOutView, type BoardItem } from "@/utils/soldOutBoard";

const item = (over: Partial<BoardItem> & Pick<BoardItem, "id" | "name">): BoardItem => ({
  categoryId: "coffee",
  priceUSD: "3.00",
  priceLBP: "267000.00",
  soldOut: false,
  archivedAt: null,
  ...over,
});

const items: BoardItem[] = [
  item({ id: "1", name: "Espresso" }),
  item({ id: "2", name: "Iced latte", soldOut: true }),
  item({ id: "3", name: "Croissant", categoryId: "food", soldOut: true }),
  item({ id: "4", name: "Halloumi sandwich", categoryId: "food" }),
  item({ id: "5", name: "Old muffin", categoryId: "food", archivedAt: "2026-11-01T10:00:00.000Z" }),
];

describe("soldOutView", () => {
  it("never shows archived items, whatever the filter", () => {
    const view = soldOutView(items, "all", "");
    expect(view.items.map((i) => i.id)).toEqual(["1", "2", "3", "4"]);
    expect(soldOutView(items, "food", "muffin").items).toEqual([]);
  });

  it("keeps only the selected category", () => {
    expect(soldOutView(items, "food", "").items.map((i) => i.id)).toEqual(["3", "4"]);
  });

  it("matches the search anywhere in the name, ignoring case and spaces around it", () => {
    expect(soldOutView(items, "all", "  LAT ").items.map((i) => i.id)).toEqual(["2"]);
    expect(soldOutView(items, "all", "sand").items.map((i) => i.id)).toEqual(["4"]);
  });

  it("combines the category and the search", () => {
    expect(soldOutView(items, "coffee", "croissant").items).toEqual([]);
    expect(soldOutView(items, "food", "croissant").items.map((i) => i.id)).toEqual(["3"]);
  });

  it("counts sold-out items across the whole menu, not just what is shown", () => {
    expect(soldOutView(items, "coffee", "espresso").soldOutCount).toBe(2);
  });

  it("does not count an archived item that is still flagged sold out", () => {
    const withArchived = [...items, item({ id: "6", name: "Gone", soldOut: true, archivedAt: "2026-11-01T10:00:00.000Z" })];
    expect(soldOutView(withArchived, "all", "").soldOutCount).toBe(2);
  });
});

describe("applySoldOut", () => {
  it("flips only the given item and leaves the list it was given untouched", () => {
    const next = applySoldOut(items, "1", true);
    expect(next.find((i) => i.id === "1")?.soldOut).toBe(true);
    expect(items.find((i) => i.id === "1")?.soldOut).toBe(false);
    expect(next.filter((i) => i.soldOut).map((i) => i.id)).toEqual(["1", "2", "3"]);
  });
});
