import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE } from "@/types/Roles";

// The real MCP handler; only the token check and the services it would call are replaced.
const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));

vi.mock("@/service/McpTokenService", () => ({ mcpTokenService: { verify } }));
vi.mock("@/service/BusinessService", () => ({ businessService: {} }));
vi.mock("@/service/CategoryService", () => ({ categoryService: {} }));
vi.mock("@/service/KitchenService", () => ({ kitchenService: {} }));
vi.mock("@/service/MenuItemsService", () => ({ menuItemService: {} }));
vi.mock("@/service/TableService", () => ({ tableService: {} }));
vi.mock("@/service/WaiterService", () => ({ waiterService: {} }));

import { POST as withHeader } from "@/app/api/mcp/route";
import { POST as withKeyInAddress } from "@/app/api/mcp/[key]/route";

const key = "a".repeat(64);

beforeEach(() => {
  vi.resetAllMocks();
  verify.mockImplementation(async (token?: string) =>
    token === key
      ? { token, clientId: "token-1", scopes: [], extra: { userId: "user-1", businessId: "business-1", role: ROLE.OWNER } }
      : undefined,
  );
});

const listTools = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });

const params = (value: string) => ({ params: Promise.resolve({ key: value }) });

describe("POST /api/mcp/<key> (key in the address)", () => {
  it("works like /api/mcp with the key in the header", async () => {
    const response = await withKeyInAddress(listTools(`http://localhost/api/mcp/${key}`), params(key));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("list_menu_items");
    expect(verify).toHaveBeenCalledWith(key);
  });

  it("uses the key in the address, not a header someone added", async () => {
    await withKeyInAddress(listTools(`http://localhost/api/mcp/${key}`, { authorization: "Bearer other" }), params(key));

    expect(verify).toHaveBeenCalledWith(key);
  });

  it("refuses an unknown key with 401", async () => {
    const other = "b".repeat(64);
    const response = await withKeyInAddress(listTools(`http://localhost/api/mcp/${other}`), params(other));

    expect(response.status).toBe(401);
  });

  it("never checks something that isn't a key's shape, even with a valid header", async () => {
    const response = await withKeyInAddress(
      listTools("http://localhost/api/mcp/not-a-key", { authorization: `Bearer ${key}` }),
      params("not-a-key"),
    );

    expect(response.status).toBe(401);
    expect(verify).toHaveBeenCalledWith(undefined);
  });
});

describe("the 401 points assistants at signing in", () => {
  it("names the protected resource document for /api/mcp", async () => {
    const response = await withHeader(listTools("http://localhost:3000/api/mcp"));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/api/mcp"',
    );
  });
});
