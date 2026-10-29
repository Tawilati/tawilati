import type { Metadata } from "next";
import { StaffManager } from "@/components/dashboard/staff/StaffManager";

export const metadata: Metadata = { title: "Staff · Tawilati" };

export default function OwnerStaffPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <StaffManager />
    </div>
  );
}
