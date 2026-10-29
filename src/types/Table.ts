export type TableResponse = {
  id: string;
  label: string;
  slug: string;
  isDisabled: boolean;
  createdAt: Date;
  
};

export type TableRecord = {
  id: string;
  label: string;
  slug: string;
  isDisabled: boolean;
  createdAt: Date;
  
}
export function maptoTableResponse(table: TableRecord): TableResponse {
  return {
    id: table.id,
    label: table.label,
    slug: table.slug,
    isDisabled: table.isDisabled,
    createdAt: table.createdAt,
  };
}