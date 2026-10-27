import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { requireStaff } from "@/lib/auth/staffSession";
import type { ROLE } from "@/types/Roles";
import { StaffShell } from "./StaffShell";

// The layout of one role's area (/dashboard, /kitchen, /waiter): checks who is signed in, then shows
// the screen inside the staff frame. The check reads the request, so it streams in behind Suspense.
export function StaffArea({ role, children }: { role: ROLE; children: ReactNode }) {
  return (
    <Suspense fallback={<StaffAreaLoading />}>
      <SignedInShell role={role}>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ role, children }: { role: ROLE; children: ReactNode }) {
  const staff = await requireStaff(role);
  return (
    <StaffShell role={staff.role} userName={staff.name} businessName={staff.businessName}>
      {children}
    </StaffShell>
  );
}

function StaffAreaLoading() {
  return (
    <div className="flex flex-1 items-center justify-center" role="status">
      <Logo variant="icon" className="h-10 w-auto animate-pulse" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
