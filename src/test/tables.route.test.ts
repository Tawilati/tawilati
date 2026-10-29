// src/test/tables.route.test.ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/app/generated/prisma/client";
import { GET, POST } from "@/app/api/tables/route";
import * as tableByIdRoute from "@/app/api/tables/[id]/route";
import { POST as DISABLE } from "@/app/api/tables/[id]/disable/route";
import { POST as ENABLE } from "@/app/api/tables/[id]/enable/route";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { DBException } from "@/utils/exceptions/RepoException";

const { PATCH } = tableByIdRoute;

// ── Mocks ────────────────────────────────────────────────────
// The routes use the singleton service; mock it to keep Prisma out of this test.
const mockedTableService = vi.hoisted(() => ({
  createTable: vi.fn(),
  listTables: vi.fn(),
  updateTable: vi.fn(),
  disableTable: vi.fn(),
  enableTable: vi.fn(),
}));

vi.mock("@/service/TableService", () => ({ tableService: mockedTableService }));

// Keeps Prisma and the database out of the test.
vi.mock("@/repository/TableRepo", () => ({ tableRepo: {} }));

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────
const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
const OTHER_BUSINESS_ID = "b0000000-0000-4000-8000-000000000002";
const TABLE_ID = "c0000000-0000-4000-8000-000000000003";

type Role = "OWNER" | "WAITER" | "KITCHEN";
type Options = { invalidJson?: boolean; as?: Role | null };

/** A request as it reaches the route: src/proxy.ts has set the identity headers (`as: null` → signed out). */
function makeRequest(
  body?: unknown,
  { invalidJson = false, as = "OWNER" as Role | null, method = "POST" } = {},
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (as) {
    headers.set("x-user-id", "u0000000-0000-4000-8000-000000000009");
    headers.set("x-user-role", as);
    headers.set("x-business-id", BUSINESS_ID);
  }
  return new NextRequest("http://localhost/api/tables", {
    method,
    headers,
    body: method === "GET" ? undefined : invalidJson ? "{ not json" : JSON.stringify(body ?? {}),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const create = (body: unknown, options: Options = {}) => POST(makeRequest(body, options));
const list = (as: Role | null = "OWNER") => GET(makeRequest(undefined, { as, method: "GET" }));
const patch = (body: unknown, options: Options = {}, id = TABLE_ID) =>
  PATCH(makeRequest(body, { ...options, method: "PATCH" }), params(id));
const disable = (options: Options = {}, id = TABLE_ID, body?: unknown) =>
  DISABLE(makeRequest(body, options), params(id));
const enable = (options: Options = {}, id = TABLE_ID, body?: unknown) =>
  ENABLE(makeRequest(body, options), params(id));

// A unique violation as Prisma reports it, for the races the service pre-check can't see.
const uniqueViolation = (constraint: string) =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: constraint },
  });

const recordGone = () =>
  new Prisma.PrismaClientKnownRequestError("Record to update not found", {
    code: "P2025",
    clientVersion: "test",
  });

