import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";

const { deleteMany } = vi.hoisted(() => ({ deleteMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { menuCategory: { deleteMany } } }));
import { categoryRepo } from "@/repository/CategoryRepo";

beforeEach(() => vi.resetAllMocks());

describe("category deletion", () => {
  it("reports a conflict if an item is added after the empty-category check", async () => {
    deleteMany.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Foreign key", {
      code: "P2003", clientVersion: "test",
    }));
    await expect(categoryRepo.delete("category", "business")).rejects.toMatchObject({
      status: 409, message: "category_has_items",
    });
  });

  it("does not hide database failures", async () => {
    const failure = new Error("Database unavailable");
    deleteMany.mockRejectedValue(failure);
    await expect(categoryRepo.delete("category", "business")).rejects.toBe(failure);
  });
});
