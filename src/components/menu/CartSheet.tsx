"use client";

import { useState } from "react";
import { Button, Modal, QuantityStepper, StatusBadge, Toast } from "@/components/ui";
import { CircleCheckIcon, XIcon } from "@/components/icons";
import type { PublicMenuItem } from "@/types/Menu";
import { MAX_CART_LINES, type CartRow, type CartSummary } from "@/utils/guestCart";
import { formatUSD } from "@/utils/money";
import type { GuestBill, PlacedOrder, SubmitOutcome } from "./guestOrderApi";
import { CancelRound, roundSummary } from "./CancelRound";
import { RoundBadge, Total } from "./OrderParts";

// Plain sentences for the guest; error codes are never shown.
const FAILED = "We couldn't submit your order. Please try again.";
const BLOCKED = "Some items just became unavailable. Remove them to submit.";
const TAB_CLOSED = "This table's bill has been closed. Please ask a member of staff.";

type Change = (item: Pick<PublicMenuItem, "id" | "name">, delta: number) => void;

function CartRowView({ row, onChange }: { row: CartRow; onChange: Change }) {
  const item = { id: row.menuItemId, name: row.name };
  const available = row.state === "available";
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-border-subtle py-2.5 last:border-b-0">
      {/* On the smallest phones the name takes its own line, so the stepper never covers it. */}
      <div className="flex min-w-0 basis-full flex-col gap-0.5 min-[360px]:flex-1 min-[360px]:basis-0">
        <p className={`text-[15px] font-semibold [overflow-wrap:anywhere] ${available ? "text-ink" : "text-ink-muted"}`}>{row.name}</p>
        {available && row.priceUSD && (
          <p className="text-[13px] text-ink-muted tabular-nums">{formatUSD(row.priceUSD)} each</p>
        )}
        {row.state === "sold_out" && <StatusBadge status="SOLD_OUT" className="self-start" />}
        {row.state === "missing" && <p className="text-[13px] text-ink-muted">No longer available</p>}
      </div>
      {available ? (
        <>
          <QuantityStepper
            itemName={row.name}
            value={row.qty}
            onDecrease={() => onChange(item, -1)}
            onIncrease={() => onChange(item, 1)}
          />
          <p className="w-14 shrink-0 text-right text-[15px] font-bold tabular-nums">{formatUSD(row.lineUSD ?? "0")}</p>
        </>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => onChange(item, -row.qty)} aria-label={`Remove ${row.name}`}>
          Remove
        </Button>
      )}
    </li>
  );
}

