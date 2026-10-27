import { StaffArea } from "@/components/staff/StaffArea";
import { ROLE } from "@/types/Roles";

// Kitchen accounts only. Owners and waiters are sent to their own screens.
export default function KitchenLayout({ children }: LayoutProps<"/kitchen">) {
  return <StaffArea role={ROLE.KITCHEN}>{children}</StaffArea>;
}
