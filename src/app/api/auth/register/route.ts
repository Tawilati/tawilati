
import { authService } from "@/service/AuthService";
import { userService } from "@/service/UserService";
import { handle, parseBody } from "@/lib/http";
import { toRole } from "@/types/Roles";
import { registerUserRequestSchema } from "@/validation/User";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const data = await parseBody(request, registerUserRequestSchema);
    const registeredUser = await userService.registerUser({
      businessName: data.businessName,
      ownerName: data.ownerName,
      email: data.email,
      password: data.password,
    });
    const response = NextResponse.json(
      {
        success: true,
        message: "register successful",
        data: registeredUser,
      },
      { status: 201 }
    );
    await authService.persistAuth(response, {
      userId: registeredUser.userId,
      businessId: registeredUser.businessId,
      userRole: toRole(registeredUser.role),
    });
    return response;
  });
}