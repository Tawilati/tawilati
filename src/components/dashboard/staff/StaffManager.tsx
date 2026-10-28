"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlusIcon } from "@/components/icons";
import { Button, Card, ConfirmDialog, Modal, StatusBadge, Toast } from "@/components/ui";
import { FloatingToast } from "@/components/ui/FloatingToast";
import { ItemMenu } from "../menu/ItemMenu";
import { StaffForm } from "./StaffForm";
import { roleLabel, staffApi, staffSentenceFor, type NewStaff, type StaffMember } from "./staffApi";

// `id` is new for every message, so the same text shown twice restarts its timer.
type Notice = { id: number; tone: "success" | "error"; title: string };

// The owner's staff screen: waiter and kitchen accounts, with add, edit, deactivate and reactivate.
export function StaffManager() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<StaffMember | null>(null);
  const [workingOn, setWorkingOn] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeCount = useRef(0);
  const [mutating, setMutating] = useState(false);
  const mutationLock = useRef(false);

  const load = useCallback(async () => {
    try {
      setStaff(await staffApi.list());
      setLoadError(null);
    } catch (error) {
      setLoadError(staffSentenceFor(error));
    }
  }, []);

  useEffect(() => {
    let current = true;
    staffApi
      .list()
      .then((list) => current && setStaff(list))
      .catch((error) => current && setLoadError(staffSentenceFor(error)));
    return () => {
      current = false;
    };
  }, []);

  // Runs one change, reloads the list, and reports the outcome. Returns the error sentence, or null when it worked.
  async function run(action: () => Promise<unknown>, done: string): Promise<string | null> {
    if (mutationLock.current) return "Please wait for the current change to finish.";
    mutationLock.current = true;
    setMutating(true);
    try {
      await action();
      setNotice({ id: ++noticeCount.current, tone: "success", title: done });
      await load();
      return null;
    } catch (error) {
      const sentence = staffSentenceFor(error);
      setNotice({ id: ++noticeCount.current, tone: "error", title: sentence });
      return sentence;
    } finally {
      mutationLock.current = false;
      setMutating(false);
    }
  }

  async function save(input: NewStaff): Promise<string | null> {
    const current = editing;
    const error =
      current && current !== "new"
        ? await run(() => staffApi.update(current.id, { name: input.name, role: input.role }), "Changes saved")
        : await run(() => staffApi.add(input), "Staff member added");
    if (!error) setEditing(null);
    return error;
  }

  async function setActive(member: StaffMember, isActive: boolean) {
    setWorkingOn(member.id);
    const error = await run(
      () => staffApi.update(member.id, { isActive }),
      isActive ? `${member.name} can sign in again` : `${member.name} can no longer sign in`,
    );
    setWorkingOn(null);
    if (!error) setDeactivating(null);
  }

  const dismissNotice = useCallback(() => setNotice(null), []);

  const heading = (withAdd = false) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">Staff</h1>
      {withAdd && (
        <Button
          disabled={mutating || !!loadError}
          onClick={() => {
            setNotice(null);
            setEditing("new");
          }}
        >
          <PlusIcon className="size-5" /> Add staff
        </Button>
      )}
    </div>
  );

  if (loadError && !staff) {
    return (
      <div className="flex flex-col gap-6">
        {heading()}
        <Card className="flex flex-col items-start gap-3">
          <Toast tone="error" title={loadError} />
          <Button onClick={() => void load()}>Try again</Button>
        </Card>
      </div>
    );
  }
  if (!staff) {
    return (
      <div className="flex flex-col gap-6">
        {heading()}
        <p role="status" className="text-sm text-ink-muted">
          Loading your staff…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {heading(true)}

      {notice && (
        <FloatingToast
          key={notice.id}
          tone={notice.tone}
          title={notice.title}
          duration={notice.tone === "error" ? 7000 : 3500}
          onDismiss={dismissNotice}
        />
      )}

      {loadError && (
        <Card className="flex flex-col items-start gap-3">
          <Toast
            tone="error"
            title={`Your last change may already be saved. Refresh the list before making another change. ${loadError}`}
          />
          <Button onClick={() => void load()}>Refresh list</Button>
        </Card>
      )}

      <fieldset disabled={mutating || !!loadError} className="contents">
        {deactivating && (
          <ConfirmDialog
            title={`Deactivate ${deactivating.name}?`}
            confirmLabel="Deactivate"
            loading={workingOn === deactivating.id}
            onConfirm={() => setActive(deactivating, false)}
            onCancel={() => setDeactivating(null)}
          >
            They won&apos;t be able to sign in any more. You can reactivate them later.
          </ConfirmDialog>
        )}

        {editing && (
          <Modal title={editing === "new" ? "Add staff member" : "Edit staff member"} onClose={() => setEditing(null)}>
            <StaffForm
              member={editing === "new" ? null : editing}
              onSave={save}
              onCancel={() => setEditing(null)}
            />
          </Modal>
        )}

        {staff.length === 0 && (
          <Card>
            <p className="text-sm text-ink-muted">
              No staff yet. Add a waiter or someone for the kitchen, and they can sign in with the email and password you set.
            </p>
          </Card>
        )}

        <ul className="flex flex-col gap-2.5">
          {staff.map((member) => (
            <li
              key={member.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border-subtle p-4 ${
                member.isActive ? "bg-surface" : "bg-surface-muted"
              }`}
            >
              <div className="flex min-w-0 flex-1 basis-44 flex-col gap-0.5">
                <p className={`truncate text-base font-semibold ${member.isActive ? "text-ink" : "text-ink-muted"}`}>
                  {member.name}
                </p>
                <p className="truncate text-[13px] text-ink-muted">{member.email}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[13px] font-semibold leading-snug ${
                    member.role === "WAITER" ? "bg-primary text-on-primary" : "bg-[var(--brand-accent)] text-ink"
                  }`}>
                  {roleLabel(member.role)}
                </span>
                {!member.isActive && (
                  <StatusBadge status="CLOSED" className="shrink-0">
                    Inactive
                  </StatusBadge>
                )}
                <div className="-mr-2">
                  <ItemMenu
                    itemName={member.name}
                    actions={
                      member.isActive
                        ? [
                            {
                              label: "Edit",
                              onSelect: () => {
                                setNotice(null);
                                setEditing(member);
                              },
                            },
                            {
                              danger: true,
                              label: "Deactivate",
                              onSelect: () => {
                                setNotice(null);
                                setDeactivating(member);
                              },
                            },
                          ]
                        : [{ label: "Reactivate", onSelect: () => void setActive(member, true) }]
                    }
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  );
}
