import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OAuthClientRecord, SpentOAuthCodeRecord } from "@/types/OAuth";

const { repo, tokens } = vi.hoisted(() => ({
  repo: { createClient: vi.fn(), findClient: vi.fn(), createCode: vi.fn(), spendCode: vi.fn() },
  tokens: { create: vi.fn() },
}));

vi.mock("@/repository/OAuthRepo", () => ({ oauthRepo: repo }));
vi.mock("@/service/McpTokenService", () => ({ mcpTokenService: tokens }));

import { oauthService } from "@/service/OAuthService";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const clientId = "11111111-1111-4111-8111-111111111111";
const redirectUri = "https://claude.ai/api/mcp/auth_callback";
// RFC 7636, appendix B.
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const owner = { userId: "user-1", businessId: "business-1" };

const client: OAuthClientRecord = {
  id: clientId,
  name: "Claude",
  redirectUris: [redirectUri],
  createdAt: new Date("2026-11-08T00:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("registering an assistant", () => {
  it("stores it as a public client and answers in the RFC 7591 shape", async () => {
    repo.createClient.mockResolvedValue(client);

    await expect(oauthService.registerClient({ redirect_uris: [redirectUri], client_name: "Claude" })).resolves.toEqual({
      client_id: clientId,
      client_name: "Claude",
      redirect_uris: [redirectUri],
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    });
    expect(repo.createClient).toHaveBeenCalledWith({ name: "Claude", redirectUris: [redirectUri] });
  });

  it("names a nameless assistant 'AI assistant'", async () => {
    repo.createClient.mockResolvedValue({ ...client, name: "AI assistant" });

    await oauthService.registerClient({ redirect_uris: [redirectUri] });
    expect(repo.createClient).toHaveBeenCalledWith({ name: "AI assistant", redirectUris: [redirectUri] });
  });
});

describe("the consent screen's checks", () => {
  it("returns who is asking and where the owner goes back to", async () => {
    repo.findClient.mockResolvedValue(client);

    await expect(oauthService.getConsentClient(clientId, redirectUri)).resolves.toEqual({
      id: clientId,
      name: "Claude",
      redirectHost: "claude.ai",
    });
  });

  it("refuses an unknown assistant", async () => {
    repo.findClient.mockResolvedValue(null);

    await expect(oauthService.getConsentClient(clientId, redirectUri)).rejects.toMatchObject({ status: 400, message: "invalid_client" });
  });

  it("refuses a return address the assistant didn't register", async () => {
    repo.findClient.mockResolvedValue(client);

    await expect(oauthService.getConsentClient(clientId, "https://evil.example/cb")).rejects.toMatchObject({
      message: "invalid_redirect_uri",
    });
  });
});

describe("the owner's answer", () => {
  const decision = { clientId, redirectUri, codeChallenge: challenge, state: "xyz" };

  it("Allow stores the hash of a one-time code and sends it back with the state", async () => {
    repo.findClient.mockResolvedValue(client);

    const redirectTo = new URL(await oauthService.decide({ ...decision, decision: "allow" }, owner));

    const code = redirectTo.searchParams.get("code")!;
    expect(code).toMatch(/^[0-9a-f]{64}$/);
    expect(redirectTo.searchParams.get("state")).toBe("xyz");
    expect(`${redirectTo.origin}${redirectTo.pathname}`).toBe(redirectUri);
    expect(repo.createCode).toHaveBeenCalledWith(
      expect.objectContaining({
        codeHash: sha256(code),
        clientId,
        businessId: "business-1",
        userId: "user-1",
        redirectUri,
        codeChallenge: challenge,
      }),
    );
    const { expiresAt } = repo.createCode.mock.calls[0][0];
    expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  it("Cancel sends access_denied and stores nothing", async () => {
    repo.findClient.mockResolvedValue(client);

    const redirectTo = new URL(await oauthService.decide({ ...decision, decision: "deny" }, owner));

    expect(redirectTo.searchParams.get("error")).toBe("access_denied");
    expect(redirectTo.searchParams.get("state")).toBe("xyz");
    expect(redirectTo.searchParams.has("code")).toBe(false);
    expect(repo.createCode).not.toHaveBeenCalled();
  });

  it("checks the assistant again, so a tampered request gets no code", async () => {
    repo.findClient.mockResolvedValue(client);

    await expect(
      oauthService.decide({ ...decision, redirectUri: "https://evil.example/cb", decision: "allow" }, owner),
    ).rejects.toMatchObject({ message: "invalid_redirect_uri" });
    expect(repo.createCode).not.toHaveBeenCalled();
  });
});

describe("swapping the code for a token", () => {
  const code = "c".repeat(64);
  const request = { grant_type: "authorization_code" as const, code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier };
  const spent: SpentOAuthCodeRecord = {
    clientId,
    businessId: "business-1",
    userId: "user-1",
    redirectUri,
    codeChallenge: challenge,
    client: { name: "Claude" },
  };

  it("spends the code and hands out an MCP token tied to the assistant", async () => {
    repo.spendCode.mockResolvedValue(spent);
    tokens.create.mockResolvedValue({ token: "t".repeat(64), expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000) });

    const response = await oauthService.exchangeCode(request);

    expect(repo.spendCode).toHaveBeenCalledWith(sha256(code));
    expect(tokens.create).toHaveBeenCalledWith("business-1", "user-1", "Claude", clientId);
    expect(response).toMatchObject({ access_token: "t".repeat(64), token_type: "Bearer", scope: "mcp" });
    expect(response.expires_in).toBeGreaterThan(89 * 24 * 3600);
  });

  it.each([
    ["an unknown, used or expired code", null, request],
    ["another assistant's code", { ...spent, clientId: "22222222-2222-4222-8222-222222222222" }, request],
    ["another return address", spent, { ...request, redirect_uri: "https://claude.ai/other" }],
    ["the wrong verifier", spent, { ...request, code_verifier: "x".repeat(43) }],
  ])("refuses %s with invalid_grant and issues nothing", async (_case, found, sent) => {
    repo.spendCode.mockResolvedValue(found);

    await expect(oauthService.exchangeCode(sent)).rejects.toMatchObject({ status: 400, message: "invalid_grant" });
    expect(tokens.create).not.toHaveBeenCalled();
  });
});
