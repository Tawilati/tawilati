"use client";

import { useEffect, useRef } from "react";
import { fetchApproval, type Approval } from "./guestOrderApi";
import { tokenStore } from "./guestCartStorage";

// How often a phone waiting for the waiter asks whether it was confirmed.
const CHECK_MS = 3_000;

// While `waiting` isn't null, asks every few seconds whether a waiter has confirmed this phone, and reports the
// first final answer: "active" (send the order now), "rejected" or "gone" (the tab closed, or the token is
// unknown). A new `waiting` number starts a fresh wait. A failed check just waits for the next one. Like the
// other polls, it pauses while the page is hidden.
export function useGuestApproval(
  qrToken: string,
  waiting: number | null,
  onAnswer: (answer: Exclude<Approval, "pending" | "unavailable">) => void,
) {
  const answer = useRef(onAnswer);
  useEffect(() => {
    answer.current = onAnswer;
  }, [onAnswer]);

  useEffect(() => {
    if (waiting === null) return;
    let busy = false;
    let done = false;

    const check = async () => {
      if (busy || done || document.visibilityState !== "visible") return;
      const token = tokenStore(qrToken).get();
      busy = true;
      const result = token ? await fetchApproval(token) : "gone";
      busy = false;
      if (done || result === "pending" || result === "unavailable") return;
      done = true;
      answer.current(result);
    };

    const first = setTimeout(check, 0);
    const timer = setInterval(check, CHECK_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      done = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [qrToken, waiting]);
}
