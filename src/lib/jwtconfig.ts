import { StringValue } from "ms";
import dotenv from "dotenv";
dotenv.config();
export default{
     NODE_ENV: process.env.NODE_ENV || "production",
  isProduction: process.env.NODE_ENV === "production",
    auth:{
          jwtSecret: process.env.JWT_SECRET || "secret_90909090",
          expiration: (process.env.JWT_EXPIRATION || "15m") as StringValue,
          refreshSecret: process.env.JWT_REFRESH_SECRET || "secret_90909090",
              refreshExpiration: (process.env.JWT_REFRESH_EXPIRATION || "7d") as StringValue,
              resetExpiration:(process.env.JWT_RESET_EXPIRATION || "15m") as StringValue,

    }
}
