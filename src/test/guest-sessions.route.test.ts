import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/guest-sessions/route";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";
import { NotFoundException } from "@/utils/exceptions/http/NotFoundException";
import { DBException } from "@/utils/exceptions/RepoException";

const mockedGuestSessionService = vi.hoisted(() => ({
  CreateGuestSession: vi.fn(),
}));

vi.mock("@/service/GuestSessionService", () => ({
  guestSessionService: mockedGuestSessionService,
}));

function makeRequest(
  body?: unknown,
  { invalidJson = false }: { invalidJson?: boolean } = {},
): NextRequest {
  return new NextRequest("http://localhost/api/guest-sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: invalidJson ? "{ not json" : JSON.stringify(body ?? {}),
  });
}

const QR_TOKEN = "a".repeat(64);
const guestSession = {
  token: "b".repeat(64),
  expiresAt: new Date("2026-10-30T04:00:00.000Z"),
  tableLabel: "T1",
  sessionId: "c0000000-0000-4000-8000-000000000001",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGuestSessionService.CreateGuestSession.mockResolvedValue(guestSession);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/guest-sessions", () => {
  describe("successful", () => {
    it("returns 201 with the guest session", async () => {
      const response = await POST(makeRequest({ qrToken: QR_TOKEN }));

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        success: true,
        message: "guest session created",
        data: {
          ...guestSession,
          expiresAt: guestSession.expiresAt.toISOString(),
        },
      });
      expect(mockedGuestSessionService.CreateGuestSession).toHaveBeenCalledWith(QR_TOKEN);
    });
  });

  describe("request body validation", () => {
    it("returns 400 validation_error when qrToken is missing", async () => {
      const response = await POST(makeRequest({}));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        message: "validation_error",
        details: { qrToken: expect.any(Array) },
      });
      expect(mockedGuestSessionService.CreateGuestSession).not.toHaveBeenCalled();
    });

    it.each(["too-short", "A".repeat(64)])(
      "rejects a malformed QR token",
      async (qrToken) => {
        const response = await POST(makeRequest({ qrToken }));

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          success: false,
          message: "validation_error",
        });
        expect(mockedGuestSessionService.CreateGuestSession).not.toHaveBeenCalled();
      },
    );

    it("rejects unexpected body fields", async () => {
      const response = await POST(makeRequest({ qrToken: QR_TOKEN, businessId: "other" }));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        message: "validation_error",
      });
      expect(mockedGuestSessionService.CreateGuestSession).not.toHaveBeenCalled();
    });

    it("returns 400 invalid_json when the body is malformed JSON", async () => {
      const response = await POST(makeRequest(null, { invalidJson: true }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ success: false, message: "invalid_json" });
      expect(mockedGuestSessionService.CreateGuestSession).not.toHaveBeenCalled();
    });
  });

  describe("failed domain check", () => {
    it("returns 404 invalid_qr when no table matches the QR token", async () => {
      mockedGuestSessionService.CreateGuestSession.mockRejectedValue(
        new NotFoundException("invalid_qr"),
      );

      const response = await POST(makeRequest({ qrToken: QR_TOKEN }));

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ success: false, message: "invalid_qr" });
    });

    it("returns 409 table_disabled when the table is disabled", async () => {
      mockedGuestSessionService.CreateGuestSession.mockRejectedValue(
        new ConflictException("table_disabled"),
      );

      const response = await POST(makeRequest({ qrToken: QR_TOKEN }));

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ success: false, message: "table_disabled" });
    });
  });

  describe("server errors", () => {
    it("returns 500 database_error when the database fails", async () => {
      mockedGuestSessionService.CreateGuestSession.mockRejectedValue(
        new DBException("Could not create guest session", new Error("database unavailable")),
      );

      const response = await POST(makeRequest({ qrToken: QR_TOKEN }));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ success: false, message: "database_error" });
    });
  });
});
