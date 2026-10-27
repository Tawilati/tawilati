
import { authService } from "@/service/AuthService";
import { userService } from "@/service/UserService";
import { toRole } from "@/types/Roles";

import { handleRouteError } from "@/utils/handleRouteError";
import { registerUserRequestSchema } from "@/validation/User";
import { NextRequest, NextResponse } from "next/server";


export async function POST(request: NextRequest) {
    let body
  try{
    body=await request.json();
    const parse=registerUserRequestSchema.safeParse(body);
    if(!parse.success){
       throw parse.error;  
    }
    const {data}=parse;
    const registedUser=await userService.registerUser({businessName:data.businessName,ownerName:data.ownerName,email:data.email,password:data.password});
    const response = NextResponse.json(
      {
        success: true,
        message: "register successful",
        data: registedUser
      },
      { status: 201 }
    );
    await authService.persistAuth(response,{userId:registedUser.userId,businessId:registedUser.businessId,userRole:toRole(registedUser.role)})
    return response;
  }
  catch(err){
    return handleRouteError(err);

  }
}