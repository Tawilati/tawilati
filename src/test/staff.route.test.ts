// src/test/staff.route.test.ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/staff/route";
import { PATCH } from "@/app/api/staff/[id]/route";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { DBException } from "@/utils/exceptions/RepoException";

// ── Mocks ────────────────────────────────────────────────────
// The routes use the singleton service; mock it to keep Prisma out of this test.
const mockedStaffService = vi.hoisted(() => ({
  createStaff: vi.fn(),
  listStaff: vi.fn(),
  updateStaff: vi.fn(),
}));

vi.mock("@/service/StaffService", () => ({ staffService: mockedStaffService }));

// Keeps Prisma and the database out of the test.
vi.mock("@/repository/StaffRepo", () => ({ staffRepo: {} }));

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────
const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
const OTHER_BUSINESS_ID = "b0000000-0000-4000-8000-000000000002";
const STAFF_ID = "a0000000-0000-4000-8000-000000000003";

type Role = "OWNER" | "WAITER" | "KITCHEN";

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
  return new NextRequest("http://localhost/api/staff", {
    method,
    headers,
    body: method === "GET" ? undefined : invalidJson ? "{ not json" : JSON.stringify(body ?? {}),
  });
}

const patch = (body: unknown, options: { invalidJson?: boolean; as?: Role | null } = {}, id = STAFF_ID) =>
  PATCH(makeRequest(body, { ...options, method: "PATCH" }), { params: Promise.resolve({ id }) });

const validPayload = {
  name: "Rami",
  email: "rami@tawilati.test",
  password: "Secret123",
  role: "WAITER",
};

const staff = {
  id: STAFF_ID,
  name: "Rami",
  email: "rami@tawilati.test",
  role: "WAITER",
  isActive: true,
  createdAt: "2026-10-28T09:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedStaffService.createStaff.mockResolvedValue(staff);
  mockedStaffService.listStaff.mockResolvedValue([staff]);
  mockedStaffService.updateStaff.mockResolvedValue(staff);
  // handleRouteError logs 500s; keep the test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ── Tests ────────────────────────────────────────────────────
describe("POST /api/staff", () => {
  describe("successful creation", () => {
    // Test 1 — happy path
    it("returns 201 with the new staff account", async () => {
      const res = await POST(makeRequest(validPayload));

      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ success: true, message: "staff created", data: staff });
    });

    // Test 2 — kitchen accounts too
    it("creates a KITCHEN account", async () => {
      const res = await POST(makeRequest({ ...validPayload, role: "KITCHEN" }));

      expect(res.status).toBe(201);
      expect(mockedStaffService.createStaff).toHaveBeenCalledWith(BUSINESS_ID, { ...validPayload, role: "KITCHEN" });
    });

    // Test 3 — input normalised
    it("passes the name trimmed and the email trimmed and lowercased", async () => {
      await POST(makeRequest({ ...validPayload, name: "  Rami ", email: "  RAMI@Tawilati.TEST " }));

      expect(mockedStaffService.createStaff).toHaveBeenCalledWith(BUSINESS_ID, validPayload);
    });

    // Test 4 — tenant isolation (E-U9)
    it("uses the business from the session and ignores a businessId in the body", async () => {
      await POST(makeRequest({ ...validPayload, businessId: OTHER_BUSINESS_ID }));

      expect(mockedStaffService.createStaff).toHaveBeenCalledWith(BUSINESS_ID, validPayload);
    });
  });

  describe("request body validation", () => {
    // Test 5 — OWNER role rejected (E-U7)
    it("returns 400 validation_error when the role is OWNER", async () => {
      const res = await POST(makeRequest({ ...validPayload, role: "OWNER" }));

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({ success: false, message: "validation_error" });
      expect(Object.keys(body.details)).toEqual(["role"]);
      expect(mockedStaffService.createStaff).not.toHaveBeenCalled();
    });

    // Test 6 — empty body
    it("returns 400 with details for every missing field", async () => {
      const res = await POST(makeRequest({}));

      expect(res.status).toBe(400);
      expect(Object.keys((await res.json()).details).sort()).toEqual(["email", "name", "password", "role"]);
      expect(mockedStaffService.createStaff).not.toHaveBeenCalled();
    });

    // Test 7 — one bad field at a time
    it.each([
      ["name", "a blank name", { name: "   " }],
      ["email", "an invalid email", { email: "not-an-email" }],
      ["password", "a password shorter than 8 characters", { password: "Abc123" }],
      ["password", "a password without a number", { password: "OnlyLetters" }],
      ["role", "an unknown role", { role: "MANAGER" }],
    ])("returns 400 with details for %s on %s", async (field, _scenario, override) => {
      const res = await POST(makeRequest({ ...validPayload, ...override }));

      expect(res.status).toBe(400);
      expect(Object.keys((await res.json()).details)).toEqual([field]);
      expect(mockedStaffService.createStaff).not.toHaveBeenCalled();
    });

    // Test 8 — malformed JSON
    it("returns 400 invalid_json when the body is not valid JSON", async () => {
      const res = await POST(makeRequest(null, { invalidJson: true }));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ success: false, message: "invalid_json" });
      expect(mockedStaffService.createStaff).not.toHaveBeenCalled();
    });
  });

  describe("failed domain check", () => {
    // Test 9 — signed out
    it("returns 401 when nobody is signed in", async () => {
      const res = await POST(makeRequest(validPayload, { as: null }));

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ success: false, message: "unauthorized" });
      expect(mockedStaffService.createStaff).not.toHaveBeenCalled();
    });

    // Test 10 — wrong role (D-02)
    it.each(["WAITER", "KITCHEN"] as const)("returns 403 forbidden for a %s", async (role) => {
      const res = await POST(makeRequest(validPayload, { as: role }));

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ success: false, message: "forbidden" });
      expect(mockedStaffService.createStaff).not.toHaveBeenCalled();
    });

    // Test 11 — duplicate email (E-U2)
    it("returns 409 email_already_in_use when the email is taken", async () => {
      mockedStaffService.createStaff.mockRejectedValue(new ConflictException("email_already_in_use"));

      const res = await POST(makeRequest(validPayload));

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ success: false, message: "email_already_in_use" });
    });
  });

  describe("server errors", () => {
    // Test 12 — database failure
    it("returns 500 database_error when the database fails", async () => {
      mockedStaffService.createStaff.mockRejectedValue(new DBException("insert failed", new Error("down")));

      const res = await POST(makeRequest(validPayload));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ success: false, message: "database_error" });
    });
  });
});

