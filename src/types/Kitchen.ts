import { Prisma, OrderStatus, TableSessionStatus } from "@/app/generated/prisma/client";

// ─────────────────────────────────────────────────────────
// Response (clean, for the kitchen screen)
// ─────────────────────────────────────────────────────────

export interface KitchenOrderLineResponse {
  menuItemId: string;
  name: string;
  qty: number;
}

export interface KitchenOrderResponse {
  orderId: string;
  tableLabel: string;
  sessionStatus: TableSessionStatus;
  status: OrderStatus;
  createdAt: Date;
  lines: KitchenOrderLineResponse[];
}

export type KitchenOrdersResponse = KitchenOrderResponse[];

// ─────────────────────────────────────────────────────────
// Raw record (what Prisma returns)
// ─────────────────────────────────────────────────────────

export type KitchenOrderRecord = Prisma.DiningOrderGetPayload<{
  include: {
    table: { select: { label: true } };
    session: { select: { status: true } };
    orderLines: {
      include: {
        menuItem: { select: { name: true } };
      };
    };
  };
}>;

// ─────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────

export function mapToKitchenOrderResponse(record: KitchenOrderRecord): KitchenOrderResponse {
  return {
    orderId: record.id,
    tableLabel: record.table.label,
    sessionStatus: record.session.status,
    status: record.status,
    createdAt: record.createdAt,
    lines: record.orderLines.map((line) => ({
      menuItemId: line.menuItemId,
      name: line.menuItem.name,
      qty: line.qty,
    })),
  };
}

export function mapToKitchenOrdersResponse(records: KitchenOrderRecord[]): KitchenOrdersResponse {
  return records.map(mapToKitchenOrderResponse);
}