import type { Metadata } from "next";
import Link from "next/link";
import { AuthScreen, authLinkClassName } from "@/components/auth/AuthScreen";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = { title: "Set up your business · Tawilati" };

// A business owner signs up here: it creates the business's workspace and their owner account, and signs them in.
// Staff never sign up; the owner creates their accounts.
export default function RegisterPage() {
  return (
    <AuthScreen
      title="Set up your business"
      intro="Create your owner account. You'll add your menu, tables and staff next."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={authLinkClassName}>
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthScreen>
  );
}
