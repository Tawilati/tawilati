import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NAV_BY_ROLE, ROLE_LABEL } from "@/components/staff/navigation";
import { StaffShell } from "@/components/staff/StaffShell";
import { Card } from "@/components/ui";
import { ROLE, toRole } from "@/types/Roles";

export const metadata: Metadata = { title: "Staff layout · Tawilati" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Preview of the staff frame for one role: /styleguide/shell?role=OWNER|KITCHEN|WAITER. Not served in production.
export default function ShellPreviewPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === "production") notFound();
  // The role comes from the address, which is only known at request time.
  return (
    <Suspense>
      <ShellPreview searchParams={searchParams} />
    </Suspense>
  );
}

async function ShellPreview({ searchParams }: { searchParams: SearchParams }) {
  const { role: requested } = await searchParams;
  const role = toRole(typeof requested === "string" ? requested : "") ?? ROLE.OWNER;

  return (
    <StaffShell role={role} userName="Souad" businessName="Tawilati Demo Café">
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">{ROLE_LABEL[role]} preview</h1>
        <Card>
          <p className="text-sm text-ink-muted">
            The links go to {NAV_BY_ROLE[role].map((i) => i.href).join(", ")}. Those screens don&apos;t exist yet; this page only shows
            the frame. Resize the window below 768px to see the phone layout.
          </p>
        </Card>
      </div>
    </StaffShell>
  );
}
