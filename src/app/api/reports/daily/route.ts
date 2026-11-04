import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle } from "@/lib/http";
import { reportService } from "@/service/ReportService";
import { PERMISSION } from "@/types/Roles";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
});

// GET /api/reports/daily?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.REPORT_DAILY_READ,
    });
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const { date } = querySchema.parse({
      date: searchParams.get("date") ?? new Date().toISOString().split("T")[0],
    });

    const businessId = getBusinessIdFromRequest(request)!;
    const report = await reportService.getDailyReport(businessId, date);

    return NextResponse.json({
      success: true,
      message: "daily report",
      data: report,
    });
  });
}