"use client";

import { useState } from "react";
import { Button, Modal, Toast } from "@/components/ui";
import { formatUSD } from "@/utils/money";
import type { BillSplit, GuestBill } from "./guestOrderApi";
import { CancelRound, roundSummary } from "./CancelRound";
import { RoundBadge, Total } from "./OrderParts";
import { SplitBill } from "./SplitBill";

const READY = "Your order is ready!";
const TAB_CLOSED = "This table's bill has been closed. Please ask a member of staff.";
const BILL_ASKED = "You asked for the bill. A waiter is on the way.";

function sentAt(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function OrdersSheet({
  bill,
  closed,
  onAskBill,
  onSplit,
  onCancel,
  onClose,
}: {
  bill: GuestBill;
  closed: boolean;
  onAskBill: () => Promise<string | null>;
  onSplit: (people: number) => Promise<BillSplit | null>;
  // Cancels a round still marked New; a sentence when it didn't work.
  onCancel: (orderId: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  async function ask() {
    setAsking(true);
    setAskError(null);
    setAskError(await onAskBill());
    setAsking(false);
  }

  return (
    <Modal title={`Your orders, Table ${bill.tableLabel}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {closed ? (
          <p role="status" className="text-sm text-ink-muted">{TAB_CLOSED}</p>
        ) : (
          bill.orders.some((order) => order.status === "READY") && <Toast title={READY} />
        )}
        <ul className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
          {bill.orders.map((order) => (
            <li key={order.orderId} className="flex flex-col gap-1.5 rounded-2xl border border-border-subtle p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink-muted tabular-nums">{sentAt(order.createdAt)}</span>
                <RoundBadge status={order.status} />
              </div>
              <ul className="flex flex-col gap-0.5 text-sm">
                {order.lines.map((line) => (
                  <li key={line.menuItemId}>
                    {line.qty} × {line.name}
                  </li>
                ))}
              </ul>
              <p className="text-right text-[15px] font-bold tabular-nums">{formatUSD(order.totalUSD)}</p>
              {!closed && order.status === "NEW" && (
                <CancelRound summary={roundSummary(order.lines, order.totalUSD)} onCancel={() => onCancel(order.orderId)} />
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          <Total label="Your orders" usd={bill.guestTotalUSD} lbp={bill.guestTotalLBP} />
          <Total label="Table total" usd={bill.totalUSD} lbp={bill.totalLBP} />
        </div>
        {!closed && bill.orders.length > 0 && <SplitBill bill={bill} onSplit={onSplit} />}
        {!closed && bill.orders.length > 0 && (
          <div className="flex flex-col gap-2">
            {askError && <Toast tone="error" title={askError} />}
            {bill.billRequestedAt ? (
              <p role="status" className="rounded-xl bg-surface-muted p-3 text-sm">{BILL_ASKED}</p>
            ) : (
              <Button block variant="secondary" loading={asking} onClick={() => void ask()}>
                Ask for the bill
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
