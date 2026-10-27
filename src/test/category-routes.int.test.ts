
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
  it("creates a category in the database and returns 201", async () => {
    const response = await POST(
      request("POST", { name: "  Drinks  " }),
    );

    const body = await response.json();

    expect(response.status).toBe(201);

    // Verify the API response.
    expect(body.category).toMatchObject({
      name: "Drinks",
    });
    expect(body.category.id).toBeTruthy();

    // Verify the category really exists under this business.
    const savedCategory = await prisma.menuCategory.findFirst({
      where: {
        id: body.category.id,
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

    expect(body.categories).toEqual(
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
      message: "Unauthorized",
    });
  });
});
