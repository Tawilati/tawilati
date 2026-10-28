import { authService } from "@/service/AuthService";
import { userService } from "@/service/UserService";
import { toRole } from "@/types/Roles";
import { mapToLoginResponse } from "@/types/User";
import { handle, parseBody } from "@/lib/http";
import { loginSchema } from "@/validation/User";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const data = await parseBody(request, loginSchema);
    const validatedUser = await userService.validateUser(data.email, data.password);
    const response = NextResponse.json({
      success: true,
      message: "login success",
      data: mapToLoginResponse(
        validatedUser.id,
        validatedUser.name,
        validatedUser.email,
        validatedUser.role,
      ),
    });
    await authService.persistAuth(response, {
      userId: validatedUser.id,
      businessId: validatedUser.businessId,
      userRole: toRole(validatedUser.role),
    });
    return response;
  });
}