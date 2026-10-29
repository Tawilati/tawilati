import { H2, Kicker, Section } from "./shared";

const ROLES = [
  { who: "For guests", text: "A simpler way to browse, order and follow their orders." },
  { who: "For the kitchen", text: "Clear incoming orders, without the back-and-forth." },
  { who: "For owners and staff", text: "One place to run the day: menu, tables, orders and bills." },
];

export function ForEveryone() {
  return (
    <Section tone="dark">
      <div className="tw-reveal grid items-end gap-4 lg:grid-cols-2 lg:gap-16">
        <div>
          <Kicker className="text-accent">One order</Kicker>
          <H2 className="max-w-lg">One connected experience. For everyone.</H2>
        </div>
        <p className="text-on-primary/80 max-w-md">
          Tawilati is more than a digital menu. The guest, the kitchen and the front of house all work from the same
          order.
        </p>
      </div>
      {/* A line with a stop for each person the same order passes through: down the side on phones, across from md. */}
      <div className="relative mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
        <span
          aria-hidden="true"
          className="bg-on-primary/20 absolute top-2 bottom-2 left-[5px] w-px md:top-[5px] md:right-0 md:bottom-auto md:left-0 md:h-px md:w-auto"
        />
        {ROLES.map((role) => (
          <div key={role.who} className="tw-reveal group relative flex flex-col gap-3 pl-9 md:pt-8 md:pl-0">
            <span
              aria-hidden="true"
              className="bg-accent ring-primary absolute top-[3px] left-0 size-[11px] rounded-full ring-8 transition-transform group-hover:scale-125 md:top-0 motion-reduce:transition-none"
            />
            <h3 className="text-on-primary/70 text-xs font-semibold tracking-[0.12em] uppercase">{role.who}</h3>
            <p className="font-display text-xl leading-snug text-balance">{role.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
