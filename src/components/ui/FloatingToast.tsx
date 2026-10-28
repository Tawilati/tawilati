"use client";

import { useEffect } from "react";
import { XIcon } from "@/components/icons";
import { Toast } from "./Toast";

// A small notification pinned to the top right (full width on a phone). It closes by itself after
// `duration` ms, or with its ✕. Give it a new `key` to show a fresh message and restart the timer.
export function FloatingToast({
  tone = "success",
  title,
  duration = 3500,
  onDismiss,
}: {
  tone?: "success" | "error";
  title: string;
  duration?: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      className="fixed inset-x-3 z-50 sm:left-auto sm:right-6 sm:w-72"
      style={{ top: "max(12px, env(safe-area-inset-top, 0px))" }}
    >
      <div className="relative shadow-[var(--shadow-raised)] [&_.tw-toast]:items-center [&_.tw-toast]:gap-3 [&_.tw-toast]:py-2.5 [&_.tw-toast]:pl-3 [&_.tw-toast]:pr-10 [&_.tw-toast\_\_mark]:size-7! [&_.tw-toast\_\_mark_svg]:size-4! [&_.tw-toast\_\_title]:text-sm!">
        <Toast tone={tone} title={title} />
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
