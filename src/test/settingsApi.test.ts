import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/components/dashboard/api";
import {
  formatRate,
  normaliseRate,
  parseRate,
  rateHint,
  settingsApi,
  settingsSentenceFor,
  timezoneLabel,
} from "@/components/dashboard/settings/settingsApi";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const business = { id: "b1", name: "Demo Cafe", exchangeRate: "89500", timezone: "Asia/Beirut" };

describe("settings API calls", () => {
  it("reads the business from GET /api/business", async () => {
    const fetchMock = stubFetch(200, { success: true, message: "business settings", data: business });
    await expect(settingsApi.get()).resolves.toEqual(business);
    expect(fetchMock).toHaveBeenCalledWith("/api/business", expect.objectContaining({ method: "GET" }));
  });

  it("sends only the rate, as a string, with PATCH /api/business", async () => {
    const fetchMock = stubFetch(200, { success: true, message: "business updated", data: { ...business, exchangeRate: "90000.5" } });
    await settingsApi.setExchangeRate("90000.5");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/business");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PATCH" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ exchangeRate: "90000.5" });
  });

  it("sends only the timezone with PATCH /api/business", async () => {
    const fetchMock = stubFetch(200, { success: true, message: "business updated", data: { ...business, timezone: "UTC" } });
    await settingsApi.setTimezone("UTC");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ timezone: "UTC" });
  });

  it("surfaces the contract code of a failure", async () => {
    stubFetch(400, { success: false, message: "invalid_exchange_rate" });
    await expect(settingsApi.setExchangeRate("999999")).rejects.toMatchObject({ code: "invalid_exchange_rate", status: 400 });
  });
});

describe("exchange rate input", () => {
  it.each([
    ["89500", "89500"],
    ["89,500", "89500"],
    [" 89 500 ", "89500"],
    ["89500.5", "89500.5"],
    ["89500.1234", "89500.1234"],
    ["089500.50", "89500.5"],
    ["0.5", "0.5"],
  ])("accepts %j as %j", (text, rate) => {
    expect(parseRate(text)).toBe(rate);
    expect(rateHint(text)).toBeUndefined();
  });

  it.each(["", "abc", "0", "0.0000", "1000000", "89500.12345", "-1", "1e5", "."])("refuses %j", (text) => {
    expect(parseRate(text)).toBeNull();
  });

  it("explains what is wrong, and says nothing while the field is empty", () => {
    expect(rateHint("")).toBeUndefined();
    expect(rateHint("abc")).toMatch(/numbers only/);
    expect(rateHint("89500.12345")).toMatch(/four decimals/);
    expect(rateHint("0")).toMatch(/more than 0/);
    expect(rateHint("1000000")).toMatch(/below 1,000,000/);
  });
});

describe("rate display", () => {
  it.each([
    ["89500", "89,500"],
    ["890000", "890,000"],
    ["89500.5000", "89,500.5"],
    ["1500.25", "1,500.25"],
    ["0.5", "0.5"],
  ])("%s → %s", (rate, shown) => {
    expect(formatRate(rate)).toBe(shown);
  });

  it("normalises so an unchanged rate compares equal", () => {
    expect(normaliseRate("89500.0000")).toBe("89500");
    expect(normaliseRate("89500")).toBe(parseRate("89,500.00"));
  });

  it("labels timezones by city", () => {
    expect(timezoneLabel("Asia/Beirut")).toBe("Beirut");
    expect(timezoneLabel("Mars/Olympus")).toBe("Mars/Olympus");
  });
});

describe("settings wording", () => {
  it("turns codes into sentences and never shows the code", () => {
    const sentence = settingsSentenceFor(new ApiError("invalid_exchange_rate", 400));
    expect(sentence).toMatch(/too high/);
    expect(sentence).not.toMatch(/invalid_exchange_rate/);
    expect(settingsSentenceFor(new ApiError("forbidden", 403))).toMatch(/owner/);
    expect(settingsSentenceFor(new ApiError("weird", 500))).toMatch(/went wrong/);
  });
});
