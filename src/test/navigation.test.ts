import { describe, expect, it } from "vitest";
import { ROLE } from "@/types/Roles";
import { homeFor, isActive, NAV_BY_ROLE } from "@/components/staff/navigation";

describe("staff navigation", () => {
  it("sends each role to its own first screen", () => {
    expect(homeFor(ROLE.OWNER)).toBe("/dashboard");
    expect(homeFor(ROLE.KITCHEN)).toBe("/kitchen");
    expect(homeFor(ROLE.WAITER)).toBe("/waiter");
  });

  it("highlights a section's home only on its exact path", () => {
    const overview = NAV_BY_ROLE[ROLE.OWNER][0];
    expect(isActive(overview, "/dashboard")).toBe(true);
    expect(isActive(overview, "/dashboard/menu")).toBe(false);
  });

  it("highlights other screens on their sub-pages too", () => {
    const menu = NAV_BY_ROLE[ROLE.OWNER][1];
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

describe("phone bottom bar", () => {
  it("keeps every role's bar to four screens plus More", () => {
    for (const role of [ROLE.OWNER, ROLE.KITCHEN, ROLE.WAITER]) {
      expect(NAV_BY_ROLE[role].filter((i) => !i.phoneMore).length).toBeLessThanOrEqual(4);
    }
  });
});
