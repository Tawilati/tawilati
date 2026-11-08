"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CircleHelpIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TerminalIcon,
  XIcon,
} from "@/components/icons";
import { Button, Card, ConfirmDialog, Modal, TextField, Toast, useModalGuard } from "@/components/ui";
import { FloatingToast } from "@/components/ui/FloatingToast";
import { ConnectHelp, type HelpTab } from "./ConnectHelp";
import { CopyField } from "./CopyField";
import {
  NAME_MAX,
  authorizationHeader,
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

// What the new key is for, so its pop-up shows only that: the header value, or the Claude Code command.
type KeyUse = "header" | "claude-code";

// The owner's AI integrations: connections that let an AI assistant (Claude, ChatGPT) work with this business
// through /api/mcp. The main way in is signing in: paste the address into the assistant, sign in, tap Allow, and
// the connection appears here by itself. For assistants that can't sign in, a key made here goes in a header.
// Revoke cuts either off. The amber "How to connect" button opens every step for each assistant.
export function IntegrationsManager() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState<KeyUse | null>(null);
  const [revoking, setRevoking] = useState<Connection | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [help, setHelp] = useState<HelpTab | null>(null);
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

  function startCreating(use: KeyUse) {
    setNotice(null);
    setCreating(use);
  }

  const heading = (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-[1_1_22rem] flex-col gap-1.5">
        <h1 className="text-2xl font-bold">AI integrations</h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          Chat with your AI assistant, Claude or ChatGPT, to update your menu, mark items sold out or check the
          kitchen. Every connection works only for your business.
        </p>
      </div>
      {connections && (
        <Button variant="accent" block className="sm:w-auto" onClick={() => setHelp("claude")}>
          <CircleHelpIcon className="size-5" /> How to connect
        </Button>
      )}
    </header>
  );

  if (loadError && !connections) {
    return (
      <div className="flex flex-col gap-8">
        {heading}
        <Card className="flex flex-col items-start gap-3">
          <Toast tone="error" title={loadError} />
          <Button onClick={() => void load()}>Try again</Button>
        </Card>
      </div>
    );
  }
  if (!connections) {
    return (
      <div className="flex flex-col gap-8">
        {heading}
        <p role="status" className="text-sm text-ink-muted">
          Loading your connections…
        </p>
      </div>
    );
  }

  // Rendered only once the list has loaded in the browser, so `window` is there.
  const url = mcpUrl(window.location.origin);

  return (
    <div className="flex flex-col gap-8">
      {heading}

      {notice && (
        <FloatingToast
          key={notice.id}
          tone={notice.tone}
          title={notice.title}
          duration={notice.tone === "error" ? 7000 : 3500}
          onDismiss={dismissNotice}
        />
      )}

      <ConnectAssistant url={url} />

      <ConnectionList
        connections={connections}
        onRevoke={(connection) => {
          setNotice(null);
          setRevoking(connection);
        }}
      />

      <WhatItCanDo />

      <OtherWays onCreate={startCreating} onSteps={setHelp} />

      {help && <ConnectHelp url={url} initialTab={help} onClose={() => setHelp(null)} />}

      {creating && (
        <NewConnectionModal url={url} use={creating} onClose={() => setCreating(null)} onCreated={() => void load()} />
      )}

      {revoking && (
        <ConfirmDialog
          title={`Revoke ${revoking.name}?`}
          confirmLabel="Revoke"
          loading={revokeBusy}
          onConfirm={() => void revoke(revoking)}
          onCancel={() => setRevoking(null)}
        >
          The assistant using this connection loses access straight away. This can&apos;t be undone: connect again if you
          need it back.
        </ConfirmDialog>
      )}
    </div>
  );
}

type Assistant = "claude" | "chatgpt";

