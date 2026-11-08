import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthScreen, authLinkClassName } from "@/components/auth/AuthScreen";
import { ConsentForm } from "@/components/oauth/ConsentForm";
import { Toast } from "@/components/ui";
import { oauthService } from "@/service/OAuthService";
import { userService } from "@/service/UserService";
import { ROLE, toRole } from "@/types/Roles";
import { authorizeQuerySchema } from "@/validation/oauthSchemas";

export const metadata: Metadata = { title: "Connect an assistant · Tawilati" };

type SearchParams = PageProps<"/oauth/authorize">["searchParams"];

// /oauth/authorize: where an AI assistant (Claude, for example) sends the owner to connect it to their café.
// The proxy has already sent signed-out visitors to /login and back here. The owner sees who is asking and
// what it may do, then taps Allow or Cancel (ConsentForm → POST /api/oauth/authorize).
export default function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  return (
    <AuthScreen
      title="Connect an AI assistant"
      intro="An assistant is asking to look after your café for you."
      footer={
        <Link href="/dashboard/integrations" className={authLinkClassName}>
          See your AI integrations
        </Link>
      }
    >
      <Suspense fallback={<p className="text-sm text-ink-muted">Checking the request…</p>}>
        <Consent searchParams={searchParams} />
      </Suspense>
    </AuthScreen>
  );
}

function Problem({ children }: { children: string }) {
  return <Toast tone="error" title={children} />;
}

async function Consent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);
  const clientId = one("client_id") ?? "";
  const redirectUri = one("redirect_uri") ?? "";

  // An unknown assistant or return address: say so here and never redirect (RFC 6749 §4.1.2.1).
  let client;
  try {
    client = await oauthService.getConsentClient(clientId, redirectUri);
  } catch {
    return <Problem>{"This connection link isn't valid. Start again from your AI assistant."}</Problem>;
  }

  // The rest is wrong (no PKCE, another response type): send the assistant its error.
  const query = authorizeQuerySchema.safeParse({
    response_type: one("response_type"),
    code_challenge: one("code_challenge"),
    code_challenge_method: one("code_challenge_method"),
    state: one("state"),
  });
  if (!query.success) {
    const back = new URL(redirectUri);
    back.searchParams.set("error", "invalid_request");
    const state = one("state");
    if (state) back.searchParams.set("state", state);
    redirect(back.toString());
  }

  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-user-id");
  const businessId = requestHeaders.get("x-business-id");
  const profile = userId && businessId ? await userService.getStaffProfile(userId, businessId) : null;
  if (!profile) redirect("/login?reason=unauthorized");
  if (toRole(profile.role) !== ROLE.OWNER) {
    return (
      <Problem>{"Only the business owner can connect an AI assistant. Ask them to sign in and connect it."}</Problem>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-muted px-4 py-3 text-sm">
        <p className="text-ink">
          <span className="font-semibold">{client.name}</span> wants to work with{" "}
          <span className="font-semibold">{profile.businessName}</span> as you ({profile.name}).
        </p>
        <p className="text-ink-muted">After you answer you go back to {client.redirectHost}.</p>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-semibold text-ink">It will be able to</p>
        <ul className="list-disc pl-5 text-ink-muted">
          <li>Read your menu, tables, kitchen orders and open tabs</li>
          <li>Add and edit menu items, categories and tables</li>
          <li>Mark items sold out, and change the exchange rate and timezone</li>
        </ul>
        <p className="mt-1 text-ink-muted">It can&apos;t see staff accounts, take payments or close bills.</p>
      </div>
      <ConsentForm
        assistantName={client.name}
        request={{ clientId: client.id, redirectUri, codeChallenge: query.data.code_challenge, state: query.data.state }}
      />
    </div>
  );
}
