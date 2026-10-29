import Link from "next/link";
import { Logo } from "@/components/Logo";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { MobileMenu } from "./MobileMenu";
import { SECTION_LINKS, contentWidth, focusRing } from "./shared";

// Top bar of the public landing page: logo, the page sections, and the two ways in.
export function LandingNav() {
  return (
    <header className="bg-surface-secondary/95 border-border-subtle sticky top-0 z-40 border-b backdrop-blur">
      <nav aria-label="Main" className={`${contentWidth} relative flex items-center justify-between gap-4 py-2.5`}>
        <Link href="/" aria-label="tawilati. home" className={`flex items-center ${focusRing}`}>
          <Logo priority className="h-8 w-auto sm:h-9" />
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {SECTION_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`text-ink-muted hover:text-ink rounded-sm text-sm font-medium transition-colors ${focusRing}`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className={buttonClassName({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
          <Link href="/register" className={buttonClassName({ variant: "primary", size: "sm" })}>
            Register your business
          </Link>
        </div>

        <MobileMenu />
      </nav>
    </header>
  );
}
