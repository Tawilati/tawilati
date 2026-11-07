"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal, StatusBadge, TextField, Toast } from "@/components/ui";
import { minorToAmount, toMinor } from "@/utils/guestCart";
import { formatLBP, formatUSD } from "@/utils/money";
import { formatRate } from "@/components/dashboard/settings/settingsApi";
import type { FloorTile } from "@/utils/waiterFloor";
import {
  waiterApi,
  waiterSentenceFor,
  type CloseReceipt,
  type PaymentMethod,
  type RoundStatus,
  type TabBill,
} from "./waiterApi";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Rounds that still need the kitchen or the waiter: the bill can't be closed while any is left.
const UNSETTLED: RoundStatus[] = ["NEW", "PREPARING", "READY"];

// "12.5" → 12.5; anything else (empty, negative, letters) → null.
function amount(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  return Number(value);
}

// One table's bill: its rounds and where each one is, "Mark served" on the ready ones, then the payment.
// `refreshKey` changes whenever the floor refreshes, so a round the kitchen finished shows up here too.
export function TableSheet({
  tile,
  rate,
  refreshKey,
  onChanged,
  onClose,
}: {
  tile: FloorTile;
  // LBP for 1 USD (the rate the close counts LBP received with), or null until the floor has read it.
  rate: string | null;
  refreshKey: number | null;
  onChanged: () => void;
  onClose: (closedLabel?: string) => void;
}) {
  const sessionId = tile.tab!.sessionId;
  const [bill, setBill] = useState<TabBill | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // the round being served, or "close"
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [receivedUSD, setReceivedUSD] = useState<string | null>(null);
  const [receivedLBP, setReceivedLBP] = useState("0");
  const [receipt, setReceipt] = useState<CloseReceipt | null>(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const next = await waiterApi.bill(sessionId);
      if (request !== latest.current) return;
      setBill(next);
      setLoadError(null);
    } catch (error) {
      if (request !== latest.current) return;
      setLoadError(waiterSentenceFor(error));
    }
  }, [sessionId]);

  useEffect(() => {
    if (receipt) return;
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load, refreshKey, receipt]);

  async function serve(orderId: string) {
    setBusy(orderId);
    setActionError(null);
    try {
      await waiterApi.serve(orderId);
      onChanged();
    } catch (error) {
      setActionError(waiterSentenceFor(error));
    } finally {
      await load();
      setBusy(null);
    }
  }

  const usdField = receivedUSD ?? bill?.totalUSD ?? "";
  const usd = amount(usdField);
  const lbp = amount(receivedLBP);
  const amountsValid = method === "EXTERNAL_CARD" || (usd !== null && lbp !== null);

  async function closeBill() {
    if (!bill || !amountsValid) return;
    setBusy("close");
    setActionError(null);
    try {
      const body =
        method === "EXTERNAL_CARD"
          ? { amountReceivedUSD: Number(bill.totalUSD), amountReceivedLBP: 0, method }
          : { amountReceivedUSD: usd!, amountReceivedLBP: lbp!, method };
      setReceipt(await waiterApi.close(sessionId, body));
      onChanged();
    } catch (error) {
      setActionError(waiterSentenceFor(error));
      await load();
    } finally {
      setBusy(null);
    }
  }

  const label = bill?.tableLabel ?? tile.label;

  if (receipt) {
    const change = receipt.changeUSD !== "0.00" || receipt.changeLBP !== "0.00";
    return (
      <Modal title={`${label} is closed`} onClose={() => onClose(label)}>
        <div className="flex flex-col gap-4">
          <Toast tone="success" title="Paid and closed. The table is free for the next guests." />
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm tabular-nums">
            <dt className="text-ink-muted">Bill</dt>
            <dd className="text-right">{formatUSD(receipt.totalUSD)} · {formatLBP(receipt.totalLBP)}</dd>
            <dt className="text-ink-muted">Received</dt>
            <dd className="text-right">{formatUSD(receipt.amountReceivedUSD)} · {formatLBP(receipt.amountReceivedLBP)}</dd>
            {change && (
              <>
                <dt className="font-semibold">Change to give</dt>
                {/* The same change in either currency, not both. */}
                <dd className="text-right font-semibold">
                  {formatUSD(receipt.changeUSD)} or {formatLBP(receipt.changeLBP)}
                </dd>
              </>
            )}
          </dl>
          <Button block onClick={() => onClose(label)}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  const unsettled = bill?.orders.filter((order) => UNSETTLED.includes(order.status)).length ?? 0;

  return (
    <Modal title={label} locked={busy === "close"} onClose={() => onClose()}>
      <div className="flex flex-col gap-4">
        {loadError && <Toast tone="error" title={loadError} />}
        {!bill && !loadError && <p className="text-sm text-ink-muted">Loading the bill…</p>}

        {bill && (
          <>
            <p className="text-sm text-ink-muted">Open since {time(bill.openedAt)}</p>

            {bill.orders.length === 0 && (
              <p className="text-sm text-ink-muted">Nothing ordered yet. You can close the table if the guests left.</p>
            )}

            <ol className="flex flex-col divide-y divide-border-subtle">
              {bill.orders.map((order, index) => (
                <li key={order.orderId} className="flex flex-col gap-1.5 py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      Round {index + 1} · {time(order.createdAt)}
                    </span>
                    {order.status !== "CANCELLED" && <StatusBadge status={order.status} />}
                  </div>
                  <ul className="flex flex-col gap-0.5 text-sm">
                    {order.lines.map((line) => (
                      <li key={line.menuItemId} className="flex justify-between gap-3 tabular-nums">
                        <span className="min-w-0 truncate">
                          {line.qty} × {line.name}
                        </span>
                        <span>{formatUSD(minorToAmount(toMinor(line.priceUSD) * line.qty))}</span>
                      </li>
                    ))}
                  </ul>
                  {order.status === "READY" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="self-start"
                      loading={busy === order.orderId}
                      disabled={busy !== null && busy !== order.orderId}
                      onClick={() => void serve(order.orderId)}
                    >
                      Mark served
                    </Button>
                  )}
                </li>
              ))}
            </ol>

            <div className="flex items-baseline justify-between border-t-2 border-ink pt-2 tabular-nums">
              <span className="font-semibold">Table total</span>
              <span className="text-right">
                <span className="block font-bold">{formatUSD(bill.totalUSD)}</span>
                <span className="block text-sm text-ink-muted">{formatLBP(bill.totalLBP)}</span>
              </span>
            </div>

            {actionError && <Toast tone="error" title={actionError} />}

            {unsettled > 0 ? (
              <p className="rounded-lg bg-surface-muted p-3 text-sm text-ink-muted">
                Close bill unlocks when every round is served ({unsettled} left).
              </p>
            ) : (
              <fieldset disabled={busy === "close"} className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold">Payment</legend>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
                  {(["CASH", "EXTERNAL_CARD"] as const).map((option) => (
                    <Button
                      key={option}
                      variant={method === option ? "primary" : "secondary"}
                      aria-pressed={method === option}
                      onClick={() => setMethod(option)}
                    >
                      {option === "CASH" ? "Cash" : "Card"}
                    </Button>
                  ))}
                </div>
                {method === "CASH" && rate && (
                  <p className="rounded-lg bg-accent px-3 py-2 text-sm text-ink">
                    LBP counts at <span className="font-semibold tabular-nums">1 USD = {formatRate(rate)} LBP</span>
                  </p>
                )}
                {method === "CASH" ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField
                      label="Received in USD"
                      inputMode="decimal"
                      value={usdField}
                      onChange={(event) => setReceivedUSD(event.target.value)}
                      error={usd === null ? "Enter an amount like 20 or 20.50." : undefined}
                    />
                    <TextField
                      label="Received in LBP"
                      inputMode="decimal"
                      value={receivedLBP}
                      onChange={(event) => setReceivedLBP(event.target.value)}
                      error={lbp === null ? "Enter an amount like 500000." : undefined}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">The card terminal charges {formatUSD(bill.totalUSD)}.</p>
                )}
                <Button block loading={busy === "close"} disabled={!amountsValid} onClick={() => void closeBill()}>
                  Close bill
                </Button>
              </fieldset>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
