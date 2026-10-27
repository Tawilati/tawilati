import type { ReactNode } from "react";
import { CheckIcon, CircleAlertIcon } from "@/components/icons";

// A confirmation ("Item saved") or an error ("Email or password is incorrect") with an optional second line.
export function Toast({
  tone = "success",
  title,
  children,
  className,
}: {
  tone?: "success" | "error";
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={["tw-toast", isError && "tw-toast--error", className].filter(Boolean).join(" ")}
    >
      <span className="tw-toast__mark">
        {isError ? <CircleAlertIcon className="size-5" /> : <CheckIcon className="size-5" />}
      </span>
      <div>
        <p className="tw-toast__title">{title}</p>
        {children && <p className="tw-toast__body">{children}</p>}
      </div>
    </div>
  );
}
