import { reportRepo } from "@/repository/ReportRepo";

import type {
  DailyReportResponse,
  DailyReportMethodBreakdown,
  DailyReportWaiterBreakdown,
  DailyReportTopItem,
} from "@/types/Report";
import { Decimal } from "@prisma/client/runtime/client";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { dayBounds, todayIn } from "@/utils/timezone";

export class ReportService {
  private static instance: ReportService;

  private constructor() {}

  static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  async getDailyReport(
    businessId: string,
    requestedDate?: string, // "YYYY-MM-DD"; today on the café's clock when missing
  ): Promise<DailyReportResponse> {
    // 1. Fetch business
    const business = await reportRepo.getBusiness(businessId);
    if (!business) throw new NotFoundException("not_found");

    // 2. The day runs from midnight to midnight on the café's clock, not UTC's
    const date = requestedDate ?? todayIn(business.timezone);
    const { start, end } = dayBounds(date, business.timezone);

    // 3. Fetch data
    const [payments, orders] = await Promise.all([
      reportRepo.getDailyPayments(businessId, start, end),
      reportRepo.getDailyOrders(businessId, start, end),
    ]);

    // 4. Totals
    let totalUSD = new Decimal(0);
    let totalLBP = new Decimal(0);

    const methodMap = new Map<string, DailyReportMethodBreakdown>();
    const waiterMap = new Map<string, DailyReportWaiterBreakdown>();

    for (const p of payments) {
      totalUSD = totalUSD.plus(p.amountUSD);
      totalLBP = totalLBP.plus(p.amountLBP);

      // By method
      const m = methodMap.get(p.method) ?? {
        method: p.method,
        count: 0,
        totalUSD: "0.00",
        totalLBP: "0.00",
      };
      m.count += 1;
      m.totalUSD = new Decimal(m.totalUSD).plus(p.amountUSD).toFixed(2);
      m.totalLBP = new Decimal(m.totalLBP).plus(p.amountLBP).toFixed(2);
      methodMap.set(p.method, m);

      // By waiter
      const w = waiterMap.get(p.recordedById) ?? {
        waiterId: p.recordedById,
        waiterName: p.recordedBy.name,
        count: 0,
        totalUSD: "0.00",
        totalLBP: "0.00",
      };
      w.count += 1;
      w.totalUSD = new Decimal(w.totalUSD).plus(p.amountUSD).toFixed(2);
      w.totalLBP = new Decimal(w.totalLBP).plus(p.amountLBP).toFixed(2);
      waiterMap.set(p.recordedById, w);
    }

    // 5. Items sold + top items + average rate
    let itemsSold = 0;
    let rateSum = new Decimal(0);
    let rateCount = 0;
    const itemMap = new Map<string, DailyReportTopItem>();

    for (const o of orders) {
      for (const line of o.orderLines) {
        itemsSold += line.qty;
        rateSum = rateSum.plus(line.rateSnapshot);
        rateCount += 1;

        const existing = itemMap.get(line.menuItemId) ?? {
          menuItemId: line.menuItemId,
          name: line.menuItem.name,
          qty: 0,
          totalUSD: "0.00",
        };
        existing.qty += line.qty;
        existing.totalUSD = new Decimal(existing.totalUSD)
          .plus(line.priceUSD.times(line.qty))
          .toFixed(2);
        itemMap.set(line.menuItemId, existing);
      }
    }

    const averageRate =
      rateCount > 0 ? rateSum.div(rateCount).toFixed(2) : "0.00";

    const topItems = [...itemMap.values()]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    // 6. Build response
    return {
      date,
      businessName: business.name,
      timezone: business.timezone,
      totalUSD: totalUSD.toFixed(2),
      totalLBP: totalLBP.toFixed(2),
      averageRate,
      tablesServed: payments.length,
      ordersCount: orders.length,
      itemsSold,
      byMethod: [...methodMap.values()],
      byWaiter: [...waiterMap.values()],
      topItems,
    };
  }
}

export const reportService = ReportService.getInstance();