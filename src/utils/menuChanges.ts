import type { PublicMenu } from "@/types/Menu";

// Names of items that were available in `before` and are sold out in `after`,
// so the guest can be told what just changed on the menu they're reading.
export function newlySoldOut(before: PublicMenu, after: PublicMenu): string[] {
  const wasAvailable = new Set(
    before.categories.flatMap((c) => c.items.filter((i) => !i.soldOut).map((i) => i.id)),
  );
  return after.categories.flatMap((c) =>
    c.items.filter((i) => i.soldOut && wasAvailable.has(i.id)).map((i) => i.name),
  );
}
