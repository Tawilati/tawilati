import  config from "@/lib/jwtconfig";
import { UserPayload } from "@/types/tokenPayload";
import jwt from "jsonwebtoken";
import ms from "ms";
import crypto from 'crypto';
import { AuthenticationException, ExpiredTokenException, InvalidTokenException, TokenNotFoundException } from "@/utils/exceptions/http/AuthenticationException";
import logger from "@/utils/logger";
import { NextResponse } from "next/server";
import { userRepo } from "@/repository/UserRepo";
import bcrypt from "bcryptjs";
export class AuthService {
    private static instance: AuthService;
   constructor(
        private accessSecret=config.auth.jwtSecret,
        private expiration=config.auth.expiration,
        private refreshSecret=config.auth.refreshSecret,
        private refreshExpiration=config.auth.refreshExpiration,
        private resetExpiration=config.auth.resetExpiration

    ){}
    static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }
     generateAccessToken(payload: UserPayload): string {
  // ✅ Build clean payload
  const cleanPayload: UserPayload = {
    userId: payload.userId,
    businessId: payload.businessId,
    userRole: payload.userRole,
  };

  return jwt.sign(cleanPayload, this.accessSecret, {
    expiresIn: this.expiration,
  });
}
 generateRefreshToken(payload: UserPayload): string {
  const cleanPayload: UserPayload = {
    userId: payload.userId,
    businessId: payload.businessId,
    userRole: payload.userRole,
  };

  return jwt.sign(cleanPayload, this.refreshSecret, {
    expiresIn: this.refreshExpiration,
  });
}
generateResetToken():{code:string,expiresAt:Date}{
          // Generate 6-digit code
    const min = 100000;
    const max = 999999;
    const code = crypto.randomInt(min, max + 1).toString();

    // Calculate expiration date (e.g., 15 minutes from now)
    const expiresAt = new Date(Date.now() + ms(this.resetExpiration));

    return { code, expiresAt };

    }
validateAccessToken(token: string): UserPayload {
  try {
    const decoded = jwt.verify(token, this.accessSecret) as UserPayload & {
      iat?: number;
      exp?: number;
    };

    // ✅ Return clean
    return {
      userId: decoded.userId,
      businessId: decoded.businessId,
      userRole: decoded.userRole,
    };
  } catch {
    logger.error('Invalid token');
    throw new AuthenticationException('invalid access token');
  }
}
  validateRefreshToken(token: string): UserPayload {
  try {
    const decoded = jwt.verify(token, this.refreshSecret) as UserPayload & {
      iat?: number;
      exp?: number;
    };

    return {
      userId: decoded.userId,
      businessId: decoded.businessId,
      userRole: decoded.userRole,
    };
  } catch {
    throw new InvalidTokenException();
  }
}
  
    setAccessCookie(res:NextResponse,token:string){
        res.cookies.set(
            'auth_token',token,{
                httpOnly:true,
                secure:config.isProduction,
                  sameSite: config.isProduction ? 'none' : 'lax',
            maxAge: ms(this.expiration)
            }
        )
    }
    setRefreshCookie(res:NextResponse,token:string){
        res.cookies.set(
            'refresh_token',
            token,
            {
                httpOnly:true,
                secure:config.isProduction,
                  sameSite: config.isProduction ? 'none' : 'lax',
            maxAge: ms(this.refreshExpiration)
            }

        )
    }
       async persistAuth(res:NextResponse,payload:UserPayload){
        //genrate access and refresh token
        const accessToken=this.generateAccessToken(payload);
        const refreshToken=this.generateRefreshToken(payload);
        //genrate the cookies
        this.setAccessCookie(res,accessToken);
        this.setRefreshCookie(res,refreshToken);
        //hash the refresh to store into the db
         const hashedRefresh=await bcrypt.hash(refreshToken,10);
        //save to db
       const exp=new Date(
  Date.now() + ms(this.refreshExpiration))
        await userRepo.updateRefreshToken(payload.userId,hashedRefresh,exp)
          await userRepo.updateLastLogin(payload.userId); 

    }
     async persistReset(res:NextResponse,payload:UserPayload){
        //genrate token
        const {code,expiresAt}=this.generateResetToken()
        //hash the code to store in db
        const hashed=await bcrypt.hash(code,10);
        //store it in db
        await userRepo.updateResetToken(payload.userId,hashed,expiresAt);
        return code;

    }
 async verifyResetToken(email:string,providedToken:string){
    try{
        const resetData=await userRepo.getByEmail(email)
    
    
       if(resetData.resetPasswordToken==null){
        logger.error('no reset token');
        return false


        }
        //check expired date
        if(!resetData.resetPasswordExpiresAt ||new Date()>resetData.resetPasswordExpiresAt) {
            logger.error('expired token');

            return false

        }

        const isMatch=await bcrypt.compare(providedToken,resetData.resetPasswordToken);
        if(!isMatch){
            logger.error('wrong code')

            return false


        }}
    catch(err){
        logger.error('error in verifying reset token',err)
        return false
    }
        return true;

    }
     async refresh(refreshToken:string){
        //verfy the refreshto ken
        const payload=this.validateRefreshToken(refreshToken);
        //see if the user  have this refresh token inside db
        const user=await userRepo.getUser(payload.userId);
        //check if user have the token or even exist
        if(!user || !user.refreshToken){
            logger.error('404');
         throw new TokenNotFoundException();


        }
        //check the date
        if(user.refreshTokenExpiresAt && new Date()>user.refreshTokenExpiresAt){
            logger.error('Token is expired');
            await userRepo.updateRefreshToken(payload.userId,null,null);
            throw new  ExpiredTokenException();

        }
        //compare if the token in cookie and user are the same
        const isMatch=await bcrypt.compare(refreshToken,user.refreshToken);
        if(!isMatch){
            logger.error('Invalid refresh token');
            throw new InvalidTokenException();
        }
        //rotation
        const newAccessToken=this.generateAccessToken(payload);
        const newRefreshToken=this.generateRefreshToken(payload);


        //save in db
        const hashed=await bcrypt.hash(newRefreshToken,10);
             const exp=new Date(
  Date.now() + ms(this.refreshExpiration))
        await userRepo.updateRefreshToken(payload.userId,hashed,exp);
        return {newAccessToken,newRefreshToken};




    }
    // Sign out: the stored refresh token is dropped too, so a copied refresh cookie can't sign back in.
    async logout(response: NextResponse, userId: string): Promise<void> {
        await userRepo.updateRefreshToken(userId, null, null);
        this.clearAuthCookies(response);
    }
     clearAuthCookies(response: NextResponse): void {
        // ✅ Delete auth_token by setting maxAge: 0
        response.cookies.set('auth_token', '', {
            httpOnly: true,
            secure: config.isProduction,
            sameSite: config.isProduction ? 'none' : 'lax',
            maxAge: 0,  // ← Delete immediately
            path: '/',
        });

        // ✅ Delete refresh_token by setting maxAge: 0
        response.cookies.set('refresh_token', '', {
            httpOnly: true,
            secure: config.isProduction,
            sameSite: config.isProduction ? 'none' : 'lax',
            maxAge: 0,  // ← Delete immediately
            path: '/',
        });
    }


}
export const authService = AuthService.getInstance();