// Three short steps per assistant; the "How to connect" pop-up has the long version.
const QUICK_STEPS: Record<Assistant, ReactNode[]> = {
  claude: [
    <>
      In Claude, open <b>Customize</b>, then <b>Connectors</b>, then <b>Add custom connector</b>.
    </>,
    <>
      Name it <b>Tawilati</b> and paste the address below. Keep the options Claude picks and press <b>Add</b>.
    </>,
    <>
      Press <b>Connect</b>, sign in to Tawilati and tap <b>Allow</b>. It shows up below.
    </>,
  ],
  chatgpt: [
    <>
      In ChatGPT, open <b>Settings</b>, then <b>Plugins</b>, then <b>Browse directory</b>. Press <b>Add</b>, then{" "}
      <b>Add custom MCP server</b>.
    </>,
    <>
      Name it <b>Tawilati</b> and paste the address below as the Server URL. Keep <b>OAuth</b> and tick{" "}
      <b>I understand and want to continue</b>.
    </>,
    <>
      Press <b>Create as a plugin</b>, sign in to Tawilati and tap <b>Allow</b>. It shows up below.
    </>,
  ],
};

// The main way in, on a forest-green box: pick the assistant, follow three steps, paste one address.
function ConnectAssistant({ url }: { url: string }) {
  const [assistant, setAssistant] = useState<Assistant>("claude");

  return (
    <section
      aria-labelledby="connect-title"
      className="flex flex-col gap-6 rounded-2xl bg-primary p-5 text-surface-secondary sm:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-accent">Recommended · about 2 minutes</p>
          <h2 id="connect-title" className="text-[22px] font-bold leading-tight">
            Connect your AI assistant
          </h2>
          <p className="text-[15px] leading-relaxed opacity-90">You sign in once and tap Allow. Nothing to copy except one address.</p>
        </div>
        {/* A pill switch, like "Split the bill": the chosen assistant sits in a cream pill. */}
        <div
          className="grid w-full grid-cols-2 gap-1 rounded-full bg-[rgb(248_245_236/0.12)] p-1 sm:w-auto"
          role="group"
          aria-label="Which assistant"
        >
          {(["claude", "chatgpt"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={assistant === option}
              onClick={() => setAssistant(option)}
              className={`min-h-11 cursor-pointer rounded-full px-5 text-sm font-semibold transition-colors ${
                assistant === option ? "bg-surface-secondary text-primary" : "text-surface-secondary hover:bg-primary-hover"
              }`}
            >
              {option === "claude" ? "Claude" : "ChatGPT"}
            </button>
          ))}
        </div>
      </div>

      <ol className="grid gap-3 md:grid-cols-3">
        {QUICK_STEPS[assistant].map((step, index) => (
          <li
            key={`${assistant}-${index}`}
            className="flex gap-3 rounded-xl border border-[rgb(248_245_236/0.16)] bg-[rgb(248_245_236/0.08)] p-4 md:flex-col"
          >
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-ink"
            >
              {index + 1}
            </span>
            <p className="text-sm leading-relaxed">{step}</p>
          </li>
        ))}
      </ol>

      <CopyField label="Address to paste" value={url} button="accent" />
    </section>
  );
}

function ConnectionList({ connections, onRevoke }: { connections: Connection[]; onRevoke: (connection: Connection) => void }) {
  const active = connections.filter((connection) => connectionStatus(connection) === "active").length;

  return (
    <section aria-labelledby="connections-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="connections-title" className="text-xl font-bold">
          Your connections
        </h2>
        {connections.length > 0 && (
          <p className="text-sm text-ink-muted">
            {active} active{connections.length > active ? ` · ${connections.length - active} no longer working` : ""}
          </p>
        )}
      </div>
      <ul className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
        {connections.length === 0 ? (
          <li className="px-5 py-4 text-sm text-ink-muted">
            No connections yet. Connect your assistant with the steps above, and it appears here.
          </li>
        ) : (
          connections.map((connection) => (
            <ConnectionRow key={connection.id} connection={connection} onRevoke={() => onRevoke(connection)} />
          ))
        )}
        <li className="flex items-start gap-2.5 bg-[var(--brand-secondary-tint)] px-5 py-3.5 text-sm text-primary">
          <ShieldCheckIcon className="mt-px size-5 shrink-0" />
          Each connection sees only your business. Revoke cuts it off straight away.
        </li>
      </ul>
    </section>
  );
}

