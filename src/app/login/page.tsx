import type { Metadata } from "next";
import Link from "next/link";
import { AuthScreen, authLinkClassName } from "@/components/auth/AuthScreen";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in · Tawilati" };

// Owners, waiters and kitchen staff all sign in here; each then lands on their own first screen.
export default function LoginPage() {
  return (
    <AuthScreen
      title="Welcome back"
      intro="Sign in to see your tables, orders and menu."
      footer={
        <>
          New business?{" "}
          <Link href="/register" className={authLinkClassName}>
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthScreen>
  );
}
