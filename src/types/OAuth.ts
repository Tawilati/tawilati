// Sign-in for AI assistants (OAuth 2.1 with PKCE). An assistant registers itself (OAuthClient), the owner
// taps Allow on /oauth/authorize (OAuthCode), and the assistant swaps the code for an MCP token.

// One scope: everything the MCP tools allow for the owner's role.
export const MCP_SCOPE = "mcp";

// What the repository returns for a registered assistant.
export type OAuthClientRecord = {
  id: string;
  name: string;
  redirectUris: string[];
  createdAt: Date;
};

// What the repository takes to store a code. Only the hash of the code is kept.
export type CreateOAuthCodeInput = {
  codeHash: string;
  clientId: string;
  businessId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  expiresAt: Date;
};

// A code that was unused and unexpired a moment ago, and is now spent.
export type SpentOAuthCodeRecord = {
  clientId: string;
  businessId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  client: { name: string };
};

// RFC 7591 registration response. Every client is public: no secret, PKCE instead.
export type OAuthClientRegistrationResponse = {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  client_id_issued_at: number;
  token_endpoint_auth_method: "none";
  grant_types: ["authorization_code"];
  response_types: ["code"];
};

// RFC 6749 §5.1 token response.
export type OAuthTokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

// What the consent screen shows about the assistant asking.
export type OAuthConsentClient = {
  id: string;
  name: string;
  // Where the owner goes back to after Allow or Cancel, e.g. "claude.ai".
  redirectHost: string;
};

export function mapToClientRegistrationResponse(record: OAuthClientRecord): OAuthClientRegistrationResponse {
  return {
    client_id: record.id,
    client_name: record.name,
    redirect_uris: record.redirectUris,
    client_id_issued_at: Math.floor(record.createdAt.getTime() / 1000),
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"],
  };
}