function ConnectionRow({ connection, onRevoke }: { connection: Connection; onRevoke: () => void }) {
  const status = connectionStatus(connection);
  const active = status === "active";
  const signedIn = connection.source === "sign-in";

  return (
    <li
      className={`flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border-subtle px-5 py-4 ${
        active ? "" : "bg-surface-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
          active ? (signedIn ? "bg-primary-tint text-primary" : "bg-accent-tint text-accent-ink") : "bg-surface-secondary text-ink-muted"
        }`}
      >
        {signedIn ? <SparklesIcon className="size-5" /> : <KeyRoundIcon className="size-5" />}
      </span>
      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={`truncate text-base font-semibold ${active ? "text-ink" : "text-ink-muted"}`}>{connection.name}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
              signedIn ? "bg-primary-tint text-primary" : "bg-accent-tint text-accent-ink"
            }`}
          >
            {signedIn ? "Signed in" : "Key"}
          </span>
        </p>
        <p className="text-[13px] text-ink-muted">
          {connection.lastUsedAt ? `Last used ${formatDay(connection.lastUsedAt)}` : "Never used"} ·{" "}
          {active ? `Works until ${formatDay(connection.expiresAt)}` : `Created ${formatDay(connection.createdAt)}`}
        </p>
      </div>
      {active ? (
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
            <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
            Active
          </span>
          <button
            type="button"
            onClick={onRevoke}
            aria-label={`Revoke ${connection.name}`}
            className="min-h-11 cursor-pointer rounded-[10px] border border-border-strong bg-surface px-3.5 text-sm font-semibold text-danger hover:bg-danger-tint"
          >
            Revoke
          </button>
        </div>
      ) : (
        <span className="rounded-full border border-border-strong px-3 py-1 text-[13px] font-semibold text-ink-muted">
          {status === "revoked" ? "Revoked" : "Expired"}
        </span>
      )}
    </li>
  );
}

// Plain words for what a connected assistant may do, matching the tools in src/lib/mcp/tools.ts.
// Closed at first: the steps to connect matter more on this screen.
function WhatItCanDo() {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="can-do"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-3.5 px-5 py-4 text-left hover:bg-surface-secondary"
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-secondary-tint)] text-primary">
          <ShieldCheckIcon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">What can a connected assistant do?</span>
          <span className="text-[13px] text-ink-muted">What it may change, and what stays off limits</span>
        </span>
        <span className="hidden text-sm font-semibold text-primary sm:inline">{open ? "Hide" : "Show"}</span>
        <ChevronDownIcon className={`size-5 shrink-0 text-primary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id="can-do" className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
          <AbilityList
            title="It can"
            allowed
            items={[
              "Read your menu, tables, kitchen orders and open tabs",
              "Add and edit menu items and categories",
              "Mark items sold out or back in stock",
              "Add tables, and turn them off or on",
              "Change the exchange rate and timezone",
            ]}
          />
          <AbilityList
            title="It can't"
            items={[
              "See or change staff accounts",
              "Take payments or close bills",
              "Change the status of orders",
              "See another business's data",
            ]}
          />
        </div>
      )}
    </section>
  );
}

