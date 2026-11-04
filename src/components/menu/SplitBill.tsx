"use client";

import { useEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { otherPhonesUSD, unevenShare } from "@/utils/guestBill";
import { formatLBP, formatUSD } from "@/utils/money";
import type { BillSplit, GuestBill } from "./guestOrderApi";

const MIN_PEOPLE = 2;
const MAX_PEOPLE = 50;
// Taps closer together than this send one request, for the number the guest stopped on.
const WAIT_MS = 300;
const FAILED = "We couldn't work out the split. Please try again.";

type Mode = "equal" | "mine";

// Helps the table agree who pays what. Nothing is saved: the waiter still closes one bill for the table.
export function SplitBill({ bill, onSplit }: { bill: GuestBill; onSplit: (people: number) => Promise<BillSplit | null> }) {
  const [mode, setMode] = useState<Mode>("equal");
  const [people, setPeople] = useState(MIN_PEOPLE);
  const [split, setSplit] = useState<BillSplit | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  // Only the newest request may answer, so a slow old one can't put another count's share on screen.
  const latest = useRef(0);

  useEffect(() => {
    if (mode !== "equal") return;
    const request = ++latest.current;
    const timer = setTimeout(async () => {
      const answer = await onSplit(people);
      if (request !== latest.current) return;
      setFailed(!answer);
      if (answer) setSplit(answer);
    }, WAIT_MS);
    return () => clearTimeout(timer);
    // A new round changes the table total, so the share is asked for again.
  }, [mode, people, bill.totalUSD, retry, onSplit]);

  const shown = split?.splitCount === people && split.totalUSD === bill.totalUSD ? split : null;
  const odd = shown ? unevenShare(shown.totalUSD, shown.perPersonUSD, people) : null;

  return (
    <section aria-labelledby="split-title" className="flex flex-col gap-3 rounded-2xl bg-primary-tint p-3.5">
      <h3 id="split-title" className="text-[15px] font-semibold">Split the bill</h3>
      {/* A pill switch: the chosen way sits in a green pill on a white track. */}
      <div className="flex rounded-full bg-surface p-[3px]" role="group" aria-label="How to split">
        {(["equal", "mine"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            onClick={() => setMode(option)}
            className={`min-h-10 flex-1 cursor-pointer whitespace-nowrap rounded-full px-1.5 text-[12px] font-semibold transition-colors ${
              mode === option ? "bg-primary text-on-primary" : "text-ink"
            }`}
          >
            {option === "equal" ? "Split equally" : "Pay for my orders"}
          </button>
        ))}
      </div>

      {mode === "equal" ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm whitespace-nowrap">People paying</span>
            <div className="tw-stepper">
              <button type="button" className="tw-stepper__btn" aria-label="One person fewer" disabled={people <= MIN_PEOPLE} onClick={() => setPeople((n) => Math.max(MIN_PEOPLE, n - 1))}>
                <MinusIcon className="size-5" />
              </button>
              <span className="tw-stepper__value" aria-live="polite" aria-label={`${people} people paying`}>
                {people}
              </span>
              <button type="button" className="tw-stepper__btn" aria-label="One person more" disabled={people >= MAX_PEOPLE} onClick={() => setPeople((n) => Math.min(MAX_PEOPLE, n + 1))}>
                <PlusIcon className="size-5" />
              </button>
            </div>
          </div>
          <div aria-live="polite" className="flex flex-col gap-1">
            {failed ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">{FAILED}</p>
                <Button size="sm" variant="secondary" onClick={() => setRetry((n) => n + 1)}>
                  Try again
                </Button>
              </div>
            ) : (
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-ink-muted">Each person pays</span>
                <span className={`flex flex-col items-end tabular-nums ${shown ? "" : "opacity-50"}`}>
                  <span className="text-[22px] font-bold text-primary">{shown ? formatUSD(shown.perPersonUSD) : "…"}</span>
                  {shown && <span className="text-[13px] text-ink-muted">{formatLBP(shown.perPersonLBP)}</span>}
                </span>
              </div>
            )}
            {!failed && odd && (
              <p className="text-[13px] text-ink-muted">
                {odd.count === 1 ? "One person pays" : `${odd.count} people pay`} {formatUSD(odd.amountUSD)}, so it adds up to {formatUSD(shown!.totalUSD)}.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5 tabular-nums">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-muted">Your share</span>
            <span className="flex flex-col items-end">
              <span className="text-[22px] font-bold text-primary">{formatUSD(bill.guestTotalUSD)}</span>
              <span className="text-[13px] text-ink-muted">{formatLBP(bill.guestTotalLBP)}</span>
            </span>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-ink-muted">Other phones at the table</span>
            <span className="font-semibold">{formatUSD(otherPhonesUSD(bill.totalUSD, bill.guestTotalUSD))}</span>
          </div>
          <p className="text-[13px] text-ink-muted">Everything ordered from this phone counts as yours, shared dishes too.</p>
        </div>
      )}
    </section>
  );
}
