"use client";

import { useCallback, useState } from "react";
import { Button, Card, Toast } from "@/components/ui";
import { FloatingToast } from "@/components/ui/FloatingToast";
import { kitchenSummary, type KitchenTicket } from "@/utils/kitchenQueue";
import { updatedAgoLabel } from "@/utils/waiterFloor";
import { SignedInElsewhere } from "@/components/staff/SignedInElsewhere";
import { kitchenApi, kitchenSentenceFor } from "./kitchenApi";
import { TicketCard } from "./TicketCard";
import { useKitchenQueue } from "./useKitchenQueue";

// The kitchen screen: every round still to cook, oldest first, left to right then top to bottom. Start keeps a
// ticket in its place; Ready takes it off (the waiter's screen shows "1 ready").
export function KitchenQueue() {
  const { tickets, now, updatedAt, stale, otherAccount, refresh, apply } = useKitchenQueue();
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<{ id: number; title: string } | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  async function advance(ticket: KitchenTicket) {
    const status = ticket.status === "NEW" ? "PREPARING" : "READY";
    setBusy((current) => new Set(current).add(ticket.orderId));
    try {
      await kitchenApi.setStatus(ticket.orderId, status);
      apply(ticket.orderId, status);
    } catch (error) {
      setNotice({ id: Date.now(), title: kitchenSentenceFor(error) });
      // Another screen may have moved it: show the queue as it really is.
      void refresh();
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(ticket.orderId);
        return next;
      });
    }
  }

  const summary = tickets ? kitchenSummary(tickets, now) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">Kitchen</h1>
        {updatedAt && (
          <p className={`text-xs ${stale ? "font-semibold text-danger" : "text-ink-muted"}`}>
            {stale ? "No connection. " : ""}Updated {updatedAgoLabel(updatedAt, now)}
          </p>
        )}
      </div>

      {otherAccount && <SignedInElsewhere role="kitchen" />}

      {notice && (
        <FloatingToast key={notice.id} tone="error" title={notice.title} duration={6000} onDismiss={dismissNotice} />
      )}

      {summary && (
        <dl className="flex flex-wrap gap-2 text-sm" aria-label="Queue summary">
          <SummaryItem label="Active" value={summary.active} className="bg-surface border border-border-subtle" />
          <SummaryItem label="New" value={summary.fresh} className="bg-[var(--status-new-bg)] text-[var(--status-new-fg)]" />
          <SummaryItem
            label="Preparing"
            value={summary.preparing}
            className="bg-[var(--status-preparing-bg)] text-[var(--status-preparing-fg)]"
          />
          <SummaryItem
            label="Overdue"
            value={summary.overdue}
            className={summary.overdue > 0 ? "bg-danger text-white" : "bg-surface border border-border-subtle text-ink-muted"}
          />
        </dl>
      )}

      {!tickets && stale && (
        <Card className="flex flex-col items-start gap-3">
          <Toast tone="error" title="We couldn't load the orders. Check the connection and try again." />
          <Button onClick={() => void refresh()}>Try again</Button>
        </Card>
      )}
      {!tickets && !stale && !otherAccount && <p className="text-sm text-ink-muted">Loading orders…</p>}

      {tickets && tickets.length === 0 && (
        <Card>
          <p className="text-ink-muted">No orders to cook. New ones show up here by themselves.</p>
        </Card>
      )}

      {tickets && tickets.length > 0 && (
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {tickets.map((ticket) => (
            <li key={ticket.orderId} className="flex min-w-0 flex-col [&>*]:flex-1">
              <TicketCard ticket={ticket} now={now} busy={busy.has(ticket.orderId)} onAdvance={(t) => void advance(t)} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SummaryItem({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`flex items-baseline gap-1.5 rounded-full px-3 py-1 ${className}`}>
      <dt>{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}
