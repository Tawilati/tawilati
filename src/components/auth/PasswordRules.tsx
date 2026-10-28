import { CheckIcon } from "@/components/icons";
import { PASSWORD_RULES } from "@/validation/User";

// The sign-up password rules under the field, each ticked green as it is met while the owner types.
// After a failed try (`showMissing`) the rules still missing turn red.
export function PasswordRules({ id, password, showMissing }: { id: string; password: string; showMissing: boolean }) {
  return (
    <ul id={id} className="-mt-2 flex flex-col gap-1 text-[13px]">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        const tone = met ? "text-[var(--color-success)]" : showMissing ? "text-danger" : "text-ink-muted";
        return (
          <li key={rule.label} className={`flex items-center gap-2 ${tone}`}>
            <span
              aria-hidden="true"
              className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${
                met ? "bg-[var(--color-success-tint)]" : "border border-current"
              }`}
            >
              {met && <CheckIcon className="size-3" />}
            </span>
            {rule.label}
            <span className="sr-only">{met ? ", done" : ", not yet"}</span>
          </li>
        );
      })}
    </ul>
  );
}
