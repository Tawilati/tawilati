import type { ReactNode } from "react";
import { CheckIcon, PlusIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatLBP, formatUSD } from "@/utils/money";
import { QrCode } from "./QrCode";

// Static pictures of the real screens, drawn with the app's own classes and the demo café's menu (src/prisma/seed.ts,
// 89,500 LBP per USD). They are look-alikes for the landing page: nothing in them is clickable, so they are inert.
// One demo order runs through all of them: table T1 orders a cappuccino and a halloumi sandwich.

const RATE = 89_500;
const lbp = (usd: string) => formatLBP(String(Math.round(Number(usd) * RATE)));

const ORDER = [
  { name: "Cappuccino", total: "3.50", qty: 1 },
  { name: "Halloumi sandwich", total: "6.50", qty: 1 },
  { name: "Fresh lemonade", total: "6.00", qty: 2 },
];

// ---------- Frames ----------

// A phone with a bezel, a camera island and side buttons. The screen is 9:19.5, like a current phone.
export function PhoneFrame({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div role="img" aria-label={label} className={`relative w-[272px] shrink-0 select-none ${className}`}>
      <span aria-hidden="true" className="bg-ink absolute top-24 -left-[3px] h-7 w-[3px] rounded-l-sm" />
      <span aria-hidden="true" className="bg-ink absolute top-36 -left-[3px] h-12 w-[3px] rounded-l-sm" />
      <span aria-hidden="true" className="bg-ink absolute top-32 -right-[3px] h-16 w-[3px] rounded-r-sm" />
      <div className="bg-ink rounded-[2.75rem] p-[9px] shadow-[0_2px_0_rgb(255_255_255/0.12)_inset,0_30px_50px_-18px_rgb(32_43_38/0.55),0_12px_20px_-12px_rgb(32_43_38/0.4)]">
        <div inert className="bg-surface-secondary text-ink relative aspect-[9/19.5] overflow-hidden rounded-[2.2rem] text-left">
          <span aria-hidden="true" className="bg-ink absolute top-2 left-1/2 z-10 h-[18px] w-[74px] -translate-x-1/2 rounded-full" />
          <div aria-hidden="true" className="text-ink flex items-center justify-between px-6 pt-2.5 text-[11px] font-semibold tabular-nums">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="bg-ink inline-block h-[7px] w-[11px] rounded-[2px]" />
              <span className="border-ink inline-block h-[8px] w-[15px] rounded-[3px] border" />
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// A window for the owner's screens: three dots and a title, then the page.
export function BrowserFrame({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`border-border-strong bg-surface text-ink overflow-hidden rounded-xl border shadow-[0_24px_40px_-24px_rgb(32_43_38/0.35)] ${className}`}>
      <div aria-hidden="true" className="bg-surface-muted border-border-subtle flex items-center gap-3 border-b px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="bg-border-strong size-2.5 rounded-full" />
          <span className="bg-border-strong size-2.5 rounded-full" />
          <span className="bg-border-strong size-2.5 rounded-full" />
        </span>
        <span className="text-ink-muted bg-surface border-border-subtle rounded-md border px-3 py-0.5 text-xs">{title}</span>
      </div>
      <div inert>{children}</div>
    </div>
  );
}

// ---------- Guest phone screens ----------

function AddDot() {
  return (
    <span className="bg-primary text-on-primary flex size-8 shrink-0 items-center justify-center rounded-full">
      <PlusIcon className="size-4" />
    </span>
  );
}

function MiniStepper({ value }: { value: number }) {
  return (
    <span className="bg-surface-muted flex items-center rounded-full p-0.5 text-sm font-semibold tabular-nums">
      <span className="flex size-7 items-center justify-center">−</span>
      <span className="min-w-4 text-center">{value}</span>
      <span className="bg-primary text-on-primary flex size-7 items-center justify-center rounded-full">+</span>
    </span>
  );
}

function TableHeader() {
  return (
    <div className="flex flex-col gap-1 px-4 pt-3 pb-2">
      <p className="text-[15px] leading-tight font-bold">Tawilati</p>
      <span className="bg-primary-tint text-primary inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[11px] font-semibold">
        Table T1
      </span>
    </div>
  );
}

// The menu as a guest sees it: categories, items with USD first then LBP, and the order bar once something is added.
export function MenuScreen() {
  const items = [
    { name: "Halloumi sandwich", usd: "6.50", qty: 1 },
    { name: "Za'atar man'oushe", usd: "2.75", qty: 0 },
    { name: "Fattoush", usd: "5.25", qty: 0 },
    { name: "Labneh wrap", usd: "4.00", qty: 0, soldOut: true },
  ];
  return (
    <div className="flex h-[calc(100%-1.75rem)] flex-col">
      <TableHeader />
      <div className="border-border-subtle flex border-b px-1">
        {["Hot drinks", "Cold drinks", "Food"].map((name) => (
          <span
            key={name}
            className={`flex-1 border-b-[3px] py-2 text-center text-xs font-semibold ${name === "Food" ? "border-primary text-primary" : "text-ink-muted border-transparent"}`}
          >
            {name}
          </span>
        ))}
      </div>
      <ul className="flex flex-col gap-2 px-3.5 pt-3">
        {items.map((item) => (
          <li
            key={item.name}
            className={`flex items-center gap-2 rounded-2xl border p-3 ${item.soldOut ? "bg-surface-muted" : "bg-surface"} ${item.qty ? "border-accent shadow-[0_0_0_3px_var(--brand-accent-tint)]" : "border-border-subtle"}`}
          >
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-semibold ${item.soldOut ? "text-ink-muted" : ""}`}>{item.name}</p>
              <p className="flex items-baseline gap-1.5 tabular-nums">
                <span className={`text-sm font-bold ${item.soldOut ? "text-ink-muted" : ""}`}>{formatUSD(item.usd)}</span>
                <span className="text-ink-muted text-[11px]">{lbp(item.usd)}</span>
              </p>
            </div>
            {item.soldOut ? (
              <StatusBadge status="SOLD_OUT" className="!px-2 !text-[11px]" />
            ) : item.qty ? (
              <MiniStepper value={item.qty} />
            ) : (
              <AddDot />
            )}
          </li>
        ))}
      </ul>
      <div className="mt-auto px-3.5 pb-4">
        <div className="bg-primary text-on-primary flex items-center justify-between rounded-2xl px-4 py-3 shadow-[var(--shadow-raised)]">
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="bg-accent text-ink flex size-5 items-center justify-center rounded-full text-[11px] font-bold">4</span>
            View order
          </span>
          <span className="text-[13px] font-bold tabular-nums">{formatUSD("16.00")}</span>
        </div>
      </div>
    </div>
  );
}

// The order before it is sent: lines, the total in both currencies, and the send button.
export function CartScreen() {
  return (
    <div className="flex h-[calc(100%-1.75rem)] flex-col">
      <TableHeader />
      <p className="px-4 pt-1 pb-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-secondary-ink">Your order</p>
      <ul className="bg-surface border-border-subtle mx-3.5 divide-y divide-border-subtle rounded-2xl border">
        {ORDER.map((line) => (
          <li key={line.name} className="flex items-center gap-2 p-3">
            <span className="bg-surface-muted flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums">{line.qty}×</span>
            <span className="flex-1 text-[13px] font-semibold">{line.name}</span>
            <span className="flex flex-col items-end tabular-nums">
              <span className="text-[13px] font-bold">{formatUSD(line.total)}</span>
              <span className="text-ink-muted text-[10px]">{lbp(line.total)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="px-4 pt-4">
        <p className="flex items-baseline justify-between tabular-nums">
          <span className="text-[13px] font-semibold">Total</span>
          <span className="text-lg font-bold">{formatUSD("16.00")}</span>
        </p>
        <p className="text-ink-muted text-right text-[11px] tabular-nums">{lbp("16.00")}</p>
      </div>
      <div className="mt-auto flex flex-col gap-2 px-3.5 pb-4">
        <div className="bg-primary text-on-primary rounded-2xl py-3 text-center text-sm font-semibold shadow-[0_0_0_3px_var(--brand-accent)]">
          Send to the kitchen
        </div>
        <p className="text-ink-muted text-center text-[11px]">Sent once, even if you tap twice.</p>
      </div>
    </div>
  );
}

// The phone camera pointed at the table's code, with amber corner marks.
export function ScanScreen({ qrUrl }: { qrUrl: string }) {
  return (
    <div className="bg-primary-hover absolute inset-0 flex flex-col items-center justify-center gap-5">
      <div className="relative rounded-2xl bg-white p-4">
        <QrCode value={qrUrl} label="QR code on the table" className="size-[132px]" />
        {[
          "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl",
          "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl",
          "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl",
          "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl",
        ].map((corner) => (
          <span key={corner} aria-hidden="true" className={`border-accent absolute -m-2 size-8 ${corner}`} />
        ))}
      </div>
      <div className="bg-surface text-ink flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-[var(--shadow-raised)]">
        <span className="bg-accent size-2 rounded-full" />
        Open tawilati.
      </div>
    </div>
  );
}

// ---------- Kitchen and staff screens ----------

type Ticket = { table: string; status: "NEW" | "PREPARING" | "READY"; lines: string[]; age: string; fresh?: boolean };

const TICKETS: Ticket[] = [
  { table: "T1", status: "NEW", lines: ["1 × Cappuccino", "1 × Halloumi sandwich", "2 × Fresh lemonade"], age: "just now", fresh: true },
  { table: "T4", status: "NEW", lines: ["2 × Espresso"], age: "1 min" },
  { table: "T3", status: "PREPARING", lines: ["1 × Fattoush", "1 × Espresso"], age: "4 min" },
  { table: "T2", status: "READY", lines: ["1 × Za'atar man'oushe"], age: "6 min" },
];

function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <li
      className={`bg-surface rounded-xl border p-3 ${ticket.fresh ? "border-accent shadow-[0_0_0_3px_var(--brand-accent-tint)]" : "border-border-subtle"}`}
    >
      <p className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold">
          {ticket.fresh && <span className="tw-ping bg-accent size-2 rounded-full" aria-hidden="true" />}
          Table {ticket.table}
        </span>
        <span className="text-ink-muted text-[11px]">{ticket.age}</span>
      </p>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-[13px] font-medium">
        {ticket.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </li>
  );
}

// The kitchen screen: one column per stage, a new ticket highlighted.
export function KitchenBoard({ className = "" }: { className?: string }) {
  const columns = [
    { status: "NEW", label: "New" },
    { status: "PREPARING", label: "Preparing" },
    { status: "READY", label: "Ready" },
  ] as const;
  return (
    <div role="img" aria-label="The kitchen screen: a new order from table T1 at the top of the New column, other tables preparing and ready." className={`bg-surface-secondary text-ink select-none ${className}`}>
      <div inert className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-lg font-bold">Kitchen</p>
          <span className="text-secondary-ink flex items-center gap-1.5 text-xs font-semibold">
            <span className="bg-accent size-2 rounded-full" aria-hidden="true" />
            Live
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.status} className={`flex flex-col gap-2 ${column.status === "READY" ? "hidden sm:flex" : ""}`}>
              <p className="flex items-center justify-between">
                <StatusBadge status={column.status}>{column.label}</StatusBadge>
              </p>
              <ul className="flex flex-col gap-2">
                {TICKETS.filter((ticket) => ticket.status === column.status).map((ticket) => (
                  <TicketCard key={ticket.table} ticket={ticket} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// The small notice that sits beside the hero phone: the order the phone just sent.
export function KitchenNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`border-border-subtle bg-surface rounded-2xl border p-4 shadow-[var(--shadow-raised)] ${className}`}>
      <p className="text-secondary-ink flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase">
        <span className="tw-ping bg-accent size-2.5 rounded-full" aria-hidden="true" />
        Kitchen screen
      </p>
      <p className="mt-2 flex items-center justify-between gap-3">
        <span className="font-bold">Table T1</span>
        <StatusBadge status="NEW" />
      </p>
      <ul className="mt-1.5 text-sm font-medium">
        <li>1 × Cappuccino</li>
        <li>1 × Halloumi sandwich</li>
        <li>2 × Fresh lemonade</li>
      </ul>
    </div>
  );
}

// A printed table stand: the code the guest scans, with the table's name.
export function TableTent({ qrUrl, className = "" }: { qrUrl: string; className?: string }) {
  return (
    <div className={`border-border-subtle bg-surface relative w-[210px] rounded-2xl border p-5 text-center shadow-[var(--shadow-raised)] ${className}`}>
      <span aria-hidden="true" className="bg-accent absolute -top-px left-1/2 h-1.5 w-14 -translate-x-1/2 rounded-b-full" />
      <Logo className="mx-auto h-auto w-[92px]" />
      <QrCode value={qrUrl} label="QR code that opens the menu for table T1" className="mx-auto mt-4 aspect-square w-[130px]" />
      <p className="mt-3 text-sm font-semibold">Scan to view the menu.</p>
      <p className="text-ink-muted text-xs">Table T1</p>
    </div>
  );
}

// ---------- Owner and waiter pages ----------

const MENU_ROWS = [
  { name: "Fresh lemonade", usd: "3.00", soldOut: false, hint: true },
  { name: "Iced latte", usd: "4.00", soldOut: true, hint: false },
  { name: "Espresso", usd: "2.50", soldOut: false, hint: false },
];

// The owner's menu page with the sold-out switch the kitchen reaches for during service.
export function MenuManagerPreview() {
  return (
    <div className="bg-surface-secondary p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xl font-bold">Menu</p>
        <span className="bg-primary text-on-primary rounded-lg px-3 py-1.5 text-sm font-semibold">+ Add item</span>
      </div>
      <div className="border-border-subtle mb-3 flex overflow-hidden border-b text-sm font-semibold">
        {["All", "Hot drinks", "Cold drinks", "Food"].map((name) => (
          <span key={name} className={`border-b-[3px] px-3 py-2 whitespace-nowrap ${name === "Cold drinks" ? "border-primary text-primary" : "text-ink-muted border-transparent"}`}>
            {name}
          </span>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {MENU_ROWS.map((row) => (
          <li key={row.name} className={`border-border-subtle flex items-center gap-3 rounded-2xl border p-3.5 ${row.soldOut ? "bg-surface-muted" : "bg-surface"}`}>
            <div className="min-w-0 flex-1">
              <p className={`text-[15px] font-semibold ${row.soldOut ? "text-ink-muted" : ""}`}>{row.name}</p>
              <p className="flex items-baseline gap-2 tabular-nums">
                <span className={`text-base font-bold ${row.soldOut ? "text-ink-muted" : ""}`}>{formatUSD(row.usd)}</span>
                <span className="text-ink-muted text-xs">{lbp(row.usd)}</span>
              </p>
            </div>
            {row.soldOut && <StatusBadge status="SOLD_OUT" />}
            <span
              className={`bg-primary-tint text-primary rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap ${row.hint ? "shadow-[0_0_0_3px_var(--brand-accent)]" : ""}`}
            >
              {row.soldOut ? "Back in stock" : "Mark sold out"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TABLES: { table: string; status: "NEW" | "PREPARING" | "READY" | "SERVED"; note: string; total: string; action?: string }[] = [
  { table: "T1", status: "NEW", note: "4 items", total: "16.00" },
  { table: "T2", status: "READY", note: "1 item", total: "2.75", action: "Mark served" },
  { table: "T3", status: "PREPARING", note: "3 items", total: "11.25" },
  { table: "T5", status: "SERVED", note: "Bill open", total: "12.25", action: "Close bill" },
];

// The waiter's view of the tables: where each order stands, and the one thing to do next.
export function OrdersPreview() {
  return (
    <div className="bg-surface-secondary p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xl font-bold">Tables</p>
        <span className="text-secondary-ink flex items-center gap-1.5 text-xs font-semibold">
          <span className="bg-accent size-2 rounded-full" aria-hidden="true" />
          Live
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {TABLES.map((row) => (
          <li key={row.table} className="bg-surface border-border-subtle flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border p-3.5">
            <span className="bg-primary-tint text-primary flex size-10 items-center justify-center rounded-xl text-sm font-bold">{row.table}</span>
            <div className="min-w-0 flex-1 basis-28">
              <p className="text-sm font-semibold">{row.note}</p>
              <p className="text-ink-muted text-xs tabular-nums">{formatUSD(row.total)} · {lbp(row.total)}</p>
            </div>
            <StatusBadge status={row.status} />
            {row.action ? (
              <span className={`bg-primary-tint text-primary flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap ${row.status === "READY" ? "shadow-[0_0_0_3px_var(--brand-accent)]" : ""}`}>
                {row.status === "READY" && <CheckIcon className="size-4" />}
                {row.action}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
