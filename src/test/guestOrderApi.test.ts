import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitCart, type TokenStore } from "@/components/menu/guestOrderApi";

const QR = "a".repeat(64);
const lines = [{ menuItemId: "esp", qty: 2 }];
const attempt = { key: "key-1", lines };
const order = { orderId: "o1", tableLabel: "T1", status: "NEW", totalUSD: "5.00", totalLBP: "447500.00", lines: [] };

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}
const failure = (status: number, message: string) => reply(status, { success: false, message });
const orderOk = (status = 201) => reply(status, { success: true, data: order });
const sessionOk = (token = "guest-new") => reply(201, { success: true, data: { token } });

function tokenStore(initial: string | null = null): TokenStore & { value: string | null } {
  return {
    value: initial,
    get() {
      return this.value;
    },
    set(token) {
      this.value = token;
    },
    clear() {
      this.value = null;
    },
  };
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function call(index: number) {
  const [url, init] = fetchMock.mock.calls[index];
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body) };
}

describe("submitCart", () => {
  it("opens a guest session on the first submit, keeps the token and sends the order with it", async () => {
    fetchMock.mockResolvedValueOnce(sessionOk()).mockResolvedValueOnce(orderOk());
    const tokens = tokenStore();

    const outcome = await submitCart({ qrToken: QR, lines, attempt, tokens });

    expect(call(0).url).toBe("/api/guest-sessions");
    expect(call(0).body).toEqual({ qrToken: QR });
    expect(call(1).url).toBe("/api/orders");
    expect(call(1).headers.Authorization).toBe("Bearer guest-new");
    expect(call(1).headers["Idempotency-Key"]).toBe("key-1");
    expect(call(1).body).toEqual({ items: lines });
    expect(tokens.value).toBe("guest-new");
    expect(outcome).toMatchObject({ kind: "sent", sentLines: lines, earlierAttempt: false, order: { orderId: "o1" } });
  });

  it("reuses a saved token without opening another session", async () => {
    fetchMock.mockResolvedValueOnce(orderOk());
    await submitCart({ qrToken: QR, lines, attempt, tokens: tokenStore("guest-old") });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(call(0).headers.Authorization).toBe("Bearer guest-old");
  });

  it("treats a replay (200) as sent", async () => {
    fetchMock.mockResolvedValueOnce(orderOk(200));
    const outcome = await submitCart({ qrToken: QR, lines, attempt, tokens: tokenStore("guest") });
    expect(outcome.kind).toBe("sent");
  });

  it("renews an expired token once and retries with the same key", async () => {
    fetchMock
      .mockResolvedValueOnce(failure(401, "token_expired"))
      .mockResolvedValueOnce(sessionOk("guest-2"))
      .mockResolvedValueOnce(orderOk());
    const tokens = tokenStore("guest-1");

    const outcome = await submitCart({ qrToken: QR, lines, attempt, tokens });

    expect(outcome.kind).toBe("sent");
    expect(call(2).headers.Authorization).toBe("Bearer guest-2");
    expect(call(2).headers["Idempotency-Key"]).toBe("key-1");
    expect(tokens.value).toBe("guest-2");
  });

  it("gives up after a second 401 instead of looping", async () => {
    fetchMock
      .mockResolvedValueOnce(failure(401, "unauthorized"))
      .mockResolvedValueOnce(sessionOk())
      .mockResolvedValueOnce(failure(401, "unauthorized"));

    const outcome = await submitCart({ qrToken: QR, lines, attempt, tokens: tokenStore("guest") });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(outcome).toEqual({ kind: "failed", keepAttempt: true });
  });

  it.each(["guest_session_revoked", "table_session_closed"])("%s means the tab closed and the token is dropped", async (code) => {
    fetchMock.mockResolvedValueOnce(failure(code === "guest_session_revoked" ? 401 : 409, code));
    const tokens = tokenStore("guest");

    const outcome = await submitCart({ qrToken: QR, lines, attempt, tokens });

    expect(outcome.kind).toBe("tab_closed");
    expect(tokens.value).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["menu_item_sold_out", "menu_item_archived", "menu_item_not_found"])("%s blocks the cart", async (code) => {
    fetchMock.mockResolvedValueOnce(failure(409, code));
    const outcome = await submitCart({ qrToken: QR, lines, attempt, tokens: tokenStore("guest") });
    expect(outcome.kind).toBe("blocked");
  });

  it.each(["invalid_qr", "table_disabled"])("%s from the guest session stops the screen", async (code) => {
    fetchMock.mockResolvedValueOnce(failure(code === "invalid_qr" ? 404 : 409, code));
    const outcome = await submitCart({ qrToken: QR, lines, attempt, tokens: tokenStore() });
    expect(outcome).toEqual({ kind: "table_problem", problem: code });
  });

  it("keeps the attempt on a network failure, so the retry reuses the key", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const outcome = await submitCart({ qrToken: QR, lines, attempt, tokens: tokenStore("guest") });
    expect(outcome).toEqual({ kind: "failed", keepAttempt: true });
  });

  it("keeps the attempt on a server error", async () => {
    fetchMock.mockResolvedValueOnce(failure(500, "database_error"));
    const outcome = await submitCart({ qrToken: QR, lines, attempt, tokens: tokenStore("guest") });
    expect(outcome).toEqual({ kind: "failed", keepAttempt: true });
  });

  describe("the guest changed the cart after a submit whose answer was lost", () => {
    const edited = [{ menuItemId: "esp", qty: 3 }];

    it("sends the new cart under the same key: if the first never arrived, it goes through", async () => {
      fetchMock.mockResolvedValueOnce(orderOk());
      const outcome = await submitCart({ qrToken: QR, lines: edited, attempt, tokens: tokenStore("guest") });

      expect(call(0).headers["Idempotency-Key"]).toBe("key-1");
      expect(call(0).body).toEqual({ items: edited });
      expect(outcome).toMatchObject({ kind: "sent", sentLines: edited, earlierAttempt: false });
    });

    it("on a mismatch the first did arrive: fetches it with the original lines, sends nothing new", async () => {
      fetchMock.mockResolvedValueOnce(failure(409, "idempotency_key_mismatch")).mockResolvedValueOnce(orderOk(200));

      const outcome = await submitCart({ qrToken: QR, lines: edited, attempt, tokens: tokenStore("guest") });

      expect(call(1).headers["Idempotency-Key"]).toBe("key-1");
      expect(call(1).body).toEqual({ items: lines });
      expect(outcome).toMatchObject({ kind: "sent", sentLines: lines, earlierAttempt: true });
    });

    it("drops the attempt if the key still mismatches, so the guest isn't stuck", async () => {
      fetchMock
        .mockResolvedValueOnce(failure(409, "idempotency_key_mismatch"))
        .mockResolvedValueOnce(failure(409, "idempotency_key_mismatch"));

      const outcome = await submitCart({ qrToken: QR, lines: edited, attempt, tokens: tokenStore("guest") });

      expect(outcome).toEqual({ kind: "failed", keepAttempt: false });
    });
  });
});
