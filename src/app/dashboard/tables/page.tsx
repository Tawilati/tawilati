import type { Metadata } from "next";
import { TablesManager } from "@/components/dashboard/tables/TablesManager";

export const metadata: Metadata = { title: "Tables · Tawilati" };

export default function OwnerTablesPage() {
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <TablesManager />
    </div>
  );
}
