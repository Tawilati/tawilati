"use client";

import { useState } from "react";
import { Button, Toast } from "@/components/ui";
import { formatUSD } from "@/utils/money";

// "Cancel this order" on a round the kitchen hasn't started. The check sits right under the round (not a second
// pop-up over the sheet), with "Keep it" as the easy way out. `onCancel` answers a sentence when it didn't work.
export function CancelRound({
  summary,
  label = "Cancel this order",
  onCancel,
}: {
  // What gets cancelled, as the guest will recognise it: "2 × Espresso, $5.00".
  summary: string;
  label?: string;
  onCancel: () => Promise<string | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const sentence = await onCancel();
    setBusy(false);
    if (sentence) {
      setError(sentence);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        {error && <Toast tone="error" title={error} />}
        <Button
          size="sm"
          variant="ghost"
          className="min-h-11 self-start text-danger!"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          {label}
        </Button>
      </div>
    );
  }

  return (
    <div role="group" aria-label="Cancel this order?" className="flex flex-col gap-2.5 rounded-xl bg-danger-tint p-3">
      <p className="text-sm">
        <span className="font-semibold">Cancel this order?</span> {summary}. The kitchen won&apos;t make it.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="ghost" className="min-h-11 bg-surface!" disabled={busy} onClick={() => setConfirming(false)}>
          Keep it
        </Button>
        <Button size="sm" variant="accent" className="min-h-11" loading={busy} onClick={() => void cancel()}>
          Cancel order
        </Button>
      </div>
    </div>
  );
}

// "2 × Espresso, 1 × Cake, $8.50"
export function roundSummary(lines: { qty: number; name: string }[], totalUSD: string): string {
  const items = lines.map((line) => `${line.qty} × ${line.name}`).join(", ");
  return `${items}, ${formatUSD(totalUSD)}`;
}
