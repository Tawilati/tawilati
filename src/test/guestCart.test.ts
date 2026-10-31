import { describe, expect, it } from "vitest";
import type { PublicMenu } from "@/types/Menu";
import { addToCart, cartQty, cartSummary, cartToOrderLines, minorToAmount, subtractLines, toMinor } from "@/utils/guestCart";

const espresso = { id: "esp", name: "Espresso", priceUSD: "2.50", priceLBP: "223750", soldOut: false };
const tea = { id: "tea", name: "Tea", priceUSD: "0.10", priceLBP: "8950", soldOut: false };
const latte = { id: "lat", name: "Iced latte", priceUSD: "4.00", priceLBP: "358000", soldOut: true };

const menu: PublicMenu = {
  business: { id: "b", name: "Café", slug: "cafe" },
  table: { id: "t", label: "T1", slug: "t1" },
  categories: [{ id: "c", name: "Coffee", items: [espresso, tea, latte] }],
};

describe("addToCart", () => {
  it("allows changing existing quantities at the 50-item limit but refuses a 51st item", () => {
    const full = Array.from({ length: 50 }, (_, i) => ({ menuItemId: `item-${i}`, name: `Item ${i}`, qty: 1 }));
    expect(addToCart(full, { id: "extra", name: "Extra" }, 1)).toEqual(full);
    expect(cartQty(addToCart(full, { id: "item-0", name: "Item 0" }, 1), "item-0")).toBe(2);
  });
  it("adds a new line, then counts up", () => {
    const once = addToCart([], espresso, 1);
    expect(once).toEqual([{ menuItemId: "esp", name: "Espresso", qty: 1 }]);
    expect(cartQty(addToCart(once, espresso, 1), "esp")).toBe(2);
  });

  it("removes the line when it reaches 0", () => {
    expect(addToCart([{ menuItemId: "esp", name: "Espresso", qty: 1 }], espresso, -1)).toEqual([]);
  });

  it("never goes past 99", () => {
    expect(cartQty(addToCart([{ menuItemId: "esp", name: "Espresso", qty: 99 }], espresso, 1), "esp")).toBe(99);
  });

  it("ignores taking away an item that isn't in the cart", () => {
    expect(addToCart([], espresso, -1)).toEqual([]);
  });
});

describe("money", () => {
  it("reads amounts into minor units without floats", () => {
    expect(toMinor("2.50")).toBe(250);
    expect(toMinor("223750")).toBe(22375000);
    expect(toMinor("0.1")).toBe(10);
  });

  it("writes minor units back as an amount", () => {
    expect(minorToAmount(30)).toBe("0.30");
    expect(minorToAmount(1234567)).toBe("12345.67");
    expect(minorToAmount(5)).toBe("0.05");
  });
});

describe("cartSummary", () => {
  it("totals USD and LBP, with no float drift on 3 × $0.10", () => {
    const summary = cartSummary([{ menuItemId: "tea", name: "Tea", qty: 3 }], menu);
    expect(summary.totalUSD).toBe("0.30");
    expect(summary.totalLBP).toBe("26850.00");
    expect(summary.count).toBe(3);
    expect(summary.blocked).toBe(false);
  });

  it("uses the current menu's name and price", () => {
    const [row] = cartSummary([{ menuItemId: "esp", name: "Old name", qty: 2 }], menu).rows;
    expect(row).toMatchObject({ name: "Espresso", state: "available", priceUSD: "2.50", lineUSD: "5.00" });
  });

  it("blocks on a sold-out item and leaves it out of the total", () => {
    const summary = cartSummary(
      [
        { menuItemId: "esp", name: "Espresso", qty: 1 },
        { menuItemId: "lat", name: "Iced latte", qty: 1 },
      ],
      menu,
    );
    expect(summary.blocked).toBe(true);
    expect(summary.rows[1].state).toBe("sold_out");
    expect(summary.totalUSD).toBe("2.50");
  });

  it("keeps the saved name for an item that left the menu, and blocks", () => {
    const summary = cartSummary([{ menuItemId: "gone", name: "Old cake", qty: 2 }], menu);
    expect(summary.rows[0]).toMatchObject({ name: "Old cake", state: "missing" });
    expect(summary.blocked).toBe(true);
    expect(summary.totalUSD).toBe("0.00");
  });
});

describe("cartToOrderLines", () => {
  it("sends only the id and quantity", () => {
    expect(cartToOrderLines([{ menuItemId: "esp", name: "Espresso", qty: 2 }])).toEqual([{ menuItemId: "esp", qty: 2 }]);
  });
});

describe("subtractLines", () => {
  it("empties the cart when everything went out", () => {
    expect(subtractLines([{ menuItemId: "esp", name: "Espresso", qty: 2 }], [{ menuItemId: "esp", qty: 2 }])).toEqual([]);
  });

  it("keeps what was added after the order was sent", () => {
    const left = subtractLines(
      [
        { menuItemId: "esp", name: "Espresso", qty: 3 },
        { menuItemId: "tea", name: "Tea", qty: 1 },
      ],
      [{ menuItemId: "esp", qty: 2 }],
    );
    expect(left).toEqual([
      { menuItemId: "esp", name: "Espresso", qty: 1 },
      { menuItemId: "tea", name: "Tea", qty: 1 },
    ]);
  });
});
