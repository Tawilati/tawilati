import type { TableRecord, TableResponse } from "@/types/Table";

export function maptoTableResponse(table: TableRecord): TableResponse {
  return {
    id: table.id,
    label: table.label,
    slug: table.slug,
    isDisabled: table.isDisabled,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
  };
}