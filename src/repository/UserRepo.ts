
import { User } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DBException, ItemNotFoundException } from "@/utils/exceptions/RepoException";


export class UserRepo {
    private static instance: UserRepo;
    static getInstance(): UserRepo {
        if (!UserRepo.instance) {
            UserRepo.instance = new UserRepo();
        }
        return UserRepo.instance;
    }
    async updateLastLogin(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  } catch (err) {
    throw new DBException("Error updating last login", err as Error);
  }
}
     async getByEmail(email:string):Promise<User>{
        try{
            const targetUser = await prisma.user.findUnique({
                where: {
                    email: email.trim().toLowerCase(),
                }
            });

            if (!targetUser) {
                throw new ItemNotFoundException(`User with email ${email} not found`);
            }

            return targetUser;
        }
        catch(err){
            if (err instanceof ItemNotFoundException) {
                throw err; // Re-throw the ItemNotFoundException
            }
            throw new DBException("Error retrieving user by email", err as Error);
        }

    }
     async getUser(userId:string):Promise<User>{
     try{
        const target=await prisma.user.findUnique({
            where:{
                id:userId
            }
        })
        if(!target){
            throw new ItemNotFoundException('user not found');
        }
        return target;
     }  catch(err){
        if(err instanceof ItemNotFoundException){
            throw err
        }
        throw new DBException('Failed in getting user',err as Error);

     }

    }
      async updateRefreshToken(userId:string,token:string | null,expiryDate:Date | null):Promise<void>{
        try{
            await prisma.user.update({
                where: { id: userId },
                data: {
                    refreshToken: token,
                    refreshTokenExpiresAt: expiryDate
                    ,
                },
            });

        }
        catch(err){
            throw new DBException('ERRO updating refersh token',err as Error);

        }
    }
      async updateResetToken(userId:string,token:string | null,expiryDate:Date | null):Promise<void>{
        try{
            await  prisma.user.update({
                where:{id:userId},
                data:{
                      resetPasswordToken :token,
                        resetPasswordExpiresAt:expiryDate
                }

            });
        }
        catch(err){
            throw new DBException('ERRO updating reset token',err as Error);

        }
        }
    
}
export const userRepo = UserRepo.getInstance();