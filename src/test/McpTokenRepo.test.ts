import { beforeEach, describe, expect, it, vi } from "vitest";

const { mcpToken } = vi.hoisted(() => ({
  mcpToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    updateManyAndReturn: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: { mcpToken } }));
import { mcpTokenRepo } from "@/repository/McpTokenRepo";

beforeEach(() => vi.resetAllMocks());

describe("finding an active token", () => {
  it("leaves out revoked and expired tokens", async () => {
    mcpToken.findFirst.mockResolvedValue(null);
    const before = Date.now();

    await expect(mcpTokenRepo.findActiveByHash("hash")).resolves.toBeNull();

    const { where } = mcpToken.findFirst.mock.calls[0][0];
    expect(where.tokenHash).toBe("hash");
    expect(where.revokedAt).toBeNull();
    expect(where.expiresAt.gt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("does not hide database failures", async () => {
    mcpToken.findFirst.mockRejectedValue(new Error("Database unavailable"));

    await expect(mcpTokenRepo.findActiveByHash("hash")).rejects.toMatchObject({
      name: "DBException", message: "Error loading MCP token: Database unavailable",
    });
  });
});

describe("listing and creating tokens", () => {
  it("never reads tokenHash back when listing", async () => {
    mcpToken.findMany.mockResolvedValue([]);

    await mcpTokenRepo.findManyByBusiness("business-1");

    const query = mcpToken.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ businessId: "business-1" });
    expect(query.select.tokenHash).toBeUndefined();
  });

  it("never reads tokenHash back when creating", async () => {
    mcpToken.create.mockResolvedValue({});

    await mcpTokenRepo.create({
      businessId: "business-1",
      userId: "user-1",
      name: "Claude Code",
      tokenHash: "hash",
      expiresAt: new Date(),
    });

    expect(mcpToken.create.mock.calls[0][0].select.tokenHash).toBeUndefined();
  });
});

describe("revoking a token", () => {
  it("only revokes an active token of the same business, and returns it without tokenHash", async () => {
    const revoked = { id: "token-1", revokedAt: new Date() };
    mcpToken.updateManyAndReturn.mockResolvedValue([revoked]);

    await expect(mcpTokenRepo.revoke("token-1", "business-1")).resolves.toBe(revoked);

    const query = mcpToken.updateManyAndReturn.mock.calls[0][0];
    expect(query.where).toEqual({ id: "token-1", businessId: "business-1", revokedAt: null });
    expect(query.select.tokenHash).toBeUndefined();
  });

  it("reports null when nothing matched", async () => {
    mcpToken.updateManyAndReturn.mockResolvedValue([]);

    await expect(mcpTokenRepo.revoke("token-1", "business-2")).resolves.toBeNull();
  });
});
