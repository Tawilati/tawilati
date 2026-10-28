import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthScreen, authLinkClassName } from "@/components/auth/AuthScreen";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginNotice } from "@/components/auth/LoginNotice";

export const metadata: Metadata = { title: "Sign in · Tawilati" };

// Owners, waiters and kitchen staff all sign in here; each then lands on their own first screen.
// A staff screen sends signed-out visitors here with ?reason=unauthorized. Reading the address is
// the only dynamic part, so it streams in on its own and the form itself stays static.
async function UnauthorizedNotice({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { reason } = await searchParams;
  return reason === "unauthorized" ? <LoginNotice /> : null;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <Suspense fallback={null}>
        <UnauthorizedNotice searchParams={searchParams} />
      </Suspense>
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
    </>
  );
}
