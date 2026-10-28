import type { ComponentType, SVGProps } from "react";
import {
  HomeIcon,
  KitchenIcon,
  MenuIcon,
  PaymentIcon,
  ReportsIcon,
  SettingsIcon,
  StaffIcon,
  TablesIcon,
} from "@/components/icons";
import { ROLE } from "@/types/Roles";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // Only highlight on this exact path (for a section's home, which is a prefix of every other page).
  exact?: boolean;
  // On a phone, list it under "More" instead of in the bottom bar.
  phoneMore?: boolean;
  // On a laptop, list it in the account menu (with Sign out) instead of the main sidebar.
  accountMenu?: boolean;
  // Not built yet: listed greyed out with a "Soon" label, and not a link.
  soon?: boolean;
};

// The screens each role can open, in menu order. The first one is where the role lands after signing in.
export const NAV_BY_ROLE: Record<ROLE, NavItem[]> = {
  [ROLE.OWNER]: [
    { href: "/dashboard", label: "Overview", icon: HomeIcon, exact: true },
    { href: "/dashboard/menu", label: "Menu", icon: MenuIcon },
    { href: "/dashboard/tables", label: "Tables", icon: TablesIcon, soon: true },
    { href: "/dashboard/staff", label: "Staff", icon: StaffIcon, phoneMore: true },
    { href: "/dashboard/reports", label: "Reports", icon: ReportsIcon, soon: true },
    { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon, phoneMore: true, accountMenu: true },
  ],
  [ROLE.KITCHEN]: [
    { href: "/kitchen", label: "Kitchen", icon: KitchenIcon, exact: true },
    { href: "/kitchen/sold-out", label: "Sold out", icon: MenuIcon },
  ],
  [ROLE.WAITER]: [
    { href: "/waiter", label: "Tables", icon: TablesIcon, exact: true },
    { href: "/waiter/bills", label: "Bills", icon: PaymentIcon },
  ],
};

export const ROLE_LABEL: Record<ROLE, string> = {
  [ROLE.OWNER]: "Owner",
  [ROLE.KITCHEN]: "Kitchen",
  [ROLE.WAITER]: "Waiter",
};

export function homeFor(role: ROLE): string {
  return NAV_BY_ROLE[role][0].href;
}

export function isActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
