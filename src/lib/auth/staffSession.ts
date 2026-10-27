import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { homeFor } from "@/components/staff/navigation";
import { userService } from "@/service/UserService";
import { ROLE, toRole } from "@/types/Roles";

export type StaffSession = {
  userId: string;
  name: string;
  role: ROLE;
  businessId: string;
  businessName: string;
};

// For a staff screen: who is signed in, checked against the database, and allowed only in their own area.
// src/proxy.ts has already verified the token (or sent the person to /login) and set the x-user-* headers;
// any copy sent by the browser is dropped there. Reads the request, so call it inside a <Suspense>.
//   - no session, user gone or deactivated → /login
//   - wrong area (a waiter opening /dashboard) → that person's own first screen
export async function requireStaff(area: ROLE): Promise<StaffSession> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-user-id");
  const businessId = requestHeaders.get("x-business-id");
  if (!userId || !businessId) redirect("/login");

  const profile = await userService.getStaffProfile(userId, businessId);
  const role = profile && toRole(profile.role);
  if (!profile || !role) redirect("/login");
  if (role !== area) redirect(homeFor(role));

  return { ...profile, role };
}
