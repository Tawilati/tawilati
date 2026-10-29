import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { MailIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { Button, Card, PasswordField, StatusBadge, TextField, Toast } from "@/components/ui";
import { LoadingButtonDemo, SmallIconButtonDemo, StepperDemo } from "./StyleguideDemos";

export const metadata: Metadata = { title: "Style guide · Tawilati" };

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-ink-muted">{note}</p>
      </div>
      <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-border-subtle bg-surface-muted/40 p-5">
        {children}
      </div>
    </section>
  );
}

// Every shared component in one place, for the team while building screens. Not served in production.
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Logo className="h-auto w-40" />
        <h1 className="font-display text-4xl">Style guide</h1>
        <p className="text-ink-muted">
          Components from <code>src/components/ui</code>. Staff layout per role:{" "}
          <Link className="font-semibold text-primary underline" href="/styleguide/shell?role=OWNER">Owner</Link>,{" "}
          <Link className="font-semibold text-primary underline" href="/styleguide/shell?role=KITCHEN">Kitchen</Link>,{" "}
          <Link className="font-semibold text-primary underline" href="/styleguide/shell?role=WAITER">Waiter</Link>.
        </p>
      </header>

      <Section title="Button" note="Primary for the main action. Accent only for promotions.">
        <Button>Sign in</Button>
        <Button variant="secondary">Add category</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="accent">Try 14 days free</Button>
        <SmallIconButtonDemo />
        <LoadingButtonDemo />
        <Button disabled>Send order</Button>
      </Section>

      <Section title="Text fields" note="Errors are sentences that say how to fix it.">
        <div className="grid w-full gap-4 sm:grid-cols-3">
          <TextField label="Email" type="email" defaultValue="owner@cafehamra.com" icon={<MailIcon className="size-5 shrink-0" />} />
          <PasswordField label="Password" defaultValue="hunter22hunter" hint="At least 8 characters." />
          <TextField label="Exchange rate (LBP per USD)" inputMode="decimal" defaultValue="0" error="Enter a rate above 0, for example 89,500." />
        </div>
      </Section>

      <Section title="Messages" note="Confirmation and error.">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <Toast title="Item saved">Halloumi sandwich is on the menu at $6.50 · 581,750 LBP.</Toast>
          <Toast tone="error" title="Email or password is incorrect">Check both and try again.</Toast>
        </div>
      </Section>

      <Section title="Status badges" note="Always a word, never colour alone.">
        <StatusBadge status="NEW" />
        <StatusBadge status="PREPARING" />
        <StatusBadge status="READY" />
        <StatusBadge status="SERVED" />
        <StatusBadge status="CLOSED" />
        <StatusBadge status="SOLD_OUT" />
        <StatusBadge status="DISABLED" />
      </Section>

      <Section title="Cart controls" note="Tap + to add, then use the stepper. Going below 1 removes the item.">
        <StepperDemo />
      </Section>

      <Section title="Card" note="Sets one block apart.">
        <Card className="w-full max-w-sm">
          <p className="text-sm text-ink-muted">Today&apos;s sales</p>
          <p className="text-2xl font-bold tabular-nums">$412.50</p>
          <p className="text-sm text-ink-muted tabular-nums">36,918,750 LBP · 27 orders</p>
        </Card>
      </Section>
    </main>
  );
}
