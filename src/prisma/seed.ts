// src/prisma/seed.ts
// Demo data so everyone tests against the same café.
// Safe to re-run: deletes ALL previous demo rows (users, orders, sessions, payments, submissions) before recreating.

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "../app/generated/prisma/client";
import { prisma } from "../lib/db";
import { makeSlug } from "../utils/slug";

const BUSINESS_NAME = "Tawilati Demo Café";
const EXCHANGE_RATE = new Prisma.Decimal("89500");
const OWNER_EMAIL = "owner@tawilati.com";
const OWNER_PASSWORD = "Secret123";

const demoToken = (label: string) =>
  createHash("sha256").update(`tawilati-demo-${label}`).digest("hex");

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
  // ─────────────────────────────────────────────────────────────
  // 1. Delete ALL dependent rows of the previous demo business.
  //    Order matters: deepest dependents first.
  // ─────────────────────────────────────────────────────────────
  const previous = await prisma.business.findMany({
    where: { name: BUSINESS_NAME },
    select: { id: true },
  });

  if (previous.length > 0) {
    const ids = previous.map((b) => b.id);

    await prisma.$transaction(async (tx) => {
      // Payments → reference TableSession
      await tx.payment.deleteMany({
        where: { session: { businessId: { in: ids } } },
      });

      // GuestSessions → reference TableSession
      await tx.guestSession.deleteMany({
        where: { session: { businessId: { in: ids } } },
      });

      // OrderLines → reference DiningOrder
      await tx.orderLine.deleteMany({
        where: { order: { businessId: { in: ids } } },
      });

      // Submissions → reference Business + DiningOrder
      await tx.submission.deleteMany({
        where: { businessId: { in: ids } },
      });

      // Now DiningOrders have no lines, no submissions → safe to delete
      await tx.diningOrder.deleteMany({
        where: { businessId: { in: ids } },
      });

      // Now TableSessions have no payments, no guests, no orders → safe to delete
      await tx.tableSession.deleteMany({
        where: { businessId: { in: ids } },
      });

      // DiningTables have no sessions, no orders → safe to delete
      await tx.diningTable.deleteMany({
        where: { businessId: { in: ids } },
      });

      // MenuItems have no order lines → safe to delete
      await tx.menuItem.deleteMany({
        where: { businessId: { in: ids } },
      });

      // MenuCategories have no items → safe to delete
      await tx.menuCategory.deleteMany({
        where: { businessId: { in: ids } },
      });

      // Users → reference Business
      await tx.user.deleteMany({
        where: { businessId: { in: ids } },
      });

      // Finally the Business itself
      await tx.business.deleteMany({
        where: { id: { in: ids } },
      });
    });

    console.log(`Deleted previous "${BUSINESS_NAME}" and all dependent rows.`);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Create the demo business + tables + menu + owner
  // ─────────────────────────────────────────────────────────────
  const business = await prisma.business.create({
    data: {
      name: BUSINESS_NAME,
      slug: makeSlug(BUSINESS_NAME, "cafe"),
      exchangeRate: EXCHANGE_RATE,
      timezone: "Asia/Beirut",
      tables: {
        create: ["T1", "T2"].map((label) => ({
          label,
          slug: makeSlug(label, "table"),
          qrToken: demoToken(label),
        })),
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
          priceLBP: new Prisma.Decimal(priceUSD)
            .times(EXCHANGE_RATE)
            .toDecimalPlaces(0),
          soldOut,
        },
      });
    }
  }

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
  await prisma.user.create({
    data: {
      businessId: business.id,
      name: "Demo Owner",
      email: OWNER_EMAIL,
      passwordHash,
      role: "OWNER",
    },
  });

  console.log(`Seeded "${business.name}".`);
  console.log(`  Owner: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
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