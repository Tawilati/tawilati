import { H2, Kicker, Section } from "./shared";

// The same busy evening twice, so the difference reads without any claim to back up.
const BEFORE = [
  { time: "8:02", text: "A hand goes up. Nobody sees it." },
  { time: "8:09", text: "The order is written on paper, on the way to another table." },
  { time: "8:14", text: "It reaches the kitchen with a detail missing." },
  { time: "8:26", text: "Two tables ask where their food is." },
];

const AFTER = [
  { time: "8:02", text: "Table T1 scans the code and opens the menu." },
  { time: "8:03", text: "The order is sent from their phone." },
  { time: "8:03", text: "The kitchen screen shows it, with the table's name." },
  { time: "8:12", text: "It's ready. The waiter sees it and serves." },
];

export function Problem() {
  return (
    <Section tone="white">
      <div className="tw-reveal grid items-end gap-4 lg:grid-cols-2 lg:gap-16">
        <div>
          <Kicker className="text-accent-ink">A busy Friday</Kicker>
          <H2>Great service shouldn&apos;t mean more waiting.</H2>
        </div>
        <p className="text-ink-muted max-w-md">
          Guests wait to be noticed, your team covers too many tables, and orders travel by paper or by word of mouth.
          Things get missed, not because anyone is careless, but because there are only two hands.
        </p>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="before" className="tw-reveal border-border-strong bg-surface-secondary rounded-3xl border border-dashed p-6 sm:p-8">
          <h3 id="before" className="text-ink-muted text-sm font-semibold">
            Without a connected system
          </h3>
          <ol className="mt-5 flex flex-col gap-5">
            {BEFORE.map((step) => (
              <li key={step.text} className="flex gap-4">
                <span className="text-ink-muted w-10 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">{step.time}</span>
                <p className="text-ink-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="after" className="tw-reveal bg-primary text-on-primary rounded-3xl p-6 sm:p-8">
          <h3 id="after" className="text-sm font-semibold">
            With Tawilati
          </h3>
          <ol className="before:bg-on-primary/20 relative mt-5 flex flex-col gap-5 before:absolute before:top-2 before:bottom-2 before:left-[3.55rem] before:w-px">
            {AFTER.map((step) => (
              <li key={step.text} className="relative flex gap-4">
                <span className="text-accent w-10 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">{step.time}</span>
                <span aria-hidden="true" className="bg-accent relative z-10 mt-2 -ml-[0.2rem] size-2 shrink-0 rounded-full ring-4 ring-primary" />
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <p className="text-ink-muted mt-4 text-center text-xs">An example evening, to show the difference. Not a measurement.</p>
    </Section>
  );
}