function AbilityList({ title, items, allowed = false }: { title: string; items: string[]; allowed?: boolean }) {
  const Mark = allowed ? CheckIcon : XIcon;
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-secondary p-4">
      <p className={`text-[12px] font-semibold uppercase tracking-[0.12em] ${allowed ? "text-primary" : "text-ink-muted"}`}>{title}</p>
      <ul className={`flex flex-col gap-2.5 text-sm ${allowed ? "text-ink" : "text-ink-muted"}`}>
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <Mark className={`mt-px size-[18px] shrink-0 ${allowed ? "text-primary" : ""}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// For assistants that can't sign in: a key made here. Each card's key pop-up ends with what that way needs.
function OtherWays({ onCreate, onSteps }: { onCreate: (use: KeyUse) => void; onSteps: (tab: HelpTab) => void }) {
  return (
    <section aria-labelledby="other-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="other-title" className="text-xl font-bold">
          Other ways to connect
        </h2>
        <p className="text-sm text-ink-muted">For assistants that can&apos;t sign in. You create a key here and paste it once.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <OtherWay
          icon={<KeyRoundIcon className="size-5" />}
          iconClassName="bg-accent-tint text-accent-ink"
          title="Any assistant, with a key"
          text='For assistants that let you add a header, like Claude with "No sign-in".'
          onCreate={() => onCreate("header")}
          onSteps={() => onSteps("key")}
        />
        <OtherWay
          icon={<TerminalIcon className="size-5" />}
          iconClassName="bg-surface-muted text-ink"
          title="Claude Code"
          text="For developers: one command in a terminal adds Tawilati."
          onCreate={() => onCreate("claude-code")}
          onSteps={() => onSteps("code")}
        />
      </div>
    </section>
  );
}

function OtherWay({
  icon,
  iconClassName,
  title,
  text,
  onCreate,
  onSteps,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  text: string;
  onCreate: () => void;
  onSteps: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <span aria-hidden="true" className={`flex size-10 items-center justify-center rounded-[10px] ${iconClassName}`}>
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-ink-muted">{text}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="min-h-11" onClick={onCreate}>
          Create a key
        </Button>
        <button
          type="button"
          onClick={onSteps}
          className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Steps
        </button>
      </div>
    </Card>
  );
}

// Step 1 names the connection. Step 2 shows the key, the only time it can be seen.
function NewConnectionModal({
  url,
  use,
  onClose,
  onCreated,
}: {
  url: string;
  use: KeyUse;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [created, setCreated] = useState<NewConnection | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <Modal title={created ? "Copy your key now" : "Create a key"} locked={saving} onClose={onClose}>
      {created ? (
        <ShowKey url={url} use={use} connection={created} onDone={onClose} />
      ) : (
        <NameForm
          placeholder={use === "claude-code" ? "Claude Code on my laptop" : "Claude on my laptop"}
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

function NameForm({
  placeholder,
  saving,
  onSubmit,
}: {
  placeholder: string;
  saving: boolean;
  onSubmit: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = useModalGuard(name.trim() !== "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the key a name, like the assistant or device it's for.");
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
          placeholder={placeholder}
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

function ShowKey({ url, use, connection, onDone }: { url: string; use: KeyUse; connection: NewConnection; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-accent-tint px-4 py-3 text-sm text-accent-ink">
        <span className="font-semibold">You won&apos;t see this again.</span> Copy it now. Anyone with this key can change
        your menu, so don&apos;t share it.
      </p>
      {use === "header" ? (
        <>
          <p className="text-sm text-ink-muted">
            In your assistant, set the Server URL to <span className="font-semibold text-ink">{url}</span>, choose no
            sign-in, and add a header named <span className="font-semibold text-ink">Authorization</span> with this value:
          </p>
          <CopyField label="Header value" value={authorizationHeader(connection.token)} multiline />
        </>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            Paste this in a terminal and press Enter. Then start Claude Code and type{" "}
            <span className="font-semibold text-ink">/mcp</span> to check Tawilati is connected.
          </p>
          <CopyField label="Command" value={claudeCodeCommand(url, connection.token)} multiline />
        </>
      )}
      <p className="text-[13px] text-ink-muted">Works until {formatDay(connection.expiresAt)}.</p>
      <div className="flex justify-end">
        <Button block className="sm:w-auto" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
