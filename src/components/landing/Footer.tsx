import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SECTION_LINKS, contentWidth, focusRing } from "./shared";

const ACCOUNT_LINKS = [
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Register your business" },
];

function LinkColumn({ title, links }: { title: string; links: readonly { href: string; label: string }[] }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-1">
      <h2 className="text-secondary-ink mb-1 text-xs font-semibold tracking-[0.12em] uppercase">{title}</h2>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`text-ink-muted hover:text-ink flex min-h-9 items-center rounded-sm text-sm transition-colors ${focusRing}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="border-border-subtle border-t">
      <div className={`${contentWidth} flex flex-col gap-10 py-12`}>
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="flex max-w-xs flex-col gap-3">
            <Link href="/" aria-label="tawilati. home" className={`w-fit ${focusRing}`}>
              <Logo className="h-8 w-auto" />
            </Link>
            <p className="text-ink-muted text-sm">
              QR table ordering for cafés and casual restaurants. Good food, smoother service.
            </p>
          </div>
          <div className="flex gap-16">
            <LinkColumn title="Explore" links={SECTION_LINKS} />
            <LinkColumn title="Account" links={ACCOUNT_LINKS} />
          </div>
        </div>
        <p className="text-ink-muted text-sm">© 2026 Tawilati. All rights reserved.</p>
      </div>
    </footer>
  );
}