describe("GET /api/staff", () => {
  describe("successful listing", () => {
    // Test 13 — happy path, scoped to the session's business
    it("returns 200 with the staff of the signed-in owner's business", async () => {
      const res = await GET(makeRequest(undefined, { method: "GET" }));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, message: "staff list", data: [staff] });
      expect(mockedStaffService.listStaff).toHaveBeenCalledWith(BUSINESS_ID);
    });

    // Test 14 — empty business
    it("returns an empty list when the business has no staff yet", async () => {
      mockedStaffService.listStaff.mockResolvedValue([]);

      const res = await GET(makeRequest(undefined, { method: "GET" }));

      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual([]);
    });
  });

  describe("request body validation", () => {
    // Test 15 — GET takes no input
    it("ignores a businessId in the query string", async () => {
      const req = makeRequest(undefined, { method: "GET" });
      const withQuery = new NextRequest(`http://localhost/api/staff?businessId=${OTHER_BUSINESS_ID}`, {
        headers: req.headers,
      });

      await GET(withQuery);

      expect(mockedStaffService.listStaff).toHaveBeenCalledWith(BUSINESS_ID);
    });
  });

  describe("failed domain check", () => {
    // Test 16 — signed out
    it("returns 401 when nobody is signed in", async () => {
      const res = await GET(makeRequest(undefined, { method: "GET", as: null }));

      expect(res.status).toBe(401);
      expect(mockedStaffService.listStaff).not.toHaveBeenCalled();
    });

    // Test 17 — wrong role (D-02)
    it.each(["WAITER", "KITCHEN"] as const)("returns 403 forbidden for a %s", async (role) => {
      const res = await GET(makeRequest(undefined, { method: "GET", as: role }));

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ success: false, message: "forbidden" });
      expect(mockedStaffService.listStaff).not.toHaveBeenCalled();
    });
  });

  describe("server errors", () => {
    // Test 18 — database failure
    it("returns 500 database_error when the database fails", async () => {
      mockedStaffService.listStaff.mockRejectedValue(new DBException("select failed", new Error("down")));

      const res = await GET(makeRequest(undefined, { method: "GET" }));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ success: false, message: "database_error" });
    });
  });
});

