"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGuestBill, type GuestBill } from "./guestOrderApi";
import { tokenStore } from "./guestCartStorage";

// How often the phone re-checks its orders, so a status change in the kitchen reaches the table.
const REFRESH_MS = 10_000;

// This phone's orders and the table's bill. An expired token is renewed while the tab is open. Once the
// bill has closed or the server no longer knows the token, polling stops and keeps the last answer.
export function useGuestOrders(qrToken: string) {
  const [bill, setBill] = useState<GuestBill | null>(null);
  const [revoked, setRevoked] = useState(false);
  const stopped = useRef(false);
  // Only the newest request may answer, so a slow old one can't put an older status back on screen.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const token = tokenStore(qrToken).get();
    if (!token) return;
    const request = ++latest.current;
    const result = await fetchGuestBill(token);
    if (request !== latest.current) return;

    if (result.kind === "bill") {
      setBill(result.bill);
      if (result.bill.status === "CLOSED") stopped.current = true;
    } else if (result.kind === "closed") {
      setRevoked(true);
      stopped.current = true;
      // This tab is over: after a reload, this phone starts fresh rather than stay on a closed bill.
      tokenStore(qrToken).clear();
    } else if (result.kind === "expired") {
      stopped.current = true;
    }
  }, [qrToken]);

  const refresh = useCallback(async () => {
    // A hidden tab or a locked phone doesn't need fresh data; we catch up when it's visible again.
    if (stopped.current || document.visibilityState !== "visible") return;
    await load();
  }, [load]);

  // After an order: the token may be new, so polling starts again.
  const restart = useCallback(() => {
    stopped.current = false;
    setRevoked(false);
    void load();
  }, [load]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return { bill, closed: revoked || bill?.status === "CLOSED", restart };
}