const table = {
  id: TABLE_ID,
  label: "T1",
  slug: "t1",
  isDisabled: false,
  createdAt: "2026-10-28T09:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedTableService.createTable.mockResolvedValue(table);
  mockedTableService.listTables.mockResolvedValue([table]);
  mockedTableService.updateTable.mockResolvedValue({ ...table, label: "Terrace 1" });
  mockedTableService.disableTable.mockResolvedValue({ ...table, isDisabled: true });
  mockedTableService.enableTable.mockResolvedValue(table);
  // handleRouteError logs 500s; keep the test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ── Tests ────────────────────────────────────────────────────
describe("POST /api/tables", () => {
  describe("successful creation", () => {
    it("returns 201 with the new table", async () => {
      const res = await create({ label: "T1" });

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ success: true, message: "table created", data: table });
      expect(mockedTableService.createTable).toHaveBeenCalledWith(BUSINESS_ID, { label: "T1" });
    });

    it("passes the label trimmed", async () => {
      await create({ label: "  Terrace 1  " });

      expect(mockedTableService.createTable).toHaveBeenCalledWith(BUSINESS_ID, { label: "Terrace 1" });
    });

    it.each([
      ["1 character", "A"],
      ["50 characters", "x".repeat(50)],
      ["Arabic text", "طاولة ١"],
    ])("accepts a label of %s", async (_scenario, label) => {
      const res = await create({ label });

      expect(res.status).toBe(201);
      expect(mockedTableService.createTable).toHaveBeenCalledWith(BUSINESS_ID, { label });
    });

    it("uses the business from the session, never from the headers of another tenant", async () => {
      await create({ label: "T1" });

      expect(mockedTableService.createTable.mock.calls[0][0]).toBe(BUSINESS_ID);
    });
  });

  describe("request body validation", () => {
    it("returns 400 with details.label for an empty body", async () => {
      const res = await create({});

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("validation_error");
      expect(Object.keys(body.details)).toEqual(["label"]);
      expect(mockedTableService.createTable).not.toHaveBeenCalled();
    });

    it.each([
      ["an empty label", ""],
      ["a blank label", "   "],
      ["a 51-character label", "x".repeat(51)],
      ["a number", 5],
      ["null", null],
    ])("returns 400 with details.label for %s", async (_scenario, label) => {
      const res = await create({ label });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("validation_error");
      expect(Object.keys(body.details)).toEqual(["label"]);
      expect(mockedTableService.createTable).not.toHaveBeenCalled();
    });

    it.each([
      ["a businessId", { businessId: OTHER_BUSINESS_ID }],
      ["a qrToken", { qrToken: "a".repeat(64) }],
      ["a slug", { slug: "custom" }],
      ["isDisabled", { isDisabled: true }],
    ])("returns 400 validation_error when the body also carries %s", async (_scenario, extra) => {
      const res = await create({ label: "T1", ...extra });

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ success: false, message: "validation_error" });
      expect(mockedTableService.createTable).not.toHaveBeenCalled();
    });

    it("returns 400 invalid_json when the body is not valid JSON", async () => {
      const res = await create(null, { invalidJson: true });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ success: false, message: "invalid_json" });
      expect(mockedTableService.createTable).not.toHaveBeenCalled();
    });
  });

  describe("failed domain check", () => {
    it("returns 401 when nobody is signed in", async () => {
      const res = await create({ label: "T1" }, { as: null });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ success: false, message: "unauthorized" });
      expect(mockedTableService.createTable).not.toHaveBeenCalled();
    });

    it.each(["WAITER", "KITCHEN"] as const)("returns 403 forbidden for a %s", async (role) => {
      const res = await create({ label: "T1" }, { as: role });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ success: false, message: "forbidden" });
      expect(mockedTableService.createTable).not.toHaveBeenCalled();
    });

    it("returns 409 table_already_taken when the label is used in the business", async () => {
      mockedTableService.createTable.mockRejectedValue(new ConflictException("table_already_taken"));

      const res = await create({ label: "T1" });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ success: false, message: "table_already_taken" });
    });

    it("returns 409 label_already_taken when two creates race on the same label", async () => {
      mockedTableService.createTable.mockRejectedValue(uniqueViolation("DiningTable_businessId_label_key"));

      const res = await create({ label: "T1" });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ success: false, message: "label_already_taken" });
    });

    it("returns 409 slug_already_taken when two labels race onto the same slug", async () => {
      mockedTableService.createTable.mockRejectedValue(uniqueViolation("DiningTable_businessId_slug_key"));

      const res = await create({ label: "T-1" });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ success: false, message: "slug_already_taken" });
    });

    it("returns 409 duplicate_value on a (practically impossible) qrToken collision", async () => {
      mockedTableService.createTable.mockRejectedValue(uniqueViolation("DiningTable_qrToken_key"));

      const res = await create({ label: "T1" });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ success: false, message: "duplicate_value" });
    });
  });

  describe("server errors", () => {
    it("returns 500 database_error when the database fails", async () => {
      mockedTableService.createTable.mockRejectedValue(new DBException("insert failed", new Error("down")));

      const res = await create({ label: "T1" });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ success: false, message: "database_error" });
    });

    it("returns 500 internal_server_error on an unexpected error", async () => {
      mockedTableService.createTable.mockRejectedValue(new Error("boom"));

      const res = await create({ label: "T1" });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ success: false, message: "internal_server_error" });
    });
  });
});

