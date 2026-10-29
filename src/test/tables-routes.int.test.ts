import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { GET as listRoute, POST as createRoute } from "@/app/api/tables/route";
import { PATCH as renameRoute } from "@/app/api/tables/[id]/route";
import { POST as disableRoute } from "@/app/api/tables/[id]/disable/route";
import { POST as enableRoute } from "@/app/api/tables/[id]/enable/route";
import { GET as qrRoute } from "@/app/api/tables/[id]/qr/route";

// Two businesses, so we can prove one owner can never read or change the other's tables.
// The routes run for real (guard, Zod, service, repository, database); only the identity headers the proxy
// normally sets are written by hand.
const run = randomBytes(4).toString("hex");
let businessA: { id: string };
let businessB: { id: string };
// A table of business B, made straight in the database, that business A must never reach.
let tableOfB: { id: string; label: string; slug: string; qrToken: string; isDisabled: boolean };

type Who = { role: "OWNER" | "WAITER" | "KITCHEN"; businessId: () => string } | null;
const ownerA: Who = { role: "OWNER", businessId: () => businessA.id };
const ownerB: Who = { role: "OWNER", businessId: () => businessB.id };
const waiterA: Who = { role: "WAITER", businessId: () => businessA.id };
const kitchenA: Who = { role: "KITCHEN", businessId: () => businessA.id };

