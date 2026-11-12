import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE } from "@/types/Roles";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";

// The real MCP handler and auth wrapper; only the token check and the services are replaced.
const { verify, services } = vi.hoisted(() => ({
  verify: vi.fn(),
  services: {
    business: { getById: vi.fn(), updateSettings: vi.fn() },
    category: { listCategories: vi.fn(), createCategory: vi.fn() },
    kitchen: { getKitchenOrders: vi.fn() },
    menuItem: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), archive: vi.fn(), unarchive: vi.fn() },
    report: { getDailyReport: vi.fn() },
    table: { listTables: vi.fn(), createTable: vi.fn(), disableTable: vi.fn(), enableTable: vi.fn() },
    waiter: { getActiveTables: vi.fn() },
  },
}));

vi.mock("@/service/McpTokenService", () => ({ mcpTokenService: { verify } }));
vi.mock("@/service/BusinessService", () => ({ businessService: services.business }));
vi.mock("@/service/CategoryService", () => ({ categoryService: services.category }));
vi.mock("@/service/KitchenService", () => ({ kitchenService: services.kitchen }));
vi.mock("@/service/MenuItemsService", () => ({ menuItemService: services.menuItem }));
vi.mock("@/service/ReportService", () => ({ reportService: services.report }));
vi.mock("@/service/TableService",() => ({ tableService: services.table }));
vi.mock("@/service/WaiterService", () => ({ waiterService: services.waiter }));

import { POST } from "@/app/api/mcp/route";

const businessId = "business-1";
const itemId = "22222222-2222-4222-8222-222222222222";

// The token "<role>-token" acts as a user with that role in business-1; anything else is refused.
function acceptTokens() {
  verify.mockImplementation(async (token?: string) => {
    const role = Object.values(ROLE).find((r) => token === `${r.toLowerCase()}-token`);
    if (!role) return undefined;
    return { token, clientId: "token-1", scopes: [], extra: { userId: "user-1", businessId, role } };
  });
}

async function rpc(method: string, params: unknown, token: string | null = "owner-token") {
  const response = await POST(new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
  return response;
}

// Answers come back as a server-sent event: "event: message\ndata: {...}".
async function rpcResult(method: string, params: unknown, token?: string) {
  const response = await rpc(method, params, token);
  expect(response.status).toBe(200);
  const data = (await response.text()).split("\n").find((line) => line.startsWith("data: "));
  return JSON.parse(data!.slice("data: ".length));
}

// Our tools answer JSON; arguments that fail the schema get the SDK's plain-text message instead.
async function callTool(name: string, args: Record<string, unknown> = {}, token?: string) {
  const { result, error } = await rpcResult("tools/call", { name, arguments: args }, token);
  expect(error).toBeUndefined();
  const text: string = result.content[0].text;
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep the text
  }
  return { isError: result.isError === true, body };
}

beforeEach(() => {
  vi.resetAllMocks();
  acceptTokens();
});

describe("authentication", () => {
  it("refuses a request with no token with 401", async () => {
    const response = await rpc("tools/list", {}, null);

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("invalid_token");
  });

  it("refuses a token the service doesn't accept with 401", async () => {
    const response = await rpc("tools/call", { name: "list_categories", arguments: {} }, "made-up");

    expect(response.status).toBe(401);
    expect(verify).toHaveBeenCalledWith("made-up");
    expect(services.category.listCategories).not.toHaveBeenCalled();
  });
});

describe("tools/list", () => {
  it("lists the tools, none of which takes a businessId", async () => {
    const { result } = await rpcResult("tools/list", {});
    const tools = result.tools as { name: string; inputSchema: { properties?: object } }[];

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "archive_menu_item",
      "create_category",
      "create_menu_item",
      "create_table",
      "get_business",
      "get_daily_report",
      "get_kitchen_orders",
      "list_active_tables",
      "list_categories",
      "list_menu_items",
      "list_tables",
      "set_menu_item_sold_out",
      "set_table_disabled",
      "unarchive_menu_item",
      "update_business_settings",
      "update_menu_item",
    ]);
    for (const tool of tools) {
      expect(JSON.stringify(tool.inputSchema)).not.toContain("businessId");
    }
  });
});

