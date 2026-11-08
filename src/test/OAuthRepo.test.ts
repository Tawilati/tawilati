import { beforeEach, describe, expect, it, vi } from "vitest";

const { oAuthClient, oAuthCode } = vi.hoisted(() => ({
  oAuthClient: { create: vi.fn(), findUnique: vi.fn() },
  oAuthCode: { create: vi.fn(), updateManyAndReturn: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: { oAuthClient, oAuthCode } }));
import { oauthRepo } from "@/repository/OAuthRepo";

beforeEach(() => vi.resetAllMocks());

describe("spending a code", () => {
  it("only spends an unused, unexpired code, in one conditional update", async () => {
    oAuthCode.updateManyAndReturn.mockResolvedValue([]);
    const before = Date.now();

    await expect(oauthRepo.spendCode("hash")).resolves.toBeNull();

    const { where, data } = oAuthCode.updateManyAndReturn.mock.calls[0][0];
    expect(where.codeHash).toBe("hash");
    expect(where.usedAt).toBeNull();
    expect(where.expiresAt.gt.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.usedAt).toBeInstanceOf(Date);
  });

  it("returns the spent code with its assistant's name", async () => {
    const spent = { clientId: "c", businessId: "b", userId: "u", redirectUri: "r", codeChallenge: "x", client: { name: "Claude" } };
    oAuthCode.updateManyAndReturn.mockResolvedValue([spent]);

    await expect(oauthRepo.spendCode("hash")).resolves.toEqual(spent);
  });

  it("does not hide database failures", async () => {
    oAuthCode.updateManyAndReturn.mockRejectedValue(new Error("Database unavailable"));

    await expect(oauthRepo.spendCode("hash")).rejects.toMatchObject({
      name: "DBException",
      message: "Error using OAuth code: Database unavailable",
    });
  });
});

describe("clients", () => {
  it("finds a client by id", async () => {
    oAuthClient.findUnique.mockResolvedValue(null);

    await expect(oauthRepo.findClient("client-1")).resolves.toBeNull();
    expect(oAuthClient.findUnique.mock.calls[0][0].where).toEqual({ id: "client-1" });
  });

  it("wraps a failed registration", async () => {
    oAuthClient.create.mockRejectedValue(new Error("Database unavailable"));

    await expect(oauthRepo.createClient({ name: "Claude", redirectUris: [] })).rejects.toMatchObject({ name: "DBException" });
  });
});
