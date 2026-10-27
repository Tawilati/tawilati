import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET } from "@/app/api/menu/route";

// Two businesses, so we can prove one's QR code never opens the other's menu.
const token = () => randomBytes(32).toString("hex");
const tokens = { a: token(), aDisabled: token(), b: token() };
// Business names and slugs are unique, so each run uses its own.
const run = randomBytes(3).toString("hex");
const slugs = { a: `test-cafe-a-${run}`, b: `test-cafe-b-${run}` };
let businessA: { id: string };
let businessB: { id: string };

function getMenu(query: Record<string, string | number>) {
  const params = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  return GET(new NextRequest(`http://localhost/api/menu?${params}`));
}

beforeAll(async () => {
  businessA = await prisma.business.create({
    data: {
      name: `Test café A ${run}`,
      slug: slugs.a,
      exchangeRate: "89500",
      timezone: "Asia/Beirut",
      tables: {
        create: [
          { label: "T1", slug: "t1", qrToken: tokens.a },
          { label: "T2", slug: "t2", qrToken: tokens.aDisabled, isDisabled: true },
        ],
      },
    },
  });
  const drinks = await prisma.menuCategory.create({
    data: { businessId: businessA.id, name: "Drinks" },
  });
  await prisma.menuItem.createMany({
    data: [
      { businessId: businessA.id, categoryId: drinks.id, name: "Espresso", priceUSD: "2.50", priceLBP: "223750" },
      { businessId: businessA.id, categoryId: drinks.id, name: "Latte", priceUSD: "4.00", priceLBP: "358000", soldOut: true },
      { businessId: businessA.id, categoryId: drinks.id, name: "Old item", priceUSD: "1.00", priceLBP: "89500", archivedAt: new Date() },
    ],
  });

  businessB = await prisma.business.create({
    data: {
      name: `Test café B ${run}`,
      slug: slugs.b,
      exchangeRate: "89500",
      timezone: "Asia/Beirut",
      tables: { create: { label: "T1", slug: "t1", qrToken: tokens.b } },
      menuCategories: { create: { name: "Secret menu" } },
    },
  });
});

afterAll(async () => {
  const ids = [businessA?.id, businessB?.id].filter((id): id is string => Boolean(id));
  await prisma.menuItem.deleteMany({ where: { businessId: { in: ids } } });
  await prisma.business.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("GET /api/menu", () => {
  it("returns the table's menu, hiding archived items and keeping sold-out ones", async () => {
    const res = await getMenu({ b: slugs.a, t: tokens.a });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.business).toEqual({ id: businessA.id, name: `Test café A ${run}`, slug: slugs.a });
    expect(body.table).toMatchObject({ label: "T1", slug: "t1" });
    expect(body.categories).toHaveLength(1);
    expect(body.categories[0].items).toEqual([
      expect.objectContaining({ name: "Espresso", priceUSD: "2.50", priceLBP: "223750", soldOut: false }),
      expect.objectContaining({ name: "Latte", priceUSD: "4.00", priceLBP: "358000", soldOut: true }),
    ]);
  });

  it("does not open business B's table under business A's name", async () => {
    const res = await getMenu({ b: slugs.a, t: tokens.b });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ success: false, message: "invalid_qr" });
  });

  it("returns invalid_qr for an unknown token", async () => {
    const res = await getMenu({ b: slugs.a, t: token() });

    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe("invalid_qr");
  });

  it("returns table_disabled for a disabled table", async () => {
    const res = await getMenu({ b: slugs.a, t: tokens.aDisabled });

    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe("table_disabled");
  });

  it("returns validation_error for bad query parameters", async () => {
    const res = await getMenu({ b: "Not a slug", t: "short" });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, message: "validation_error" });
    expect(Object.keys(body.details).sort()).toEqual(["b", "t"]);
  });
});
