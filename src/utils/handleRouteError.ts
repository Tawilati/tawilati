// src/utils/handleRouteError.ts
import { Prisma } from "@/app/generated/prisma/client";
import { ZodError } from "zod";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { AuthorizationException } from "@/utils/exceptions/http/AutharizationException"
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import {  InsufficientPermissionsException} from "@/utils/exceptions/http/AutharizationException"
import {
  DBException,
  ItemNotFoundException,
} from "@/utils/exceptions/RepoException";

/**
 * Map any thrown error to an HTTP Response.
 * The single place where exceptions become status codes.
 *
 * Order matters:
 *  1. Zod (validation) → 400 with details
 *  2. Typed domain exceptions → 4xx
 *  3. Prisma P2002 (unique violation) → 409
 *  4. Prisma P2025 (record not found) → 404
 *  5. Other Prisma errors → 500
 *  6. DBException → 500
 *  7. Unknown → 500
 * when add a new ecxeptiom add it here also so it can map it
 */
export function handleRouteError(err: unknown): Response {
  // ─────────────────────────────────────────────────────────
  // 1. Zod validation errors → 400
  // ─────────────────────────────────────────────────────────
  if (err instanceof ZodError) {
    return Response.json(
      {
        success: false,
        message: "validation_error",
        details: err.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  // ─────────────────────────────────────────────────────────
  // 2. Typed domain exceptions → 4xx
  // ─────────────────────────────────────────────────────────
  if (err instanceof BadRequestException) {
    return Response.json(
      { success: false, message: err.message },
      { status: 400 }
    );
  }

  if (err instanceof AuthorizationException) {
    return Response.json(
      { success: false, message: err.message },
      { status: 401 }
    );
  }

  if (err instanceof InsufficientPermissionsException) {
    return Response.json(
      { success: false, message: err.message },
      { status: 403 }
    );
  }

  if (err instanceof ItemNotFoundException || err instanceof NotFoundException) {
    return Response.json(
      { success: false, message: err.message },
      { status: 404 }
    );
  }

  if (err instanceof ConflictException) {
    return Response.json(
      { success: false, message: err.message },
      { status: 409 }
    );
  }

  // ─────────────────────────────────────────────────────────
  // 3. Prisma P2002 (unique violation) — bubbled unwrapped from the repo
  // ─────────────────────────────────────────────────────────
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const target = String(err.meta?.target ?? "");

    if (target.includes("email")) {
      return Response.json(
        { success: false, message: "email_already_in_use" },
        { status: 409 }
      );
    }

    if (target.includes("slug")) {
      return Response.json(
        { success: false, message: "slug_already_taken" },
        { status: 409 }
      );
    }

    if (target.includes("label")) {
      return Response.json(
        { success: false, message: "label_already_taken" },
        { status: 409 }
      );
    }

    if (target.includes("idempotencyKey")) {
      return Response.json(
        { success: false, message: "idempotency_key_conflict" },
        { status: 409 }
      );
    }

    // Generic unique violation
    return Response.json(
      { success: false, message: "duplicate_value" },
      { status: 409 }
    );
  }

  // ─────────────────────────────────────────────────────────
  // 4. Prisma P2025 (record not found on update/delete) → 404
  // ─────────────────────────────────────────────────────────
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    return Response.json(
      { success: false, message: "not_found" },
      { status: 404 }
    );
  }

  // ─────────────────────────────────────────────────────────
  // 5. Other Prisma errors (P2000 length, P2003 FK, P1001 connection, ...) → 500
  // ─────────────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(
      "[handleRouteError] Prisma error:",
      err.code,
      err.meta,
      err.message
    );
    return Response.json(
      { success: false, message: "database_error" },
      { status: 500 }
    );
  }

  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    console.error("[handleRouteError] Prisma unknown error:", err.message);
    return Response.json(
      { success: false, message: "database_error" },
      { status: 500 }
    );
  }

  // ─────────────────────────────────────────────────────────
  // 6. DBException — infra error → 500
  // ─────────────────────────────────────────────────────────
  if (err instanceof DBException) {
    console.error(
      "[handleRouteError] DBException:",
      err.message,
      err.cause ?? ""
    );
    return Response.json(
      { success: false, message: "database_error" },
      { status: 500 }
    );
  }

  // ─────────────────────────────────────────────────────────
  // 7. Unknown → 500
  // ─────────────────────────────────────────────────────────
  console.error("[handleRouteError] Unknown error:", err);
  return Response.json(
    { success: false, message: "internal_server_error" },
    { status: 500 }
  );
}