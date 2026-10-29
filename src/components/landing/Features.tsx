import { demoMenuUrl } from "./demoMenu";
import { FeatureTabs, type Feature } from "./FeatureTabs";
import { BrowserFrame, KitchenBoard, MenuManagerPreview, OrdersPreview, TableTent } from "./previews";
import { H2, Kicker, Section } from "./shared";

const MORE = [
  { title: "Bills & Payments", text: "Keep a running bill for each table, record payments, and close the table when it's paid." },
  { title: "Flexible Currency", text: "Set your own exchange rate. Every price shows in USD first, then in LBP." },
];

export function Features() {
  const features: Feature[] = [
    {
      id: "kitchen",
      label: "Kitchen dashboard",
      title: "The kitchen sees it as it's sent.",
      text: "Every order arrives as its own ticket with the table's name. Move it from New to Preparing to Ready, and the waiter knows when to bring it out.",
      screen: (
        <BrowserFrame title="Kitchen">
          <KitchenBoard />
        </BrowserFrame>
      ),
    },
    {
      id: "menu",
      label: "Menu management",
      title: "Run out of something? One tap.",
      text: "Add a dish, change a price, or mark an item sold out. It leaves every guest's menu, so nobody orders what you can't make.",
      screen: (
        <BrowserFrame title="Menu">
          <MenuManagerPreview />
        </BrowserFrame>
      ),
    },
    {
      id: "orders",
      label: "Order management",
      title: "Every table, where it stands.",
      text: "Your waiters see which orders are new, being prepared or ready to serve, and take the next step from the same screen.",
      screen: (
        <BrowserFrame title="Tables">
          <OrdersPreview />
        </BrowserFrame>
      ),
    },
  ];

  return (
    <Section id="features">
      <div className="tw-reveal max-w-xl">
        <Kicker className="text-accent-ink">Features</Kicker>
        <H2>Everything your restaurant needs, in one place.</H2>
      </div>

      {/* QR ordering leads: it is where every order starts. */}
      <div className="tw-reveal bg-primary-tint border-border-subtle mt-10 grid items-center gap-8 overflow-hidden rounded-3xl border p-6 sm:p-10 md:grid-cols-[1fr_auto] md:gap-14">
        <div className="flex max-w-lg flex-col gap-3">
          <h3 className="font-display text-2xl sm:text-3xl">QR code ordering</h3>
          <p className="text-ink-muted">
            One code per table. Guests open the menu on their own phone and order from their seat, so nobody waits for
            a menu or for someone to come over.
          </p>
          <ul className="mt-2 flex flex-col gap-2 text-[15px] font-medium">
            {["Print it once, it keeps working", "Each code belongs to one table", "No app, no account"].map((line) => (
              <li key={line} className="flex items-center gap-3">
                <span aria-hidden="true" className="bg-accent size-1.5 shrink-0 rounded-full" />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <TableTent qrUrl={demoMenuUrl()} className="mx-auto rotate-2 transition-transform duration-300 hover:rotate-0 md:mr-4 motion-reduce:transition-none" />
      </div>

      <div className="tw-reveal mt-12">
        <FeatureTabs features={features} />
      </div>

      <dl className="tw-reveal border-border-strong mt-12 grid gap-x-12 border-t md:grid-cols-2">
        {MORE.map((feature) => (
          <div key={feature.title} className="border-border-subtle group flex gap-4 border-b py-5 last:border-b-0 md:border-b-0">
            <span aria-hidden="true" className="bg-border-strong group-hover:bg-accent mt-2 h-0.5 w-6 shrink-0 rounded-full transition-colors" />
            <div className="flex flex-col gap-1">
              <dt className="font-semibold">{feature.title}</dt>
              <dd className="text-ink-muted text-[15px]">{feature.text}</dd>
            </div>
          </div>
        ))}
      </dl>
    </Section>
  );
}
