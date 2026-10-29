"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronRightIcon, LogOutIcon, SettingsIcon, XIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { ConfirmDialog } from "@/components/ui";
import type { ROLE } from "@/types/Roles";
import { isActive, NAV_BY_ROLE, ROLE_LABEL, type NavItem } from "./navigation";


function NavLink({ item, pathname, compact = false }: { item: NavItem; pathname: string; compact?: boolean }) {
  const Icon = item.icon;
  const current = isActive(item, pathname);
  // A screen that isn't built yet: in its place so the menu doesn't move later, but not a link.
  if (item.soon) {
    if (compact) {
      return (
        <span
          aria-disabled="true"
          title="Coming soon"
          className="flex min-h-12 cursor-not-allowed flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[var(--text-disabled)]"
        >
          <Icon className="h-[26px] w-6" />
          {item.label}
        </span>
      );
    }
    return (
      <span aria-disabled="true" className="tw-nav__item">
        <Icon className="size-5" />
        {item.label}
        <span className="tw-nav__soon">Soon</span>
      </span>
    );
  }
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

// The frame around every staff screen. Tablet and laptop: sidebar, with the `accountMenu` screens and Sign out
// folded under the signed-in person's name (an arrow opens them). Phone: top bar + bottom bar, with the
// same items under "More".
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Sidebar account menu. Starts open on Staff or Settings, so the current screen stays visible.
  const [accountOpen, setAccountOpen] = useState(() =>
    NAV_BY_ROLE[role].some((item) => item.accountMenu && isActive(item, pathname)),
  );

  async function signOut() {
    setSigningOut(true);
    // Logout clears the auth cookies; whatever the answer, leave the staff area.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    // A full page load, not router.replace + refresh: those two raced, leaving this dialog spinning on the old screen.
    // `replace`, so Back doesn't return to the staff screen that was just signed out of.
    window.location.replace("/login");
  }
  const items = NAV_BY_ROLE[role];
  const sidebarItems = items.filter((item) => !item.accountMenu);
  const accountItems = items.filter((item) => item.accountMenu);
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
      {/* print:!hidden on the menus: a printed page (the table stickers) shows only the screen's content. */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-5 border-r border-border-subtle bg-surface px-3 py-5 md:flex print:!hidden">
        <Link href={items[0].href} className="ml-2 self-start">
          <Logo priority className="h-auto w-32" />
        </Link>
        <nav className="tw-nav" aria-label="Staff">
          {sidebarItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col border-t border-border-subtle pt-2">
          {accountOpen && (
            <div id="account-menu" className="flex flex-col gap-0.5 pb-1">
              {accountItems.length > 0 && (
                <nav className="tw-nav" aria-label="Account">
                  {accountItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </nav>
              )}
              <button type="button" onClick={() => setConfirmingSignOut(true)} className="tw-nav__item cursor-pointer text-ink-muted">
                <LogOutIcon className="size-5" />
                Sign out
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setAccountOpen((open) => !open)}
            aria-expanded={accountOpen}
            aria-controls="account-menu"
            className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-surface-muted"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="truncate font-semibold">{userName}</b>
              <span className="truncate text-ink-muted" title={businessName}>
                {ROLE_LABEL[role]} · {businessName}
              </span>
            </span>
            {/* Points up while closed (the menu opens above), down while open. */}
            <ChevronRightIcon
              aria-hidden="true"
              className={`size-5 shrink-0 text-ink-muted transition-transform ${accountOpen ? "rotate-90" : "-rotate-90"}`}
            />
            <span className="sr-only">{accountOpen ? "Hide account menu" : "Show account menu"}</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky z-20 flex items-center justify-between border-b border-border-subtle bg-surface px-4 py-3 md:hidden print:!hidden"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <Logo priority className="h-auto w-[104px]" />
          <span className="text-xs font-semibold text-secondary-ink">{ROLE_LABEL[role]}</span>
        </header>

        <main className="flex-1 px-4 py-5 pb-24 md:px-8 md:py-7 md:pb-7 print:!p-0">{children}</main>

        <nav
          aria-label="Staff"
          className="fixed inset-x-0 bottom-0 z-20 grid border-t border-border-subtle bg-surface px-1 pt-1.5 md:hidden print:!hidden"
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
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  setConfirmingSignOut(true);
                }}
                className="tw-nav__item cursor-pointer text-ink-muted"
              >
                <LogOutIcon className="size-5" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
      {confirmingSignOut && (
        <ConfirmDialog
          title="Sign out?"
          confirmLabel="Sign out"
          loading={signingOut}
          onConfirm={signOut}
          onCancel={() => setConfirmingSignOut(false)}
        >
          You&apos;ll need your email and password to get back in.
        </ConfirmDialog>
      )}
    </div>
  );
}