describe("GET /api/tables", () => {
  describe("successful", () => {
    it.each(["OWNER", "WAITER", "KITCHEN"] as const)("returns 200 with the tables for a %s", async (role) => {
      const res = await list(role);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, message: "table list", data: [table] });
      expect(mockedTableService.listTables).toHaveBeenCalledWith(BUSINESS_ID);
    });

    it("returns 200 with an empty array when the business has no tables", async () => {
      mockedTableService.listTables.mockResolvedValue([]);

      const res = await list();

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });
  });

  describe("failed domain check", () => {
    it("returns 401 when nobody is signed in", async () => {
      const res = await list(null);

      expect(res.status).toBe(401);
      expect(mockedTableService.listTables).not.toHaveBeenCalled();
    });
  });

  describe("server errors", () => {
    it("returns 500 database_error when the database fails", async () => {
      mockedTableService.listTables.mockRejectedValue(new DBException("read failed", new Error("down")));

      const res = await list();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ success: false, message: "database_error" });
    });
  });
});

describe("PATCH /api/tables/:id", () => {
  describe("successful update", () => {
    it("returns 200 with the renamed table", async () => {
      const res = await patch({ label: "Terrace 1" });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        success: true,
        message: "table updated",
        data: { ...table, label: "Terrace 1" },
      });
      expect(mockedTableService.updateTable).toHaveBeenCalledWith(BUSINESS_ID, TABLE_ID, { label: "Terrace 1" });
    });

    it("passes the label trimmed", async () => {
      await patch({ label: "  Terrace 1 " });

      expect(mockedTableService.updateTable).toHaveBeenCalledWith(BUSINESS_ID, TABLE_ID, { label: "Terrace 1" });
    });
  });

  describe("request validation", () => {
    it.each([
      ["not a UUID", "abc"],
      ["a numeric id", "123"],
      ["an almost-UUID", "c0000000-0000-4000-8000-00000000000"],
    ])("returns 400 with details.id when the id is %s", async (_scenario, id) => {
      const res = await patch({ label: "T2" }, {}, id);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("validation_error");
      expect(Object.keys(body.details)).toEqual(["id"]);
      expect(mockedTableService.updateTable).not.toHaveBeenCalled();
    });

    it.each([
      ["an empty body", {}],
      ["a blank label", { label: "   " }],
      ["a 51-character label", { label: "x".repeat(51) }],
    ])("returns 400 with details.label for %s", async (_scenario, body) => {
      const res = await patch(body);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toBe("validation_error");
      expect(Object.keys(json.details)).toEqual(["label"]);
      expect(mockedTableService.updateTable).not.toHaveBeenCalled();
    });

    it.each([
      ["isDisabled (use /disable or /enable)", { label: "T2", isDisabled: true }],
      ["a qrToken (tokens never rotate)", { label: "T2", qrToken: "b".repeat(64) }],
      ["a slug (slugs never change)", { label: "T2", slug: "t2" }],
      ["a businessId", { label: "T2", businessId: OTHER_BUSINESS_ID }],
    ])("returns 400 validation_error when the body carries %s", async (_scenario, body) => {
      const res = await patch(body);

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ success: false, message: "validation_error" });
      expect(mockedTableService.updateTable).not.toHaveBeenCalled();
    });

    it("returns 400 invalid_json when the body is not valid JSON", async () => {
      const res = await patch(null, { invalidJson: true });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ success: false, message: "invalid_json" });
      expect(mockedTableService.updateTable).not.toHaveBeenCalled();
    });
  });

  describe("failed domain check", () => {
    it("returns 401 when nobody is signed in", async () => {
      const res = await patch({ label: "T2" }, { as: null });

      expect(res.status).toBe(401);
      expect(mockedTableService.updateTable).not.toHaveBeenCalled();
    });

    it.each(["WAITER", "KITCHEN"] as const)("returns 403 forbidden for a %s", async (role) => {
      const res = await patch({ label: "T2" }, { as: role });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ success: false, message: "forbidden" });
      expect(mockedTableService.updateTable).not.toHaveBeenCalled();
    });

    it("returns 404 not_found for an unknown table or another business's table", async () => {
      mockedTableService.updateTable.mockRejectedValue(new NotFoundException("not_found"));

      const res = await patch({ label: "T2" });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ success: false, message: "not_found" });
    });

    it("returns 404 not_found when the table disappears between the check and the update", async () => {
      mockedTableService.updateTable.mockRejectedValue(recordGone());

      const res = await patch({ label: "T2" });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ success: false, message: "not_found" });
    });

    it("returns 409 label_already_taken when renaming onto another table's label", async () => {
      mockedTableService.updateTable.mockRejectedValue(uniqueViolation("DiningTable_businessId_label_key"));

      const res = await patch({ label: "T2" });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ success: false, message: "label_already_taken" });
    });
  });

  describe("server errors", () => {
    it("returns 500 database_error when the database fails", async () => {
      mockedTableService.updateTable.mockRejectedValue(new DBException("update failed", new Error("down")));

      const res = await patch({ label: "T2" });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ success: false, message: "database_error" });
    });
  });

  it("has no DELETE handler (deleting tables is not part of the C block)", () => {
    expect((tableByIdRoute as Record<string, unknown>).DELETE).toBeUndefined();
  });
});

