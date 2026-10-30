// src/proxy.ts
// Runs on /api/* and on the staff screens (/dashboard, /kitchen, /waiter): verifies the JWT,
// injects x-user-* headers, rotates refresh tokens. On failure: JSON 401 for the API,
// a redirect to /login for a screen.

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
  "/api/auth/business-name", // GET ?name= — sign-up form checks the name is free
  "/api/auth/refresh",
  // "/api/auth/forgot-password",
  // "/api/auth/reset-password",
  // "/api/auth/verify-reset",

  // Customer-facing (anonymous)
  "/api/menu",            // GET /api/menu?b=&t= — QR resolve
  "/api/guest-sessions",  // POST — issue guest credential
];
const guestApiRoutes = [
  "/api/orders",       // POST — guest submits order
  "/api/orders/me",    // GET — guest views their orders
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
//to by pass the guest api
function isGuestApi(pathname: string): boolean {
  return guestApiRoutes.some((route) => isPathUnder(pathname, route));
}
// Set only by this proxy. Any copy sent by the browser is dropped first, so a route or
// screen can trust them.
const IDENTITY_HEADERS = ["x-user-id", "x-user-role", "x-business-id"];

// The API answers JSON; a screen sends the person to sign in. Either way the dead cookies go.
function unauthenticated(req: NextRequest): NextResponse {
  const response = req.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 })
    : NextResponse.redirect(new URL("/login?reason=unauthorized", req.url));
  authService.clearAuthCookies(response);
  return response;
}


// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

export async function proxy(req: NextRequest) {
  try {
    const currentPath = req.nextUrl.pathname;
    const requestHeaders = new Headers(req.headers);
    for (const header of IDENTITY_HEADERS) requestHeaders.delete(header);

    // 1. Skip public API routes
    if (isPublicApi(currentPath)) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    // Guest routes: proxy steps aside. The route validates the Bearer token against the GuestSession DB table.
    
if (isGuestApi(currentPath)) {
  return NextResponse.next({ request: { headers: requestHeaders } });
}

    const authToken = req.cookies.get("auth_token")?.value;
    const refreshToken = req.cookies.get("refresh_token")?.value;

    // ─────────────────────────────────────────
    // 2. Try access token
    // ─────────────────────────────────────────
    if (authToken) {
      try {
        const payload = await authService.validateAccessToken(authToken);

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
    // 4. No valid tokens → JSON 401 (API) or /login (screen)
    // ─────────────────────────────────────────
    logger.warn(`[Middleware] No auth for ${currentPath}`);
    return unauthenticated(req);
  } catch (err) {
    logger.error("[Middleware] Unexpected error", err);
    return unauthenticated(req);
  }
}

// ─────────────────────────────────────────────
// Matcher — the API and the staff screens (`:path*` also matches the bare /dashboard)
// ─────────────────────────────────────────────

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/kitchen/:path*", "/waiter/:path*"],
};