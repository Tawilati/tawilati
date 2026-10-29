
import { NextRequest } from "next/server";
import QRCode from "qrcode";

import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseParams } from "@/lib/http";
import { tableRepo } from "@/repository/TableRepo";
import { PERMISSION } from "@/types/Roles";
import { tableIdSchema } from "@/validation/tableSchemas";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    //Only authorized owners can retrieve table QR codes.
    const denied = authGuard(request, {
      requirePermission: PERMISSION.TABLE_QR_READ,
    });

    if (denied) return denied;

    //Validate the table ID.
    const { id } = await parseParams(params, tableIdSchema);

    //Identify the current owner's business.
    const businessId = getBusinessIdFromRequest(request)!;

    //Find the table within that business only.
    const table = await tableRepo.findQrDetailsInBusiness(
      id,
      businessId,
    );

    if (!table) {
      throw new NotFoundException("not_found");
    }

    //Do not generate a usable QR code for a disabled table.
    if (table.isDisabled) {
      throw new ConflictException("table_disabled");
    }

    //Build the exact URL expected by GET /api/menu.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

    const menuUrl = new URL("/api/menu", baseUrl);
    menuUrl.searchParams.set("b", table.business.slug);
    menuUrl.searchParams.set("t", table.qrToken);

    //Generate a PNG image from the public menu URL.
    const png = await QRCode.toBuffer(menuUrl.toString(), {
      type: "png",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "H",
    });

    //Return and download the image.
    return new Response(new Uint8Array(png), {
  status: 200,
  headers: {
    "Content-Type": "image/png",
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="table-${table.id}-qr.png"`,
  },
});
  });
}