describe.each([
  {
    name: "POST /api/tables/:id/disable",
    call: disable,
    service: "disableTable" as const,
    message: "table disabled",
    result: { ...table, isDisabled: true },
  },
  {
    name: "POST /api/tables/:id/enable",
    call: enable,
    service: "enableTable" as const,
    message: "table enabled",
    result: table,
  },
])("$name", ({ call, service, message, result }) => {
  describe("successful", () => {
    it(`returns 200 "${message}" with the table`, async () => {
      const res = await call();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, message, data: result });
      expect(mockedTableService[service]).toHaveBeenCalledWith(BUSINESS_ID, TABLE_ID);
    });

    it("ignores any request body", async () => {
      const res = await call({}, TABLE_ID, { isDisabled: "the opposite", businessId: OTHER_BUSINESS_ID });

      expect(res.status).toBe(200);
      expect(mockedTableService[service]).toHaveBeenCalledWith(BUSINESS_ID, TABLE_ID);
    });

    it("works with no body at all", async () => {
      const res = await call({}, TABLE_ID, undefined);

      expect(res.status).toBe(200);
    });
  });

  describe("request validation", () => {
    it("returns 400 with details.id when the id is not a UUID", async () => {
      const res = await call({}, "abc");

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("validation_error");
      expect(Object.keys(body.details)).toEqual(["id"]);
      expect(mockedTableService[service]).not.toHaveBeenCalled();
    });
  });

  describe("failed domain check", () => {
    it("returns 401 when nobody is signed in", async () => {
      const res = await call({ as: null });

      expect(res.status).toBe(401);
      expect(mockedTableService[service]).not.toHaveBeenCalled();
    });

    it.each(["WAITER", "KITCHEN"] as const)("returns 403 forbidden for a %s", async (role) => {
      const res = await call({ as: role });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ success: false, message: "forbidden" });
      expect(mockedTableService[service]).not.toHaveBeenCalled();
    });

    it("returns 404 not_found for an unknown table or another business's table", async () => {
      mockedTableService[service].mockRejectedValue(new NotFoundException("not_found"));

      const res = await call();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ success: false, message: "not_found" });
    });

    it("returns 404 not_found when the table disappears between the check and the update", async () => {
      mockedTableService[service].mockRejectedValue(recordGone());

      const res = await call();

      expect(res.status).toBe(404);
    });
  });

  describe("server errors", () => {
    it("returns 500 database_error when the database fails", async () => {
      mockedTableService[service].mockRejectedValue(new DBException("update failed", new Error("down")));

      const res = await call();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ success: false, message: "database_error" });
    });
  });
});
