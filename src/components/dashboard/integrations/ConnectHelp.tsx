"use client";

import { useState, type ReactNode } from "react";
import { CheckIcon } from "@/components/icons";
import { Button, Modal } from "@/components/ui";
import { CopyField } from "./CopyField";

export type HelpTab = "claude" | "chatgpt" | "key" | "code";

const TABS: { id: HelpTab; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "chatgpt", label: "ChatGPT" },
  { id: "key", label: "With a key" },
  { id: "code", label: "Claude Code" },
];

// The amber "How to connect" pop-up: every step for each assistant, the buttons to press written as in the
// assistant's own screens, then the fixes for the problems owners actually hit. Keep the button names in step
// with Claude's and ChatGPT's settings screens; they rename them now and then.
export function ConnectHelp({ url, initialTab, onClose }: { url: string; initialTab: HelpTab; onClose: () => void }) {
  const [tab, setTab] = useState<HelpTab>(initialTab);

  return (
    <Modal title="How to connect your AI assistant" wide onClose={onClose}>
      <p className="-mt-2 text-sm text-ink-muted">
        Pick the assistant you use. Each way takes a couple of minutes, on the web, the desktop app or the phone app.
      </p>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which assistant">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-11 cursor-pointer rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors ${
              tab === id ? "border-primary bg-primary text-on-primary" : "border-border-strong bg-surface text-ink hover:bg-surface-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "claude" && (
        <ol className="flex flex-col gap-4">
          <Step n={1} title="Open Claude's connectors.">
            <ButtonPath parts={["Customize", "Connectors", "Add custom connector"]} />
          </Step>
          <Step n={2} title="Fill in two fields.">
            <p>
              Name: <b>Tawilati</b>. Server URL:
            </p>
            <CopyField label="Server URL" value={url} />
          </Step>
          <Step n={3} title="Keep what Claude picks.">
            <p>
              Claude ticks <b>Sign in now</b> and <b>Register automatically</b> for you. Leave Request headers empty and
              press <b>Add</b>.
            </p>
          </Step>
          <Step n={4} title="Press Connect.">
            <p>
              Tawilati opens. Sign in if asked, check it shows your café&apos;s name, then tap <b>Allow</b>.
            </p>
          </Step>
          <Step title="Try it.">
            <p>In a new chat, switch Tawilati on in the tools menu and ask:</p>
            <Example>What&apos;s on my menu today?</Example>
          </Step>
        </ol>
      )}

      {tab === "chatgpt" && (
        <ol className="flex flex-col gap-4">
          <Step n={1} title="Open ChatGPT's plugins.">
            <ButtonPath parts={["Settings", "Plugins", "Browse directory", "Add", "Add custom MCP server"]} />
          </Step>
          <Step n={2} title="Fill in the server.">
            <p>
              Name: <b>Tawilati</b>. Under Connection, keep <b>Server URL</b> and paste:
            </p>
            <CopyField label="Server URL" value={url} />
          </Step>
          <Step n={3} title="Keep OAuth.">
            <p>
              Leave Authentication on <b>OAuth</b>. Tick <b>I understand and want to continue</b>, then press{" "}
              <b>Create as a plugin</b>.
            </p>
          </Step>
          <Step n={4} title="Sign in.">
            <p>
              Tawilati opens. Sign in if asked, check it shows your café&apos;s name, then tap <b>Allow</b>.
            </p>
          </Step>
          <Step title="Try it.">
            <p>In a new chat, ask:</p>
            <Example>Which tables are open right now?</Example>
          </Step>
        </ol>
      )}

      {tab === "key" && (
        <>
          <ol className="flex flex-col gap-4">
            <Step n={1} title="Create a key on this page.">
              <p>
                Under Other ways to connect, press <b>Create a key</b>. Copy it straight away: it&apos;s shown only once.
              </p>
            </Step>
            <Step n={2} title="Add a connector in Claude.">
              <ButtonPath parts={["Customize", "Connectors", "Add custom connector"]} />
              <p>
                Name: <b>Tawilati</b>. Server URL:
              </p>
              <CopyField label="Server URL" value={url} />
            </Step>
            <Step n={3} title="Choose No sign-in.">
              <p>Under Authentication.</p>
            </Step>
            <Step n={4} title="Add the key as a header.">
              <p>
                Press <b>Add header</b>. Name: <b>Authorization</b>. Value: <b>Bearer</b>, a space, then your key. The key
                window gives you this value ready to copy.
              </p>
            </Step>
            <Step title="Press Add.">
              <p>There&apos;s no sign-in step: it works straight away.</p>
            </Step>
          </ol>
          <p className="rounded-xl bg-accent-tint px-4 py-3 text-sm text-accent-ink">
            <b>Treat the key like a password.</b> Anyone who has it can change your menu. If it leaks, revoke it on this page.
          </p>
        </>
      )}

      {tab === "code" && (
        <ol className="flex flex-col gap-4">
          <Step n={1} title="Create a key on this page.">
            <p>The key window shows the command below with your key already in it.</p>
          </Step>
          <Step n={2} title="Paste it in a terminal and press Enter.">
            <pre className="whitespace-pre-wrap break-all rounded-xl bg-ink px-4 py-3 font-mono text-[13px] leading-relaxed text-surface-secondary">
              {`claude mcp add --scope user --transport http tawilati ${url} --header "Authorization: Bearer your-key"`}
            </pre>
          </Step>
          <Step title="Check it.">
            <p>
              Start Claude Code and type <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono">/mcp</code>.
              Tawilati shows as connected.
            </p>
          </Step>
        </ol>
      )}

      <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
        <p className="text-sm font-bold">Not working?</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-muted">
          <li>
            <b className="text-ink">&quot;Couldn&apos;t register&quot;</b>: check the address is exactly {url}.
          </li>
          <li>
            <b className="text-ink">The wrong café on the Allow screen</b>: sign out of Tawilati, sign in as that
            café&apos;s owner, then connect again.
          </li>
          <li>
            <b className="text-ink">The assistant doesn&apos;t use it</b>: switch Tawilati on in the chat&apos;s tools or +
            menu.
          </li>
        </ul>
      </div>

      <div className="flex justify-end">
        <Button block className="sm:w-auto" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}

// One numbered step. Without `n` it's the last one: an amber tick.
function Step({ n, title, children }: { n?: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          n ? "bg-primary text-on-primary" : "bg-accent text-ink"
        }`}
      >
        {n ?? <CheckIcon className="size-4" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1 text-[15px] leading-relaxed">
        <p className="font-semibold">{title}</p>
        {children}
      </div>
    </li>
  );
}

// The buttons to press in the assistant's settings, in order, drawn like buttons.
function ButtonPath({ parts }: { parts: string[] }) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold">
      {parts.map((part, index) => (
        <span key={part} className="flex items-center gap-1.5">
          {index > 0 && (
            <span aria-hidden="true" className="text-ink-muted">
              ›
            </span>
          )}
          <span className="rounded-lg border border-border-strong bg-surface px-3 py-1.5">{part}</span>
        </span>
      ))}
    </p>
  );
}

// Something to type into the assistant, drawn as a chat bubble.
function Example({ children }: { children: ReactNode }) {
  return (
    <p className="self-start rounded-2xl rounded-bl-sm bg-primary-tint px-4 py-2.5 text-sm">&quot;{children}&quot;</p>
  );
}
