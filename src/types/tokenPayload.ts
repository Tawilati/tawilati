import { ROLE } from "./Roles";

export interface UserPayload{
    userId:string,
    businessId:string,
    userRole:ROLE

}

// Keeps only the identity fields of a decoded token (drops iat, exp).
export function mapToUserPayload(decoded: UserPayload): UserPayload {
  return {
    userId: decoded.userId,
    businessId: decoded.businessId,
    userRole: decoded.userRole,
  };
}
