// Demo data so everyone tests against the same café. Run with `npm run db:seed`.
// Safe to re-run: the demo business is deleted and recreated each time, with the same QR tokens.
import { createHash } from "node:crypto";
import { Prisma } from "../app/generated/prisma/client";
import { prisma } from "../lib/db";
import { makeSlug } from "../server/slug";

const BUSINESS_NAME = "Tawilati Demo Café";
const EXCHANGE_RATE = new Prisma.Decimal("89500");

// Fixed tokens keep the demo QR links stable across re-seeds. Real tables get random tokens.
const demoToken = (label: string) => createHash("sha256").update(`tawilati-demo-${label}`).digest("hex");

const menu: Record<string, [name: string, priceUSD: string, soldOut?: boolean][]> = {
  "Hot drinks": [
    ["Espresso", "2.50"],
    ["Cappuccino", "3.50"],
    ["Turkish coffee", "2.00"],
  ],
  "Cold drinks": [
    ["Fresh lemonade", "3.00"],
    ["Iced latte", "4.00", true],
  ],
  Food: [
    ["Halloumi sandwich", "6.50"],
    ["Za'atar man'oushe", "2.75"],
    ["Fattoush", "5.25"],
  ],
};

async function main() {
  const old = await prisma.business.findMany({ where: { name: BUSINESS_NAME }, select: { id: true } });
  if (old.length > 0) {
    const ids = old.map((b) => b.id);
    // Items first: MenuItem → MenuCategory is RESTRICT, so the business cascade can't remove them in one go.
    await prisma.menuItem.deleteMany({ where: { businessId: { in: ids } } });
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
  }

  const business = await prisma.business.create({
    data: {
      name: BUSINESS_NAME,
      slug: makeSlug(BUSINESS_NAME, "cafe"),
      exchangeRate: EXCHANGE_RATE,
      timezone: "Asia/Beirut",
      tables: {
        create: ["T1", "T2"].map((label) => ({ label, slug: makeSlug(label, "table"), qrToken: demoToken(label) })),
      },
    },
    include: { tables: true },
  });

  for (const [categoryName, items] of Object.entries(menu)) {
    const category = await prisma.menuCategory.create({
      data: { businessId: business.id, name: categoryName },
    });
    for (const [name, priceUSD, soldOut = false] of items) {
      await prisma.menuItem.create({
        data: {
          businessId: business.id,
          categoryId: category.id,
          name,
          priceUSD,
          priceLBP: new Prisma.Decimal(priceUSD).times(EXCHANGE_RATE).toDecimalPlaces(0),
          soldOut,
        },
      });
    }
  }

  console.log(`Seeded "${business.name}".`);
  for (const table of business.tables) {
    console.log(`  ${table.label} customer link: /menu/${business.slug}/${table.slug}?t=${table.qrToken}`);
    console.log(`  ${table.label} API:           /api/menu?b=${business.slug}&t=${table.qrToken}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
