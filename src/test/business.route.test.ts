// src/test/business.route.test.ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "@/app/api/business/route";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { DBException, ItemNotFoundException } from "@/utils/exceptions/RepoException";

// ── Mocks ────────────────────────────────────────────────────
// The route uses the singleton service; mock it to keep Prisma out of this test.
const mockedBusinessService = vi.hoisted(() => ({
  getById: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("@/service/BusinessService", () => ({ businessService: mockedBusinessService }));

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ──────────────────────────────────────────────────
const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";
const OTHER_BUSINESS_ID = "b0000000-0000-4000-8000-000000000002";

type Role = "OWNER" | "WAITER" | "KITCHEN";

/** A request as it reaches the route: src/proxy.ts has set the identity headers (`as: null` → signed out). */
function makeRequest(
  body?: unknown,
  { invalidJson = false, as = "OWNER" as Role | null, method = "PATCH" } = {},
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (as) {
    headers.set("x-user-id", "u0000000-0000-4000-8000-000000000009");
    headers.set("x-user-role", as);
    headers.set("x-business-id", BUSINESS_ID);
  }
  return new NextRequest("http://localhost/api/business", {
    method,
    headers,
    body: method === "GET" ? undefined : invalidJson ? "{ not json" : JSON.stringify(body ?? {}),
  });
}

const get = (as: Role | null = "OWNER") => GET(makeRequest(undefined, { as, method: "GET" }));
const patch = (body: unknown, options: { invalidJson?: boolean; as?: Role | null } = {}) =>
  PATCH(makeRequest(body, options));

const business = {
  id: BUSINESS_ID,
  name: "Tawilati Demo Cafe",
  exchangeRate: "90000",
  timezone: "Asia/Beirut",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedBusinessService.getById.mockResolvedValue(business);
  mockedBusinessService.updateSettings.mockResolvedValue(business);
  // handleRouteError logs 500s; keep the test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ── Tests ────────────────────────────────────────────────────
describe("GET /api/business", () => {
  describe("successful", () => {
    it.each(["OWNER", "WAITER", "KITCHEN"] as const)("returns 200 with the settings for a %s", async (role) => {
      const res = await get(role);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, message: "business settings", data: business });
      expect(mockedBusinessService.getById).toHaveBeenCalledWith(BUSINESS_ID);
    });
  });

  describe("failed domain check", () => {
    it("returns 401 when nobody is signed in", async () => {
      const res = await get(null);

      expect(res.status).toBe(401);
      expect(mockedBusinessService.getById).not.toHaveBeenCalled();
    });

    it("returns 404 not_found when the business is gone", async () => {
      mockedBusinessService.getById.mockRejectedValue(new ItemNotFoundException("business not found"));

      const res = await get();

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ success: false, message: "not_found" });
    });
  });

  describe("server errors", () => {
    it("returns 500 database_error when the database fails", async () => {
      mockedBusinessService.getById.mockRejectedValue(new DBException("read failed", new Error("down")));

      const res = await get();

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ success: false, message: "database_error" });
    });
  });
});

describe("PATCH /api/business", () => {
  describe("successful", () => {
    it("returns 200 with the updated settings", async () => {
      const res = await patch({ exchangeRate: 90000, timezone: "Asia/Beirut" });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, message: "business updated", data: business });
      expect(mockedBusinessService.updateSettings).toHaveBeenCalledWith(BUSINESS_ID, {
        exchangeRate: 90000,
        timezone: "Asia/Beirut",
      });
    });

    it("accepts the exchange rate alone, as a number or a numeric string", async () => {
      await patch({ exchangeRate: "89500.5" });

      expect(mockedBusinessService.updateSettings).toHaveBeenCalledWith(BUSINESS_ID, { exchangeRate: 89500.5 });
    });

    it("accepts the timezone alone, trimmed", async () => {
      await patch({ timezone: " UTC " });

      expect(mockedBusinessService.updateSettings).toHaveBeenCalledWith(BUSINESS_ID, { timezone: "UTC" });
    });
  });

  describe("request body validation", () => {
    it("returns 400 validation_error for an empty body", async () => {
      const res = await patch({});

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ success: false, message: "validation_error" });
      expect(mockedBusinessService.updateSettings).not.toHaveBeenCalled();
    });

    it.each([
      ["a name", { name: "New name" }],
      ["a slug", { slug: "new-slug" }],
      ["another businessId", { exchangeRate: 90000, businessId: OTHER_BUSINESS_ID }],
    ])("returns 400 validation_error when the body carries %s", async (_scenario, body) => {
      const res = await patch(body);

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ success: false, message: "validation_error" });
      expect(mockedBusinessService.updateSettings).not.toHaveBeenCalled();
    });

    it.each([
      ["a non-numeric rate", { exchangeRate: "abc" }],
      ["a non-string timezone", { timezone: 3 }],
    ])("returns 400 validation_error with details for %s", async (_scenario, body) => {
      const res = await patch(body);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toBe("validation_error");
      expect(Object.keys(json.details)).toEqual(Object.keys(body));
      expect(mockedBusinessService.updateSettings).not.toHaveBeenCalled();
    });

    it("returns 400 invalid_json when the body is not valid JSON", async () => {
      const res = await patch(null, { invalidJson: true });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ success: false, message: "invalid_json" });
      expect(mockedBusinessService.updateSettings).not.toHaveBeenCalled();
    });
  });

  describe("failed domain check", () => {
    it("returns 401 when nobody is signed in", async () => {
      const res = await patch({ exchangeRate: 90000 }, { as: null });

      expect(res.status).toBe(401);
      expect(mockedBusinessService.updateSettings).not.toHaveBeenCalled();
    });

    it.each(["WAITER", "KITCHEN"] as const)("returns 403 forbidden for a %s", async (role) => {
      const res = await patch({ exchangeRate: 90000 }, { as: role });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ success: false, message: "forbidden" });
      expect(mockedBusinessService.updateSettings).not.toHaveBeenCalled();
    });

    it("returns 400 invalid_exchange_rate when the service rejects the rate", async () => {
      mockedBusinessService.updateSettings.mockRejectedValue(
        new BadRequestException("invalid_exchange_rate", { exchangeRate: ["Must be above 0"] }),
      );

      const res = await patch({ exchangeRate: 0 });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        success: false,
        message: "invalid_exchange_rate",
        details: { exchangeRate: ["Must be above 0"] },
      });
    });

    it("returns 400 invalid_timezone when the service rejects the timezone", async () => {
      mockedBusinessService.updateSettings.mockRejectedValue(new BadRequestException("invalid_timezone"));

      const res = await patch({ timezone: "Mars/Olympus" });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ success: false, message: "invalid_timezone" });
    });

    it("returns 404 not_found when the business is gone", async () => {
      mockedBusinessService.updateSettings.mockRejectedValue(new ItemNotFoundException("business not found"));

      const res = await patch({ exchangeRate: 90000 });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ success: false, message: "not_found" });
    });
  });

  describe("server errors", () => {
    it("returns 500 database_error when the database fails", async () => {
      mockedBusinessService.updateSettings.mockRejectedValue(new DBException("update failed", new Error("down")));

      const res = await patch({ exchangeRate: 90000 });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ success: false, message: "database_error" });
    });
  });
});
