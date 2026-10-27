import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Overview · Tawilati" };

export default function OwnerHomePage() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Overview</h1>
      <Card>
        <p className="text-sm text-ink-muted">Today&apos;s orders, sales and tables will show here.</p>
      </Card>
    </div>
  );
}
