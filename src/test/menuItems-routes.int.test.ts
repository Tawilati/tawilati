
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
} from "@/app/api/menu-items/route";
import { DELETE, PATCH } from "@/app/api/menu-items/[id]/route";
import { POST as archivePOST } from "@/app/api/menu-items/[id]/archive/route";
import { POST as unarchivePOST } from "@/app/api/menu-items/[id]/unarchive/route";

const run = randomBytes(4).toString("hex");

let businessAId: string | undefined;
let businessBId: string | undefined;
let categoryAId: string | undefined;
let categoryBId: string | undefined;
let createdItemId: string | undefined;

function makeRequest(
  method: string,
  businessId: string,
  body?: unknown,
  role = "owner",
): NextRequest {
  const headers: Record<string, string> = {
    "x-user-id": `test-user-${run}`,
    "x-user-role": role,
    "x-business-id": businessId,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return new NextRequest("http://localhost/api/menu-items", {
    method,
    headers,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });
}

function itemRequest(
  method: string,
  businessId: string,
  itemId: string,
  body?: unknown,
  role = "owner",
): NextRequest {
  return makeRequest(method, businessId, body, role);
}

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeAll(async () => {
  const businessA = await prisma.business.create({
    data: {
      name: `Menu Item Test A ${run}`,
      slug: `menu-item-test-a-${run}`,
      exchangeRate: "89500",
      timezone: "Asia/Beirut",
    },
  });

  businessAId = businessA.id;

  const categoryA = await prisma.menuCategory.create({
    data: {
      businessId: businessA.id,
      name: `Test Category A ${run}`,
    },
  });

  categoryAId = categoryA.id;

  const businessB = await prisma.business.create({
    data: {
      name: `Menu Item Test B ${run}`,
      slug: `menu-item-test-b-${run}`,
      exchangeRate: "90000",
      timezone: "Asia/Beirut",
    },
  });

  businessBId = businessB.id;

  const categoryB = await prisma.menuCategory.create({
    data: {
      businessId: businessB.id,
      name: `Test Category B ${run}`,
    },
  });

  categoryBId = categoryB.id;
});

afterAll(async () => {
  try {
    const businessIds = [businessAId, businessBId].filter(
      (id): id is string => Boolean(id),
    );

    if (businessIds.length > 0) {
      // Delete only records created for this test run.
      await prisma.menuItem.deleteMany({
        where: { businessId: { in: businessIds } },
      });

      await prisma.menuCategory.deleteMany({
        where: { businessId: { in: businessIds } },
      });

      await prisma.business.deleteMany({
        where: { id: { in: businessIds } },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe("Menu item integration", () => {
  it("creates an item and calculates its LBP price", async () => {
    const response = await POST(
      makeRequest("POST", businessAId!, {
        name: "  Espresso  ",
        categoryId: categoryAId,
        priceUSD: 2.5,
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({
      name: "Espresso",
      businessId: businessAId,
      categoryId: categoryAId,
      soldOut: false,
    });

    expect(body.data.id).toBeTruthy();
    expect(String(body.data.priceUSD)).toBe("2.5");
    expect(String(body.data.priceLBP)).toBe("223750");

    createdItemId = body.data.id;

    const savedItem = await prisma.menuItem.findFirst({
      where: {
        id: createdItemId,
        businessId: businessAId,
      },
    });

    expect(savedItem).not.toBeNull();
    expect(savedItem?.name).toBe("Espresso");
    expect(savedItem?.priceUSD.toString()).toBe("2.5");
    expect(savedItem?.priceLBP.toString()).toBe("223750");
  });

  it("lists only items belonging to the current business", async () => {
    const response = await GET(
      makeRequest("GET", businessAId!),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdItemId,
          businessId: businessAId,
          name: "Espresso",
        }),
      ]),
    );

    expect(
      body.data.every(
        (item: { businessId: string }) =>
          item.businessId === businessAId,
      ),
    ).toBe(true);
  });

  it("updates the name and recalculates LBP when USD price changes", async () => {
    const response = await PATCH(
      itemRequest("PATCH", businessAId!, createdItemId!, {
        name: "Espresso Large",
        priceUSD: 3.25,
      }),
      routeContext(createdItemId!),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: createdItemId,
      name: "Espresso Large",
    });
    expect(String(body.data.priceUSD)).toBe("3.25");
    expect(String(body.data.priceLBP)).toBe("290875");

    const savedItem = await prisma.menuItem.findFirst({
      where: {
        id: createdItemId,
        businessId: businessAId,
      },
    });

    expect(savedItem?.name).toBe("Espresso Large");
    expect(savedItem?.priceUSD.toString()).toBe("3.25");
    expect(savedItem?.priceLBP.toString()).toBe("290875");
  });

  it("does not allow an item to use another business's category", async () => {
    const response = await POST(
      makeRequest("POST", businessAId!, {
        name: "Wrong Category Item",
        categoryId: categoryBId,
        priceUSD: 1.5,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "category_not_in_business",
    });
  });

  it("does not allow another business to update this item", async () => {
    const response = await PATCH(
      itemRequest("PATCH", businessBId!, createdItemId!, {
        name: "Unauthorized Change",
      }),
      routeContext(createdItemId!),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "menu_item_not_found",
    });

    const savedItem = await prisma.menuItem.findUnique({
      where: { id: createdItemId },
    });

    expect(savedItem?.name).toBe("Espresso Large");
  });

  it("archives an item without deleting it", async () => {
    const response = await archivePOST(
      itemRequest("POST", businessAId!, createdItemId!),
      routeContext(createdItemId!),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(createdItemId);
    expect(body.data.archivedAt).toBeTruthy();

    const savedItem = await prisma.menuItem.findUnique({
      where: { id: createdItemId },
    });

    expect(savedItem).not.toBeNull();
    expect(savedItem?.archivedAt).not.toBeNull();
  });

  it("rejects archiving an already archived item", async () => {
    const response = await archivePOST(
      itemRequest("POST", businessAId!, createdItemId!),
      routeContext(createdItemId!),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "menu_item_already_archived",
    });
  });

  it("unarchives an item", async () => {
    const response = await unarchivePOST(
      itemRequest("POST", businessAId!, createdItemId!),
      routeContext(createdItemId!),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(createdItemId);
    expect(body.data.archivedAt).toBeNull();

    const savedItem = await prisma.menuItem.findUnique({
      where: { id: createdItemId },
    });

    expect(savedItem?.archivedAt).toBeNull();
  });

  it("rejects unarchiving an item that is already active", async () => {
    const response = await unarchivePOST(
      itemRequest("POST", businessAId!, createdItemId!),
      routeContext(createdItemId!),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "menu_item_not_archived",
    });
  });

  it("rejects invalid create data", async () => {
    const response = await POST(
      makeRequest("POST", businessAId!, {
        name: "   ",
        categoryId: categoryAId,
        priceUSD: -5,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "validation_error",
    });
  });

  it("rejects an empty update", async () => {
    const response = await PATCH(
      itemRequest("PATCH", businessAId!, createdItemId!, {}),
      routeContext(createdItemId!),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "validation_error",
    });
  });

  it("rejects unauthenticated list requests", async () => {
    const request = new NextRequest(
      "http://localhost/api/menu-items",
      { method: "GET" },
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      message: "unauthorized",
    });
  });

  it("rejects a waiter attempting to create an item", async () => {
    const response = await POST(
      makeRequest(
        "POST",
        businessAId!,
        {
          name: "Waiter Item",
          categoryId: categoryAId,
          priceUSD: 1,
        },
        "waiter",
      ),
    );

    expect(response.status).toBe(403);
  });

  it("deletes an unused item and returns 404 on a second delete", async () => {
    const response = await DELETE(makeRequest("DELETE", businessAId!), routeContext(createdItemId!));
    expect(response.status).toBe(204);
    expect(await prisma.menuItem.findUnique({ where: { id: createdItemId! } })).toBeNull();
    const again = await DELETE(makeRequest("DELETE", businessAId!), routeContext(createdItemId!));
    expect(again.status).toBe(404);
  });
});