function Confirmation({
  order,
  earlierAttempt,
  cancelled,
  canCancel,
  cartLeft,
  onCancel,
  onDone,
  onTrack,
}: {
  order: PlacedOrder;
  earlierAttempt: boolean;
  // The guest cancelled it from here.
  cancelled: boolean;
  canCancel: boolean;
  cartLeft: boolean;
  onCancel: () => Promise<string | null>;
  onDone: () => void;
  onTrack: () => void;
}) {
  const done = (
    <Button block onClick={onDone}>
      {cartLeft ? "Back to my cart" : "Order something else"}
    </Button>
  );

  if (cancelled) {
    return (
      <div className="flex flex-col gap-3">
        <div role="status" className="flex flex-col items-center gap-1.5 text-center">
          <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-surface-muted text-ink-muted">
            <XIcon className="size-[26px]" />
          </span>
          <p className="text-lg font-bold text-balance">Order cancelled</p>
          <p className="text-sm text-ink-muted">{roundSummary(order.lines, order.totalUSD)}. The kitchen won&apos;t make it.</p>
        </div>
        {cartLeft && <p className="text-sm text-ink-muted">Some items are still in your cart. They haven&apos;t been sent yet.</p>}
        {done}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-primary-tint text-primary">
          <CircleCheckIcon className="size-[26px]" />
        </span>
        <p className="text-lg font-bold text-balance">Order placed for Table {order.tableLabel}</p>
        <p className="text-sm text-ink-muted">
          {order.status === "CANCELLED" ? "This order was cancelled. Please ask a member of staff." : earlierAttempt ? "Your earlier order did reach the kitchen." : "The kitchen has it."}
        </p>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-border-subtle p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-semibold">Your order</span>
          <span aria-live="polite"><RoundBadge status={order.status} /></span>
        </div>
        <ul className="flex flex-col gap-0.5 text-sm">
          {order.lines.map((line) => (
            <li key={line.menuItemId}>
              {line.qty} × {line.name}
            </li>
          ))}
        </ul>
        <Total label="Total" usd={order.totalUSD} lbp={order.totalLBP} />
        {canCancel && order.status === "NEW" && (
          <CancelRound label="Cancel order" summary={roundSummary(order.lines, order.totalUSD)} onCancel={onCancel} />
        )}
      </div>
      {cartLeft && <p className="text-sm text-ink-muted">Some items are still in your cart. They haven&apos;t been sent yet.</p>}
      {done}
      <Button block variant="secondary" onClick={onTrack}>
        Follow your order
      </Button>
    </div>
  );
}

export function CartSheet({
  tableLabel,
  summary,
  submitting,
  closed,
  onChange,
  onSubmit,
  onCancelRound,
  onClose,
  onTrack,
  rounds,
}: {
  tableLabel: string;
  summary: CartSummary;
  // This phone's rounds as last polled, so the confirmation follows the kitchen while it stays open.
  rounds: GuestBill["orders"] | undefined;
  submitting: boolean;
  closed: boolean;
  onChange: Change;
  onSubmit: () => Promise<SubmitOutcome | null>;
  // Cancels a round still marked New; a sentence when it didn't work.
  onCancelRound: (orderId: string) => Promise<string | null>;
  onClose: () => void;
  onTrack: () => void;
}) {
  const [placed, setPlaced] = useState<{ order: PlacedOrder; earlierAttempt: boolean; cancelled?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Any edit answers the last error, so it doesn't stay on screen.
  const edit: Change = (item, delta) => {
    setError(null);
    onChange(item, delta);
  };

  async function submit() {
    if (closed || submitting) return;
    setError(null);
    const outcome = await onSubmit();
    if (!outcome) return;
    if (outcome.kind === "sent") setPlaced({ order: outcome.order, earlierAttempt: outcome.earlierAttempt });
    else if (outcome.kind === "blocked") setError(BLOCKED);
    else if (outcome.kind === "tab_closed") setError(TAB_CLOSED);
    else if (outcome.kind === "failed") setError(outcome.reason === "storage_unavailable"
      ? "Your browser couldn't save this order safely. Allow site storage, then try again. Nothing was sent."
      : FAILED);
  }

  return (
    <Modal title={`Table ${tableLabel}`} locked={submitting} onClose={onClose}>
      {placed ? (
        <Confirmation
          order={{ ...placed.order, status: rounds?.find((r) => r.orderId === placed.order.orderId)?.status ?? placed.order.status }}
          earlierAttempt={placed.earlierAttempt}
          cancelled={placed.cancelled === true}
          canCancel={!closed}
          onCancel={async () => {
            const sentence = await onCancelRound(placed.order.orderId);
            if (!sentence) setPlaced((current) => current && { ...current, cancelled: true });
            return sentence;
          }}
          cartLeft={summary.rows.length > 0}
          onDone={() => (summary.rows.length > 0 ? setPlaced(null) : onClose())}
          onTrack={onTrack}
        />
      ) : summary.rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-muted">Your cart is empty. Add something from the menu.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <fieldset disabled={closed || submitting} className="contents">
          <ul className="-my-2.5 max-h-[45dvh] overflow-y-auto">
            {summary.rows.map((row) => (
              <CartRowView key={row.menuItemId} row={row} onChange={edit} />
            ))}
          </ul>
          </fieldset>
          <div className="border-t border-border-subtle pt-3">
            <Total label="Total" usd={summary.totalUSD} lbp={summary.totalLBP} />
          </div>
          {(closed || error) && <Toast tone="error" title={closed ? TAB_CLOSED : error!} />}
          {summary.blocked && !error && !closed && (
            <p className="text-sm font-medium text-ink-muted">{summary.rows.length > MAX_CART_LINES ? "Remove items to keep your order within 50 different items." : "Remove unavailable items to submit."}</p>
          )}
          <Button block loading={submitting} disabled={closed || summary.blocked} onClick={submit}>
            Submit your order
          </Button>
        </div>
      )}
    </Modal>
  );
}
