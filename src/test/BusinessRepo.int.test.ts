import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { businessRepo } from "@/repository/BusinessRepo";

const run = randomBytes(4).toString("hex");

let businessId: string | undefined;
let itemId: string | undefined;

beforeAll(async () => {
  const business = await prisma.business.create({
    data: {
      name: `Business Repo Test ${run}`,
      slug: `business-repo-test-${run}`,
      exchangeRate: "89500",
      timezone: "Asia/Beirut",
    },
  });
  businessId = business.id;

  const category = await prisma.menuCategory.create({
    data: { businessId, name: "Drinks" },
  });

  const item = await prisma.menuItem.create({
    data: {
      businessId,
      categoryId: category.id,
      name: "Most expensive",
      priceUSD: "99999.00",
      priceLBP: "8949910500.00",
    },
  });
  itemId = item.id;
});

afterAll(async () => {
  try {
    if (businessId) {
      // Delete only records created for this test run.
      await prisma.menuItem.deleteMany({ where: { businessId } });
      await prisma.menuCategory.deleteMany({ where: { businessId } });
      await prisma.business.deleteMany({ where: { id: businessId } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe("businessRepo.updateSettings", () => {
  // Calls the repository directly, as if a price had been raised after the service's limit check.
  it("rolls the new rate back when a repriced item no longer fits priceLBP", async () => {
    // 99999 USD x 200000 = 19,999,800,000 LBP, above Decimal(12,2).
    await expect(
      businessRepo.updateSettings(businessId!, { exchangeRate: new Prisma.Decimal("200000") }),
    ).rejects.toMatchObject({ status: 400, message: "invalid_exchange_rate" });

    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const item = await prisma.menuItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(business.exchangeRate.toString()).toBe("89500");
    expect(item.priceLBP.toFixed(2)).toBe("8949910500.00");
  });

  it("reprices every item with the new rate", async () => {
    await businessRepo.updateSettings(businessId!, { exchangeRate: new Prisma.Decimal("90000") });

    const item = await prisma.menuItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.priceLBP.toFixed(2)).toBe("8999910000.00");
  });
});
