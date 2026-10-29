import Link from "next/link";
import { Logo } from "@/components/Logo";
import { buttonClassName } from "@/components/ui/buttonStyles";

// The first screen anyone sees: the logo, one line, and the two ways in.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-[460px] flex-col items-center gap-8 text-center">
        <Logo priority className="h-auto w-52 sm:w-64" />
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-4xl leading-tight text-balance sm:text-5xl">
            Good food, smoother service.
          </h1>
          <p className="text-ink-muted text-balance">
            Guests scan, order and watch it arrive. Your team sees every order the moment it&apos;s placed.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/register" className={buttonClassName({ variant: "primary", block: true })}>
            Register your business
          </Link>
          <Link href="/login" className={buttonClassName({ variant: "secondary", block: true })}>
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
