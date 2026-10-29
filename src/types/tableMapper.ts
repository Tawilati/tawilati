import type { TableRecord, TableResponse } from "@/types/TableTypes";

export function mapTable(table: TableRecord): TableResponse {
  return {
    id: table.id,
    label: table.label,
    slug: table.slug,
    isDisabled: table.isDisabled,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  };
}