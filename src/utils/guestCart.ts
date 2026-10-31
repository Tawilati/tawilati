// The guest's cart: pure logic, no React or storage. Money is added up in whole cents and
// piastres, never floats. The saved name only matters once an item has left the menu.
import type { PublicMenu, PublicMenuItem } from "@/types/Menu";

export const MAX_QTY = 99;

export type CartLine = { menuItemId: string; name: string; qty: number };
export type OrderLine = { menuItemId: string; qty: number };

export type CartRowState = "available" | "sold_out" | "missing";
export type CartRow = {
  menuItemId: string;
  name: string;
  qty: number;
  state: CartRowState;
  priceUSD: string | null;
  lineUSD: string | null;
};
export type CartSummary = {
  rows: CartRow[];
  count: number;
  totalUSD: string;
  totalLBP: string;
  blocked: boolean;
};

export function cartQty(cart: CartLine[], menuItemId: string): number {
  return cart.find((line) => line.menuItemId === menuItemId)?.qty ?? 0;
}

// A change by +1 or −1. Reaching 0 removes the line; the quantity never passes MAX_QTY.
export function addToCart(cart: CartLine[], item: Pick<PublicMenuItem, "id" | "name">, delta: number): CartLine[] {
  const current = cartQty(cart, item.id);
  const qty = Math.min(MAX_QTY, current + delta);
  if (qty <= 0) return cart.filter((line) => line.menuItemId !== item.id);
  if (current === 0) return [...cart, { menuItemId: item.id, name: item.name, qty }];
  return cart.map((line) => (line.menuItemId === item.id ? { ...line, qty } : line));
}

// "2.50" → 250. Split as a string, so no float touches the price.
export function toMinor(amount: string): number {
  const [whole, decimals = ""] = amount.split(".");
  return Number(whole) * 100 + Number(decimals.padEnd(2, "0").slice(0, 2));
}

// 250 → "2.50"
export function minorToAmount(minor: number): string {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

// Joins the cart with the current menu: prices come from the menu, and a sold-out or removed
// item stays visible but out of the total, and blocks the submit until the guest removes it.
export function cartSummary(cart: CartLine[], menu: PublicMenu): CartSummary {
  const items = new Map(menu.categories.flatMap((category) => category.items).map((item) => [item.id, item]));
  let usd = 0;
  let lbp = 0;

  const rows = cart.map((line): CartRow => {
    const item = items.get(line.menuItemId);
    if (!item) return { ...line, state: "missing", priceUSD: null, lineUSD: null };

    const lineUSD = toMinor(item.priceUSD) * line.qty;
    if (!item.soldOut) {
      usd += lineUSD;
      lbp += toMinor(item.priceLBP) * line.qty;
    }
    return {
      menuItemId: line.menuItemId,
      name: item.name,
      qty: line.qty,
      state: item.soldOut ? "sold_out" : "available",
      priceUSD: item.priceUSD,
      lineUSD: minorToAmount(lineUSD),
    };
  });

  return {
    rows,
    count: cart.reduce((sum, line) => sum + line.qty, 0),
    totalUSD: minorToAmount(usd),
    totalLBP: minorToAmount(lbp),
    blocked: rows.some((row) => row.state !== "available"),
  };
}

export function cartToOrderLines(cart: CartLine[]): OrderLine[] {
  return cart.map(({ menuItemId, qty }) => ({ menuItemId, qty }));
}

// After a submit: takes out what was sent, so anything added since stays for the next round.
export function subtractLines(cart: CartLine[], sent: OrderLine[]): CartLine[] {
  return cart
    .map((line) => {
      const sentQty = sent.find((s) => s.menuItemId === line.menuItemId)?.qty ?? 0;
      return { ...line, qty: line.qty - sentQty };
    })
    .filter((line) => line.qty > 0);
}
