"use client";

import { useState } from "react";
import { Button, Toast } from "@/components/ui";
import { ApiError, call } from "@/components/dashboard/api";

export type ConsentRequest = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
};

const SENTENCES: Record<string, string> = {
  offline: "We couldn't reach Tawilati. Check your connection and try again.",
  forbidden: "Only the business owner can connect an AI assistant.",
  invalid_client: "This connection request has expired. Start again from your AI assistant.",
  invalid_redirect_uri: "This connection request has expired. Start again from your AI assistant.",
};

// Allow or Cancel. Either way the server answers with the assistant's address to go back to.
export function ConsentForm({ request, assistantName }: { request: ConsentRequest; assistantName: string }) {
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(decision: "allow" | "deny") {
    setPending(decision);
    setError(null);
    try {
      const { redirectTo } = await call<{ redirectTo: string }>("/api/oauth/authorize", "POST", {
        ...request,
        decision,
      });
      // Stay "loading" while the browser leaves for the assistant.
      window.location.assign(redirectTo);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : "";
      setError(SENTENCES[code] ?? "Something went wrong on our side. Please try again in a moment.");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Toast tone="error" title={error} />}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" block loading={pending === "deny"} disabled={pending === "allow"} onClick={() => void answer("deny")}>
          Cancel
        </Button>
        <Button block loading={pending === "allow"} disabled={pending === "deny"} onClick={() => void answer("allow")}>
          Allow
        </Button>
      </div>
      <p className="text-center text-[13px] text-ink-muted">
        You can cut {assistantName} off at any time from AI integrations in your dashboard.
      </p>
    </div>
  );
}
