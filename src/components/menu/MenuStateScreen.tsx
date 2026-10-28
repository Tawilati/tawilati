import { CircleAlertIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";

export type MenuProblem = "invalid_qr" | "table_disabled" | "empty_menu";

// Plain sentences for the guest; error codes are never shown.
const SCREENS: Record<MenuProblem, { title: string; body: string; isError: boolean }> = {
  invalid_qr: {
    title: "We couldn't open this menu",
    body: "This QR code doesn't match a table. Please ask a member of staff for help.",
    isError: true,
  },
  table_disabled: {
    title: "This table isn't taking orders right now",
    body: "Please ask a member of staff to seat you at another table.",
    isError: false,
  },
  empty_menu: {
    title: "The menu isn't ready yet",
    body: "Please ask a member of staff what's available today.",
    isError: false,
  },
};

export function MenuStateScreen({ problem }: { problem: MenuProblem }) {
  const { title, body, isError } = SCREENS[problem];
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span
        className={`inline-flex size-[52px] items-center justify-center rounded-full ${
          isError ? "bg-danger-tint text-danger" : "bg-primary-tint text-primary"
        }`}
      >
        {isError ? <CircleAlertIcon className="size-[26px]" /> : <Logo variant="icon" className="h-[26px] w-auto" />}
      </span>
      <h1 className="text-lg font-bold text-balance">{title}</h1>
      <p className="max-w-[30ch] text-sm text-ink-muted">{body}</p>
    </main>
  );
}
