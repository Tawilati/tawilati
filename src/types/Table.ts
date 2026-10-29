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

};

// What tableRepo.findStickerInBusiness returns.
export type TableStickerRecord = {
  label: string;
  slug: string;
  qrToken: string;
  business: { name: string; slug: string };
};

// What a QR sticker shows; menuPath is what the QR code opens, before the site's address is added.
export type TableSticker = {
  label: string;
  businessName: string;
  menuPath: string; // "/menu/tawilati-demo-cafe/t1?t=1e64…"
};

export function mapToTableSticker(table: TableStickerRecord): TableSticker {
  return {
    label: table.label,
    businessName: table.business.name,
    menuPath: `/menu/${table.business.slug}/${table.slug}?t=${table.qrToken}`,
  };
}