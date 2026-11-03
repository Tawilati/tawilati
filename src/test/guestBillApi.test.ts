import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGuestBill } from "@/components/menu/guestOrderApi";

const bill = {
  sessionId: "s1",
  tableLabel: "T1",
  status: "OPEN",
  totalUSD: "39.50",
  totalLBP: "3515500.00",
  guestTotalUSD: "24.50",
  guestTotalLBP: "2180500.00",
  orders: [{
    orderId: "o1",
    status: "PREPARING",
    totalUSD: "24.50",
    totalLBP: "2180500.00",
    createdAt: "2026-11-02T12:00:00.000Z",
    lines: [{ menuItemId: "esp", name: "Espresso", qty: 2, priceUSD: "2.50", priceLBP: "222500.00" }],
  }],
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("fetchGuestBill", () => {
  it("asks for the bill with this phone's token, never from a cache", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, data: bill }));

    await fetchGuestBill("guest-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orders/me");
    expect(init.headers.Authorization).toBe("Bearer guest-1");
    expect(init.cache).toBe("no-store");
  });

  it("returns the bill", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, data: bill }));

    expect(await fetchGuestBill("guest-1")).toEqual({ kind: "bill", bill });
  });

  describe("when the token has expired", () => {
    const expired = () => reply(401, { success: false, message: "token_expired" });

    it("renews it and asks for the bill again with the same token", async () => {
      fetchMock
        .mockResolvedValueOnce(expired())
        .mockResolvedValueOnce(reply(200, { success: true, data: { token: "guest-1" } }))
        .mockResolvedValueOnce(reply(200, { success: true, data: bill }));

      expect(await fetchGuestBill("guest-1")).toEqual({ kind: "bill", bill });
      expect(fetchMock.mock.calls[1][0]).toBe("/api/guest-sessions/renew");
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer guest-1");
      expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe("Bearer guest-1");
    });

    it("reports a closed bill and doesn't open a guest session when the tab has closed", async () => {
      fetchMock.mockResolvedValueOnce(expired()).mockResolvedValueOnce(reply(409, { success: false, message: "table_session_closed" }));

      expect(await fetchGuestBill("guest-1")).toEqual({ kind: "closed" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("reports a closed bill when the session was revoked meanwhile", async () => {
      fetchMock.mockResolvedValueOnce(expired()).mockResolvedValueOnce(reply(401, { success: false, message: "guest_session_revoked" }));

      expect(await fetchGuestBill("guest-1")).toEqual({ kind: "closed" });
    });

    it("stops when the server doesn't know the token", async () => {
      fetchMock.mockResolvedValueOnce(expired()).mockResolvedValueOnce(reply(401, { success: false, message: "unauthorized" }));

      expect(await fetchGuestBill("guest-1")).toEqual({ kind: "expired" });
    });

    it("is unavailable when the renewal can't reach the server, so the next check tries again", async () => {
      fetchMock.mockResolvedValueOnce(expired()).mockRejectedValueOnce(new TypeError("offline"));

      expect(await fetchGuestBill("guest-1")).toEqual({ kind: "unavailable" });
    });

    it("doesn't loop if the token still counts as expired after renewing", async () => {
      fetchMock
        .mockResolvedValueOnce(expired())
        .mockResolvedValueOnce(reply(200, { success: true, data: {} }))
        .mockResolvedValueOnce(expired());

      expect(await fetchGuestBill("guest-1")).toEqual({ kind: "expired" });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  it("treats an unknown token like an expired one", async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { success: false, message: "unauthorized" }));

    expect(await fetchGuestBill("guest-1")).toEqual({ kind: "expired" });
  });

  it("reports a closed bill when the session was revoked", async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { success: false, message: "guest_session_revoked" }));

    expect(await fetchGuestBill("guest-1")).toEqual({ kind: "closed" });
  });

  it("is unavailable when the server fails", async () => {
    fetchMock.mockResolvedValueOnce(reply(500, { success: false, message: "database_error" }));

    expect(await fetchGuestBill("guest-1")).toEqual({ kind: "unavailable" });
  });

  it("is unavailable when the phone is offline", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));

    expect(await fetchGuestBill("guest-1")).toEqual({ kind: "unavailable" });
  });

  it("is unavailable when the answer isn't a bill", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, data: { ...bill, totalUSD: 39.5 } }));

    expect(await fetchGuestBill("guest-1")).toEqual({ kind: "unavailable" });
  });
});
