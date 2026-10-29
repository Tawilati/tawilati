"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { ModalFrame } from "./ModalFrame";

type Guard = { setDirty: (dirty: boolean) => void; requestClose: () => void };
const GuardContext = createContext<Guard | null>(null);

// For a form inside a `Modal`: tell the pop-up whether it holds unsaved changes. While it does, closing it (X,
// Escape, a tap outside or Cancel) first asks "Discard your changes?". Returns the close function for the Cancel button.
export function useModalGuard(dirty: boolean): () => void {
  const guard = useContext(GuardContext);
  useEffect(() => {
    guard?.setDirty(dirty);
    return () => guard?.setDirty(false);
  }, [guard, dirty]);
  return guard?.requestClose ?? (() => undefined);
}

// A pop-up in the middle of the screen over a dimmed page, with an X. Closes with the X, Escape or a tap outside,
// unless `locked` (a request is running). Forms inside it can report unsaved changes with `useModalGuard`.
export function Modal({
  title,
  children,
  locked = false,
  onClose,
}: {
  title: string;
  children: ReactNode;
  locked?: boolean;
  onClose: () => void;
}) {
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const latest = useRef({ dirty, locked, onClose });
  useEffect(() => {
    latest.current = { dirty, locked, onClose };
  });

  const requestClose = useCallback(() => {
    const current = latest.current;
    if (current.locked) return;
    if (current.dirty) setConfirming(true);
    else current.onClose();
  }, []);
  const guard = useMemo(() => ({ setDirty, requestClose }), [requestClose]);

  return (
    <GuardContext.Provider value={guard}>
      <ModalFrame title={title} locked={locked} onClose={requestClose}>
        {children}
      </ModalFrame>
      {confirming && (
        <ConfirmDialog
          title="Discard your changes?"
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          onConfirm={() => {
            setConfirming(false);
            onClose();
          }}
          onCancel={() => setConfirming(false)}
        >
          Your changes won&apos;t be saved.
        </ConfirmDialog>
      )}
    </GuardContext.Provider>
  );
}
