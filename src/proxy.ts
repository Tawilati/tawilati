// src/proxy.ts
// API-only middleware: verifies JWT, injects x-user-* headers,
// rotates refresh tokens, returns JSON 401 on failure.

import { NextRequest, NextResponse } from "next/server";
import { authService } from "./service/AuthService";
import {
  AuthenticationException,
  ExpiredTokenException,
  InvalidTokenException,
  TokenNotFoundException,
} from "./utils/exceptions/http/AuthenticationException";
import logger from "./utils/logger";

// ─────────────────────────────────────────────
// Public API routes (no auth required)
// ─────────────────────────────────────────────

const publicApiRoutes = [
  // Staff auth
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-reset",

  // Customer-facing (anonymous)
  "/api/menu",            // GET /api/menu?b=&t= — QR resolve
  "/api/guest-sessions",  // POST — issue guest credential
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function isPathUnder(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isPublicApi(pathname: string): boolean {
  return publicApiRoutes.some((route) => isPathUnder(pathname, route));
}

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

export async function proxy(req: NextRequest) {
  try {
    const currentPath = req.nextUrl.pathname;

    // 1. Skip public API routes
    if (isPublicApi(currentPath)) {
      return NextResponse.next();
    }

    const authToken = req.cookies.get("auth_token")?.value;
    const refreshToken = req.cookies.get("refresh_token")?.value;

    // ─────────────────────────────────────────
    // 2. Try access token
    // ─────────────────────────────────────────
    if (authToken) {
      try {
        const payload = await authService.validateAccessToken(authToken);

        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-user-id", payload.userId);
        requestHeaders.set("x-user-role", payload.userRole);
        requestHeaders.set("x-business-id", payload.businessId);

        logger.info(`[Middleware] Access token valid for ${currentPath}`);
        return NextResponse.next({ request: { headers: requestHeaders } });
      } catch (err) {
        if (err instanceof AuthenticationException) {
          logger.warn(`[Middleware] Access token invalid, trying refresh for ${currentPath}`);
        } else {
          throw err;
        }
      }
    }

    // ─────────────────────────────────────────
    // 3. Try refresh token
    // ─────────────────────────────────────────
    if (refreshToken) {
      try {
        const { newAccessToken, newRefreshToken } = await authService.refresh(refreshToken);

        const payload = authService.validateAccessToken(newAccessToken);

        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-user-id", payload.userId);
        requestHeaders.set("x-user-role", payload.userRole);
        requestHeaders.set("x-business-id", payload.businessId);

        // Build response with forwarded headers AND new cookies
        const response = NextResponse.next({ request: { headers: requestHeaders } });
        authService.setAccessCookie(response, newAccessToken);
        authService.setRefreshCookie(response, newRefreshToken);

        logger.info(`[Middleware] Tokens refreshed for ${currentPath}`);
        return response;
      } catch (err) {
        if (
          err instanceof TokenNotFoundException ||
          err instanceof ExpiredTokenException ||
          err instanceof InvalidTokenException
        ) {
          logger.warn(`[Middleware] Refresh failed (${err.constructor.name}) for ${currentPath}`);
        } else {
          logger.error(`[Middleware] Refresh error for ${currentPath}`, err);
        }
      }
    }

    // ─────────────────────────────────────────
    // 4. No valid tokens → JSON 401
    // ─────────────────────────────────────────
    logger.warn(`[Middleware] No auth for ${currentPath}`);

    const response = NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 }
    );
    authService.clearAuthCookies(response);
    return response;
  } catch (err) {
    logger.error("[Middleware] Unexpected error", err);

    const response = NextResponse.json(
      { success: false, message: "Authentication error" },
      { status: 401 }
    );
    authService.clearAuthCookies(response);
    return response;
  }
}

// ─────────────────────────────────────────────
// Matcher — API routes only
// ─────────────────────────────────────────────

export const config = {
  matcher: ["/api/:path*"],
};