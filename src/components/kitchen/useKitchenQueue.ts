"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyStatus, type KitchenStatus, type KitchenTicket } from "@/utils/kitchenQueue";
import { kitchenApi } from "./kitchenApi";

// How often the kitchen re-reads the queue, so a round a guest just sent shows up.
const REFRESH_MS = 5_000;

// The tickets still to cook, refreshed while the screen is visible. A failed refresh keeps the last queue on
// screen and says so (`stale`). The clock ticks on its own, so waiting times keep counting even offline.
export function useKitchenQueue() {
  const [tickets, setTickets] = useState<KitchenTicket[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Only the newest request may answer, so a slow old one can't put a ticket back after a tap.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const next = await kitchenApi.queue();
      if (request !== latest.current) return;
      setTickets(next);
      setUpdatedAt(Date.now());
      setStale(false);
    } catch {
      if (request !== latest.current) return;
      setStale(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    // A hidden tab or a sleeping tablet doesn't need fresh data; we catch up when it's visible again.
    if (document.visibilityState !== "visible") return;
    await load();
  }, [load]);

  // After a tap succeeded: show it at once (started stays in place, ready leaves), and drop any refresh
  // that was already on its way with the old status.
  const apply = useCallback((orderId: string, status: KitchenStatus | "READY") => {
    latest.current++;
    setTickets((current) => (current ? applyStatus(current, orderId, status) : current));
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, []);

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

  return { tickets, now, updatedAt, stale, refresh: load, apply };
}
