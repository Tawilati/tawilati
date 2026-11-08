import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ROLE } from "@/types/Roles";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@/service/McpTokenService", () => ({
  mcpTokenService: mocks,
}));

import { GET, POST } from "@/app/api/mcp-tokens/route";
import { POST as revokePOST } from "@/app/api/mcp-tokens/[id]/revoke/route";

const businessId = "business-1";
const userId = "user-1";
const tokenId = "22222222-2222-4222-8222-222222222222";

// The guard is the real one, so these tests prove which roles get in.
function request(path: string, role: ROLE | null, init: { method?: string; body?: string } = {}): NextRequest {
  const headers: Record<string, string> = role
    ? { "x-user-id": userId, "x-user-role": role, "x-business-id": businessId }
    : {};
  return new NextRequest(`http://localhost${path}`, { ...init, headers });
}

const createRequest = (body: string, role: ROLE | null = ROLE.OWNER) =>
  request("/api/mcp-tokens", role, { method: "POST", body });

const params = (id = tokenId) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/mcp-tokens", () => {
  it("creates a token for the signed-in owner and returns the raw token", async () => {
    mocks.create.mockResolvedValue({ id: tokenId, name: "Claude Code", token: "raw-token" });

    const response = await POST(createRequest(JSON.stringify({ name: "  Claude Code  " })));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      success: true,
      message: "mcp token created",
      data: { id: tokenId, name: "Claude Code", token: "raw-token" },
    });
    expect(mocks.create).toHaveBeenCalledWith(businessId, userId, "Claude Code");
  });

  it.each([ROLE.WAITER, ROLE.KITCHEN])("refuses %s with 403", async (role) => {
    const response = await POST(createRequest(JSON.stringify({ name: "Claude Code" }), role));

    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("refuses a request with no staff identity with 401", async () => {
    const response = await POST(createRequest(JSON.stringify({ name: "Claude Code" }), null));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, message: "unauthorized" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    ["blank", { name: "   " }],
    ["too long", { name: "x".repeat(101) }],
    ["missing", {}],
  ])("answers 400 validation_error when the name is %s", async (_case, body) => {
    const response = await POST(createRequest(JSON.stringify(body)));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("refuses a businessId sent in the body", async () => {
    const response = await POST(createRequest(JSON.stringify({ name: "Claude Code", businessId: "business-2" })));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("answers 400 invalid_json for a body that isn't JSON", async () => {
    const response = await POST(createRequest("not json"));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("invalid_json");
  });
});

describe("GET /api/mcp-tokens", () => {
  it("lists the tokens of the owner's business", async () => {
    mocks.list.mockResolvedValue([{ id: tokenId, name: "Claude Code" }]);

    const response = await GET(request("/api/mcp-tokens", ROLE.OWNER));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ id: tokenId, name: "Claude Code" }]);
    expect(mocks.list).toHaveBeenCalledWith(businessId);
  });

  it.each([ROLE.WAITER, ROLE.KITCHEN])("refuses %s with 403", async (role) => {
    const response = await GET(request("/api/mcp-tokens", role));

    expect(response.status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

describe("POST /api/mcp-tokens/:id/revoke", () => {
  const revokeRequest = (role: ROLE = ROLE.OWNER) =>
    request(`/api/mcp-tokens/${tokenId}/revoke`, role, { method: "POST" });

  it("revokes the token within the owner's business", async () => {
    mocks.revoke.mockResolvedValue({ id: tokenId, name: "Claude Code" });

    const response = await revokePOST(revokeRequest(), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "mcp token revoked",
      data: { id: tokenId, name: "Claude Code" },
    });
    expect(mocks.revoke).toHaveBeenCalledWith(tokenId, businessId);
  });

  it.each([ROLE.WAITER, ROLE.KITCHEN])("refuses %s with 403", async (role) => {
    const response = await revokePOST(revokeRequest(role), params());

    expect(response.status).toBe(403);
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it("answers 400 validation_error for an id that isn't a UUID", async () => {
    const response = await revokePOST(revokeRequest(), params("abc"));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.revoke).not.toHaveBeenCalled();
  });

  it("returns the service's 404 as the error shape", async () => {
    mocks.revoke.mockRejectedValue(new NotFoundException("mcp_token_not_found"));

    const response = await revokePOST(revokeRequest(), params());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, message: "mcp_token_not_found" });
  });
});
