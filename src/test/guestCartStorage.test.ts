import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSaved, readStored, writeStored } from "@/components/menu/guestCartStorage";

afterEach(() => vi.unstubAllGlobals());

describe("saved guest cart", () => {
  it.each(["null", "{}", "[]", '{"lines":null}', '{"lines":[{"menuItemId":"x","name":"X","qty":-1}],"attempt":null}', "not json"])("recovers safely from invalid storage: %s", (raw) => {
    expect(parseSaved(raw)).toEqual({ lines: [], attempt: null, closed: false });
  });
  it("keeps the frozen attempt and closed state across a reload", () => {
    const saved = { lines: [{ menuItemId: "x", name: "X", qty: 2 }], attempt: { key: "retry-key", lines: [{ menuItemId: "x", qty: 1 }] }, closed: true };
    expect(parseSaved(JSON.stringify(saved))).toEqual(saved);
  });
  it("supports carts saved before the closed flag was added", () => {
    expect(parseSaved('{"lines":[],"attempt":null}')).toEqual({ lines: [], attempt: null, closed: false });
  });
  it("keeps cart edits in memory when storage is blocked, but reports that they are not persisted", () => {
    vi.stubGlobal("sessionStorage", { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
    expect(writeStored("blocked-cart", "draft")).toBe(false);
    expect(readStored("blocked-cart")).toBe("draft");
  });
  it("uses the in-memory edit when reading still works but storage quota prevents writing", () => {
    vi.stubGlobal("sessionStorage", { getItem: () => "old cart", setItem() { throw new Error("quota"); } });
    expect(writeStored("quota-cart", "new cart")).toBe(false);
    expect(readStored("quota-cart")).toBe("new cart");
  });
});
