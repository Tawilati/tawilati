import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PERMISSION } from "@/types/Roles";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

const mocks = vi.hoisted(() => ({
  authGuard: vi.fn(),
  getBusinessIdFromRequest: vi.fn(),
  service: {
    createTable: vi.fn(),
    listTables: vi.fn(),
    updateTable: vi.fn(),
    disableTable: vi.fn(),
    enableTable: vi.fn(),
  },
}));

vi.mock("@/lib/auth/gaurd", () => ({ authGuard: mocks.authGuard }));
vi.mock("@/lib/auth/requestHelper", () => ({ getBusinessIdFromRequest: mocks.getBusinessIdFromRequest }));
vi.mock("@/service/TableService", () => ({ tableService: mocks.service }));

import { GET as listRoute, POST as createRoute } from "@/app/api/tables/route";
import { PATCH as renameRoute } from "@/app/api/tables/[id]/route";
import { POST as disableRoute } from "@/app/api/tables/[id]/disable/route";
import { POST as enableRoute } from "@/app/api/tables/[id]/enable/route";

const businessId = "business-1";
const tableId = "33333333-3333-4333-8333-333333333333";
const table = { id: tableId, label: "T1", slug: "t1", isDisabled: false, createdAt: new Date("2026-10-29T10:00:00Z") };
const forbidden = () => NextResponse.json({ success: false, message: "forbidden" }, { status: 403 });

function request(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/tables${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}
const params = (id = tableId) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authGuard.mockReturnValue(null);
  mocks.getBusinessIdFromRequest.mockReturnValue(businessId);
  mocks.service.createTable.mockResolvedValue(table);
  mocks.service.listTables.mockResolvedValue([table]);
  mocks.service.updateTable.mockResolvedValue({ ...table, label: "Terrace 1" });
  mocks.service.disableTable.mockResolvedValue({ ...table, isDisabled: true });
  mocks.service.enableTable.mockResolvedValue(table);
});

describe("POST /api/tables", () => {
  it("creates the table in the signed-in owner's business and answers 201", async () => {
    const response = await createRoute(request("POST", "", { label: "  T1  " }));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, message: "table created", data: { id: tableId, label: "T1" } });
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), { requirePermission: PERMISSION.TABLE_WRITE });
    // The label arrives trimmed.
    expect(mocks.service.createTable).toHaveBeenCalledWith(businessId, { label: "T1" });
  });

  it.each([
    ["an empty label", { label: "   " }],
    ["a label over 50 characters", { label: "x".repeat(51) }],
    ["no label", {}],
    ["a field other than label", { label: "T1", isDisabled: true }],
  ])("refuses %s with 400 validation_error", async (_, body) => {
    const response = await createRoute(request("POST", "", body));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.service.createTable).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const response = await createRoute(request("POST", "", "{label"));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("invalid_json");
  });

  it("passes on the service's conflict code", async () => {
    mocks.service.createTable.mockRejectedValue(new ConflictException("table_label_exists"));

    const response = await createRoute(request("POST", "", { label: "T1" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, message: "table_label_exists" });
  });

  it("returns the guard's refusal (a waiter) without calling the service", async () => {
    mocks.authGuard.mockReturnValue(forbidden());

    const response = await createRoute(request("POST", "", { label: "T1" }));

    expect(response.status).toBe(403);
    expect(mocks.service.createTable).not.toHaveBeenCalled();
  });
});

describe("GET /api/tables", () => {
  it("lists the signed-in business's tables", async () => {
    const response = await listRoute(request("GET", ""));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, message: "table list" });
    expect(body.data).toHaveLength(1);
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), { requirePermission: PERMISSION.TABLE_READ });
    expect(mocks.service.listTables).toHaveBeenCalledWith(businessId);
  });

  it("returns the guard's refusal without listing", async () => {
    mocks.authGuard.mockReturnValue(NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 }));

    const response = await listRoute(request("GET", ""));

    expect(response.status).toBe(401);
    expect(mocks.service.listTables).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/tables/:id", () => {
  it("renames the table in the signed-in business", async () => {
    const response = await renameRoute(request("PATCH", `/${tableId}`, { label: " Terrace 1 " }), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, message: "table updated", data: { label: "Terrace 1" } });
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), { requirePermission: PERMISSION.TABLE_UPDATE });
    expect(mocks.service.updateTable).toHaveBeenCalledWith(businessId, tableId, { label: "Terrace 1" });
  });

  it.each([
    ["an empty body", {}],
    ["isDisabled (disable has its own route)", { isDisabled: true }],
    ["a slug (slugs never change)", { label: "T1", slug: "new" }],
  ])("refuses %s with 400 validation_error", async (_, body) => {
    const response = await renameRoute(request("PATCH", `/${tableId}`, body), params());

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("validation_error");
    expect(mocks.service.updateTable).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a UUID", async () => {
    const response = await renameRoute(request("PATCH", "/abc", { label: "T2" }), params("abc"));

    expect(response.status).toBe(400);
    expect((await response.json()).details).toHaveProperty("id");
    expect(mocks.service.updateTable).not.toHaveBeenCalled();
  });

  it("answers 404 for a table of another business", async () => {
    mocks.service.updateTable.mockRejectedValue(new NotFoundException("not_found"));

    const response = await renameRoute(request("PATCH", `/${tableId}`, { label: "T2" }), params());

    expect(response.status).toBe(404);
    expect((await response.json()).message).toBe("not_found");
  });

  it("returns the guard's refusal without renaming", async () => {
    mocks.authGuard.mockReturnValue(forbidden());

    const response = await renameRoute(request("PATCH", `/${tableId}`, { label: "T2" }), params());

    expect(response.status).toBe(403);
    expect(mocks.service.updateTable).not.toHaveBeenCalled();
  });
});

describe.each([
  ["disable", disableRoute, "disableTable", "table disabled", true],
  ["enable", enableRoute, "enableTable", "table enabled", false],
] as const)("POST /api/tables/:id/%s", (action, route, method, message, isDisabled) => {
  it(`${action}s the table in the signed-in business`, async () => {
    const response = await route(request("POST", `/${tableId}/${action}`), params());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, message, data: { id: tableId, isDisabled } });
    expect(mocks.authGuard).toHaveBeenCalledWith(expect.anything(), { requirePermission: PERMISSION.TABLE_UPDATE });
    expect(mocks.service[method]).toHaveBeenCalledWith(businessId, tableId);
  });

  it("refuses an id that is not a UUID", async () => {
    const response = await route(request("POST", `/abc/${action}`), params("abc"));

    expect(response.status).toBe(400);
    expect(mocks.service[method]).not.toHaveBeenCalled();
  });

  it("answers 404 for a table of another business", async () => {
    mocks.service[method].mockRejectedValue(new NotFoundException("not_found"));

    const response = await route(request("POST", `/${tableId}/${action}`), params());

    expect(response.status).toBe(404);
  });

  it("returns the guard's refusal without changing the table", async () => {
    mocks.authGuard.mockReturnValue(forbidden());

    const response = await route(request("POST", `/${tableId}/${action}`), params());

    expect(response.status).toBe(403);
    expect(mocks.service[method]).not.toHaveBeenCalled();
  });
});
