
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "@/lib/db";
import {
  GET,
  POST,
} from "@/app/api/categories/route";
import { PATCH, DELETE } from "@/app/api/categories/[id]/route";

const run = randomBytes(4).toString("hex");

const businessSlug = `test-categories-${run}`;
const businessName = `Test Categories ${run}`;

let businessId: string | undefined;

function request(
  method: string,
  body?: unknown,
  authenticated = true,
): NextRequest {
  const headers: Record<string, string> = {};

  if (authenticated) {
    headers["x-user-id"] = `test-owner-${run}`;
    headers["x-user-role"] = "owner";
    headers["x-business-id"] = businessId ?? "";
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return new NextRequest("http://localhost/api/categories", {
    method,
    headers,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });
}

beforeAll(async () => {
  const business = await prisma.business.create({
    data: {
      name: businessName,
      slug: businessSlug,
      exchangeRate: "89500",
      timezone: "Asia/Beirut",
    },
  });

  businessId = business.id;
});

afterAll(async () => {
  if (!businessId) return;

  // Delete only this test's categories and business.
  try {
    await prisma.menuItem.deleteMany({ where: { businessId } });
    await prisma.menuCategory.deleteMany({
      where: { businessId },
    });

    await prisma.business.deleteMany({
      where: { id: businessId },
    });
  } finally {
    await prisma.$disconnect();
  }
});

describe("/api/categories integration", () => {
  it("renames an empty category, rejects duplicates, and deletes it", async () => {
    const first = await prisma.menuCategory.create({ data: { businessId: businessId!, name: "Rename me" } });
    const other = await prisma.menuCategory.create({ data: { businessId: businessId!, name: "Taken" } });
    const context = () => ({ params: Promise.resolve({ id: first.id }) });
    const renamed = await PATCH(request("PATCH", { name: "  Renamed  " }), context());
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).data).toMatchObject({ name: "Renamed", itemCount: 0 });
    const duplicate = await PATCH(request("PATCH", { name: other.name }), context());
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).message).toBe("category_already_exists");
    expect((await DELETE(request("DELETE"), context())).status).toBe(204);
    expect((await DELETE(request("DELETE"), context())).status).toBe(404);
    expect(await prisma.menuCategory.findUnique({ where: { id: first.id } })).toBeNull();
  });

  it("blocks deleting categories containing archived items", async () => {
    const category = await prisma.menuCategory.create({ data: { businessId: businessId!, name: "Archived category" } });
    await prisma.menuItem.create({ data: {
      businessId: businessId!, categoryId: category.id, name: "Archived item",
      priceUSD: "1", priceLBP: "89500", archivedAt: new Date(),
    } });
    const response = await DELETE(request("DELETE"), { params: Promise.resolve({ id: category.id }) });
    expect(response.status).toBe(409);
    expect((await response.json()).message).toBe("category_has_items");
    expect(await prisma.menuCategory.findUnique({ where: { id: category.id } })).not.toBeNull();
  });

  it("rejects category writes by a waiter", async () => {
    const req = request("POST", { name: "Forbidden" });
    req.headers.set("x-user-role", "waiter");
    expect((await POST(req)).status).toBe(403);
  });

  it("does not rename or delete a category from another business", async () => {
    const category = await prisma.menuCategory.create({ data: { businessId: businessId!, name: "Scoped category" } });
    const context = () => ({ params: Promise.resolve({ id: category.id }) });
    const rename = request("PATCH", { name: "Intruder" });
    rename.headers.set("x-business-id", "11111111-1111-4111-8111-111111111111");
    expect((await PATCH(rename, context())).status).toBe(404);
    const remove = request("DELETE");
    remove.headers.set("x-business-id", "11111111-1111-4111-8111-111111111111");
    expect((await DELETE(remove, context())).status).toBe(404);
    expect((await prisma.menuCategory.findUnique({ where: { id: category.id } }))?.name).toBe("Scoped category");
  });

  it("creates a category in the database and returns 201", async () => {
    const response = await POST(
      request("POST", { name: "  Drinks  " }),
    );

    const body = await response.json();

    expect(response.status).toBe(201);

    // Verify the API response.
    expect(body.data).toMatchObject({
      name: "Drinks",
    });
    expect(body.data.id).toBeTruthy();

    // Verify the category really exists under this business.
    const savedCategory = await prisma.menuCategory.findFirst({
      where: {
        id: body.data.id,
        businessId,
      },
    });

    expect(savedCategory).not.toBeNull();
    expect(savedCategory?.name).toBe("Drinks");
  });

  it("returns categories belonging to the current business", async () => {
    const response = await GET(request("GET"));
    const body = await response.json();

    expect(response.status).toBe(200);

    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Drinks",
          itemCount: 0,
        }),
      ]),
    );
  });

  it("rejects an invalid category name with 400", async () => {
    const response = await POST(
      request("POST", { name: "   " }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "validation_error",
    });
  });

  it("rejects unauthenticated requests with 401", async () => {
    const response = await GET(
      request("GET", undefined, false),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "unauthorized",
    });
  });
});
