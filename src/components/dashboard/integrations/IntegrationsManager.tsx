"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { CheckIcon, CopyIcon, PlusIcon } from "@/components/icons";
import { Button, Card, ConfirmDialog, Modal, StatusBadge, TextField, Toast, useModalGuard } from "@/components/ui";
import { FloatingToast } from "@/components/ui/FloatingToast";
import { ItemMenu } from "../menu/ItemMenu";
import {
  NAME_MAX,
  claudeCodeCommand,
  connectionStatus,
  formatDay,
  integrationSentenceFor,
  integrationsApi,
  mcpUrl,
  type Connection,
  type NewConnection,
} from "./integrationsApi";

// `id` is new for every message, so the same text shown twice restarts its timer.
type Notice = { id: number; tone: "success" | "error"; title: string };

// The owner's AI integrations: keys that let an AI assistant (Claude, for example) work with this business
// through /api/mcp. Create one, copy the key once, revoke it to cut access straight away.
export function IntegrationsManager() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<Connection | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeCount = useRef(0);

  const load = useCallback(async () => {
    try {
      setConnections(await integrationsApi.list());
      setLoadError(null);
    } catch (error) {
      setLoadError(integrationSentenceFor(error));
    }
  }, []);

  useEffect(() => {
    let current = true;
    integrationsApi
      .list()
      .then((list) => current && setConnections(list))
      .catch((error) => current && setLoadError(integrationSentenceFor(error)));
    return () => {
      current = false;
    };
  }, []);

  const notify = useCallback((tone: Notice["tone"], title: string) => {
    setNotice({ id: ++noticeCount.current, tone, title });
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  async function revoke(connection: Connection) {
    setRevokeBusy(true);
    try {
      await integrationsApi.revoke(connection.id);
      notify("success", `${connection.name} can no longer reach your business.`);
    } catch (error) {
      notify("error", integrationSentenceFor(error));
    } finally {
      setRevokeBusy(false);
      setRevoking(null);
      await load();
    }
  }

  const heading = (withAdd = false) => (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">AI integrations</h1>
        {withAdd && (
          <Button
            onClick={() => {
              setNotice(null);
              setCreating(true);
            }}
          >
            <PlusIcon className="size-5" /> New connection
          </Button>
        )}
      </div>
      <p className="text-sm text-ink-muted">
        Let an AI assistant such as Claude look after your menu and tables for you. Each connection has its own key.
      </p>
    </div>
  );

  if (loadError && !connections) {
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
  if (!connections) {
    return (
      <div className="flex flex-col gap-6">
        {heading()}
        <p role="status" className="text-sm text-ink-muted">
          Loading your connections…
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

      <WhatItCanDo />

      {connections.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            No connections yet. Create one, then paste its key into your AI assistant.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {connections.map((connection) => (
            <ConnectionRow
              key={connection.id}
              connection={connection}
              onRevoke={() => {
                setNotice(null);
                setRevoking(connection);
              }}
            />
          ))}
        </ul>
      )}

      {creating && (
        <NewConnectionModal
          onClose={() => setCreating(false)}
          onCreated={() => void load()}
        />
      )}

      {revoking && (
        <ConfirmDialog
          title={`Revoke ${revoking.name}?`}
          confirmLabel="Revoke"
          loading={revokeBusy}
          onConfirm={() => void revoke(revoking)}
          onCancel={() => setRevoking(null)}
        >
          The assistant using this key loses access straight away. This can&apos;t be undone: create a new connection
          if you need one again.
        </ConfirmDialog>
      )}
    </div>
  );
}

// Plain words for what a connected assistant may do, matching the tools in src/lib/mcp/tools.ts.
function WhatItCanDo() {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">What a connected assistant can do</h2>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-ink">It can</p>
          <ul className="list-disc pl-5 text-ink-muted">
            <li>Read your menu, tables, kitchen orders and open tabs</li>
            <li>Add and edit menu items and categories</li>
            <li>Mark items sold out or back in stock</li>
            <li>Add tables, and disable or enable them</li>
            <li>Change the exchange rate and timezone</li>
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-ink">It can&apos;t</p>
          <ul className="list-disc pl-5 text-ink-muted">
            <li>See or change staff accounts</li>
            <li>Take payments or close bills</li>
            <li>Change the status of orders</li>
            <li>See another business&apos;s data</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function ConnectionRow({ connection, onRevoke }: { connection: Connection; onRevoke: () => void }) {
  const status = connectionStatus(connection);
  const active = status === "active";
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl border border-border-subtle p-4 ${
        active ? "bg-surface" : "bg-surface-muted"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={`truncate text-base font-semibold ${active ? "text-ink" : "text-ink-muted"}`}>{connection.name}</p>
        <p className="text-[13px] text-ink-muted">
          Created {formatDay(connection.createdAt)} ·{" "}
          {connection.lastUsedAt ? `Last used ${formatDay(connection.lastUsedAt)}` : "Never used"}
        </p>
        {active && <p className="text-[13px] text-ink-muted">Works until {formatDay(connection.expiresAt)}</p>}
      </div>
      {status === "revoked" && (
        <StatusBadge status="CLOSED" className="shrink-0">
          Revoked
        </StatusBadge>
      )}
      {status === "expired" && (
        <StatusBadge status="DISABLED" className="shrink-0">
          Expired
        </StatusBadge>
      )}
      {active && (
        <div className="-mr-2 shrink-0">
          <ItemMenu itemName={connection.name} actions={[{ danger: true, label: "Revoke", onSelect: onRevoke }]} />
        </div>
      )}
    </li>
  );
}

// Step 1 names the connection. Step 2 shows the key, the only time it can be seen.
function NewConnectionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [created, setCreated] = useState<NewConnection | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <Modal title={created ? "Copy your key now" : "New connection"} locked={saving} onClose={onClose}>
      {created ? (
        <ShowKey connection={created} onDone={onClose} />
      ) : (
        <NameForm
          saving={saving}
          onSubmit={async (name) => {
            setSaving(true);
            try {
              const connection = await integrationsApi.create(name);
              setCreated(connection);
              onCreated();
              return null;
            } catch (error) {
              return integrationSentenceFor(error);
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </Modal>
  );
}

function NameForm({ saving, onSubmit }: { saving: boolean; onSubmit: (name: string) => Promise<string | null> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = useModalGuard(name.trim() !== "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the connection a name, like the assistant or device it's for.");
      return;
    }
    setError(await onSubmit(trimmed));
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={saving} className="contents">
        <TextField
          label="Name"
          autoFocus
          autoComplete="off"
          maxLength={NAME_MAX}
          placeholder="Claude on my laptop"
          value={name}
          error={error ?? undefined}
          hint="So you can tell your connections apart later."
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button variant="ghost" block className="sm:w-auto" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" block className="sm:w-auto" loading={saving}>
            Create key
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function ShowKey({ connection, onDone }: { connection: NewConnection; onDone: () => void }) {
  // Only shown after the owner presses Create, so this never renders on the server and `window` is there.
  const url = mcpUrl(window.location.origin);

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-border-subtle bg-surface-muted px-4 py-3 text-sm text-ink">
        <span className="font-semibold">You won&apos;t see this key again.</span> Copy it now and keep it somewhere safe.
        Anyone with it can change your menu, so don&apos;t share it.
      </p>
      <CopyField label="Key" value={connection.token} />
      <CopyField label="Server address" value={url} />
      <CopyField
        label="Add to Claude Code (paste in a terminal)"
        value={claudeCodeCommand(url, connection.token)}
        multiline
      />
      <p className="text-[13px] text-ink-muted">Works until {formatDay(connection.expiresAt)}.</p>
      <div className="flex justify-end">
        <Button block className="sm:w-auto" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

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
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="flex items-start gap-2">
        <code
          className={`min-w-0 flex-1 select-all rounded-xl border border-border-subtle bg-surface px-3 py-2.5 font-mono text-[13px] text-ink ${
            multiline ? "whitespace-pre-wrap break-all" : "truncate"
          }`}
        >
          {value}
        </code>
        <Button variant="secondary" size="sm" className="min-h-11 shrink-0" onClick={() => void copy()} aria-label={`Copy ${label}`}>
          {copied === "yes" ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
          {copied === "yes" ? "Copied" : "Copy"}
        </Button>
      </div>
      {copied === "failed" && (
        <p className="text-[13px] text-ink-muted">Your browser blocked copying. Select the text and copy it yourself.</p>
      )}
    </div>
  );
}
