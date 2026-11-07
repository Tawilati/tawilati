import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askForBill, cancelRound, fetchGuestBill, fetchSplit } from "@/components/menu/guestOrderApi";

const bill = {
  sessionId: "s1",
  tableLabel: "T1",
  status: "OPEN",
  totalUSD: "39.50",
  totalLBP: "3515500.00",
  guestTotalUSD: "24.50",
  guestTotalLBP: "2180500.00",
  billRequestedAt: null,
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

describe("askForBill", () => {
  const asked = () => reply(200, { success: true, data: { billRequestedAt: "2026-11-03T12:00:00.000Z" } });

  it("posts to the bill request with this phone's token", async () => {
    fetchMock.mockResolvedValueOnce(asked());

    expect(await askForBill("guest-1")).toEqual({ kind: "asked" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orders/me/bill-request");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer guest-1");
  });

  it("renews an expired token and asks once more", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401, { success: false, message: "token_expired" }))
      .mockResolvedValueOnce(reply(200, { success: true, data: { token: "guest-1" } }))
      .mockResolvedValueOnce(asked());

    expect(await askForBill("guest-1")).toEqual({ kind: "asked" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/guest-sessions/renew");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each(["table_session_closed", "guest_session_revoked"])("reports a closed bill on %s", async (code) => {
    fetchMock.mockResolvedValueOnce(reply(code === "table_session_closed" ? 409 : 401, { success: false, message: code }));

    expect(await askForBill("guest-1")).toEqual({ kind: "closed" });
  });

  it("stops when the server doesn't know the token", async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { success: false, message: "unauthorized" }));

    expect(await askForBill("guest-1")).toEqual({ kind: "expired" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable when the server can't be reached", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));

    expect(await askForBill("guest-1")).toEqual({ kind: "unavailable" });
  });
});

describe("fetchSplit", () => {
  const split = {
    sessionId: "s1", tableLabel: "T1", totalUSD: "5.00", totalLBP: "447500.00",
    splitCount: 3, perPersonUSD: "1.67", perPersonLBP: "149166.67",
  };
  const answered = () => reply(200, { success: true, message: "bill split", data: split });
  // The phone keeps only what it shows.
  const shown = { totalUSD: "5.00", totalLBP: "447500.00", splitCount: 3, perPersonUSD: "1.67", perPersonLBP: "149166.67" };

  it("posts the number of people with this phone's token", async () => {
    fetchMock.mockResolvedValueOnce(answered());

    expect(await fetchSplit("guest-1", 3)).toEqual({ kind: "split", split: shown });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/orders/split");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer guest-1");
    expect(JSON.parse(init.body)).toEqual({ splitCount: 3 });
  });

  it("renews an expired token and asks once more", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(401, { success: false, message: "token_expired" }))
      .mockResolvedValueOnce(reply(200, { success: true, data: { token: "guest-1" } }))
      .mockResolvedValueOnce(answered());

    expect(await fetchSplit("guest-1", 3)).toEqual({ kind: "split", split: shown });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/guest-sessions/renew");
  });

  it.each(["table_session_closed", "guest_session_revoked"])("reports a closed bill on %s", async (code) => {
    fetchMock.mockResolvedValueOnce(reply(code === "table_session_closed" ? 409 : 401, { success: false, message: code }));

    expect(await fetchSplit("guest-1", 3)).toEqual({ kind: "closed" });
  });

  it("stops when the server doesn't know the token", async () => {
    fetchMock.mockResolvedValueOnce(reply(401, { success: false, message: "unauthorized" }));

    expect(await fetchSplit("guest-1", 3)).toEqual({ kind: "expired" });
  });

  it("is unavailable when the phone is offline", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));

    expect(await fetchSplit("guest-1", 3)).toEqual({ kind: "unavailable" });
  });

  it("is unavailable when the answer isn't a split", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { success: true, data: { ...split, perPersonUSD: 1.67 } }));

    expect(await fetchSplit("guest-1", 3)).toEqual({ kind: "unavailable" });
  });
});

describe("cancelRound", () => {
  const ORDER = "f0000000-0000-4000-8000-000000000001";
  const done = () => reply(200, { success: true, data: { orderId: ORDER, status: "CANCELLED" } });
  const refused = (status: number, message: string) => reply(status, { success: false, message });

  it("posts to this round's cancel with this phone's token", async () => {
    fetchMock.mockResolvedValueOnce(done());

    expect(await cancelRound("guest-1", ORDER)).toEqual({ kind: "cancelled" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/orders/${ORDER}/cancel`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer guest-1");
  });

  it("treats a round that was already cancelled (a double tap) as cancelled", async () => {
    fetchMock.mockResolvedValueOnce(refused(409, "order_already_cancelled"));
    expect(await cancelRound("guest-1", ORDER)).toEqual({ kind: "cancelled" });
  });

  it("says when the kitchen started it first", async () => {
    fetchMock.mockResolvedValueOnce(refused(409, "cannot_cancel_order_already_in_progress"));
    expect(await cancelRound("guest-1", ORDER)).toEqual({ kind: "started" });
  });

  it("says when the bill was closed", async () => {
    fetchMock.mockResolvedValueOnce(refused(409, "table_session_closed"));
    expect(await cancelRound("guest-1", ORDER)).toEqual({ kind: "closed" });
  });

  it("renews an expired token and cancels once more", async () => {
    fetchMock
      .mockResolvedValueOnce(refused(401, "token_expired"))
      .mockResolvedValueOnce(reply(200, { success: true, data: { token: "guest-1" } }))
      .mockResolvedValueOnce(done());

    expect(await cancelRound("guest-1", ORDER)).toEqual({ kind: "cancelled" });
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      `/api/orders/${ORDER}/cancel`,
      "/api/guest-sessions/renew",
      `/api/orders/${ORDER}/cancel`,
    ]);
  });

  it("reports an unreachable server or an unknown answer as unavailable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect(await cancelRound("guest-1", ORDER)).toEqual({ kind: "unavailable" });
    fetchMock.mockResolvedValueOnce(refused(404, "order_not_found"));
    expect(await cancelRound("guest-1", ORDER)).toEqual({ kind: "unavailable" });
  });
});
