import Link from "next/link";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { H2, Section } from "./shared";

export function FinalCta() {
  return (
    <Section tone="dark">
      <div className="tw-reveal flex flex-col items-center gap-6 text-center">
        <span aria-hidden="true" className="bg-accent h-1 w-12 rounded-full" />
        <H2>Ready for smoother service?</H2>
        <p className="text-on-primary/85 max-w-md text-balance">
          Bring your menu, orders, and restaurant team together with Tawilati.
        </p>
        <Link
          href="/register"
          className={buttonClassName({
            variant: "secondary",
            className:
              "tw-lift !bg-surface-secondary !text-primary !border-surface-secondary hover:!bg-surface focus-visible:!outline-surface-secondary",
          })}
        >
          Register your business
        </Link>
      </div>
    </Section>
  );
}
