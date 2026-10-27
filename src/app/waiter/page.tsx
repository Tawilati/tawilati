import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Tables · Tawilati" };

export default function WaiterHomePage() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Tables</h1>
      <Card>
        <p className="text-sm text-ink-muted">Your tables and their bills will show here.</p>
      </Card>
    </div>
  );
}
