import type { Metadata } from "next";
import { IntegrationsManager } from "@/components/dashboard/integrations/IntegrationsManager";

export const metadata: Metadata = { title: "AI integrations · Tawilati" };

export default function OwnerIntegrationsPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <IntegrationsManager />
    </div>
  );
}
