import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/reports/daily/route";
import { DBException } from "@/utils/exceptions/RepoException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";

const mockedReportService = vi.hoisted(() => ({
  getDailyReport: vi.fn(),
}));

vi.mock("@/service/ReportService", () => ({
  reportService: mockedReportService,
}));

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const BUSINESS_ID = "b0000000-0000-4000-8000-000000000001";

type Role = "OWNER" | "WAITER" | "KITCHEN";

function makeRequest({
  as = "OWNER" as Role | null,
  date = "2026-11-04",
}: { as?: Role | null; date?: string } = {}): NextRequest {
  const headers = new Headers();
  if (as) {
    headers.set("x-user-id", "u0000000-0000-4000-8000-000000000009");
    headers.set("x-user-role", as);
    headers.set("x-business-id", BUSINESS_ID);
  }

  return new NextRequest(`http://localhost/api/reports/daily?date=${date}`, {
    method: "GET",
    headers,
  });
}

const report = {
  date: "2026-11-04",
  businessName: "Tawilati Demo Cafe",
  timezone: "Asia/Beirut",
  totalUSD: "120.50",
  totalLBP: "105000.00",
  receivedUSD: "120.50",
  receivedLBP: "0.00",
  averageRate: "87500.00",
  tablesServed: 3,
  ordersCount: 4,
  itemsSold: 12,
  byMethod: [
    { method: "CASH", count: 2, totalUSD: "70.00", totalLBP: "60000.00" },
    { method: "EXTERNAL_CARD", count: 1, totalUSD: "50.50", totalLBP: "45000.00" },
  ],
  byWaiter: [
    {
      waiterId: "u0000000-0000-4000-8000-000000000011",
      waiterName: "Rami",
      count: 2,
      totalUSD: "120.50",
      totalLBP: "105000.00",
    },
  ],
  topItems: [
    { menuItemId: "m0000000-0000-4000-8000-000000000021", name: "Tabbouleh", qty: 6, totalUSD: "42.00" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedReportService.getDailyReport.mockResolvedValue(report);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/reports/daily", () => {
  it("returns the daily report for the authenticated business", async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "daily report",
      data: report,
    });
    expect(mockedReportService.getDailyReport).toHaveBeenCalledWith(BUSINESS_ID, "2026-11-04");
  });

  it("returns 401 when nobody is signed in", async () => {
    const response = await GET(makeRequest({ as: null }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      message: "unauthorized",
    });
    expect(mockedReportService.getDailyReport).not.toHaveBeenCalled();
  });

  it.each(["WAITER", "KITCHEN"] as const)("returns 403 for a %s", async (role) => {
    const response = await GET(makeRequest({ as: role }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: "forbidden",
    });
    expect(mockedReportService.getDailyReport).not.toHaveBeenCalled();
  });

  it("returns 400 validation_error when the date is malformed", async () => {
    const response = await GET(makeRequest({ date: "2026/11/04" }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      message: "validation_error",
    });
    expect(Object.keys(body.details)).toEqual(["date"]);
    expect(mockedReportService.getDailyReport).not.toHaveBeenCalled();
  });

  it("leaves the date to the service when none is sent, so it uses today on the café's clock", async () => {
    const headers = new Headers({ "x-user-id": "u0000000-0000-4000-8000-000000000009", "x-user-role": "OWNER", "x-business-id": BUSINESS_ID });
    const response = await GET(new NextRequest("http://localhost/api/reports/daily", { method: "GET", headers }));

    expect(response.status).toBe(200);
    expect(mockedReportService.getDailyReport).toHaveBeenCalledWith(BUSINESS_ID, undefined);
  });

  it("returns 400 validation_error for a day that doesn't exist", async () => {
    const response = await GET(makeRequest({ date: "2026-02-30" }));

    expect(response.status).toBe(400);
    expect(Object.keys((await response.json()).details)).toEqual(["date"]);
    expect(mockedReportService.getDailyReport).not.toHaveBeenCalled();
  });

  it("returns 404 not_found when the business is gone", async () => {
    mockedReportService.getDailyReport.mockRejectedValue(new NotFoundException("not_found"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, message: "not_found" });
  });

  it("returns 500 database_error when the report cannot be generated", async () => {
    mockedReportService.getDailyReport.mockRejectedValue(
      new DBException("read failed", new Error("database unavailable")),
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      message: "database_error",
    });
  });
});
