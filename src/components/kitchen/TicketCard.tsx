import { Button, StatusBadge } from "@/components/ui";
import { elapsedLabel } from "@/utils/waiterFloor";
import { isOverdue, type KitchenTicket } from "@/utils/kitchenQueue";

// The top band takes the status colour (brand --status-* tokens); the badge says it in words too.
const BAND: Record<KitchenTicket["status"], string> = {
  NEW: "bg-[var(--status-new-bg)]",
  PREPARING: "bg-[var(--status-preparing-bg)]",
};

// One round to cook: table, how long it has waited, the items, and the one button for the next step.
export function TicketCard({
  ticket,
  now,
  busy,
  onAdvance,
}: {
  ticket: KitchenTicket;
  now: number;
  busy: boolean;
  onAdvance: (ticket: KitchenTicket) => void;
}) {
  const late = isOverdue(ticket, now);
  const waited = elapsedLabel(ticket.createdAt, now);
  const next = ticket.status === "NEW" ? "Start" : "Ready";

  return (
    <article
      aria-label={`${ticket.tableLabel}, ${ticket.status === "NEW" ? "new" : "preparing"}, ${waited}${late ? ", overdue" : ""}`}
      className={`flex min-h-56 min-w-0 flex-col overflow-hidden rounded-2xl bg-surface ${
        late ? "border-2 border-danger" : "border border-border-subtle"
      }`}
    >
      <header className={`flex flex-col gap-1.5 px-4 pt-3 pb-2.5 ${BAND[ticket.status]}`}>
        <div className="flex min-w-0 items-baseline justify-between gap-2">
          <h2 className="truncate text-2xl font-bold lg:text-3xl">{ticket.tableLabel}</h2>
          {late ? (
            <span className="shrink-0 rounded-full bg-danger px-2.5 py-0.5 text-sm font-bold text-white tabular-nums">
              Late · {waited}
            </span>
          ) : (
            <span className="shrink-0 text-sm font-medium tabular-nums text-ink-muted">{waited}</span>
          )}
        </div>
        <StatusBadge status={ticket.status} className="self-start" />
      </header>

      <ul className="flex flex-1 flex-col gap-1.5 px-4 py-3 text-lg">
        {ticket.lines.map((line) => (
          <li key={line.menuItemId} className="flex gap-2 leading-snug">
            <span className="min-w-8 font-bold tabular-nums">{line.qty}×</span>
            <span className="min-w-0 break-words">{line.name}</span>
          </li>
        ))}
      </ul>

      <div className="px-4 pb-4">
        <Button block loading={busy} onClick={() => onAdvance(ticket)} aria-label={`${next} ${ticket.tableLabel}`}>
          {next}
        </Button>
      </div>
    </article>
  );
}
