import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Kitchen · Tawilati" };

export default function KitchenHomePage() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Kitchen</h1>
      <Card>
        <p className="text-sm text-ink-muted">New orders will appear here as guests send them.</p>
      </Card>
    </div>
  );
}
