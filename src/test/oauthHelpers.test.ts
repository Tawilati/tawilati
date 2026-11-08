import { describe, expect, it } from "vitest";
import { safeNext } from "@/components/auth/authForm";
import { authorizationServerMetadata, protectedResourceMetadata } from "@/lib/oauth/metadata";
import { s256Challenge, verifyPkce } from "@/utils/pkce";
import { isAllowedRedirectUri, registerClientSchema, tokenRequestSchema } from "@/validation/oauthSchemas";

describe("PKCE (S256)", () => {
  // RFC 7636, appendix B.
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

  it("matches the RFC's example", () => {
    expect(s256Challenge(verifier)).toBe(challenge);
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  it("refuses another verifier, and a challenge of another length", () => {
    expect(verifyPkce(`${verifier.slice(0, -1)}A`, challenge)).toBe(false);
    expect(verifyPkce(verifier, "short")).toBe(false);
  });
});

describe("where an assistant may send the owner back to", () => {
  it.each([
    "https://claude.ai/api/mcp/auth_callback",
    "http://localhost:33418/callback",
    "http://127.0.0.1:5000/cb",
  ])("allows %s", (uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(true);
  });

  it.each([
    "http://evil.example/callback",
    "https://claude.ai/cb#fragment",
    "javascript:alert(1)",
    "not a url",
  ])("refuses %s", (uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(false);
  });

  it("registers with extra metadata ignored and a long name cut to 100 characters", () => {
    const parsed = registerClientSchema.parse({
      redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
      client_name: "x".repeat(150),
      grant_types: ["authorization_code", "refresh_token"],
      logo_uri: "https://claude.ai/logo.png",
    });
    expect(parsed).toEqual({ redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], client_name: "x".repeat(100) });
  });

  it("refuses a registration without a return address", () => {
    expect(registerClientSchema.safeParse({ client_name: "Claude" }).success).toBe(false);
    expect(registerClientSchema.safeParse({ redirect_uris: [] }).success).toBe(false);
  });
});

describe("token request", () => {
  const valid = {
    grant_type: "authorization_code",
    code: "a".repeat(64),
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    client_id: "11111111-1111-4111-8111-111111111111",
    code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
  };

  it("accepts the authorization code grant with a verifier", () => {
    expect(tokenRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses a missing or too short verifier", () => {
    expect(tokenRequestSchema.safeParse({ ...valid, code_verifier: undefined }).success).toBe(false);
    expect(tokenRequestSchema.safeParse({ ...valid, code_verifier: "short" }).success).toBe(false);
  });
});

describe("sign-in metadata", () => {
  it("lists the endpoints under the app's address", () => {
    expect(authorizationServerMetadata("https://tawilati.app")).toMatchObject({
      issuer: "https://tawilati.app",
      authorization_endpoint: "https://tawilati.app/oauth/authorize",
      token_endpoint: "https://tawilati.app/api/oauth/token",
      registration_endpoint: "https://tawilati.app/api/oauth/register",
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    });
  });

  it("names the MCP endpoint as the resource and this app as where to sign in", () => {
    expect(protectedResourceMetadata("https://tawilati.app")).toMatchObject({
      resource: "https://tawilati.app/api/mcp",
      authorization_servers: ["https://tawilati.app"],
    });
  });
});

describe("returning to the sign-in screen after logging in", () => {
  it("follows ?next= only to the assistant sign-in screen", () => {
    expect(safeNext("/oauth/authorize?client_id=1&state=x")).toBe("/oauth/authorize?client_id=1&state=x");
    expect(safeNext("/oauth/authorize")).toBe("/oauth/authorize");
  });

  it.each([null, "", "/dashboard", "https://evil.example/oauth/authorize?x", "//evil.example/oauth/authorize?", "/oauth/authorizeX"])(
    "ignores %s",
    (next) => {
      expect(safeNext(next)).toBeNull();
    },
  );
});
