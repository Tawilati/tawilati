import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/mcp/route";
import { prisma } from "@/lib/db";
import { mcpTokenService } from "@/service/McpTokenService";

// Two businesses, each with an owner and an MCP token, talking to the real route and database.
const run = randomBytes(4).toString("hex");

type Tenant = { businessId: string; userId: string; token: string; tokenId: string; categoryId: string };
let a: Tenant;
let b: Tenant;

async function createTenant(tag: string): Promise<Tenant> {
  const business = await prisma.business.create({
    data: {
      name: `Test MCP ${tag} ${run}`,
      slug: `test-mcp-${tag}-${run}`,
      exchangeRate: "89500",
      timezone: "Asia/Beirut",
    },
  });
  const user = await prisma.user.create({
    data: {
      businessId: business.id,
      name: `Owner ${tag}`,
      email: `mcp-${tag}-${run}@example.test`,
      passwordHash: "not-used",
      role: "OWNER",
    },
  });
  const category = await prisma.menuCategory.create({
    data: { businessId: business.id, name: `Only in ${tag}` },
  });
  const created = await mcpTokenService.create(business.id, user.id, "test");
  return {
    businessId: business.id,
    userId: user.id,
    token: created.token,
    tokenId: created.id,
    categoryId: category.id,
  };
}

async function rpc(token: string, method: string, params: unknown) {
  return POST(new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
}

async function callTool(token: string, name: string, args: Record<string, unknown> = {}) {
  const response = await rpc(token, "tools/call", { name, arguments: args });
  expect(response.status).toBe(200);
  const data = (await response.text()).split("\n").find((line) => line.startsWith("data: "));
  const { result } = JSON.parse(data!.slice("data: ".length));
  return { isError: result.isError === true, body: JSON.parse(result.content[0].text) };
}

beforeAll(async () => {
  a = await createTenant("a");
  b = await createTenant("b");
});

afterAll(async () => {
  try {
    const businessIds = [a?.businessId, b?.businessId].filter(Boolean) as string[];
    await prisma.menuItem.deleteMany({ where: { businessId: { in: businessIds } } });
    // Deleting the business cascades to its users, categories and MCP tokens.
    await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  } finally {
    await prisma.$disconnect();
  }
});

describe("MCP tenant isolation", () => {
  it("shows each token only its own business's categories", async () => {
    const fromA = await callTool(a.token, "list_categories");
    const fromB = await callTool(b.token, "list_categories");

    expect(fromA.body.map((c: { id: string }) => c.id)).toEqual([a.categoryId]);
    expect(fromB.body.map((c: { id: string }) => c.id)).toEqual([b.categoryId]);
  });

  it("creates data in the token's business only", async () => {
    const created = await callTool(a.token, "create_category", { name: `Made by MCP ${run}` });

    expect(created.isError).toBe(false);
    const row = await prisma.menuCategory.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(row.businessId).toBe(a.businessId);
  });

  it("can't put an item into another business's category", async () => {
    const result = await callTool(b.token, "create_menu_item", {
      name: "Sneaky latte", categoryId: a.categoryId, priceUSD: 3,
    });

    expect(result.isError).toBe(true);
    expect(result.body).toEqual({ success: false, message: "category_not_in_business" });
    expect(await prisma.menuItem.count({ where: { name: "Sneaky latte" } })).toBe(0);
  });

  it("can't change another business's menu item", async () => {
    const item = await callTool(a.token, "create_menu_item", {
      name: `Latte ${run}`, categoryId: a.categoryId, priceUSD: 3,
    });
    expect(item.isError).toBe(false);

    const archive = await callTool(b.token, "archive_menu_item", { id: item.body.id });
    const soldOut = await callTool(b.token, "set_menu_item_sold_out", { id: item.body.id, soldOut: true });

    expect(archive.body).toEqual({ success: false, message: "menu_item_not_found" });
    expect(soldOut.body).toEqual({ success: false, message: "menu_item_not_found" });
    const row = await prisma.menuItem.findUniqueOrThrow({ where: { id: item.body.id } });
    expect(row.archivedAt).toBeNull();
    expect(row.soldOut).toBe(false);
  });
});

describe("MCP token lifecycle", () => {
  it("stops a revoked token at once", async () => {
    const extra = await mcpTokenService.create(a.businessId, a.userId, "to revoke");
    expect((await rpc(extra.token, "tools/list", {})).status).toBe(200);

    await mcpTokenService.revoke(extra.id, a.businessId);

    expect((await rpc(extra.token, "tools/list", {})).status).toBe(401);
  });

  it("stops the token of a deactivated user at once", async () => {
    await prisma.user.update({ where: { id: b.userId }, data: { isActive: false } });

    expect((await rpc(b.token, "tools/list", {})).status).toBe(401);

    await prisma.user.update({ where: { id: b.userId }, data: { isActive: true } });
    expect((await rpc(b.token, "tools/list", {})).status).toBe(200);
  });

  it("records when a token was last used", async () => {
    await callTool(a.token, "get_business");

    const row = await prisma.mcpToken.findUniqueOrThrow({ where: { id: a.tokenId } });
    expect(row.lastUsedAt).not.toBeNull();
  });
});