describe("PATCH /api/staff/:id", () => {
  describe("successful update", () => {
    // Test 19 — rename and change role
    it("returns 200 with the updated account", async () => {
      const updated = { ...staff, name: "Rami K.", role: "KITCHEN" };
      mockedStaffService.updateStaff.mockResolvedValue(updated);

      const res = await patch({ name: "Rami K.", role: "KITCHEN" });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, message: "staff updated", data: updated });
      expect(mockedStaffService.updateStaff).toHaveBeenCalledWith(BUSINESS_ID, STAFF_ID, {
        name: "Rami K.",
        role: "KITCHEN",
      });
    });

    // Test 20 — deactivate and reactivate (D-03)
    it.each([false, true])("passes isActive: %s through to the service", async (isActive) => {
      const res = await patch({ isActive });

      expect(res.status).toBe(200);
      expect(mockedStaffService.updateStaff).toHaveBeenCalledWith(BUSINESS_ID, STAFF_ID, { isActive });
    });

    // Test 21 — tenant isolation (E-U9)
    it("uses the business from the session and ignores a businessId in the body", async () => {
      await patch({ name: "Rami", businessId: OTHER_BUSINESS_ID });

      expect(mockedStaffService.updateStaff).toHaveBeenCalledWith(BUSINESS_ID, STAFF_ID, { name: "Rami" });
    });
  });

  describe("request body validation", () => {
    // Test 22 — promote to OWNER rejected (E-U7)
    it("returns 400 validation_error when the role is OWNER", async () => {
      const res = await patch({ role: "OWNER" });

      expect(res.status).toBe(400);
      expect(Object.keys((await res.json()).details)).toEqual(["role"]);
      expect(mockedStaffService.updateStaff).not.toHaveBeenCalled();
    });

    // Test 23 — nothing to update
    it("returns 400 validation_error for an empty body", async () => {
      const res = await patch({});

      expect(res.status).toBe(400);
      expect((await res.json()).message).toBe("validation_error");
      expect(mockedStaffService.updateStaff).not.toHaveBeenCalled();
    });

    // Test 24 — bad field types
    it.each([
      ["isActive", { isActive: "no" }],
      ["name", { name: "" }],
    ])("returns 400 with details for %s", async (field, body) => {
      const res = await patch(body);

      expect(res.status).toBe(400);
      expect(Object.keys((await res.json()).details)).toEqual([field]);
      expect(mockedStaffService.updateStaff).not.toHaveBeenCalled();
    });

    // Test 26 — malformed JSON
    it("returns 400 invalid_json when the body is not valid JSON", async () => {
      const res = await patch(null, { invalidJson: true });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ success: false, message: "invalid_json" });
      expect(mockedStaffService.updateStaff).not.toHaveBeenCalled();
    });
  });

  describe("failed domain check", () => {
    // Test 27 — signed out
    it("returns 401 when nobody is signed in", async () => {
      const res = await patch({ name: "Rami" }, { as: null });

      expect(res.status).toBe(401);
      expect(mockedStaffService.updateStaff).not.toHaveBeenCalled();
    });

    // Test 28 — wrong role (D-02)
    it.each(["WAITER", "KITCHEN"] as const)("returns 403 forbidden for a %s", async (role) => {
      const res = await patch({ isActive: false }, { as: role });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ success: false, message: "forbidden" });
      expect(mockedStaffService.updateStaff).not.toHaveBeenCalled();
    });

    // Test 29 — cross-tenant or unknown id (E-U10)
    it("returns 404 not_found when the staff member is not in the owner's business", async () => {
      mockedStaffService.updateStaff.mockRejectedValue(new NotFoundException("not_found"));

      const res = await patch({ name: "Rami" });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ success: false, message: "not_found" });
    });
  });

  describe("server errors", () => {
    // Test 30 — database failure
    it("returns 500 database_error when the database fails", async () => {
      mockedStaffService.updateStaff.mockRejectedValue(new DBException("update failed", new Error("down")));

      const res = await patch({ name: "Rami" });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ success: false, message: "database_error" });
    });
  });
});
