import { MinusIcon, PlusIcon } from "@/components/icons";
import { H2, Kicker, Section, focusRing } from "./shared";

const QUESTIONS = [
  {
    q: "What is Tawilati?",
    a: "A QR code ordering system for cafés and casual restaurants. Guests order from their phone at the table, the kitchen sees the order, and your team keeps track of tables and bills.",
  },
  {
    q: "How do customers place orders?",
    a: "Every table has its own QR code. A guest scans it, reads the menu in their phone's browser and sends their order. There's nothing to download.",
  },
  {
    q: "Do customers need to create an account?",
    a: "No. Scanning the table's code is enough to start ordering.",
  },
  {
    q: "How does the kitchen receive orders?",
    a: "On the kitchen screen. New orders show up there as soon as a guest sends them, so nobody has to carry a ticket from the floor.",
  },
  {
    q: "Can I manage my menu and prices?",
    a: "Yes. You add categories and items, set prices, and mark an item sold out when it runs out. You can also archive items you no longer serve.",
  },
  {
    q: "Can I configure my restaurant's currency and exchange rate?",
    a: "Yes. You set your own USD to LBP exchange rate when you register your business. Menu prices show in USD first, then in LBP.",
  },
];

// Native <details>: keyboard and screen-reader friendly, no script needed.
export function Faq() {
  return (
    <Section id="faq">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div className="tw-reveal">
          <Kicker className="text-accent-ink">FAQ</Kicker>
          <H2 className="max-w-sm">A few things you might be wondering.</H2>
        </div>
        <div className="tw-reveal border-border-strong divide-border-subtle divide-y border-y">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="group border-l-[3px] border-transparent pl-4 transition-colors open:border-accent">
              <summary
                className={`hover:text-primary flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold marker:hidden [&::-webkit-details-marker]:hidden ${focusRing}`}
              >
                {item.q}
                <PlusIcon className="text-ink-muted size-5 shrink-0 group-open:hidden" />
                <MinusIcon className="text-accent-ink hidden size-5 shrink-0 group-open:block" />
              </summary>
              <p className="text-ink-muted max-w-xl pb-5">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
