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

export interface WaiterBillLine {
  menuItemId: string;
  name: string;
  qty: number;
  priceUSD: string;
  priceLBP: string;
  rateSnapshot: string;
}

export interface WaiterBillOrder {
  orderId: string;
  status: OrderStatus;
  totalUSD: string;
  totalLBP: string;
  createdAt: Date;
  lines: WaiterBillLine[];
}

export interface WaiterBillResponse {
  sessionId: string;
  tableLabel: string;
  status: TableSessionStatus;
  openedAt: Date;
  orderCount: number;
  totalUSD: string;
  totalLBP: string;
  amountPaidUSD: string;
  amountPaidLBP: string;
  orders: WaiterBillOrder[];
}

// Raw record: every round of the tab except CANCELLED ones (WaiterRepo.findBillBySessionId)
export type WaiterBillRecord = Prisma.TableSessionGetPayload<{
  include: {
    table: { select: { label: true } };
    orders: {
      include: {
        orderLines: {
          include: {
            menuItem: { select: { name: true } };
          };
        };
      };
      orderBy: { createdAt: "asc" };
    };
  };
}>;

export function mapToWaiterBillResponse(record: WaiterBillRecord): WaiterBillResponse {
  return {
    sessionId: record.id,
    tableLabel: record.table.label,
    status: record.status,
    openedAt: record.openedAt,
    orderCount: record.orders.length,
    totalUSD: record.totalUSD.toFixed(2),
    totalLBP: record.totalLBP.toFixed(2),
    amountPaidUSD: record.amountPaidUSD.toFixed(2),
    amountPaidLBP: record.amountPaidLBP.toFixed(2),
    orders: record.orders.map((order) => ({
      orderId: order.id,
      status: order.status,
      totalUSD: order.totalUSD.toFixed(2),
      totalLBP: order.totalLBP.toFixed(2),
      createdAt: order.createdAt,
      lines: order.orderLines.map((line) => ({
        menuItemId: line.menuItemId,
        name: line.menuItem.name,
        qty: line.qty,
        priceUSD: line.priceUSD.toFixed(2),
        priceLBP: line.priceLBP.toFixed(2),
        rateSnapshot: line.rateSnapshot.toFixed(2),
      })),
    })),
  };
  
}
export interface CloseTabInput {
  amountReceivedUSD: number ;
  amountReceivedLBP: number;
  method: "CASH" | "EXTERNAL_CARD";
}

export interface CloseTabResponse {
  sessionId: string;
  status: TableSessionStatus;
  totalUSD: string;
  totalLBP: string;
  amountPaidUSD: string;
  amountPaidLBP: string;
  amountReceivedUSD: string;
  amountReceivedLBP: string;
  changeUSD: string;
  changeLBP: string;
  paymentId: string | null; // null when the tab had nothing on it
}