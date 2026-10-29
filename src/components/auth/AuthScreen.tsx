import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui";

// The frame for sign-in and sign-up: logo, one card with the form, and a line linking to the other screen.
// Same layout on every width; on a phone the card fills the screen less its side margins.
export function AuthScreen({
  title,
  intro,
  footer,
  children,
}: {
  title: string;
  intro: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:py-8">
      <div className="flex w-full max-w-[420px] flex-col gap-4">
        <Link
          href="/"
          aria-label="tawilati. home"
          className="mx-auto rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <Logo priority className="h-auto w-40" />
        </Link>
        <Card className="flex flex-col gap-5 sm:px-8 sm:py-7">
          <header className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold text-balance">{title}</h1>
            <p className="text-sm text-ink-muted">{intro}</p>
          </header>
          {children}
        </Card>
        {/* Pulled up: the link's 44px touch target already adds space above the text. */}
        <p className="-mt-3 text-center text-sm text-ink-muted">{footer}</p>
      </div>
    </main>
  );
}

// An inline link with a 44px tall touch target.
export const authLinkClassName =
  "inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline";
