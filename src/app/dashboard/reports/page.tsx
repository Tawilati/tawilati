import type { Metadata } from "next";
import { DailyReport } from "@/components/dashboard/reports/DailyReport";

export const metadata: Metadata = { title: "Reports · Tawilati" };

export default function OwnerReportsPage() {
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <DailyReport />
    </div>
  );
}
