"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TablesIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import type { PublicMenu } from "@/types/Menu";
import { cartQty, MAX_CART_LINES } from "@/utils/guestCart";
import { newlySoldOut } from "@/utils/menuChanges";
import { formatUSD } from "@/utils/money";
import { CartSheet } from "./CartSheet";
import { CategoryTabs } from "./CategoryTabs";
import { MenuItemCard } from "./MenuItemCard";
import { MenuStateScreen, type MenuProblem } from "./MenuStateScreen";
import { useGuestCart } from "./useGuestCart";

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
  const [cartOpen, setCartOpen] = useState(false);
  const menuRef = useRef(initialMenu);
  const { lines, summary, submitting, closed, change, submit } = useGuestCart(menu, qrToken);

  const refresh = useCallback(async () => {
    // A hidden tab or a locked phone doesn't need fresh data; we catch up when it's visible again.
    if (document.visibilityState !== "visible") return;
    try {
      const query = new URLSearchParams({ b: businessSlug, t: qrToken });
      const res = await fetch(`/api/menu?${query}`, { cache: "no-store" });
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
  }, [businessSlug, qrToken]);

  useEffect(() => {
    const timer = setInterval(refresh, REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const submitOrder = useCallback(async () => {
    const outcome = await submit();
    // The server refused an item the menu here still shows: fetch it so the cart rows get flagged.
    if (outcome?.kind === "blocked") await refresh();
    if (outcome?.kind === "table_problem") setProblem(outcome.problem);
    return outcome;
  }, [submit, refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (problem) return <MenuStateScreen problem={problem} />;
  if (menu.categories.length === 0) return <MenuStateScreen problem="empty_menu" />;

  // If the selected category disappears after a refresh, fall back to the first one.
  const active = menu.categories.find((c) => c.id === activeId) ?? menu.categories[0];
  const hasCart = lines.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <header className="flex flex-col gap-1 px-[max(18px,env(safe-area-inset-left,0px))] pt-6 pb-3.5">
        <h1 className="text-[22px] leading-tight font-bold text-balance">{menu.business.name}</h1>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary-tint px-2.5 py-0.5 text-[13px] font-semibold text-primary">
          <TablesIcon className="size-3.5" />
          Table {menu.table.label}
        </span>
      </header>

      <CategoryTabs categories={menu.categories} activeId={active.id} onSelect={setActiveId} />
      {lines.length >= MAX_CART_LINES && (
        <p role="status" className="px-4 pt-3 text-sm text-ink-muted">Up to 50 different items per order. Remove an item to add another.</p>
      )}
      {closed && <p role="status" className="px-4 pt-3 text-sm text-ink-muted">This table&apos;s bill has been closed. Please ask a member of staff.</p>}

      <main className="flex-1">
        <fieldset disabled={closed || submitting} className="contents">
        <ul
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          className="flex flex-col gap-2.5 px-[max(18px,env(safe-area-inset-left,0px))] pt-4"
        >
          {active.items.map((item) => (
            <MenuItemCard key={item.id} item={item} qty={cartQty(lines, item.id)} onChange={change} canAdd={lines.length < MAX_CART_LINES} />
          ))}
        </ul>
        </fieldset>
      </main>

      <footer
        className={`flex flex-col items-center gap-1.5 px-4 pt-7 text-xs text-ink-muted ${
          hasCart ? "pb-[calc(88px+env(safe-area-inset-bottom,0px))]" : "pb-[max(32px,env(safe-area-inset-bottom,0px))]"
        }`}
      >
        Ordering by
        <Logo className="h-auto w-[104px]" />
      </footer>

      {hasCart && (
        <div
          className="fixed inset-x-0 z-30 flex justify-center px-3"
          style={{ bottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex min-h-[52px] w-full max-w-[552px] cursor-pointer items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 font-semibold text-on-primary shadow-[var(--shadow-raised)] hover:bg-primary-hover"
          >
            <span className="flex items-center gap-2.5">
              <span className="min-w-6 rounded-full bg-accent px-2 py-0.5 text-center text-[13px] font-bold text-ink tabular-nums">
                {summary.count}
              </span>
              View cart
            </span>
            <span className="tabular-nums">{formatUSD(summary.totalUSD)}</span>
          </button>
        </div>
      )}

      {cartOpen && (
        <CartSheet
          tableLabel={menu.table.label}
          summary={summary}
          submitting={submitting}
          closed={closed}
          onChange={change}
          onSubmit={submitOrder}
          onClose={() => setCartOpen(false)}
        />
      )}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-3"
        style={{
          bottom: hasCart
            ? "calc(76px + env(safe-area-inset-bottom, 0px))"
            : "max(16px, env(safe-area-inset-bottom, 0px))",
        }}
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
