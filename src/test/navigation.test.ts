import { describe, expect, it } from "vitest";
import { ROLE } from "@/types/Roles";
import { homeFor, isActive, NAV_BY_ROLE } from "@/components/staff/navigation";

describe("staff navigation", () => {
  it("sends each role to its own first screen", () => {
    expect(homeFor(ROLE.OWNER)).toBe("/dashboard/menu");
    expect(homeFor(ROLE.KITCHEN)).toBe("/kitchen");
    expect(homeFor(ROLE.WAITER)).toBe("/waiter");
  });

  it("highlights the exact-match screens only on their own path", () => {
    const kitchen = NAV_BY_ROLE[ROLE.KITCHEN][0];
    expect(isActive(kitchen, "/kitchen")).toBe(true);
    expect(isActive(kitchen, "/kitchen/sold-out")).toBe(false);
  });

  it("highlights other screens on their sub-pages too", () => {
    const menu = NAV_BY_ROLE[ROLE.OWNER][0];
    expect(isActive(menu, "/dashboard/menu")).toBe(true);
    expect(isActive(menu, "/dashboard/menu/new")).toBe(true);
    expect(isActive(menu, "/dashboard/menus")).toBe(false);
  });

  it("never shows owner screens to kitchen or waiter staff", () => {
    const ownerOnly = ["/dashboard/staff", "/dashboard/reports", "/dashboard/settings"];
    for (const role of [ROLE.KITCHEN, ROLE.WAITER]) {
      const hrefs = NAV_BY_ROLE[role].map((i) => i.href);
      expect(hrefs.filter((href) => href.startsWith("/dashboard"))).toEqual([]);
      for (const href of ownerOnly) expect(hrefs).not.toContain(href);
    }
  });
});

describe("screens not built yet", () => {
  it("lists the owner's Reports as coming soon", () => {
    const soon = NAV_BY_ROLE[ROLE.OWNER].filter((i) => i.soon).map((i) => i.href);
    expect(soon).toEqual(["/dashboard/reports"]);
  });

  it("never makes a role's landing screen a coming-soon one", () => {
    for (const role of [ROLE.OWNER, ROLE.KITCHEN, ROLE.WAITER]) {
      expect(NAV_BY_ROLE[role][0].soon).toBeFalsy();
    }
  });
});

describe("phone bottom bar", () => {
  it("keeps every role's bar to four screens plus More", () => {
    for (const role of [ROLE.OWNER, ROLE.KITCHEN, ROLE.WAITER]) {
      expect(NAV_BY_ROLE[role].filter((i) => !i.phoneMore).length).toBeLessThanOrEqual(4);
    }
  });
});

describe("sidebar", () => {
  it("lists Staff in the owner's main sidebar and keeps only Settings in the account menu", () => {
    const owner = NAV_BY_ROLE[ROLE.OWNER];
    expect(owner.find((i) => i.href === "/dashboard/staff")?.accountMenu).toBeFalsy();
    expect(owner.filter((i) => i.accountMenu).map((i) => i.href)).toEqual(["/dashboard/settings"]);
  });
});

describe("owner screens", () => {
  it("has no overview and puts Staff in the phone bottom bar", () => {
    const owner = NAV_BY_ROLE[ROLE.OWNER];
    expect(owner.map((i) => i.href)).not.toContain("/dashboard");
    const bar = owner.filter((i) => !i.phoneMore).map((i) => i.href);
    expect(bar).toEqual(["/dashboard/menu", "/dashboard/tables", "/dashboard/staff", "/dashboard/reports"]);
  });
});
