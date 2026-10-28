"use client";

import type { ReactNode } from "react";
import { Button } from "./Button";
import { ModalFrame } from "./ModalFrame";

// A pop-up asking "are you sure?" before something that is hard to undo. Focus starts on Cancel, the safe choice.
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalFrame title={title} role="alertdialog" locked={loading} onClose={onCancel}>
      <div className="text-sm text-ink-muted">{children}</div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button variant="ghost" block className="sm:w-auto" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant="accent" block className="sm:w-auto" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </ModalFrame>
  );
}
