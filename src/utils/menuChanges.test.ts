import { describe, expect, it } from "vitest";
import type { PublicMenu } from "@/service/MenuService";
import { newlySoldOut } from "./menuChanges";

function menu(items: { id: string; name: string; soldOut: boolean }[]): PublicMenu {
  return {
    business: { id: "b", name: "Café", slug: "cafe" },
    table: { id: "t", label: "T1", slug: "t1" },
    categories: [
      { id: "c", name: "Drinks", items: items.map((i) => ({ ...i, priceUSD: "1.00", priceLBP: "89500" })) },
    ],
  };
}

describe("newlySoldOut", () => {
  it("names items that were available and are now sold out", () => {
    const before = menu([
      { id: "1", name: "Lemonade", soldOut: false },
      { id: "2", name: "Iced latte", soldOut: true },
    ]);
    const after = menu([
      { id: "1", name: "Lemonade", soldOut: true },
      { id: "2", name: "Iced latte", soldOut: true },
    ]);

    expect(newlySoldOut(before, after)).toEqual(["Lemonade"]);
  });

  it("ignores items that come back, and items that are new", () => {
    const before = menu([{ id: "2", name: "Iced latte", soldOut: true }]);
    const after = menu([
      { id: "2", name: "Iced latte", soldOut: false },
      { id: "3", name: "Mint tea", soldOut: true },
    ]);

    expect(newlySoldOut(before, after)).toEqual([]);
  });
});
