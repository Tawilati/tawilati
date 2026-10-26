"use client";

import { useEffect, useRef, useState } from "react";
import { TableIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import type { PublicMenu } from "@/service/MenuService";
import { newlySoldOut } from "@/utils/menuChanges";
import { CategoryTabs } from "./CategoryTabs";
import { MenuItemCard } from "./MenuItemCard";
import { MenuStateScreen, type MenuProblem } from "./MenuStateScreen";

// How often the open menu re-checks the server, so a sold-out switch reaches every open phone.
const REFRESH_MS = 10_000;
const NOTICE_MS = 6_000;

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

export function MenuView({
  initialMenu,
  businessSlug,
  qrToken,
}: {
  initialMenu: PublicMenu;
  businessSlug: string;
  qrToken: string;
}) {
  const [menu, setMenu] = useState(initialMenu);
  const [problem, setProblem] = useState<MenuProblem | null>(null);
  const [activeId, setActiveId] = useState(initialMenu.categories[0]?.id ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const menuRef = useRef(initialMenu);

  useEffect(() => {
    let stopped = false;

    async function refresh() {
      // A hidden tab or a locked phone doesn't need fresh data; we catch up when it's visible again.
      if (document.visibilityState !== "visible") return;
      try {
        const query = new URLSearchParams({ b: businessSlug, t: qrToken });
        const res = await fetch(`/api/menu?${query}`, { cache: "no-store" });
        if (stopped) return;
        if (res.ok) {
          const next: PublicMenu = await res.json();
          const soldOut = newlySoldOut(menuRef.current, next);
          menuRef.current = next;
          setMenu(next);
          if (soldOut.length > 0) setNotice(`${listFormat.format(soldOut)} just sold out`);
          return;
        }
        const body = await res.json().catch(() => null);
        if (body?.message === "invalid_qr" || body?.message === "table_disabled") setProblem(body.message);
      } catch {
        // Offline or a server hiccup: keep showing the last menu and try again on the next tick.
      }
    }

    const timer = setInterval(refresh, REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [businessSlug, qrToken]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (problem) return <MenuStateScreen problem={problem} />;
  if (menu.categories.length === 0) return <MenuStateScreen problem="empty_menu" />;

  // If the selected category disappears after a refresh, fall back to the first one.
  const active = menu.categories.find((c) => c.id === activeId) ?? menu.categories[0];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <header className="flex flex-col gap-1 px-[max(18px,env(safe-area-inset-left,0px))] pt-6 pb-3.5">
        <h1 className="text-[22px] leading-tight font-bold text-balance">{menu.business.name}</h1>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary-tint px-2.5 py-0.5 text-[13px] font-semibold text-primary">
          <TableIcon className="size-3.5" />
          Table {menu.table.label}
        </span>
      </header>

      <CategoryTabs categories={menu.categories} activeId={active.id} onSelect={setActiveId} />

      <main className="flex-1">
        <ul
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          className="flex flex-col gap-2.5 px-[max(18px,env(safe-area-inset-left,0px))] pt-4"
        >
          {active.items.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </ul>
      </main>

      <footer className="flex flex-col items-center gap-1.5 px-4 pt-7 pb-[max(32px,env(safe-area-inset-bottom,0px))] text-xs text-ink-muted">
        Ordering by
        <Logo className="h-auto w-[104px]" />
      </footer>

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 flex justify-center px-3"
        style={{ bottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}
      >
        {notice && (
          <p className="flex w-full max-w-md flex-col rounded-2xl border border-border-subtle bg-surface px-3.5 py-3 text-left shadow-[var(--shadow-raised)]">
            <strong className="text-sm">{notice}</strong>
            <span className="text-[13px] text-ink-muted">The menu is up to date.</span>
          </p>
        )}
      </div>
    </div>
  );
}
