import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveMcpTokenRecord, McpTokenRecord } from "@/types/McpToken";
import { ROLE } from "@/types/Roles";

const { repo } = vi.hoisted(() => ({
  repo: {
    create: vi.fn(),
    findActiveByHash: vi.fn(),
    touch: vi.fn(),
    findManyByBusiness: vi.fn(),
    revoke: vi.fn(),
  },
}));

vi.mock("@/repository/McpTokenRepo", () => ({
  mcpTokenRepo: repo,
}));

import { mcpTokenService } from "@/service/McpTokenService";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const record: McpTokenRecord = {
  id: "token-1",
  name: "Claude Code",
  expiresAt: new Date("2027-01-01T00:00:00.000Z"),
  revokedAt: null,
  lastUsedAt: null,
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  clientId: null,
};

const active: ActiveMcpTokenRecord = {
  id: "token-1",
  businessId: "business-1",
  userId: "user-1",
  expiresAt: new Date("2027-01-01T00:00:00.000Z"),
  user: { role: "OWNER", isActive: true },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("creating a token", () => {
  it("stores only the hash and hands the raw token back once", async () => {
    repo.create.mockResolvedValue(record);

    const created = await mcpTokenService.create("business-1", "user-1", "Claude Code");

    expect(created.token).toMatch(/^[0-9a-f]{64}$/);
    const saved = repo.create.mock.calls[0][0];
    expect(saved.tokenHash).toBe(sha256(created.token));
    expect(JSON.stringify(saved)).not.toContain(created.token);
    expect(saved).toMatchObject({ businessId: "business-1", userId: "user-1", name: "Claude Code" });
  });

  it("expires the token after 90 days", async () => {
    repo.create.mockResolvedValue(record);
    const before = Date.now();

    await mcpTokenService.create("business-1", "user-1", "Claude Code");

    const lifetime = repo.create.mock.calls[0][0].expiresAt.getTime() - before;
    const days = lifetime / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(90);
    expect(days).toBeLessThan(90.01);
  });

  it("makes a different token each time", async () => {
    repo.create.mockResolvedValue(record);

    const first = await mcpTokenService.create("business-1", "user-1", "One");
    const second = await mcpTokenService.create("business-1", "user-1", "Two");

    expect(first.token).not.toBe(second.token);
  });
});

describe("verifying a token", () => {
  it("looks the token up by its hash and returns who it acts as", async () => {
    repo.findActiveByHash.mockResolvedValue(active);

    const auth = await mcpTokenService.verify("raw-token");

    expect(repo.findActiveByHash).toHaveBeenCalledWith(sha256("raw-token"));
    expect(repo.touch).toHaveBeenCalledWith("token-1");
    expect(auth).toEqual({
      token: "raw-token",
      clientId: "token-1",
      scopes: [],
      expiresAt: Math.floor(active.expiresAt.getTime() / 1000),
      extra: { userId: "user-1", businessId: "business-1", role: ROLE.OWNER },
    });
  });

  it("refuses a missing token without touching the database", async () => {
    await expect(mcpTokenService.verify(undefined)).resolves.toBeUndefined();
    expect(repo.findActiveByHash).not.toHaveBeenCalled();
  });

  it("refuses an unknown, revoked or expired token", async () => {
    repo.findActiveByHash.mockResolvedValue(null);

    await expect(mcpTokenService.verify("raw-token")).resolves.toBeUndefined();
    expect(repo.touch).not.toHaveBeenCalled();
  });

  it("refuses the token of a deactivated user straight away", async () => {
    repo.findActiveByHash.mockResolvedValue({
      ...active,
      user: { role: "OWNER", isActive: false },
    });

    await expect(mcpTokenService.verify("raw-token")).resolves.toBeUndefined();
    expect(repo.touch).not.toHaveBeenCalled();
  });
});

describe("listing and revoking tokens", () => {
  it("lists the tokens of the business", async () => {
    const signedIn = { ...record, id: "token-2", clientId: "client-1" };
    repo.findManyByBusiness.mockResolvedValue([record, signedIn]);

    // The client id stays on the server; the screen only learns how the connection was made.
    const { clientId: _hidden, ...shown } = record;
    await expect(mcpTokenService.list("business-1")).resolves.toEqual([
      { ...shown, source: "key" },
      { ...shown, id: "token-2", source: "sign-in" },
    ]);
    expect(repo.findManyByBusiness).toHaveBeenCalledWith("business-1");
  });

  it("revokes within the business and returns the revoked token", async () => {
    const revoked = { ...record, revokedAt: new Date("2026-11-03T00:00:00.000Z") };
    repo.revoke.mockResolvedValue(revoked);

    const { clientId: _hidden, ...shown } = revoked;
    await expect(mcpTokenService.revoke("token-1", "business-1")).resolves.toEqual({ ...shown, source: "key" });
    expect(repo.revoke).toHaveBeenCalledWith("token-1", "business-1");
  });

  it("answers 404 for a token that isn't in the business", async () => {
    repo.revoke.mockResolvedValue(null);

    await expect(mcpTokenService.revoke("token-1", "business-2")).rejects.toMatchObject({
      status: 404, message: "mcp_token_not_found",
    });
  });
});
