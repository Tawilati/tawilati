import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { demoMenuUrl } from "./demoMenu";
import { KitchenNotice, MenuScreen, PhoneFrame, TableTent } from "./previews";
import { contentWidth, focusRing } from "./shared";

const bigButton = "tw-lift !min-h-14 !px-7 !text-lg whitespace-nowrap sm:!w-auto";

const POINTS = ["No app to install", "Prices in USD and LBP", "Orders reach the kitchen live"];

const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

// Headline and buttons on the left. On the right, one phone showing the guest's menu, with the two things around it
// that tell the story: the code on the table, and the order arriving in the kitchen.
export function Hero() {
  const qrUrl = demoMenuUrl();
  return (
    <section className={`${contentWidth} grid items-center gap-8 pt-10 pb-6 sm:pt-14 lg:grid-cols-[1fr_600px] lg:gap-6 lg:pt-16 lg:pb-12`}>
      <div className="flex flex-col items-center gap-8 text-center lg:items-start lg:text-left">
        <div className="tw-rise flex flex-col gap-5">
          <h1 className="font-display text-5xl leading-[1.08] text-balance sm:text-6xl lg:text-[4.25rem]">
            Good food, <span className="tw-mark">smoother</span> service.
          </h1>
          <p className="text-ink-muted max-w-lg text-lg text-balance sm:text-xl sm:leading-relaxed">
            Guests scan, order and watch it arrive. Your team sees every order the moment it&apos;s placed.
          </p>
        </div>
        <div style={delay(0.15)} className="tw-rise flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          <Link href="/register" className={buttonClassName({ variant: "primary", block: true, className: bigButton })}>
            Register your business
          </Link>
          <Link href="/login" className={buttonClassName({ variant: "ghost", block: true, className: bigButton })}>
            Sign in
          </Link>
        </div>
        <ul style={delay(0.3)} className="tw-rise text-ink-muted flex flex-col items-center gap-x-5 gap-y-1.5 text-sm sm:flex-row sm:flex-wrap lg:justify-start">
          {POINTS.map((point) => (
            <li key={point} className="flex items-center gap-2">
              <span aria-hidden="true" className="bg-accent size-1.5 rounded-full" />
              {point}
            </li>
          ))}
        </ul>
        <Link
          href="/#how-it-works"
          style={delay(0.4)}
          className={`tw-rise group text-primary inline-flex min-h-11 items-center gap-2 rounded-sm text-base font-semibold ${focusRing}`}
        >
          <span className="decoration-accent underline decoration-2 underline-offset-4">See how it works</span>
          <ArrowRightIcon className="size-5 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
        </Link>
      </div>

      <div className="tw-phone-stage relative mx-auto flex w-full max-w-[600px] flex-col items-center pb-2 lg:h-[640px] lg:flex-row lg:items-start lg:justify-center lg:pb-0">
        {/* A tall arch behind the phone, like a café window. */}
        <div
          aria-hidden="true"
          className="bg-primary-tint border-border-subtle absolute inset-x-[8%] top-8 bottom-0 rounded-t-[999px] border border-b-0 sm:inset-x-[16%]"
        />
        <span aria-hidden="true" className="bg-accent absolute top-[26px] left-1/2 h-1.5 w-14 -translate-x-1/2 rounded-full" />

        <div style={delay(0.2)} className="tw-rise relative mt-16">
          <PhoneFrame
            label="The menu a guest sees on their phone after scanning the table's code: food items with prices in USD and LBP, and an order bar with four items."
            className="tw-phone -rotate-3 sm:w-[288px]"
          >
            <MenuScreen />
          </PhoneFrame>
        </div>

        {/* The two cards overlap the phone's sides: smaller and lower down on phones, full size from lg. */}
        <div style={delay(0.55)} className="tw-rise absolute top-[66%] left-[10%] z-10 lg:top-auto lg:bottom-6 lg:left-[5%]">
          <div className="tw-bob-late">
            <TableTent qrUrl={qrUrl} className="-rotate-3 max-lg:[zoom:0.55] lg:origin-bottom-left lg:scale-[0.72]" />
          </div>
        </div>
        <div style={delay(0.7)} className="tw-rise absolute top-[52%] left-[56%] z-10 lg:top-[300px] lg:right-[3%] lg:left-auto">
          <div className="tw-bob w-[176px] max-lg:[zoom:0.82]">
            <KitchenNotice className="rotate-2 !p-3" />
          </div>
        </div>
      </div>
    </section>
  );
}
