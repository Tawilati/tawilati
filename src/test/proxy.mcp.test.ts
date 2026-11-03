import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/service/AuthService", () => ({
  authService: { validateAccessToken: vi.fn(), refresh: vi.fn(), clearAuthCookies: vi.fn() },
}));

import { proxy } from "@/proxy";

// No staff cookie on any of these requests.
const send = (path: string) => proxy(new NextRequest(`http://localhost${path}`, { method: "POST" }));

describe("proxy and the MCP endpoint", () => {
  it("lets /api/mcp through without a staff cookie (the route checks its own token)", async () => {
    const response = await send("/api/mcp");

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/api/mcp-tokens", "/api/mcp-tokens/22222222-2222-4222-8222-222222222222/revoke"])(
    "still requires the staff cookie on %s",
    async (path) => {
      const response = await send(path);

      expect(response.status).toBe(401);
    },
  );

  it("never forwards identity headers a caller sends to /api/mcp", async () => {
    const response = await proxy(new NextRequest("http://localhost/api/mcp", {
      method: "POST",
      headers: { "x-business-id": "someone-else", "x-user-role": "OWNER" },
    }));

    expect(response.headers.get("x-middleware-request-x-business-id")).toBeNull();
    expect(response.headers.get("x-middleware-request-x-user-role")).toBeNull();
  });
});
