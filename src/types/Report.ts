export interface DailyReportMethodBreakdown {
  method: "CASH" | "EXTERNAL_CARD";
  count: number;
  totalUSD: string;
  totalLBP: string;
}

export interface DailyReportWaiterBreakdown {
  waiterId: string;
  waiterName: string;
  count: number;
  totalUSD: string;
  totalLBP: string;
}

export interface DailyReportTopItem {
  menuItemId: string;
  name: string;
  qty: number;
  totalUSD: string;
}

export interface DailyReportResponse {
  date: string;
  businessName: string;
  timezone: string;

  // Money
  totalUSD: string;
  totalLBP: string;
  averageRate: string;

  // Operations
  tablesServed: number;
  ordersCount: number;
  itemsSold: number;

  // Breakdowns
  byMethod: DailyReportMethodBreakdown[];
  byWaiter: DailyReportWaiterBreakdown[];
  topItems: DailyReportTopItem[];
}