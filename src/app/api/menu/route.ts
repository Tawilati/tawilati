import type { NextRequest } from "next/server";
import { handle, parseQuery } from "@/src/server/http";
import { menuRepository } from "@/src/server/repositories/menuRepository";
import { createMenuService } from "@/src/server/services/menuService";
import { publicMenuQuerySchema } from "@/src/server/validation/menuSchemas";

const menuService = createMenuService(menuRepository);

// Public: opened from the QR code on a table. No staff or guest session needed.
export async function GET(request: NextRequest) {
  return handle(async () => {
    const query = parseQuery(request, publicMenuQuerySchema);
    const menu = await menuService.getPublicMenu(query);
    // Sold-out flags change mid-service, so never serve a cached menu.
    return Response.json(menu, { headers: { "Cache-Control": "no-store" } });
  });
}
