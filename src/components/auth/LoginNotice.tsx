"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { FloatingToast } from "@/components/ui/FloatingToast";

// Shown when a staff screen sent the person here because they weren't signed in (/login?reason=unauthorized).
// Closing it also clears the ?reason from the address, so a refresh doesn't show it again.
export function LoginNotice() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const dismiss = useCallback(() => {
    setOpen(false);
    router.replace("/login", { scroll: false });
  }, [router]);

  if (!open) return null;
  return (
    <FloatingToast
      tone="error"
      title="You don't have permission to open that page. Sign in to continue."
      duration={6000}
      onDismiss={dismiss}
    />
  );
}
