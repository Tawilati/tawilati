import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseQuery } from "@/lib/http";
import { reportService } from "@/service/ReportService";
import { PERMISSION } from "@/types/Roles";
import { isCalendarDate } from "@/utils/timezone";

// Optional: without a date the service reports today on the café's clock.
const querySchema = z.object({
  date: z.string().refine(isCalendarDate, "Use a real date as YYYY-MM-DD").optional(),
});

// GET /api/reports/daily?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.REPORT_DAILY_READ,
    });
    if (denied) return denied;

    const { date } = parseQuery(request, querySchema);

    const businessId = getBusinessIdFromRequest(request)!;
    const report = await reportService.getDailyReport(businessId, date);

    return NextResponse.json({
      success: true,
      message: "daily report",
      data: report,
    });
  });
}