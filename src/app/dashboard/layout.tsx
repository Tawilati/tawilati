import { StaffArea } from "@/components/staff/StaffArea";
import { ROLE } from "@/types/Roles";

// Owner only. Kitchen and waiter accounts are sent to their own screens.
export default function OwnerLayout({ children }: LayoutProps<"/dashboard">) {
  return <StaffArea role={ROLE.OWNER}>{children}</StaffArea>;
}
