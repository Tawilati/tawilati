"use client";

import { Modal, Toast } from "@/components/ui";
import { formatUSD } from "@/utils/money";
import type { GuestBill } from "./guestOrderApi";
import { RoundBadge, Total } from "./OrderParts";

const READY = "Your order is ready!";
const TAB_CLOSED = "This table's bill has been closed. Please ask a member of staff.";

function sentAt(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function OrdersSheet({ bill, closed, onClose }: { bill: GuestBill; closed: boolean; onClose: () => void }) {
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
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          <Total label="Your orders" usd={bill.guestTotalUSD} lbp={bill.guestTotalLBP} />
          <Total label="Table total" usd={bill.totalUSD} lbp={bill.totalLBP} />
        </div>
      </div>
    </Modal>
  );
}
