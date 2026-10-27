import { StaffArea } from "@/components/staff/StaffArea";
import { ROLE } from "@/types/Roles";

// Waiter accounts only. Owners and kitchen accounts are sent to their own screens.
export default function WaiterLayout({ children }: LayoutProps<"/waiter">) {
  return <StaffArea role={ROLE.WAITER}>{children}</StaffArea>;
}
