// src/utils/handleRouteError.ts
import { Prisma } from "@/app/generated/prisma/client";
import { z, ZodError } from "zod";
import { HttpException } from "@/utils/exceptions/http/HttpException";
import {
  DBException,
  ItemNotFoundException,
} from "@/utils/exceptions/RepoException";

/**
 * Map any thrown error to an HTTP Response.
 * The single place where exceptions become status codes.
 * Shape: { success: false, message: "<code>", details? }. The message is always a
 * contract code (e.g. "invalid_credentials"), never a sentence: the UI maps codes to sentences.
 *
 * Order matters:
 *  1. Zod (validation) → 400 with details keyed by field
 *  2. HttpException and its subclasses → their own status
 *  3. Prisma P2002 (unique violation) → 409
 *  4. Prisma P2025 (record not found) → 404
 *  5. Other Prisma errors → 500
 *  6. DBException → 500
 *  7. Unknown → 500
 * A new HttpException subclass needs nothing here: its status comes with it.
 */
export function handleRouteError(err: unknown): Response {
  // ─────────────────────────────────────────────────────────
  // 1. Zod validation errors → 400
  //    details: { email: ["Invalid email address"], password: [...] }, so a form can show
  //    each message under its field.
  // ─────────────────────────────────────────────────────────
  if (err instanceof ZodError) {
    return json(400, "validation_error", z.flattenError(err).fieldErrors);
  }

  // ─────────────────────────────────────────────────────────
  // 2. Typed exceptions → their own status
  //    (BadRequest 400, Authentication 401, Authorization/Forbidden 403, NotFound 404, Conflict 409)
  // ─────────────────────────────────────────────────────────
  if (err instanceof HttpException) {
    return json(err.status, err.message, err.details);
  }

  // Repo-level "not found": its message names the record (e.g. an email), so it is not sent.
  if (err instanceof ItemNotFoundException) {
    return json(404, "not_found");
  }

  // ─────────────────────────────────────────────────────────
  // 3. Prisma P2002 (unique violation) — bubbled unwrapped from the repo
  // ─────────────────────────────────────────────────────────
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const constraint = uniqueConstraint(err);

    if (constraint.includes("email")) {
      return json(409, "email_already_in_use");
    }

    // Business_name_key or Business_slug_key: both mean the name is taken at sign-up.
    if (constraint.startsWith("Business_")) {
      return json(409, "business_name_taken");
    }

    if (constraint.includes("label")) {
      return json(409, "label_already_taken");
    }

    if (constraint.includes("slug")) {
      return json(409, "slug_already_taken");
    }

    if (constraint.includes("idempotencyKey")) {
      return json(409, "idempotency_key_conflict");
    }

    // Generic unique violation
    return json(409, "duplicate_value");
  }

  // ─────────────────────────────────────────────────────────
  // 4. Prisma P2025 (record not found on update/delete) → 404
  // ─────────────────────────────────────────────────────────
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    return json(404, "not_found");
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
    return json(500, "database_error");
  }

  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    console.error("[handleRouteError] Prisma unknown error:", err.message);
    return json(500, "database_error");
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
    return json(500, "database_error");
  }

  // ─────────────────────────────────────────────────────────
  // 7. Unknown → 500
  // ─────────────────────────────────────────────────────────
  console.error("[handleRouteError] Unknown error:", err);
  return json(500, "internal_server_error");
}

function json(status: number, message: string, details?: unknown): Response {
  return Response.json(
    { success: false, message, ...(details ? { details } : {}) },
    { status }
  );
}

// Name of the violated unique constraint, e.g. "Business_name_key" or "User_email_key".
// With the pg driver adapter Prisma leaves meta.target empty and reports the
// constraint under meta.driverAdapterError instead.
function uniqueConstraint(err: Prisma.PrismaClientKnownRequestError): string {
  const meta = err.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { index?: string } } };
      }
    | undefined;
  return String(meta?.driverAdapterError?.cause?.constraint?.index ?? meta?.target ?? "");
}
