"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { DownloadIcon, PlusIcon, PrinterIcon, QrIcon } from "@/components/icons";
import {
  Button,
  buttonClassName,
  Card,
  ConfirmDialog,
  Modal,
  StatusBadge,
  TextField,
  Toast,
  useModalGuard,
} from "@/components/ui";
import { FloatingToast } from "@/components/ui/FloatingToast";
import { ItemMenu } from "../menu/ItemMenu";
import { downloadSticker, tableSentenceFor, tablesApi, type DiningTable } from "./tablesApi";

// `id` is new for every message, so the same text shown twice restarts its timer.
type Notice = { id: number; tone: "success" | "error"; title: string };

// The owner's tables screen: add, rename, disable and enable tables, and download or print their QR stickers.
export function TablesManager() {
  const [tables, setTables] = useState<DiningTable[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DiningTable | "new" | null>(null);
  const [disabling, setDisabling] = useState<DiningTable | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeCount = useRef(0);
  const [mutating, setMutating] = useState(false);
  const mutationLock = useRef(false);

  const load = useCallback(async () => {
    try {
      setTables(await tablesApi.list());
      setLoadError(null);
    } catch (error) {
      setLoadError(tableSentenceFor(error));
    }
  }, []);

  useEffect(() => {
    let current = true;
    tablesApi
      .list()
      .then((list) => current && setTables(list))
      .catch((error) => current && setLoadError(tableSentenceFor(error)));
    return () => {
      current = false;
    };
  }, []);

  const notify = (tone: Notice["tone"], title: string) => setNotice({ id: ++noticeCount.current, tone, title });

  // Runs one change, reloads the list, and reports the outcome. Returns the error sentence, or null when it worked.
  async function run(action: () => Promise<unknown>, done: string): Promise<string | null> {
    if (mutationLock.current) return "Please wait for the current change to finish.";
    mutationLock.current = true;
    setMutating(true);
    try {
      await action();
      notify("success", done);
      await load();
      return null;
    } catch (error) {
      const sentence = tableSentenceFor(error);
      notify("error", sentence);
      return sentence;
    } finally {
      mutationLock.current = false;
      setMutating(false);
    }
  }

  async function save(label: string): Promise<string | null> {
    const current = editing;
    const error =
      current && current !== "new"
        ? await run(() => tablesApi.rename(current.id, label), "Table renamed")
        : await run(() => tablesApi.add(label), `${label} added. Download its sticker to print it.`);
    if (!error) setEditing(null);
    return error;
  }

  async function setDisabled(table: DiningTable, isDisabled: boolean) {
    const error = await run(
      () => (isDisabled ? tablesApi.disable(table.id) : tablesApi.enable(table.id)),
      isDisabled ? `${table.label} is no longer taking orders` : `${table.label} is taking orders again`,
    );
    if (!error) setDisabling(null);
  }

  async function download(table: DiningTable) {
    setDownloading(table.id);
    try {
      await downloadSticker(table);
    } catch (error) {
      notify("error", tableSentenceFor(error));
    } finally {
      setDownloading(null);
    }
  }

  const dismissNotice = useCallback(() => setNotice(null), []);
  // Print all only lists tables that take orders, so it needs at least one.
  const canPrint = !!tables?.some((table) => !table.isDisabled);

  const heading = (withActions = false) => (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-xl flex-col gap-1">
        <h1 className="text-2xl font-bold">Tables</h1>
        <p className="text-[15px] text-ink-muted">
          Each table has its own QR code. Guests scan it to see the menu and order from their table.
        </p>
      </div>
      {withActions && (
        <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto">
          {canPrint && (
            <Link href="/dashboard/tables/print" className={buttonClassName({ variant: "secondary" })}>
              <PrinterIcon className="size-5" />
              {/* One text box, so the button's gap doesn't split "Print all" from "stickers". */}
              <span>
                Print all<span className="hidden sm:inline"> stickers</span>
              </span>
            </Link>
          )}
          <Button
            disabled={mutating || !!loadError}
            className={canPrint ? undefined : "col-span-2"}
            onClick={() => {
              setNotice(null);
              setEditing("new");
            }}
          >
            <PlusIcon className="size-5" /> Add table
          </Button>
        </div>
      )}
    </div>
  );

  if (loadError && !tables) {
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
  if (!tables) {
    return (
      <div className="flex flex-col gap-6">
        {heading()}
        <p role="status" className="text-sm text-ink-muted">
          Loading your tables…
        </p>
      </div>
    );
  }

  // "2 tables · 1 disabled": the tables taking orders, then the disabled ones.
  const disabledCount = tables.filter((table) => table.isDisabled).length;
  const activeCount = tables.length - disabledCount;

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
        {disabling && (
          <ConfirmDialog
            title={`Disable ${disabling.label}?`}
            confirmLabel="Disable"
            loading={mutating}
            onConfirm={() => setDisabled(disabling, true)}
            onCancel={() => setDisabling(null)}
          >
            Guests who scan its QR code will be told this table isn&apos;t taking orders. You can enable it again any
            time.
          </ConfirmDialog>
        )}

        {editing && (
          <Modal title={editing === "new" ? "Add table" : `Rename ${editing.label}`} locked={mutating} onClose={() => setEditing(null)}>
            <LabelForm table={editing === "new" ? null : editing} busy={mutating} onSave={save} />
          </Modal>
        )}

        {tables.length === 0 ? (
          <Card>
            <p className="text-sm text-ink-muted">
              No tables yet. Add your first table, then download its QR sticker and put it on the table.
            </p>
          </Card>
        ) : (
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-secondary-ink">
            {activeCount} {activeCount === 1 ? "table" : "tables"}
            {disabledCount > 0 && (
              <>
                {" · "}
                <span className="text-[var(--color-warning)]">{disabledCount} disabled</span>
              </>
            )}
          </p>
        )}

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] sm:gap-4">
          {tables.map((table) => (
            <li
              key={table.id}
              className={`flex flex-col gap-3.5 rounded-2xl border border-border-subtle p-4 ${
                table.isDisabled ? "bg-surface-muted" : "bg-surface"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className={`flex size-14 shrink-0 items-center justify-center rounded-[10px] ${
                    table.isDisabled ? "bg-surface text-ink-muted" : "bg-primary-tint text-primary"
                  }`}
                >
                  <QrIcon className="size-7" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <p className={`max-w-full truncate text-xl font-bold ${table.isDisabled ? "text-ink-muted" : "text-ink"}`}>
                    {table.label}
                  </p>
                  {table.isDisabled ? (
                    <StatusBadge status="DISABLED" />
                  ) : (
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-success)]">
                      <span aria-hidden="true" className="size-2 rounded-full bg-[var(--color-success)]" />
                      Taking orders
                    </p>
                  )}
                </div>
                <div className="-mr-2 -mt-2 self-start">
                  <ItemMenu
                    itemName={table.label}
                    actions={[
                      {
                        label: "Rename",
                        onSelect: () => {
                          setNotice(null);
                          setEditing(table);
                        },
                      },
                      table.isDisabled
                        ? { label: "Enable", onSelect: () => void setDisabled(table, false) }
                        : {
                            danger: true,
                            label: "Disable",
                            onSelect: () => {
                              setNotice(null);
                              setDisabling(table);
                            },
                          },
                    ]}
                  />
                </div>
              </div>
              {table.isDisabled ? (
                <p className="flex min-h-11 items-center text-[13px] text-ink-muted">
                  Guests who scan this code can&apos;t order. Enable it from the menu.
                </p>
              ) : (
                <Button
                  variant="secondary"
                  block
                  loading={downloading === table.id}
                  onClick={() => void download(table)}
                >
                  <DownloadIcon className="size-[18px]" /> Download sticker
                </Button>
              )}
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  );
}

// The name field of the add and rename pop-ups.
function LabelForm({
  table,
  busy,
  onSave,
}: {
  table: DiningTable | null;
  busy: boolean;
  onSave: (label: string) => Promise<string | null>;
}) {
  const initialLabel = table?.label ?? "";
  const [label, setLabel] = useState(initialLabel);
  const [error, setError] = useState<string>();
  const requestClose = useModalGuard(label !== initialLabel);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!label.trim()) return setError("Enter a table name, like T7 or Terrace 3.");
    if (table && label.trim() === table.label) return requestClose();
    setError((await onSave(label.trim())) ?? undefined);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextField
        label="Table name"
        value={label}
        error={error}
        hint={
          table
            ? "The printed QR code keeps working. Download a new sticker if you want the new name on it."
            : "Short names work best, like T7, Terrace 3 or Bar 2. Guests see it when they scan."
        }
        maxLength={50}
        placeholder="T7"
        autoFocus
        onChange={(e) => {
          setLabel(e.target.value);
          setError(undefined);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy}>
          {table ? "Save" : "Add table"}
        </Button>
        <Button variant="ghost" onClick={requestClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
