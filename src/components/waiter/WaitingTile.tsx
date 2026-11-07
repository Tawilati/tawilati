"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { elapsedLabel, type FloorTile } from "@/utils/waiterFloor";
import { waiterApi, waiterSentenceFor, type PendingGuest } from "./waiterApi";

// The look of a table where a phone waits for the waiter, also used by the colour key.
export const WAITING_LOOK = "border-2 border-accent bg-accent-tint text-ink";

// A table where a new phone wants to order. The waiter looks at the table: someone sitting there → Confirm (that
// phone's order goes to the kitchen at once); nobody there (an old QR photo, someone at home) → Reject. With two
// phones waiting, the buttons answer the one that asked first, then the next one shows. While a phone waits, the
// tile answers it instead of opening the bill: one tap and the table is back to normal.
export function WaitingTile({
  tile,
  guests,
  now,
  onAnswered,
  onError,
}: {
  tile: FloorTile;
  // Oldest first, never empty.
  guests: PendingGuest[];
  now: number;
  onAnswered: () => void;
  onError: (sentence: string) => void;
}) {
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);
  const guest = guests[0];

  async function answer(action: "confirm" | "reject") {
    setBusy(action);
    try {
      if (action === "confirm") await waiterApi.confirmGuest(guest.guestSessionId);
      else await waiterApi.rejectGuest(guest.guestSessionId);
    } catch (error) {
      onError(waiterSentenceFor(error));
    } finally {
      setBusy(null);
      onAnswered();
    }
  }

  return (
    <div
      role="group"
      aria-label={`${tile.label}: waiting for you. ${guests.length === 1 ? "A guest wants" : `${guests.length} guests want`} to order.`}
      className={`flex min-h-28 min-w-0 flex-col gap-0.5 rounded-xl p-3 md:min-h-40 md:gap-1 md:rounded-2xl md:p-5 ${WAITING_LOOK}`}
    >
      <span className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="truncate text-xl font-bold md:text-3xl">{tile.label}</span>
        <span className="shrink-0 text-xs tabular-nums text-ink-muted md:text-sm">{elapsedLabel(guest.createdAt, now)}</span>
      </span>
      <span className="truncate text-sm font-semibold md:text-lg">Waiting for you</span>
      <span className="text-xs text-ink-muted md:text-sm">
        {guests.length === 1 ? "A guest wants to order" : `${guests.length} guests want to order`}
      </span>
      {/* Two tiles to a row on a phone leave no room side by side: the buttons stack there. */}
      <span className="mt-auto flex flex-col gap-2 pt-2 md:flex-row">
        <Button
          size="sm"
          variant="accent"
          className="flex-1"
          loading={busy === "reject"}
          disabled={busy !== null}
          onClick={() => void answer("reject")}
          aria-label={`Reject the guest at ${tile.label}`}
        >
          Reject
        </Button>
        <Button
          size="sm"
          className="flex-1"
          loading={busy === "confirm"}
          disabled={busy !== null}
          onClick={() => void answer("confirm")}
          aria-label={`Confirm the guest at ${tile.label}`}
        >
          Confirm
        </Button>
      </span>
    </div>
  );
}
