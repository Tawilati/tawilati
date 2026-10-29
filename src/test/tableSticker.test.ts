import { describe, expect, it } from "vitest";
import { renderTableSticker, STICKER_HEIGHT, STICKER_WIDTH, tableLine } from "@/lib/tableSticker";

describe("table sticker", () => {
  it("draws a 900 x 1200 PNG", async () => {
    const image = await renderTableSticker(
      { label: "T1", businessName: "Tawilati Demo Café", menuPath: "/menu/tawilati-demo-cafe/t1?t=abc" },
      "http://localhost:3000/menu/tawilati-demo-cafe/t1?t=abc",
    );
    const png = Buffer.from(await image.arrayBuffer());

    expect(image.headers.get("content-type")).toBe("image/png");
    // PNG signature, then the IHDR chunk's width and height.
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(STICKER_WIDTH);
    expect(png.readUInt32BE(20)).toBe(STICKER_HEIGHT);
  }, 20_000);

  it.each([
    // Short codes get "Table" in front.
    ["T1", "Table T1"],
    ["12", "Table 12"],
    ["A3", "Table A3"],
    ["T-4", "Table T-4"],
    // Names that are already words are shown as they are.
    ["Terrace 2", "Terrace 2"],
    ["Bar 2", "Bar 2"],
    ["VIP", "VIP"],
    ["Window seat", "Window seat"],
    ["Table 4", "Table 4"],
    ["table 4", "table 4"],
    ["طاولة ٣", "طاولة ٣"],
  ])("shows %s as %s", (label, line) => {
    expect(tableLine(label)).toBe(line);
  });
});
