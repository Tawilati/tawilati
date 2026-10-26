import type { NextRequest } from "next/server";
import { handle, parseQuery } from "@/lib/http";
import { menuRepo } from "@/repository/MenuRepo";
import { MenuService } from "@/service/MenuService";
import { publicMenuQuerySchema } from "@/validation/menuSchemas";

const menuService = new MenuService(menuRepo);

// Public (listed in src/proxy.ts): opened from the QR code on a table. No staff or guest session needed.
export async function GET(request: NextRequest) {
  return handle(async () => {
    const query = parseQuery(request, publicMenuQuerySchema);
    const menu = await menuService.getPublicMenu(query);
    // Sold-out flags change mid-service, so never serve a cached menu.
    return Response.json(menu, { headers: { "Cache-Control": "no-store" } });
  });
}
