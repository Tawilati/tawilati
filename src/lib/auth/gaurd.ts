// src/lib/auth/guard.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from './requestHelper';
import { ROLE, PERMISSION, hasPermission } from '@/types/Roles';
import {
    AuthorizationException,
    InsufficientPermissionsException,
    InvalidRoleException
} from '@/utils/exceptions/http/AutharizationException';
import logger from '@/utils/logger';

/**
 * Auth Guard - One function for all authorization needs
 * 
 * @param request - The NextRequest object
 * @param options - Authorization options
 * @returns NextResponse if unauthorized, null if allowed
 * 
 * @example
 * // owner check
 * authGuard(request, { requireRole: ROLE.OWNER })
 * 
 * // Permission check
 * authGuard(request, { requirePermission: PERMISSION.CREATE_PRODUCT })
 * 
 * // Role + Permission
 * authGuard(request, { requireRole: ROLE.OWNER, requirePermission: PERMISSION.READ_ALL_SUPPLIERS })
 * 
 * // Any permission (OR)
 * authGuard(request, { requireAnyPermission: [PERMISSION.READ_ALL_PRODUCTS, PERMISSION.READ_ALL_SUPPLIERS] })
 * 
 * // All permissions (AND)
 * authGuard(request, { requireAllPermissions: [PERMISSION.READ_ALL_PRODUCTS, PERMISSION.READ_ALL_SUPPLIERS] })
 */
export function authGuard(
    request: NextRequest,
    options: {
        requireRole?: ROLE;
        requirePermission?: PERMISSION;
        requireAnyPermission?: PERMISSION[];
        requireAllPermissions?: PERMISSION[];
    } = {}
): NextResponse | null {
    // 1. Get user from request
    const user = getUserFromRequest(request);
    
    // 2. Check if user exists
    if (!user) {
        logger.warn('Unauthorized access attempt - no user found');
        return NextResponse.json(
            { success: false, message: 'Unauthorized' },
            { status: 401 }
        );
    }

    // 3. Check if user has a valid role
    if (!Object.values(ROLE).includes(user.role)) {
        logger.warn(`Invalid role found for user ${user.userId}: ${user.role}`);
        throw new InvalidRoleException(`Invalid role: ${user.role}`);
    }

    // 4. Check role (if required)
    if (options.requireRole && user.role !== options.requireRole) {
        logger.warn(`User ${user.userId} (${user.role}) attempted to access ${options.requireRole} route`);
        throw new AuthorizationException(
            `Access denied. ${options.requireRole} role required.`
        );
    }

    // 5. Check single permission (if required)
    if (options.requirePermission && !hasPermission(user.role, options.requirePermission)) {
        logger.warn(`User ${user.userId} (${user.role}) lacks permission: ${options.requirePermission}`);
        throw new InsufficientPermissionsException();
    }

    // 6. Check ANY permission (OR)
    if (options.requireAnyPermission && 
        options.requireAnyPermission.length > 0 &&
        !options.requireAnyPermission.some(p => hasPermission(user.role, p))) {
        logger.warn(`User ${user.userId} (${user.role}) lacks any of: ${options.requireAnyPermission.join(', ')}`);
        throw new InsufficientPermissionsException();
    }

    // 7. Check ALL permissions (AND)
    if (options.requireAllPermissions && 
        options.requireAllPermissions.length > 0 &&
        !options.requireAllPermissions.every(p => hasPermission(user.role, p))) {
        logger.warn(`User ${user.userId} (${user.role}) lacks all of: ${options.requireAllPermissions.join(', ')}`);
        throw new InsufficientPermissionsException();
    }

    // 8. ✅ ALL CHECKS PASSED!
    return null; // ✅ Allowed
}

// ============================================
// Convenience Functions (Optional)
// ============================================

/**

/**
 * Check if user has specific permission
 */
export function requirePermission(permission: PERMISSION) {
    return function(request: NextRequest): NextResponse | null {
        return authGuard(request, { requirePermission: permission });
    };
}

/**
 * Check if user has any of the permissions
 */
export function requireAnyPermission(permissions: PERMISSION[]) {
    return function(request: NextRequest): NextResponse | null {
        return authGuard(request, { requireAnyPermission: permissions });
    };
}

/**
 * Check if user has all permissions
 */
export function requireAllPermissions(permissions: PERMISSION[]) {
    return function(request: NextRequest): NextResponse | null {
        return authGuard(request, { requireAllPermissions: permissions });
    };
}