import { handleOAuth, oauthJson, oauthPreflight, readOAuthBody } from "@/lib/oauth/http";
import { oauthService } from "@/service/OAuthService";
import { registerClientSchema } from "@/validation/oauthSchemas";

// POST /api/oauth/register (public, RFC 7591): an AI assistant registers itself before asking an owner
// to sign in. Answers in the OAuth shape: 201 with the client, or 400 { error }.
export async function POST(request: Request) {
  return handleOAuth(
    async () => {
      const body = registerClientSchema.parse(await readOAuthBody(request));
      return oauthJson(await oauthService.registerClient(body), 201);
    },
    (error) =>
      error.issues.some((issue) => issue.path[0] === "redirect_uris") ? "invalid_redirect_uri" : "invalid_client_metadata",
  );
}

export const OPTIONS = oauthPreflight;
