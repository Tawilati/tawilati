import { createHash, randomBytes } from "node:crypto";
import type { z } from "zod";
import { oauthRepo } from "@/repository/OAuthRepo";
import { mcpTokenService } from "@/service/McpTokenService";
import {
  MCP_SCOPE,
  mapToClientRegistrationResponse,
  type OAuthClientRegistrationResponse,
  type OAuthConsentClient,
  type OAuthTokenResponse,
} from "@/types/OAuth";
import { BadRequestException } from "@/utils/exceptions/http/BadRequestException";
import { verifyPkce } from "@/utils/pkce";
import type { registerClientSchema, tokenRequestSchema } from "@/validation/oauthSchemas";

// A code is only the bridge from the owner's "Allow" to the assistant's token request, seconds apart.
const CODE_LIFETIME_MS = 5 * 60 * 1000;
const DEFAULT_CLIENT_NAME = "AI assistant";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type OAuthDecision = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  decision: "allow" | "deny";
};

// Sign-in for AI assistants (OAuth 2.1, authorization code with PKCE). The token it hands out is an
// ordinary MCP token tied to the client, so it shows on the AI integrations screen and Revoke cuts it off.
// Errors carry the OAuth error codes (RFC 6749 §5.2), which the OAuth routes send as { error }.
export class OAuthService {
  private static instance: OAuthService;

  private constructor() {}

  static getInstance(): OAuthService {
    if (!OAuthService.instance) {
      OAuthService.instance = new OAuthService();
    }

    return OAuthService.instance;
  }

  // RFC 7591 dynamic registration. Anyone may register: nothing is reachable until an owner taps Allow.
  async registerClient(input: z.output<typeof registerClientSchema>): Promise<OAuthClientRegistrationResponse> {
    const record = await oauthRepo.createClient({
      name: input.client_name || DEFAULT_CLIENT_NAME,
      redirectUris: input.redirect_uris,
    });
    return mapToClientRegistrationResponse(record);
  }

  // The assistant asking, if it is registered and the return address is one it registered.
  // Both are checked before anything is redirected anywhere (RFC 6749 §4.1.2.1).
  async getConsentClient(clientId: string, redirectUri: string): Promise<OAuthConsentClient> {
    const client = clientId ? await oauthRepo.findClient(clientId) : null;
    if (!client) throw new BadRequestException("invalid_client");
    if (!client.redirectUris.includes(redirectUri)) throw new BadRequestException("invalid_redirect_uri");

    return { id: client.id, name: client.name, redirectHost: new URL(redirectUri).host };
  }

  // The owner's answer on the consent screen. Returns where to send the browser: back to the assistant
  // with a one-time code (Allow) or with error=access_denied (Cancel), plus its state either way.
  async decide(decision: OAuthDecision, owner: { userId: string; businessId: string }): Promise<string> {
    await this.getConsentClient(decision.clientId, decision.redirectUri);

    const url = new URL(decision.redirectUri);
    if (decision.decision === "allow") {
      const code = randomBytes(32).toString("hex");
      await oauthRepo.createCode({
        codeHash: sha256(code),
        clientId: decision.clientId,
        businessId: owner.businessId,
        userId: owner.userId,
        redirectUri: decision.redirectUri,
        codeChallenge: decision.codeChallenge,
        expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
      });
      url.searchParams.set("code", code);
    } else {
      url.searchParams.set("error", "access_denied");
    }
    if (decision.state) url.searchParams.set("state", decision.state);

    return url.toString();
  }

  // Swaps a code for an MCP token. The code is spent first, so a second try with it always fails,
  // even when the first one sent the wrong verifier.
  async exchangeCode(input: z.output<typeof tokenRequestSchema>): Promise<OAuthTokenResponse> {
    const spent = await oauthRepo.spendCode(sha256(input.code));
    if (
      !spent ||
      spent.clientId !== input.client_id ||
      spent.redirectUri !== input.redirect_uri ||
      !verifyPkce(input.code_verifier, spent.codeChallenge)
    ) {
      throw new BadRequestException("invalid_grant");
    }

    const created = await mcpTokenService.create(spent.businessId, spent.userId, spent.client.name, spent.clientId);
    return {
      access_token: created.token,
      token_type: "Bearer",
      expires_in: Math.max(0, Math.floor((created.expiresAt.getTime() - Date.now()) / 1000)),
      scope: MCP_SCOPE,
    };
  }
}

export const oauthService = OAuthService.getInstance();
