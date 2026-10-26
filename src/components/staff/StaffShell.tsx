"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOutIcon, SettingsIcon, XIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import type { ROLE } from "@/types/Roles";
import { isActive, NAV_BY_ROLE, ROLE_LABEL, type NavItem } from "./navigation";


function NavLink({ item, pathname, compact = false }: { item: NavItem; pathname: string; compact?: boolean }) {
  const Icon = item.icon;
  const current = isActive(item, pathname);
  if (compact) {
    return (
      <Link
        href={item.href}
        aria-current={current ? "page" : undefined}
        className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] ${
          current ? "font-bold text-primary" : "font-medium text-ink-muted"
        }`}
      >
        <Icon className={`h-[26px] ${current ? "w-11 rounded-full bg-[var(--brand-secondary-tint)] px-2.5 py-0.5" : "w-6"}`} />
        {item.label}
      </Link>
    );
  }
  return (
    <Link href={item.href} aria-current={current ? "page" : undefined} className="tw-nav__item">
      <Icon className="size-5" />
      {item.label}
    </Link>
  );
}

// The frame around every staff screen. Tablet and laptop: sidebar. Phone: top bar + bottom bar, with the
// `phoneMore` screens, the signed-in person and Sign out under "More".
export function StaffShell({
  role,
  userName,
  businessName,
  children,
}: {
  role: ROLE;
  userName: string;
  businessName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  async function signOut() {
    // Logout clears the auth cookies; whatever the answer, leave the staff area.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }
  const items = NAV_BY_ROLE[role];
  const barItems = items.filter((item) => !item.phoneMore);
  const moreItems = items.filter((item) => item.phoneMore);

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-5 border-r border-border-subtle bg-surface px-3 py-5 md:flex">
        <Link href={items[0].href} className="ml-2 self-start">
          <Logo className="h-auto w-32" />
        </Link>
        <nav className="tw-nav" aria-label="Staff">
          {items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border-subtle px-2 pt-3 text-[13px]">
          <b className="font-semibold">{userName}</b>
          <span className="text-ink-muted">
            {ROLE_LABEL[role]} · {businessName}
          </span>
          <button type="button" onClick={signOut} className="tw-nav__item -mx-2 mt-1.5 cursor-pointer text-ink-muted">
            <LogOutIcon className="size-5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky z-20 flex items-center justify-between border-b border-border-subtle bg-surface px-4 py-3 md:hidden"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <Logo className="h-auto w-[104px]" />
          <span className="text-xs font-semibold text-secondary-ink">{ROLE_LABEL[role]}</span>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 md:px-8 md:py-7 md:pb-7">{children}</main>

        <nav
          aria-label="Staff"
          className="fixed inset-x-0 bottom-0 z-20 grid border-t border-border-subtle bg-surface px-1 pt-1.5 md:hidden"
          style={{
            gridTemplateColumns: `repeat(${barItems.length + 1}, minmax(0, 1fr))`,
            paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
          }}
        >
          {barItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} compact />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className="flex min-h-12 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-medium text-ink-muted"
          >
            <SettingsIcon className="h-[26px] w-6" />
            More
          </button>
        </nav>

        {moreOpen && (
          <div className="fixed inset-0 z-30 flex items-end bg-[rgb(32_43_38/0.35)] md:hidden" onClick={() => setMoreOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="More"
              className="flex w-full flex-col gap-1 rounded-t-2xl bg-surface px-3 pt-3"
              style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex flex-col text-[13px]">
                  <b className="font-semibold">{userName}</b>
                  <span className="text-ink-muted">
                    {ROLE_LABEL[role]} · {businessName}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setMoreOpen(false)}
                  className="tw-field__action m-0 cursor-pointer"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
              <nav className="tw-nav" aria-label="More screens" onClick={() => setMoreOpen(false)}>
                {moreItems.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </nav>
              <button type="button" onClick={signOut} className="tw-nav__item cursor-pointer text-ink-muted">
                <LogOutIcon className="size-5" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
