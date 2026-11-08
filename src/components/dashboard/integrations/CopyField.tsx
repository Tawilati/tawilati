"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { ButtonVariant } from "@/components/ui/buttonStyles";

// A value to paste somewhere else (an address, a key, a command), with a Copy button. The label takes the colour
// around it, so the field also sits on the green "Connect your AI assistant" box.
export function CopyField({
  label,
  value,
  multiline = false,
  button = "secondary",
}: {
  label: string;
  value: string;
  multiline?: boolean;
  button?: ButtonVariant;
}) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  // "Copied" goes back to "Copy" after a moment, so a second copy also shows that it worked.
  useEffect(() => {
    if (copied !== "yes") return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex items-start gap-2">
        <code
          className={`min-h-11 min-w-0 flex-1 select-all rounded-xl border border-border-subtle bg-surface px-3 py-2.5 font-mono text-[14px] text-ink ${
            multiline ? "whitespace-pre-wrap break-all" : "truncate"
          }`}
        >
          {value}
        </code>
        <Button variant={button} size="sm" className="min-h-11 shrink-0" onClick={() => void copy()} aria-label={`Copy ${label}`}>
          {copied === "yes" ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          {copied === "yes" ? "Copied" : "Copy"}
        </Button>
      </div>
      {copied === "failed" && (
        <p className="text-[13px]">Your browser blocked copying. Select the text and copy it yourself.</p>
      )}
    </div>
  );
}
