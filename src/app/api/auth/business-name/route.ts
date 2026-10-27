import type { NextRequest } from "next/server";
import { handle, parseQuery } from "@/lib/http";
import { userService } from "@/service/UserService";
import { businessNameQuerySchema } from "@/validation/User";

// Public (listed in src/proxy.ts): the sign-up form asks whether a business name is free
// when the owner leaves the field. Answers { success: true, data: { available } }.
export async function GET(request: NextRequest) {
  return handle(async () => {
    const { name } = parseQuery(request, businessNameQuerySchema);
    const available = await userService.isBusinessNameAvailable(name);
    return Response.json({ success: true, data: { available } }, { headers: { "Cache-Control": "no-store" } });
  });
}
