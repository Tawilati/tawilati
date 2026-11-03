"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FloorTable, OpenTab } from "@/utils/waiterFloor";
import { waiterApi } from "./waiterApi";

// How often the waiter's screen re-reads the tables, so a new round or a guest asking for the bill shows up.
const REFRESH_MS = 5_000;
// The table list (names, disabled) changes rarely: re-read it every few refreshes only.
const TABLES_EVERY = 6;

// Open tabs and every table, refreshed while the screen is visible. A failed refresh keeps the last answer on
// screen and says so (`stale`); the next one tries again.
export function useWaiterFloor() {
  const [tables, setTables] = useState<FloorTable[] | null>(null);
  const [tabs, setTabs] = useState<OpenTab[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const round = useRef(0);
  // Only the newest request may answer, so a slow old one can't put an older state back on screen.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    const withTables = round.current++ % TABLES_EVERY === 0;
    try {
      const [nextTabs, nextTables] = await Promise.all([
        waiterApi.tabs(),
        withTables ? waiterApi.tables() : Promise.resolve(null),
      ]);
      if (request !== latest.current) return;
      setTabs(nextTabs);
      if (nextTables) setTables(nextTables);
      setUpdatedAt(Date.now());
      setNow(Date.now());
      setStale(false);
    } catch {
      if (request !== latest.current) return;
      // Read the table list again next time, in case that was the part that failed.
      round.current = 0;
      setStale(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    // A hidden tab or a locked tablet doesn't need fresh data; we catch up when it's visible again.
    if (document.visibilityState !== "visible") return;
    await load();
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

  return { tables, tabs, now, updatedAt, stale, refresh: load };
}
