"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PublicMenu, PublicMenuItem } from "@/types/Menu";
import { addToCart, cartSummary, cartToOrderLines, subtractLines } from "@/utils/guestCart";
import { submitCart, type SubmitOutcome, type TokenStore } from "./guestOrderApi";
import { parseSaved, readStored, writeStored, type SavedCart } from "./guestCartStorage";

// sessionStorage, per table: the cart survives a reload or a locked phone. The unanswered attempt
// is saved too, so even a reload can't turn a lost answer into a second kitchen ticket.

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function tokenStore(qrToken: string): TokenStore {
  const key = `tawilati:guest:${qrToken}`;
  return {
    get: () => readStored(key) || null,
    set: (token) => { if (!writeStored(key, token)) throw new Error("storage_unavailable"); },
    clear: () => { writeStored(key, ""); },
  };
}

export function useGuestCart(menu: PublicMenu, qrToken: string) {
  const storageKey = `tawilati:cart:${qrToken}`;
  // The server renders an empty cart; the saved one appears right after the page loads.
  const raw = useSyncExternalStore(
    subscribe,
    () => readStored(storageKey),
    () => null,
  );
  const saved = useMemo(() => parseSaved(raw), [raw]);
  const summary = useMemo(() => cartSummary(saved.lines, menu), [saved.lines, menu]);

  const [submitting, setSubmitting] = useState(false);
  // Blocks a second tap before React has re-rendered the button as busy.
  const inFlight = useRef(false);

  const save = useCallback(
    (update: (current: SavedCart) => SavedCart) => {
      const persisted = writeStored(storageKey, JSON.stringify(update(parseSaved(readStored(storageKey)))));
      listeners.forEach((listener) => listener());
      return persisted;
    },
    [storageKey],
  );

  const change = useCallback(
    (item: Pick<PublicMenuItem, "id" | "name">, delta: number) => {
      if (inFlight.current) return;
      save((current) => ({ ...current, lines: addToCart(current.lines, item, delta) }));
    },
    [save],
  );

  const submit = useCallback(async (): Promise<SubmitOutcome | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const current = parseSaved(readStored(storageKey));
      if (current.closed) return { kind: "tab_closed" };
      if (summary.blocked || current.lines.length === 0) return { kind: "blocked" };
      const lines = cartToOrderLines(current.lines);
      const attempt = current.attempt ?? { key: crypto.randomUUID(), lines };
      if (!save((state) => ({ ...state, attempt }))) {
        return { kind: "failed", keepAttempt: true, reason: "storage_unavailable" };
      }

      const outcome = await submitCart({ qrToken, lines, attempt, tokens: tokenStore(qrToken) });

      if (outcome.kind === "sent") {
        save((state) => ({ ...state, lines: subtractLines(state.lines, outcome.sentLines), attempt: null }));
      } else if (outcome.kind === "tab_closed") {
        save((state) => ({ ...state, closed: true }));
      } else if (outcome.kind !== "failed" || !outcome.keepAttempt) {
        save((state) => ({ ...state, attempt: null }));
      }
      return outcome;
    } catch {
      return { kind: "failed", keepAttempt: true };
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, [qrToken, save, storageKey, summary.blocked]);

  return { lines: saved.lines, summary, submitting, closed: saved.closed, change, submit };
}
