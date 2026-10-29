import type { NextRequest } from "next/server";
import { authGuard } from "@/lib/auth/gaurd";
import { getBusinessIdFromRequest } from "@/lib/auth/requestHelper";
import { handle, parseParams } from "@/lib/http";
import { renderTableSticker } from "@/lib/tableSticker";
import { tableService } from "@/service/TableService";
import { PERMISSION } from "@/types/Roles";
import { tableIdSchema } from "@/validation/tableSchemas";

// GET /api/tables/:id/qr (OWNER): the table's printable QR sticker as a PNG.
// The QR token never leaves the server except inside this image, so waiters (who can list tables) never see it.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const denied = authGuard(request, {
      requirePermission: PERMISSION.TABLE_QR_READ,
    });
    if (denied) return denied;

    const { id } = await parseParams(params, tableIdSchema);
    const sticker = await tableService.getSticker(getBusinessIdFromRequest(request)!, id);

    // The public address, so a phone can open it; NEXT_PUBLIC_APP_URL wins over the address this request came in on.
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const image = await renderTableSticker(sticker, new URL(sticker.menuPath, origin).toString());

    // A rename changes the sticker, so the browser asks again each time instead of reusing an old copy.
    image.headers.set("Cache-Control", "private, no-cache");
    return image;
  });
}
