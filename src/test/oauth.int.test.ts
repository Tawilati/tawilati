import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST as mcpWithKeyInAddress } from "@/app/api/mcp/[key]/route";
import { POST as mcp } from "@/app/api/mcp/route";
import { POST as authorize } from "@/app/api/oauth/authorize/route";
import { POST as register } from "@/app/api/oauth/register/route";
import { POST as token } from "@/app/api/oauth/token/route";
import { prisma } from "@/lib/db";
import { mcpTokenService } from "@/service/McpTokenService";
import { s256Challenge } from "@/utils/pkce";

// Both ways an owner connects Claude, through the real routes and database:
// signing in (register → Allow → token → MCP) and a key in the connector address.
const run = randomBytes(4).toString("hex");
const redirectUri = "https://claude.ai/api/mcp/auth_callback";

type Tenant = { businessId: string; userId: string; categoryName: string };
let a: Tenant;
let b: Tenant;
const clientIds: string[] = [];

async function createTenant(tag: string): Promise<Tenant> {
  const business = await prisma.business.create({
    data: { name: `Test OAuth ${tag} ${run}`, slug: `test-oauth-${tag}-${run}`, exchangeRate: "89500", timezone: "Asia/Beirut" },
  });
  const user = await prisma.user.create({
    data: { businessId: business.id, name: `Owner ${tag}`, email: `oauth-${tag}-${run}@example.test`, passwordHash: "x", role: "OWNER" },
  });
  const categoryName = `Only in ${tag} ${run}`;
  await prisma.menuCategory.create({ data: { businessId: business.id, name: categoryName } });
  return { businessId: business.id, userId: user.id, categoryName };
}

async function registerClaude(): Promise<string> {
  const response = await register(
    new Request("http://localhost/api/oauth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "Claude", redirect_uris: [redirectUri], token_endpoint_auth_method: "none" }),
    }),
  );
  expect(response.status).toBe(201);
  const { client_id } = await response.json();
  clientIds.push(client_id);
  return client_id;
}

async function allow(owner: Tenant, clientId: string, codeChallenge: string, role = "OWNER") {
  return authorize(
    new NextRequest("http://localhost/api/oauth/authorize", {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": owner.userId, "x-user-role": role, "x-business-id": owner.businessId },
      body: JSON.stringify({ clientId, redirectUri, codeChallenge, state: "s1", decision: "allow" }),
    }),
  );
}

async function swap(clientId: string, code: string, codeVerifier: string) {
  return token(
    new Request("http://localhost/api/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier }).toString(),
    }),
  );
}

const listCategoriesRequest = (url: string, bearer?: string) =>
  new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_categories", arguments: {} } }),
  });

async function categoryNames(response: Response): Promise<string[]> {
  expect(response.status).toBe(200);
  const data = (await response.text()).split("\n").find((line) => line.startsWith("data: "))!;
  const { result } = JSON.parse(data.slice("data: ".length));
  return (JSON.parse(result.content[0].text) as { name: string }[]).map((category) => category.name);
}

beforeAll(async () => {
  a = await createTenant("a");
  b = await createTenant("b");
});

afterAll(async () => {
  try {
    // Deleting a business cascades to its users, codes and MCP tokens; clients belong to no business.
    await prisma.business.deleteMany({ where: { id: { in: [a?.businessId, b?.businessId].filter(Boolean) as string[] } } });
    await prisma.oAuthClient.deleteMany({ where: { id: { in: clientIds } } });
  } finally {
    await prisma.$disconnect();
  }
});

describe("connecting Claude by signing in", () => {
  it("registers, gets the owner's Allow, swaps the code once, and reaches only the owner's business", async () => {
    const clientId = await registerClaude();
    const verifier = randomBytes(32).toString("base64url");

    const allowed = await allow(a, clientId, s256Challenge(verifier));
    expect(allowed.status).toBe(200);
    const back = new URL((await allowed.json()).data.redirectTo);
    expect(back.searchParams.get("state")).toBe("s1");
    const code = back.searchParams.get("code")!;

    const swapped = await swap(clientId, code, verifier);
    expect(swapped.status).toBe(200);
    const { access_token, token_type } = await swapped.json();
    expect(token_type).toBe("Bearer");

    // A code works once.
    expect(await (await swap(clientId, code, verifier)).json()).toEqual({ error: "invalid_grant" });

    const names = await categoryNames(await mcp(listCategoriesRequest("http://localhost/api/mcp", access_token)));
    expect(names).toContain(a.categoryName);
    expect(names).not.toContain(b.categoryName);

    // It shows on the owner's AI integrations screen as a sign-in, and Revoke cuts it off.
    const listed = (await mcpTokenService.list(a.businessId)).find((connection) => connection.source === "sign-in")!;
    expect(listed.name).toBe("Claude");
    await mcpTokenService.revoke(listed.id, a.businessId);
    expect((await mcp(listCategoriesRequest("http://localhost/api/mcp", access_token))).status).toBe(401);
  });

  it("refuses the code with the wrong verifier, and the code is gone after that", async () => {
    const clientId = await registerClaude();
    const verifier = randomBytes(32).toString("base64url");
    const code = new URL((await (await allow(a, clientId, s256Challenge(verifier))).json()).data.redirectTo).searchParams.get("code")!;

    expect(await (await swap(clientId, code, randomBytes(32).toString("base64url"))).json()).toEqual({ error: "invalid_grant" });
    expect(await (await swap(clientId, code, verifier)).json()).toEqual({ error: "invalid_grant" });
  });

  it("refuses another assistant's code", async () => {
    const claude = await registerClaude();
    const other = await registerClaude();
    const verifier = randomBytes(32).toString("base64url");
    const code = new URL((await (await allow(a, claude, s256Challenge(verifier))).json()).data.redirectTo).searchParams.get("code")!;

    expect(await (await swap(other, code, verifier)).json()).toEqual({ error: "invalid_grant" });
  });

  it("lets only the owner tap Allow", async () => {
    const clientId = await registerClaude();

    expect((await allow(a, clientId, s256Challenge(randomBytes(32).toString("base64url")), "WAITER")).status).toBe(403);
  });
});

describe("connecting Claude with the key in the address", () => {
  it("reaches the key's business through /api/mcp/<key>, and Revoke cuts it off", async () => {
    const created = await mcpTokenService.create(b.businessId, b.userId, "Claude connector");
    const url = `http://localhost/api/mcp/${created.token}`;
    const params = { params: Promise.resolve({ key: created.token }) };

    const names = await categoryNames(await mcpWithKeyInAddress(listCategoriesRequest(url), params));
    expect(names).toContain(b.categoryName);
    expect(names).not.toContain(a.categoryName);

    await mcpTokenService.revoke(created.id, b.businessId);
    expect((await mcpWithKeyInAddress(listCategoriesRequest(url), params)).status).toBe(401);
  });
});
