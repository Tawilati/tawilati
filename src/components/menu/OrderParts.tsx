import { StatusBadge } from "@/components/ui";
import type { OrderResponse } from "@/types/Order";
import { formatLBP, formatUSD } from "@/utils/money";

export function Total({ label, usd, lbp }: { label: string; usd: string; lbp: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 font-bold tabular-nums">
      <span>{label}</span>
      <span className="flex flex-col items-end">
        <span className="text-[17px]">{formatUSD(usd)}</span>
        <span className="text-[13px] font-normal text-ink-muted">{formatLBP(lbp)}</span>
      </span>
    </div>
  );
}

export function RoundBadge({ status }: { status: OrderResponse["status"] }) {
  return status === "CANCELLED" ? <StatusBadge status="CLOSED">Cancelled</StatusBadge> : <StatusBadge status={status} />;
}
