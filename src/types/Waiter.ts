import type { TableSessionStatus, OrderStatus, Prisma } from "@/app/generated/prisma/client";

export interface WaiterReadyLine {
  name: string;
  qty: number;
}

export interface WaiterReadyOrder {
  orderId: string;
  createdAt: Date;
  lines: WaiterReadyLine[];
}

export interface WaiterTableResponse {
  sessionId: string;
  tableLabel: string;
  status: TableSessionStatus;
  openedAt: Date;
  totalUSD: string;
  totalLBP: string;
  orderCount: number;
  readyOrders: WaiterReadyOrder[]; // <--- The actual READY items to serve
}

// Raw record
export type WaiterTableRecord = Prisma.TableSessionGetPayload<{
  include: {
    table: { select: { label: true } };
    _count: { select: { orders: true } };
    orders: {
      where: { status: "READY" };
      include: {
        orderLines: {
          include: {
            menuItem: { select: { name: true } };
          };
        };
      };
    };
  };
}>;

export function mapToWaiterTableResponse(record: WaiterTableRecord): WaiterTableResponse {
  return {
    sessionId: record.id,
    tableLabel: record.table.label,
    status: record.status,
    openedAt: record.openedAt,
    totalUSD: record.totalUSD.toFixed(2),
    totalLBP: record.totalLBP.toFixed(2),
    orderCount: record._count.orders,
    readyOrders: record.orders.map((order) => ({
      orderId: order.id,
      createdAt: order.createdAt,
      lines: order.orderLines.map((line) => ({
        name: line.menuItem.name,
        qty: line.qty,
      })),
    })),
  };
}