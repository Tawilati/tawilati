"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PublicMenu, PublicMenuItem } from "@/types/Menu";
import { addToCart, cartSummary, cartToOrderLines, subtractLines, type CartLine } from "@/utils/guestCart";
import { submitCart, type SubmitAttempt, type SubmitOutcome, type TokenStore } from "./guestOrderApi";

// sessionStorage, per table: the cart survives a reload or a locked phone. The unanswered attempt
// is saved too, so even a reload can't turn a lost answer into a second kitchen ticket.
type Saved = { lines: CartLine[]; attempt: SubmitAttempt | null };
const EMPTY: Saved = { lines: [], attempt: null };

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function parseSaved(raw: string | null): Saved {
  if (!raw) return EMPTY;
  try {
    return JSON.parse(raw) as Saved;
  } catch {
    return EMPTY;
  }
}

function tokenStore(qrToken: string): TokenStore {
  const key = `tawilati:guest:${qrToken}`;
  return {
    get: () => sessionStorage.getItem(key),
    set: (token) => sessionStorage.setItem(key, token),
    clear: () => sessionStorage.removeItem(key),
  };
}

export function useGuestCart(menu: PublicMenu, qrToken: string) {
  const storageKey = `tawilati:cart:${qrToken}`;
  // The server renders an empty cart; the saved one appears right after the page loads.
  const raw = useSyncExternalStore(
    subscribe,
    () => sessionStorage.getItem(storageKey),
    () => null,
  );
  const saved = useMemo(() => parseSaved(raw), [raw]);
  const summary = useMemo(() => cartSummary(saved.lines, menu), [saved.lines, menu]);

  const [submitting, setSubmitting] = useState(false);
  // Blocks a second tap before React has re-rendered the button as busy.
  const inFlight = useRef(false);

  const save = useCallback(
    (update: (current: Saved) => Saved) => {
      sessionStorage.setItem(storageKey, JSON.stringify(update(parseSaved(sessionStorage.getItem(storageKey)))));
      listeners.forEach((listener) => listener());
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
      const current = parseSaved(sessionStorage.getItem(storageKey));
      const lines = cartToOrderLines(current.lines);
      const attempt = current.attempt ?? { key: crypto.randomUUID(), lines };
      save((state) => ({ ...state, attempt }));

      const outcome = await submitCart({ qrToken, lines, attempt, tokens: tokenStore(qrToken) });

      if (outcome.kind === "sent") {
        save((state) => ({ lines: subtractLines(state.lines, outcome.sentLines), attempt: null }));
      } else if (outcome.kind !== "failed" || !outcome.keepAttempt) {
        save((state) => ({ ...state, attempt: null }));
      }
      return outcome;
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, [qrToken, save, storageKey]);

  return { lines: saved.lines, summary, submitting, change, submit };
}
