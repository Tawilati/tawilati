import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/components/dashboard/api";
import {
  claudeCodeCommand,
  connectionStatus,
  integrationSentenceFor,
  integrationsApi,
  authorizationHeader,
  mcpUrl,
  type Connection,
} from "@/components/dashboard/integrations/integrationsApi";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const connection: Connection = {
  id: "1",
  name: "Claude Code",
  expiresAt: "2027-02-01T00:00:00.000Z",
  revokedAt: null,
  lastUsedAt: null,
  createdAt: "2026-11-03T00:00:00.000Z",
  source: "key",
};

describe("AI integrations API calls", () => {
  it("lists connections from GET /api/mcp-tokens", async () => {
    const fetchMock = stubFetch(200, { success: true, message: "mcp tokens list", data: [connection] });

    await expect(integrationsApi.list()).resolves.toEqual([connection]);
    expect(fetchMock).toHaveBeenCalledWith("/api/mcp-tokens", expect.objectContaining({ method: "GET" }));
  });

  it("creates a connection with only its name and returns the key", async () => {
    const fetchMock = stubFetch(201, { success: true, message: "mcp token created", data: { ...connection, token: "abc" } });

    await expect(integrationsApi.create("Claude Code")).resolves.toMatchObject({ token: "abc" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: "Claude Code" });
  });

  it("revokes with POST /api/mcp-tokens/:id/revoke", async () => {
    const fetchMock = stubFetch(200, { success: true, message: "mcp token revoked", data: connection });

    await integrationsApi.revoke("1");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/mcp-tokens/1/revoke");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("surfaces the contract code of a failure", async () => {
    stubFetch(404, { success: false, message: "mcp_token_not_found" });

    await expect(integrationsApi.revoke("1")).rejects.toMatchObject({ code: "mcp_token_not_found", status: 404 });
  });
});

describe("connection status", () => {
  const now = new Date("2026-12-01T00:00:00.000Z");

  it("is active until it expires", () => {
    expect(connectionStatus(connection, now)).toBe("active");
  });

  it("is expired once its expiry has passed", () => {
    expect(connectionStatus({ ...connection, expiresAt: "2026-11-30T00:00:00.000Z" }, now)).toBe("expired");
    expect(connectionStatus({ ...connection, expiresAt: now.toISOString() }, now)).toBe("expired");
  });

  it("is revoked once revoked, even before it would expire", () => {
    expect(connectionStatus({ ...connection, revokedAt: "2026-11-15T00:00:00.000Z" }, now)).toBe("revoked");
  });
});

describe("AI integrations wording", () => {
  it("turns codes into sentences and never shows the code", () => {
    const sentence = integrationSentenceFor(new ApiError("mcp_token_not_found", 404));
    expect(sentence).toMatch(/already revoked/);
    expect(sentence).not.toMatch(/mcp_token_not_found/);
    expect(integrationSentenceFor(new ApiError("forbidden", 403))).toMatch(/owner/);
    expect(integrationSentenceFor(new ApiError("weird", 500))).toMatch(/went wrong/);
  });
});

describe("connecting an assistant", () => {
  it("points at /api/mcp on this site", () => {
    expect(mcpUrl("http://localhost:3000")).toBe("http://localhost:3000/api/mcp");
  });

  it("uses NEXT_PUBLIC_APP_URL when it is set, like the QR codes", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://tawilati.app");
    expect(mcpUrl("http://localhost:3000")).toBe("https://tawilati.app/api/mcp");
  });

  it("builds the Claude Code command with the key as a Bearer header, for every folder (user scope)", () => {
    expect(claudeCodeCommand("https://tawilati.app/api/mcp", "abc")).toBe(
      'claude mcp add --scope user --transport http tawilati https://tawilati.app/api/mcp --header "Authorization: Bearer abc"',
    );
  });

  it("gives the Authorization header value for a connection made with a key", () => {
    expect(authorizationHeader("abc")).toBe("Bearer abc");
  });
});
