"use client";

import { useState } from "react";
import { Button, ConfirmDialog, Toast } from "@/components/ui";
import { formatUSD } from "@/utils/money";

// "Cancel this order" on a round the kitchen hasn't started. Tapping it opens a pop-up over the sheet asking to
// confirm, with "Keep it" as the easy way out. `onCancel` answers a sentence when it didn't work.
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
    setConfirming(false);
    if (sentence) setError(sentence);
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <Toast tone="error" title={error} />}
      <Button
        size="sm"
        variant="accent"
        className="min-h-11 self-start"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        {label}
      </Button>
      {confirming && (
        <ConfirmDialog
          title="Cancel this order?"
          confirmLabel="Cancel order"
          cancelLabel="Keep it"
          loading={busy}
          onConfirm={() => void cancel()}
          onCancel={() => setConfirming(false)}
        >
          {summary}. The kitchen won&apos;t make it.
        </ConfirmDialog>
      )}
    </div>
  );
}

// "2 × Espresso, 1 × Cake, $8.50"
export function roundSummary(lines: { qty: number; name: string }[], totalUSD: string): string {
  const items = lines.map((line) => `${line.qty} × ${line.name}`).join(", ");
  return `${items}, ${formatUSD(totalUSD)}`;
}
