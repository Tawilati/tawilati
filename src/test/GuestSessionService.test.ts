import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guestSessionService } from "@/service/GuestSessionService";

const mockedGuestSessionRepo = vi.hoisted(() => ({
  FindByToken: vi.fn(),
  extend: vi.fn(),
  create: vi.fn(),
}));
const mockedTableSessionRepo = vi.hoisted(() => ({ create: vi.fn(), getActiveByTableId: vi.fn() }));

vi.mock("@/repository/GuestSessionRepo", () => ({ guestSessionRepo: mockedGuestSessionRepo }));
vi.mock("@/repository/TabelSession", () => ({ tableSessionRepo: mockedTableSessionRepo }));
vi.mock("@/repository/TableRepo", () => ({ tableRepo: { FindTabelByQr: vi.fn() } }));
vi.mock("@/utils/logger", () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const NOW = new Date("2026-11-02T14:00:00.000Z");
const IN_TWO_HOURS = new Date("2026-11-02T16:00:00.000Z");
const TOKEN = "b".repeat(64);

function guest(overrides: Record<string, unknown> = {}, sessionStatus = "OPEN") {
  return {
    id: "guest-1",
    token: TOKEN,
    sessionId: "tab-1",
    expiresAt: new Date("2026-11-02T13:00:00.000Z"),
    revokedAt: null,
    session: { id: "tab-1", status: sessionStatus, table: { label: "T1" } },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ now: NOW });
  mockedGuestSessionRepo.extend.mockImplementation(async (_id, expiresAt) => ({ ...guest(), expiresAt }));
});
afterEach(() => vi.useRealTimers());

describe("RenewGuestSession", () => {
  it("gives an expired session 2 more hours on the same row, keeping its token", async () => {
    mockedGuestSessionRepo.FindByToken.mockResolvedValue(guest());

    const renewed = await guestSessionService.RenewGuestSession(TOKEN);

    expect(mockedGuestSessionRepo.extend).toHaveBeenCalledWith("guest-1", IN_TWO_HOURS);
    expect(renewed).toEqual({ token: TOKEN, expiresAt: IN_TWO_HOURS, tableLabel: "T1", sessionId: "tab-1" });
  });

  it("never creates a guest session or a tab", async () => {
    mockedGuestSessionRepo.FindByToken.mockResolvedValue(guest());

    await guestSessionService.RenewGuestSession(TOKEN);

    expect(mockedGuestSessionRepo.create).not.toHaveBeenCalled();
    expect(mockedTableSessionRepo.create).not.toHaveBeenCalled();
  });

  it("refuses an unknown token with 401 unauthorized", async () => {
    mockedGuestSessionRepo.FindByToken.mockResolvedValue(null);

    await expect(guestSessionService.RenewGuestSession(TOKEN)).rejects.toMatchObject({ status: 401, message: "unauthorized" });
    expect(mockedGuestSessionRepo.extend).not.toHaveBeenCalled();
  });

  it("refuses a phone the waiter turned away with 403 guest_session_rejected", async () => {
    mockedGuestSessionRepo.FindByToken.mockResolvedValue(guest({ status: "REJECTED", revokedAt: NOW }));

    await expect(guestSessionService.RenewGuestSession(TOKEN)).rejects.toMatchObject({ status: 403, message: "guest_session_rejected" });
  });

  it("refuses a revoked session with 401 guest_session_revoked", async () => {
    mockedGuestSessionRepo.FindByToken.mockResolvedValue(guest({ revokedAt: NOW }));

    await expect(guestSessionService.RenewGuestSession(TOKEN)).rejects.toMatchObject({ status: 401, message: "guest_session_revoked" });
    expect(mockedGuestSessionRepo.extend).not.toHaveBeenCalled();
  });

  it("refuses a closed tab with 409 table_session_closed", async () => {
    mockedGuestSessionRepo.FindByToken.mockResolvedValue(guest({}, "CLOSED"));

    await expect(guestSessionService.RenewGuestSession(TOKEN)).rejects.toMatchObject({ status: 409, message: "table_session_closed" });
    expect(mockedGuestSessionRepo.extend).not.toHaveBeenCalled();
  });
});
