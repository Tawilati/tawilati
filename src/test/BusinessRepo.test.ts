import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";

const { tx } = vi.hoisted(() => ({
  tx: { business: { update: vi.fn() }, $executeRaw: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  prisma: { $transaction: (run: (client: typeof tx) => unknown) => run(tx) },
}));
import { businessRepo } from "@/repository/BusinessRepo";

// The shape the pg driver adapter gives a raw query that Postgres refused.
function rawQueryFailure(originalCode: string) {
  return new Prisma.PrismaClientKnownRequestError("Raw query failed", {
    code: "P2010",
    clientVersion: "test",
    meta: { driverAdapterError: { name: "DriverAdapterError", cause: { originalCode } } },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  tx.business.update.mockResolvedValue({ id: "business" });
});

describe("business settings update", () => {
  it("answers invalid_exchange_rate if a menu price rose after the service's limit check", async () => {
    tx.$executeRaw.mockRejectedValue(rawQueryFailure("22003"));

    await expect(
      businessRepo.updateSettings("business", { exchangeRate: new Prisma.Decimal("200000") }),
    ).rejects.toMatchObject({ status: 400, message: "invalid_exchange_rate" });
  });

  it("does not hide other repricing failures", async () => {
    tx.$executeRaw.mockRejectedValue(rawQueryFailure("57014"));

    await expect(
      businessRepo.updateSettings("business", { exchangeRate: new Prisma.Decimal("90000") }),
    ).rejects.toMatchObject({ name: "DBException" });
  });

  it("does not reprice the menu when only the timezone changes", async () => {
    await businessRepo.updateSettings("business", { timezone: "UTC" });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});
