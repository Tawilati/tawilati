import type { Metadata } from "next";
import { SettingsManager } from "@/components/dashboard/settings/SettingsManager";

export const metadata: Metadata = { title: "Settings · Tawilati" };

export default function OwnerSettingsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <SettingsManager />
    </div>
  );
}
