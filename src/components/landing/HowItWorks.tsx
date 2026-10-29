import { demoMenuUrl } from "./demoMenu";
import { CartScreen, KitchenBoard, MenuScreen, PhoneFrame, ScanScreen } from "./previews";
import { H2, Kicker, Section } from "./shared";
import { StepTabs, type Step } from "./StepTabs";

// A dark band: the one place the page stops explaining and lets the visitor try the flow.
export function HowItWorks() {
  const steps: Step[] = [
    {
      title: "Scan the QR code",
      text: "Each table has its own code. Guests scan it with their phone camera. There's no app to install.",
      screen: (
        <PhoneFrame label="A phone camera pointed at the code on a table.">
          <ScanScreen qrUrl={demoMenuUrl()} />
        </PhoneFrame>
      ),
    },
    {
      title: "Browse the menu",
      text: "They read your menu, with prices in USD first and LBP after, and add what they want.",
      screen: (
        <PhoneFrame label="The menu on the guest's phone, with an item added.">
          <MenuScreen />
        </PhoneFrame>
      ),
    },
    {
      title: "Place an order",
      text: "They check the order and send it from the table. A double tap never sends it twice.",
      screen: (
        <PhoneFrame label="The guest's order with a total in USD and LBP, and the button that sends it to the kitchen.">
          <CartScreen />
        </PhoneFrame>
      ),
    },
    {
      title: "It's on the kitchen screen",
      text: "The order appears as a new ticket with the table's name, ready to be prepared.",
      screen: (
        <div className="bg-ink w-full max-w-[460px] rounded-[1.75rem] p-2.5 shadow-[0_30px_50px_-20px_rgb(0_0_0/0.5)]">
          <KitchenBoard className="rounded-[1.25rem]" />
        </div>
      ),
    },
  ];

  return (
    <Section id="how-it-works" tone="dark">
      <StepTabs
        steps={steps}
        heading={
          <div className="tw-reveal mb-6 max-w-lg">
            <Kicker className="text-accent">How it works</Kicker>
            <H2>From the table to the kitchen.</H2>
          </div>
        }
      />
    </Section>
  );
}
