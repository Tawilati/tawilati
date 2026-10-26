// src/lib/auth/requestHelper.ts
//these are helper functions to extract user information from the request headers and used in authguard to check if the user has the required permissions to access a specific route
import { NextRequest } from 'next/server';
import { ROLE, toRole } from '@/types/Roles';

export function getUserIdFromRequest(request: NextRequest): string | null {
    return request.headers.get('x-user-id');
}

export function getBusinessIdFromRequest(request: NextRequest): string | null {
    return request.headers.get('x-business-id');
}
export function getUserRoleFromRequest(request: NextRequest): ROLE | null {
    const roleHeader = request.headers.get('x-user-role');
    if (!roleHeader) return null;

    return toRole(roleHeader);
}

export function getUserFromRequest(request: NextRequest): {
    userId: string;
    role: ROLE;
    businessId: string 
} | null {
    const userId = getUserIdFromRequest(request);
    const role = getUserRoleFromRequest(request);
    const businessId = getBusinessIdFromRequest(request);

    if (!userId || !role || !businessId) return null;

    return { userId, role, businessId };
}
