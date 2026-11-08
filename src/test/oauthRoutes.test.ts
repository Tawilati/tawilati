import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";

const { service } = vi.hoisted(() => ({
  service: { registerClient: vi.fn(), getConsentClient: vi.fn(), decide: vi.fn(), exchangeCode: vi.fn() },
}));

vi.mock("@/service/OAuthService", () => ({ oauthService: service }));

import { GET as authServerMetadata } from "@/app/.well-known/oauth-authorization-server/route";
import { GET as resourceMetadata } from "@/app/.well-known/oauth-protected-resource/[[...resource]]/route";
import { POST as authorize } from "@/app/api/oauth/authorize/route";
import { OPTIONS as registerPreflight, POST as register } from "@/app/api/oauth/register/route";
import { POST as token } from "@/app/api/oauth/token/route";

const clientId = "11111111-1111-4111-8111-111111111111";
const redirectUri = "https://claude.ai/api/mcp/auth_callback";
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

const json = (url: string, body: unknown) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("POST /api/oauth/register", () => {
  it("answers 201 with the registered client, readable from another origin", async () => {
    service.registerClient.mockResolvedValue({ client_id: clientId });

    const response = await register(json("http://localhost/api/oauth/register", { redirect_uris: [redirectUri], client_name: "Claude" }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ client_id: clientId });
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(service.registerClient).toHaveBeenCalledWith({ redirect_uris: [redirectUri], client_name: "Claude" });
  });

  it("answers invalid_redirect_uri for a return address on another site over http", async () => {
    const response = await register(json("http://localhost/api/oauth/register", { redirect_uris: ["http://evil.example/cb"] }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_redirect_uri" });
    expect(service.registerClient).not.toHaveBeenCalled();
  });

  it("answers invalid_client_metadata for a body that isn't client metadata", async () => {
    const response = await register(json("http://localhost/api/oauth/register", { redirect_uris: [redirectUri], client_name: 5 }));

    expect(await response.json()).toEqual({ error: "invalid_client_metadata" });
  });

  it("answers the browser's preflight", () => {
    const response = registerPreflight();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

describe("POST /api/oauth/token", () => {
  const form = (fields: Record<string, string>) =>
    new Request("http://localhost/api/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
  const fields = {
    grant_type: "authorization_code",
    code: "c".repeat(64),
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  };

  it("swaps a form-encoded code for a token, never cached", async () => {
    service.exchangeCode.mockResolvedValue({ access_token: "t", token_type: "Bearer", expires_in: 60, scope: "mcp" });

    const response = await token(form(fields));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ access_token: "t", token_type: "Bearer", expires_in: 60, scope: "mcp" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(service.exchangeCode).toHaveBeenCalledWith(fields);
  });

  it("takes JSON too", async () => {
    service.exchangeCode.mockResolvedValue({ access_token: "t" });

    expect((await token(json("http://localhost/api/oauth/token", fields))).status).toBe(200);
  });

  it("answers invalid_grant in the OAuth shape when the service refuses the code", async () => {
    service.exchangeCode.mockRejectedValue(new BadRequestException("invalid_grant"));

    const response = await token(form(fields));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_grant" });
  });

  it("answers unsupported_grant_type for a refresh token or any other grant", async () => {
    const response = await token(form({ ...fields, grant_type: "refresh_token" }));

    expect(await response.json()).toEqual({ error: "unsupported_grant_type" });
    expect(service.exchangeCode).not.toHaveBeenCalled();
  });

  it("answers invalid_request without a verifier, or with no body at all", async () => {
    const { code_verifier: _dropped, ...withoutVerifier } = fields;
    expect(await (await token(form(withoutVerifier))).json()).toEqual({ error: "invalid_request" });
    expect(await (await token(new Request("http://localhost/api/oauth/token", { method: "POST" }))).json()).toEqual({
      error: "invalid_request",
    });
  });

  it("answers server_error without details when something unexpected breaks", async () => {
    service.exchangeCode.mockRejectedValue(new Error("db down"));

    const response = await token(form(fields));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "server_error" });
  });
});

describe("POST /api/oauth/authorize (the owner's Allow or Cancel)", () => {
  const decision = { clientId, redirectUri, codeChallenge: challenge, state: "xyz", decision: "allow" };
  const asRole = (role: string, body: unknown = decision) =>
    new NextRequest("http://localhost/api/oauth/authorize", {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": "user-1", "x-user-role": role, "x-business-id": "business-1" },
      body: JSON.stringify(body),
    });

  it("records the owner's answer for their own business and returns where to go", async () => {
    service.decide.mockResolvedValue(`${redirectUri}?code=abc&state=xyz`);

    const response = await authorize(asRole("OWNER"));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ redirectTo: `${redirectUri}?code=abc&state=xyz` });
    expect(service.decide).toHaveBeenCalledWith(decision, { userId: "user-1", businessId: "business-1" });
  });

  it.each(["WAITER", "KITCHEN"])("refuses a %s", async (role) => {
    const response = await authorize(asRole(role));

    expect(response.status).toBe(403);
    expect(service.decide).not.toHaveBeenCalled();
  });

  it("ignores a business id in the body (strict body: validation_error)", async () => {
    const response = await authorize(asRole("OWNER", { ...decision, businessId: "someone-else" }));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
  });
});

describe("sign-in metadata routes", () => {
  it("serves the authorization server document at the request's address", async () => {
    const body = await authServerMetadata(new Request("http://localhost:3000/.well-known/oauth-authorization-server")).json();

    expect(body.issuer).toBe("http://localhost:3000");
    expect(body.token_endpoint).toBe("http://localhost:3000/api/oauth/token");
  });

  it("prefers NEXT_PUBLIC_APP_URL, like the QR codes", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://tawilati.app/");

    const body = await resourceMetadata(new Request("http://localhost:3000/.well-known/oauth-protected-resource/api/mcp")).json();

    expect(body).toMatchObject({ resource: "https://tawilati.app/api/mcp", authorization_servers: ["https://tawilati.app"] });
  });
});
