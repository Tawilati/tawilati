import { describe, expect, it } from "vitest";
import { ApiError } from "@/components/dashboard/api";
import { stickerUrl, tableSentenceFor } from "@/components/dashboard/tables/tablesApi";

describe("tables screen", () => {
  it.each(["table_label_exists", "label_already_taken"])("says the name is taken for %s, never the code", (code) => {
    const sentence = tableSentenceFor(new ApiError(code, 409));

    expect(sentence).toBe("You already have a table with this name. Pick another one.");
  });

  it("falls back to a general sentence for an unknown code", () => {
    expect(tableSentenceFor(new ApiError("database_error", 500))).toBe(
      "Something went wrong on our side. Please try again in a moment.",
    );
    expect(tableSentenceFor(new Error("boom"))).toBe("Something went wrong on our side. Please try again in a moment.");
  });

  it("asks for a new sticker after a rename, since the label is in the address", () => {
    expect(stickerUrl({ id: "t-1", label: "Terrace 2" })).toBe("/api/tables/t-1/qr?v=Terrace%202");
  });
});