describe("tools/call", () => {
  it("runs a read tool in the token's business", async () => {
    services.category.listCategories.mockResolvedValue([{ id: "c1", name: "Drinks" }]);

    const { isError, body } = await callTool("list_categories");

    expect(isError).toBe(false);
    expect(body).toEqual([{ id: "c1", name: "Drinks" }]);
    expect(services.category.listCategories).toHaveBeenCalledWith(businessId);
  });

  it("ignores a businessId slipped into the arguments", async () => {
    services.menuItem.getAll.mockResolvedValue([]);

    await callTool("list_menu_items", { businessId: "business-2" });

    expect(services.menuItem.getAll).toHaveBeenCalledWith(businessId);
  });

  it("rejects a businessId on a write tool without calling the service", async () => {
    const { isError, body } = await callTool("create_category", { name: "Drinks", businessId: "business-2" });

    expect(isError).toBe(true);
    expect(body).toMatch(/^Input validation error/);
    expect(services.category.createCategory).not.toHaveBeenCalled();
  });

  it("validates arguments with the same rules as the HTTP route", async () => {
    const { isError, body } = await callTool("create_menu_item", {
      name: "Latte", categoryId: "not-a-uuid", priceUSD: 3.5,
    });

    expect(isError).toBe(true);
    expect(body).toMatch(/^Input validation error/);
    expect(services.menuItem.create).not.toHaveBeenCalled();
  });

  it("passes only the requested changes when editing an item", async () => {
    services.menuItem.update.mockResolvedValue({ id: itemId });

    await callTool("update_menu_item", { id: itemId, changes: { priceUSD: 4 } });

    expect(services.menuItem.update).toHaveBeenCalledWith(businessId, itemId, { priceUSD: 4 });
  });

  it("refuses a waiter on an owner tool with forbidden", async () => {
    const { isError, body } = await callTool(
      "create_menu_item",
      { name: "Latte", categoryId: itemId, priceUSD: 3.5 },
      "waiter-token",
    );

    expect(isError).toBe(true);
    expect(body).toEqual({ success: false, message: "forbidden" });
    expect(services.menuItem.create).not.toHaveBeenCalled();
  });

  it("lets the kitchen mark an item sold out", async () => {
    services.menuItem.update.mockResolvedValue({ id: itemId, soldOut: true });

    const { isError } = await callTool("set_menu_item_sold_out", { id: itemId, soldOut: true }, "kitchen-token");

    expect(isError).toBe(false);
    expect(services.menuItem.update).toHaveBeenCalledWith(businessId, itemId, { soldOut: true });
  });

  it("reads the daily report for the asked day in the token's business", async () => {
    services.report.getDailyReport.mockResolvedValue({ date: "2026-11-04", totalUSD: "42.00" });

    const { isError, body } = await callTool("get_daily_report", { date: "2026-11-04" });

    expect(isError).toBe(false);
    expect(body).toEqual({ date: "2026-11-04", totalUSD: "42.00" });
    expect(services.report.getDailyReport).toHaveBeenCalledWith(businessId, "2026-11-04");
  });

  it("reads today's report when no date is given", async () => {
    services.report.getDailyReport.mockResolvedValue({ date: "2026-11-12" });

    await callTool("get_daily_report");

    expect(services.report.getDailyReport).toHaveBeenCalledWith(businessId, undefined);
  });

  it("rejects a date that isn't a real day without calling the service", async () => {
    const { isError, body } = await callTool("get_daily_report", { date: "2026-02-30" });

    expect(isError).toBe(true);
    expect(body).toMatch(/^Input validation error/);
    expect(services.report.getDailyReport).not.toHaveBeenCalled();
  });

  it.each(["waiter-token", "kitchen-token"])("refuses %s on the daily report with forbidden", async (token) => {
    const { isError, body } = await callTool("get_daily_report", {}, token);

    expect(isError).toBe(true);
    expect(body).toEqual({ success: false, message: "forbidden" });
    expect(services.report.getDailyReport).not.toHaveBeenCalled();
  });

  it.each([
    [true, "disableTable"],
    [false, "enableTable"],
  ] as const)("set_table_disabled %s calls %s", async (disabled, method) => {
    services.table[method].mockResolvedValue({ id: itemId });

    await callTool("set_table_disabled", { id: itemId, disabled });

    expect(services.table[method]).toHaveBeenCalledWith(businessId, itemId);
  });

  it("returns a service error with the same code as the HTTP route", async () => {
    services.category.createCategory.mockRejectedValue(new ConflictException("category_already_exists"));

    const { isError, body } = await callTool("create_category", { name: "Drinks" });

    expect(isError).toBe(true);
    expect(body).toEqual({ success: false, message: "category_already_exists" });
  });

  it("hides the details of an unexpected error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    services.business.getById.mockRejectedValue(new Error("connection string with a password"));

    const { isError, body } = await callTool("get_business");

    expect(isError).toBe(true);
    expect(body).toEqual({ success: false, message: "internal_server_error" });
  });
});
