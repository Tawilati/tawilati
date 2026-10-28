import type { Metadata } from "next";
import { MenuManager } from "@/components/dashboard/menu/MenuManager";

export const metadata: Metadata = { title: "Menu · Tawilati" };

export default function OwnerMenuPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <MenuManager />
    </div>
  );
}
