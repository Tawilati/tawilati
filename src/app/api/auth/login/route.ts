import { authService } from "@/service/AuthService";
import { userService } from "@/service/UserService";
import { toRole } from "@/types/Roles";
import { mapToLoginResponse } from "@/types/User";
import { handleRouteError } from "@/utils/handleRouteError";
import { loginSchema } from "@/validation/User";;
import { NextRequest, NextResponse } from "next/server";


export async function POST(req:NextRequest){
    let body;
    try{
        body= await req.json();
        const isparsed=loginSchema.safeParse(body);
        if(!isparsed.success){
            throw isparsed.error
        }
        const {data}=isparsed;
        const validatedUser=await userService.validateUser(data.email,data.password);
        const response=NextResponse.json({
            success:true,
            message:"login success",
            data:mapToLoginResponse(validatedUser.id,validatedUser.name,validatedUser.email,validatedUser.role)

        })
        await authService.persistAuth(response,{userId:validatedUser.id,businessId:validatedUser.businessId,userRole:toRole(validatedUser.role)})
        return response;
    }
    catch(err){
        return handleRouteError(err);
    }
}