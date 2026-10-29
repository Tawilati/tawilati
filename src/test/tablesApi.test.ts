import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/components/dashboard/api";
import { downloadSticker, stickerUrl, tableSentenceFor } from "@/components/dashboard/tables/tablesApi";

describe("downloadSticker", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("saves the PNG as tawilati-<slug>.png and frees it only after the browser has started the download", async () => {
    vi.useFakeTimers();
    const link = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: vi.fn(() => link) });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["png"], { type: "image/png" }))));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:sticker");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    await downloadSticker({ id: "t-1", label: "T1", slug: "t1", isDisabled: false, createdAt: "" });

    expect(link).toMatchObject({ href: "blob:sticker", download: "tawilati-t1.png" });
    expect(link.click).toHaveBeenCalledOnce();
    // Safari reads the file after click() returns; freeing it at once can leave an empty download.
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:sticker");
  });
});

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