function request(who: Who, method: string, path = "", body?: unknown): NextRequest {
  const headers: Record<string, string> = {};
  if (who) {
    headers["x-user-id"] = `test-user-${run}`;
    headers["x-user-role"] = who.role;
    headers["x-business-id"] = who.businessId();
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return new NextRequest(`http://localhost/api/tables${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const create = (who: Who, label: string) => createRoute(request(who, "POST", "", { label }));
const list = (who: Who) => listRoute(request(who, "GET"));
const rename = (who: Who, id: string, label: string) => renameRoute(request(who, "PATCH", `/${id}`, { label }), params(id));
const disable = (who: Who, id: string) => disableRoute(request(who, "POST", `/${id}/disable`), params(id));
const enable = (who: Who, id: string) => enableRoute(request(who, "POST", `/${id}/enable`), params(id));
const qr = (who: Who, id: string) => qrRoute(request(who, "GET", `/${id}/qr`), params(id));

async function createdId(label: string): Promise<string> {
  const response = await create(ownerA, label);
  expect(response.status).toBe(201);
  return (await response.json()).data.id;
}

beforeAll(async () => {
  const business = (name: string) => ({
    name: `Test Tables ${name} ${run}`,
    slug: `test-tables-${name.toLowerCase()}-${run}`,
    exchangeRate: "89500",
    timezone: "Asia/Beirut",
  });
  businessA = await prisma.business.create({ data: business("A") });
  businessB = await prisma.business.create({ data: business("B") });
  tableOfB = await prisma.diningTable.create({
    data: { businessId: businessB.id, label: "B1", slug: "b1", qrToken: randomBytes(32).toString("hex") },
  });
});

afterAll(async () => {
  try {
    const ids = [businessA?.id, businessB?.id].filter((id): id is string => Boolean(id));
    // Tables go with their business (onDelete: Cascade).
    await prisma.business.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await prisma.$disconnect();
  }
});

describe("POST /api/tables", () => {
  it("saves the table with a slug and a 64-character QR token, and never returns the token", async () => {
    const response = await create(ownerA, "  Terrace 1  ");

    expect(response.status).toBe(201);
    const { data } = await response.json();
    expect(data).toMatchObject({ label: "Terrace 1", slug: "terrace-1", isDisabled: false });
    expect(data).not.toHaveProperty("qrToken");

    const row = await prisma.diningTable.findUniqueOrThrow({ where: { id: data.id } });
    expect(row.businessId).toBe(businessA.id);
    expect(row.qrToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a label the business already has with 409 table_label_exists", async () => {
    await createdId("Dup");

    const response = await create(ownerA, "Dup");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, message: "table_label_exists" });
  });

  it("lets another business use the same label and slug", async () => {
    const response = await create(ownerA, "B1");

    expect(response.status).toBe(201);
    expect((await response.json()).data.slug).toBe("b1");
  });

  it("gives labels that share a slug their own slugs, even when they arrive at the same moment", async () => {
    const responses = await Promise.all(["Bar!", "Bar?", "Bar.", "(Bar)"].map((label) => create(ownerA, label)));

    expect(responses.map((response) => response.status)).toEqual([201, 201, 201, 201]);
    const slugs = await Promise.all(responses.map(async (response) => (await response.json()).data.slug));
    expect([...slugs].sort()).toEqual(["bar", "bar-2", "bar-3", "bar-4"]);
  });

  it("creates the same label only once when it is sent several times at once", async () => {
    const responses = await Promise.all([1, 2, 3, 4].map(() => create(ownerA, "Race")));
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([201, 409, 409, 409]);
    expect(await prisma.diningTable.count({ where: { businessId: businessA.id, label: "Race" } })).toBe(1);
  });

  it("gives a name with no Latin letters a table-xxxxxx slug", async () => {
    const response = await create(ownerA, "طاولة ٣");

    expect(response.status).toBe(201);
    expect((await response.json()).data).toMatchObject({ label: "طاولة ٣", slug: expect.stringMatching(/^table-[0-9a-f]{6}$/) });
  });
});

describe("GET /api/tables", () => {
  it("lists only the signed-in business's tables, without QR tokens", async () => {
    const response = await list(ownerA);

    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.length).toBeGreaterThan(0);
    expect(data.map((table: { id: string }) => table.id)).not.toContain(tableOfB.id);
    expect(JSON.stringify(data)).not.toContain("qrToken");
    expect(JSON.stringify(data)).not.toContain(tableOfB.qrToken);
  });

  it("lets a waiter and a kitchen account read the list", async () => {
    expect((await list(waiterA)).status).toBe(200);
    expect((await list(kitchenA)).status).toBe(200);
  });

  it("refuses anonymous requests", async () => {
    expect((await list(null)).status).toBe(401);
  });
});

describe("PATCH /api/tables/:id", () => {
  it("renames the table and keeps its slug and QR token, so printed stickers keep working", async () => {
    const id = await createdId("Window");
    const before = await prisma.diningTable.findUniqueOrThrow({ where: { id } });

    const response = await rename(ownerA, id, "Window seat");

    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ label: "Window seat", slug: "window" });
    const after = await prisma.diningTable.findUniqueOrThrow({ where: { id } });
    expect(after.slug).toBe(before.slug);
    expect(after.qrToken).toBe(before.qrToken);
  });

  it("refuses a rename onto a label the business already has with 409 label_already_taken", async () => {
    await createdId("Patio 1");
    const id = await createdId("Patio 2");

    const response = await rename(ownerA, id, "Patio 1");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, message: "label_already_taken" });
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id } })).label).toBe("Patio 2");
  });

  it("answers 404 for an id that doesn't exist", async () => {
    const response = await rename(ownerA, "11111111-1111-4111-8111-111111111111", "Ghost");

    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe("not_found");
  });
});

describe("POST /api/tables/:id/disable and /enable", () => {
  it("saves the switch both ways, and disabling twice is harmless", async () => {
    const id = await createdId("Corner");

    expect((await disable(ownerA, id)).status).toBe(200);
    expect((await disable(ownerA, id)).status).toBe(200);
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id } })).isDisabled).toBe(true);

    const response = await enable(ownerA, id);
    expect(response.status).toBe(200);
    expect((await response.json()).data.isDisabled).toBe(false);
    expect((await prisma.diningTable.findUniqueOrThrow({ where: { id } })).isDisabled).toBe(false);
  });
});

describe("GET /api/tables/:id/qr", () => {
  it("answers the owner with the sticker PNG", async () => {
    const id = await createdId("Sticker");

    const response = await qr(ownerA, id);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  }, 20_000);
});

describe("staff who aren't the owner", () => {
  it.each([
    ["waiter", waiterA],
    ["kitchen", kitchenA],
  ])("a %s can't add, rename, disable or enable a table, or get its sticker", async (_, who) => {
    const id = await createdId(`Locked ${who!.role}`);

    expect((await create(who, "Sneaky")).status).toBe(403);
    expect((await rename(who, id, "Sneaky")).status).toBe(403);
    expect((await disable(who, id)).status).toBe(403);
    expect((await enable(who, id)).status).toBe(403);
    expect((await qr(who, id)).status).toBe(403);

    const row = await prisma.diningTable.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ label: `Locked ${who!.role}`, isDisabled: false });
    expect(await prisma.diningTable.count({ where: { businessId: businessA.id, label: "Sneaky" } })).toBe(0);
  });

  it("anonymous requests are refused with 401", async () => {
    const id = await createdId("Anon");

    for (const response of [
      await create(null, "Anon 2"),
      await rename(null, id, "Anon 2"),
      await disable(null, id),
      await enable(null, id),
      await qr(null, id),
    ]) {
      expect(response.status).toBe(401);
    }
  });
});

// Definition of done 3: one business cannot read another's data.
describe("tenant isolation", () => {
  it("business B's owner doesn't see business A's tables in the list", async () => {
    const idOfA = await createdId("Private");

    const { data } = await (await list(ownerB)).json();

    expect(data.map((table: { id: string }) => table.id)).toEqual([tableOfB.id]);
    expect(data.map((table: { id: string }) => table.id)).not.toContain(idOfA);
  });

  it("business A's owner gets 404 for every action on business B's table, and the table is untouched", async () => {
    const responses = {
      rename: await rename(ownerA, tableOfB.id, "Hijacked"),
      disable: await disable(ownerA, tableOfB.id),
      enable: await enable(ownerA, tableOfB.id),
      qr: await qr(ownerA, tableOfB.id),
    };

    for (const [action, response] of Object.entries(responses)) {
      expect({ action, status: response.status }).toEqual({ action, status: 404 });
      expect(await response.json()).toEqual({ success: false, message: "not_found" });
    }
    const row = await prisma.diningTable.findUniqueOrThrow({ where: { id: tableOfB.id } });
    expect(row).toMatchObject({ label: tableOfB.label, slug: tableOfB.slug, qrToken: tableOfB.qrToken, isDisabled: false });
  });

  // Today the strict schema refuses the extra field (400); whether to refuse or ignore it is still open.
  // Either way the table must never land in the business named in the body.
  it("never lets a businessId in the body put a table in another business", async () => {
    await createRoute(request(ownerA, "POST", "", { label: "Smuggled", businessId: businessB.id }));

    expect(await prisma.diningTable.count({ where: { businessId: businessB.id, label: "Smuggled" } })).toBe(0);
  });
});
