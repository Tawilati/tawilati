"use client";

import { useEffect, useState } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { Button, Card, Toast } from "@/components/ui";
import type { DailyReportResponse } from "@/types/Report";
import { barWidth, countChange, dayLabel, moneyChange, type Direction } from "@/utils/dailyReport";
import { formatLBP, formatUSD } from "@/utils/money";
import { isCalendarDate, nextDay, previousDay } from "@/utils/timezone";
import { reportsApi, reportsSentenceFor } from "./reportsApi";

// Top items shown before "Show all".
const TOP_SHOWN = 5;

type Loaded = { day: DailyReportResponse; before: DailyReportResponse | null };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "↑ $166.50 vs Tue 3 Nov": more is green, less is yellow, and the arrow and words always say which.
// `short` drops "vs Tue 3 Nov" on phones, where the money card's chip has already named the day.
function Trend({ direction, text, against, short = false }: { direction: Direction; text: string; against: string; short?: boolean }) {
  const day = short ? "sr-only sm:not-sr-only" : "";
  if (direction === "same") {
    return (
      <span className="inline-flex rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-ink-muted">
        Same<span className={day}>&nbsp;as {against}</span>
      </span>
    );
  }
  const up = direction === "up";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums ${up ? "bg-trend-up text-on-trend-up" : "bg-trend-down text-on-trend-down"}`}>
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      <span className="sr-only">{up ? "Up" : "Down"}</span>&nbsp;{text}
      <span className={day}>&nbsp;vs {against}</span>
    </span>
  );
}

function Bar({ label, value, width }: { label: string; value: string; width: number }) {
  return (
    <li className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-sm tabular-nums">
      <span className="truncate">{label}</span>
      <span aria-hidden className="h-3 overflow-hidden rounded-[4px] bg-surface-muted">
        <span className="block h-full rounded-r-[4px] bg-primary" style={{ width: `${width}%` }} />
      </span>
      <span className="text-right font-semibold">{value}</span>
    </li>
  );
}

function Count({ value, label, change, against }: { value: number; label: string; change?: ReturnType<typeof countChange>; against: string }) {
  return (
    <Card className="flex flex-col gap-1 !p-3 sm:!p-4">
      <span className="text-2xl font-extrabold tabular-nums sm:text-[26px]">{value}</span>
      <span className="text-[13px] font-semibold text-ink-muted">{label}</span>
      {change && <span><Trend direction={change.direction} text={String(change.amount)} against={against} short /></span>}
    </Card>
  );
}

// The day and the day before. Without a date, the server answers today on the café's clock.
// The day before is only for the comparison chips, so if it fails the chips just don't show.
async function fetchDay(wanted: string | null): Promise<Loaded> {
  const day = await reportsApi.daily(wanted ?? undefined);
  const before = await reportsApi.daily(previousDay(day.date)).catch(() => null);
  return { day, before };
}

// The owner's day: money taken, bills, orders, items, best sellers, cash vs card and each waiter.
// Each day comes with the day before, for the comparison chips.
export function DailyReport() {
  // null until the server has said what "today" is on the café's clock.
  const [date, setDate] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allItems, setAllItems] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    // Stepping quickly through days: only the newest day may answer.
    let current = true;
    fetchDay(date)
      .then((result) => {
        if (!current) return;
        if (!date) setToday(result.day.date);
        setLoaded(result);
        setError(null);
      })
      .catch((failure) => current && setError(reportsSentenceFor(failure)))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [date, retry]);

  const day = loaded?.day;
  const before = loaded?.before;
  const shown = day?.date ?? date;
  const isToday = !!shown && shown === today;
  const against = before ? dayLabel(before.date, { year: false }) : "";
  const takings = day && before ? moneyChange(day.totalUSD, before.totalUSD) : null;
  const quiet = day && day.tablesServed === 0 && day.ordersCount === 0;
  const items = day ? (allItems ? day.topItems : day.topItems.slice(0, TOP_SHOWN)) : [];
  const maxQty = Math.max(0, ...(day?.topItems.map((item) => item.qty) ?? []));
  const maxMethod = Math.max(0, ...(day?.byMethod.map((m) => Number(m.totalUSD)) ?? []));

  // Loading starts here, with the tap, rather than inside the effect that fetches.
  const go = (next: string) => {
    setAllItems(false);
    setLoading(true);
    setDate(next);
  };
  const tryAgain = () => {
    setLoading(true);
    setRetry((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-bold">Daily report</h1>
          {day && <p className="text-sm text-ink-muted">{day.businessName}</p>}
        </div>
        <nav aria-label="Choose a day" className="flex items-center gap-1 rounded-full border border-border-subtle bg-surface p-1">
          <button
            type="button"
            aria-label="Previous day"
            disabled={!shown || loading}
            onClick={() => shown && go(previousDay(shown))}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-surface-muted disabled:cursor-default disabled:opacity-40"
          >
            <ChevronRightIcon className="size-5 rotate-180" />
          </button>
          <label className="relative cursor-pointer px-2 text-sm font-semibold tabular-nums">
            <span>{shown ? dayLabel(shown) : "Today"}</span>
            {/* The native picker sits under the label, so tapping the date opens it. */}
            <input
              type="date"
              aria-label="Pick a day"
              value={shown ?? ""}
              max={today ?? undefined}
              onChange={(event) => isCalendarDate(event.target.value) && (!today || event.target.value <= today) && go(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <button
            type="button"
            disabled={isToday || !today || loading}
            onClick={() => today && go(today)}
            className={`min-h-11 cursor-pointer rounded-full px-3 text-sm font-semibold disabled:cursor-default ${isToday ? "bg-primary text-on-primary" : "hover:bg-surface-muted"}`}
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next day"
            disabled={!shown || isToday || loading}
            onClick={() => shown && go(nextDay(shown))}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-surface-muted disabled:cursor-default disabled:opacity-40"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </nav>
      </div>

      {error && (
        <Card className="flex flex-col items-start gap-3">
          <Toast tone="error" title={error} />
          <Button onClick={tryAgain}>Try again</Button>
        </Card>
      )}

      {!day && !error && <p role="status" className="text-sm text-ink-muted">Loading the report…</p>}

      {day && (
        <div aria-busy={loading} className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <Card className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-ink-muted uppercase">{isToday ? "Sales today" : `Sales on ${dayLabel(day.date, { year: false })}`}</span>
              <span className="text-[40px] leading-tight font-extrabold text-primary tabular-nums">{formatUSD(day.totalUSD)}</span>
              <span className="text-sm text-ink-muted tabular-nums">{formatLBP(day.totalLBP)}</span>
              {!quiet && (
                <span className="text-sm tabular-nums">
                  <span className="text-ink-muted">Received: </span>
                  <span className="font-semibold">{formatUSD(day.receivedUSD)} + {formatLBP(day.receivedLBP)}</span>
                </span>
              )}
              {takings && (
                <span className="mt-1">
                  <Trend direction={takings.direction} text={formatUSD(takings.amountUSD)} against={against} />
                </span>
              )}
            </div>
            <p className="max-w-64 text-xs text-ink-muted">
              {quiet
                ? "No bills were closed on this day."
                : "What the bills closed on this day were worth, cash and card. Received is what was handed over in each currency, for counting the drawer."}
            </p>
          </Card>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Count value={day.tablesServed} label="Bills closed" change={before ? countChange(day.tablesServed, before.tablesServed) : undefined} against={against} />
            <Count value={day.ordersCount} label="Orders sent to the kitchen" change={before ? countChange(day.ordersCount, before.ordersCount) : undefined} against={against} />
            <Count value={day.itemsSold} label="Items sold" change={before ? countChange(day.itemsSold, before.itemsSold) : undefined} against={against} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
            <Card className="flex flex-col gap-3">
              <h2 className="text-[15px] font-semibold">Top items</h2>
              {items.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing was ordered on this day.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {items.map((item) => (
                    <Bar key={item.menuItemId} label={item.name} width={barWidth(item.qty, maxQty)} value={`${item.qty} · ${formatUSD(item.totalUSD)}`} />
                  ))}
                </ul>
              )}
              {day.topItems.length > TOP_SHOWN && (
                <Button variant="secondary" size="sm" className="self-start" onClick={() => setAllItems((all) => !all)}>
                  {allItems ? "Show fewer" : `Show all ${day.topItems.length}`}
                </Button>
              )}
            </Card>

            <div className="flex flex-col gap-3">
              <Card className="flex flex-col gap-3">
                <h2 className="text-[15px] font-semibold">How guests paid</h2>
                {day.byMethod.length === 0 ? (
                  <p className="text-sm text-ink-muted">No payments on this day.</p>
                ) : (
                  <ul className="flex flex-col gap-2.5">
                    {day.byMethod.map((m) => (
                      <Bar
                        key={m.method}
                        label={`${m.method === "CASH" ? "Cash" : "Card"} · ${plural(m.count, "bill", "bills")}`}
                        width={barWidth(Number(m.totalUSD), maxMethod)}
                        value={formatUSD(m.totalUSD)}
                      />
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="flex flex-col gap-2">
                <h2 className="text-[15px] font-semibold">By waiter</h2>
                {day.byWaiter.length === 0 ? (
                  <p className="text-sm text-ink-muted">No bills closed on this day.</p>
                ) : (
                  <ul className="flex flex-col">
                    {day.byWaiter.map((w) => (
                      <li key={w.waiterId} className="flex justify-between gap-3 border-b border-border-subtle py-2 text-sm tabular-nums last:border-b-0">
                        <span>
                          {w.waiterName} <span className="text-xs text-ink-muted">· {plural(w.count, "bill", "bills")}</span>
                        </span>
                        <span className="font-bold">{formatUSD(w.totalUSD)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
