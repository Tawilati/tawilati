import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/guest-sessions/renew/route";
import { ConflictException } from "@/utils/exceptions/http/ConflictException";

const mockedGuestSessionService = vi.hoisted(() => ({ RenewGuestSession: vi.fn() }));

vi.mock("@/service/GuestSessionService", () => ({ guestSessionService: mockedGuestSessionService }));
vi.mock("@/utils/logger", () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const TOKEN = "b".repeat(64);
const renewed = {
  token: TOKEN,
  expiresAt: new Date("2026-11-02T16:00:00.000Z"),
  tableLabel: "T1",
  sessionId: "c0000000-0000-4000-8000-000000000001",
};

function makeRequest(authorization?: string): NextRequest {
  return new NextRequest("http://localhost/api/guest-sessions/renew", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGuestSessionService.RenewGuestSession.mockResolvedValue(renewed);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/guest-sessions/renew", () => {
  it("returns 200 with the renewed session", async () => {
    const response = await POST(makeRequest(`Bearer ${TOKEN}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "guest session renewed",
      data: { ...renewed, expiresAt: renewed.expiresAt.toISOString() },
    });
    expect(mockedGuestSessionService.RenewGuestSession).toHaveBeenCalledWith(TOKEN);
  });

  it("returns 401 unauthorized when the token is missing", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, message: "unauthorized" });
    expect(mockedGuestSessionService.RenewGuestSession).not.toHaveBeenCalled();
  });

  it("returns 401 unauthorized when the token is malformed", async () => {
    const response = await POST(makeRequest("Bearer not-a-token"));

    expect(response.status).toBe(401);
    expect(mockedGuestSessionService.RenewGuestSession).not.toHaveBeenCalled();
  });

  it("returns the service's refusal when the tab is closed", async () => {
    mockedGuestSessionService.RenewGuestSession.mockRejectedValue(new ConflictException("table_session_closed"));

    const response = await POST(makeRequest(`Bearer ${TOKEN}`));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ success: false, message: "table_session_closed" });
  });
});
