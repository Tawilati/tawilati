//will use in order
export interface CreateGuestResponse {
  token: string;
  expiresAt: Date;
  tableLabel: string;
  sessionId: string;
}

export type GuestSessionRecord = {
  token: string;
  expiresAt: Date;
  sessionId: string;
  session: {
    table: {
      label: string;
    };
  };
};

export function mapToCreateGuestResponse(
  guestSession: GuestSessionRecord,
): CreateGuestResponse {
  return {
    token: guestSession.token,
    expiresAt: guestSession.expiresAt,
    tableLabel: guestSession.session.table.label,
    sessionId: guestSession.sessionId,
  };
}