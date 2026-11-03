import { buttonClassName, Card, Toast } from "@/components/ui";

// Shown when a staff screen's own data answers 403: tabs of one browser share the sign-in, so signing in as
// another role in another tab (kitchen, say) also changed this tab's account. The screen keeps checking and
// comes back by itself once this browser is signed in with the right role again.
export function SignedInElsewhere({ role }: { role: "waiter" | "kitchen" }) {
  return (
    <Card className="flex flex-col items-start gap-3">
      <Toast
        tone="error"
        title={`This browser is now signed in with another account, probably from another tab. Sign in again as the ${role}. To use several roles at once, open each one in its own browser or a private window.`}
      />
      {/* A full page load, so the login screen starts clean. */}
      <a href="/login" className={buttonClassName()}>
        Sign in again
      </a>
    </Card>
  );
}
