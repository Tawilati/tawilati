import type { TableSession } from "@/app/generated/prisma/client";
import { tableRepo } from "@/repository/TableRepo";
import { tableSessionRepo } from "@/repository/TabelSession";
import { guestSessionRepo } from "@/repository/GuestSessionRepo";
import type { CreateGuestResponse } from "@/types/GuesSession";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { HttpException } from "@/utils/exceptions/http/HttpException";
import logger from "@/utils/logger";
import crypto from "crypto";

export class GuestSessionService {
  private static instance: GuestSessionService;

  private constructor() {}

  static getInstance(): GuestSessionService {
    if (!GuestSessionService.instance) {
      GuestSessionService.instance = new GuestSessionService();
    }
    return GuestSessionService.instance;
  }

  async CreateGuestSession(qrToken: string): Promise<CreateGuestResponse> {
    // ─────────────────────────────────────────────────────────
    // Step 1: Find table by QR token
    // ─────────────────────────────────────────────────────────
    const table = await tableRepo.FindTabelByQr(qrToken);

    if (!table) {
      logger.error("No table exists having qr token submitted");
      throw new NotFoundException("invalid_qr");
    }

    if (table.isDisabled) {
      logger.error("Table is disabled meaning out of service");
      throw new ConflictException("table_disabled");
    }

    // ─────────────────────────────────────────────────────────
    // Step 2: Handle active session (C-04)
    // ─────────────────────────────────────────────────────────
    let activeSession: TableSession | null | undefined = table.sessions[0];

    if (!activeSession) {
      try {
        activeSession = await tableSessionRepo.create(
          table.businessId,
          table.id,
        );
      } catch (error: any) {
        if (error.code === "P2002") {
          logger.warn("Race condition detected, fetching existing session.");
          activeSession = await tableSessionRepo.getActiveByTableId(table.id);

          if (!activeSession) {
            logger.error("Failed to recover table session after P2002");
            throw new HttpException(500, "session_creation_failed");
          }
        } else {
          throw error;
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // Step 3: Generate Guest Token (E-TAB3)
    // ─────────────────────────────────────────────────────────
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    // ─────────────────────────────────────────────────────────
    // Step 4: Create the GuestSession
    // ─────────────────────────────────────────────────────────
    const guestSession = await guestSessionRepo.create({
      sessionId: activeSession.id,
      token,
      expiresAt,
    });

    // ─────────────────────────────────────────────────────────
    // Step 5: Return the response
    // ─────────────────────────────────────────────────────────
    return {
      token: guestSession.token,
      expiresAt: guestSession.expiresAt,
      tableLabel: table.label, // Already in memory from Step 1
      sessionId: activeSession.id,
    };
  }
}

export const guestSessionService = GuestSessionService.getInstance();