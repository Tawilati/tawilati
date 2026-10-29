"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, ConfirmDialog, SelectField, TextField, Toast } from "@/components/ui";
import { FloatingToast } from "@/components/ui/FloatingToast";
import {
  TIMEZONE_OPTIONS,
  formatRate,
  normaliseRate,
  parseRate,
  rateHint,
  settingsApi,
  settingsSentenceFor,
  timezoneLabel,
  type BusinessSettings,
} from "./settingsApi";

// `id` is new for every message, so the same text shown twice restarts its timer.
type Notice = { id: number; tone: "success" | "error"; title: string };

// The owner's settings: the exchange rate (which reprices every LBP menu price) and the business timezone.
export function SettingsManager() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeCount = useRef(0);

  const load = useCallback(async () => {
    try {
      setSettings(await settingsApi.get());
      setLoadError(null);
    } catch (error) {
      setLoadError(settingsSentenceFor(error));
    }
  }, []);

  useEffect(() => {
    let current = true;
    settingsApi
      .get()
      .then((data) => current && setSettings(data))
      .catch((error) => current && setLoadError(settingsSentenceFor(error)));
    return () => {
      current = false;
    };
  }, []);

  const notify = useCallback((tone: Notice["tone"], title: string) => {
    setNotice({ id: ++noticeCount.current, tone, title });
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);
  // Each PATCH returns a full snapshot, which may predate a save in the other card.
  // Merge only the field that this request changed.
  const applySaved = useCallback((patch: Partial<Pick<BusinessSettings, "exchangeRate" | "timezone">>) => {
    setSettings((current) => current ? { ...current, ...patch } : current);
  }, []);

  const heading = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold">Settings</h1>
      {settings && <p className="text-sm text-ink-muted">{settings.name}</p>}
    </div>
  );

  if (loadError && !settings) {
    return (
      <div className="flex flex-col gap-6">
        {heading}
        <Card className="flex flex-col items-start gap-3">
          <Toast tone="error" title={loadError} />
          <Button onClick={() => void load()}>Try again</Button>
        </Card>
      </div>
    );
  }
  if (!settings) {
    return (
      <div className="flex flex-col gap-6">
        {heading}
        <p role="status" className="text-sm text-ink-muted">
          Loading your settings…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
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

      <ExchangeRateCard settings={settings} onSaved={applySaved} notify={notify} />
      <TimezoneCard settings={settings} onSaved={applySaved} notify={notify} />
    </div>
  );
}

type CardProps = {
  settings: BusinessSettings;
  onSaved: (patch: Partial<Pick<BusinessSettings, "exchangeRate" | "timezone">>) => void;
  notify: (tone: Notice["tone"], title: string) => void;
};

function ExchangeRateCard({ settings, onSaved, notify }: CardProps) {
  const current = normaliseRate(settings.exchangeRate);
  const [text, setText] = useState(current);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hint = rateHint(text);
  const parsed = parseRate(text);
  const unchanged = parsed === current;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!parsed) {
      setFormError(hint ?? "Enter how many Lebanese pounds one US dollar is worth.");
      return;
    }
    if (unchanged) return;
    setConfirming(parsed);
  }

  async function save(rate: string) {
    setSaving(true);
    try {
      const updated = await settingsApi.setExchangeRate(rate);
      onSaved({ exchangeRate: updated.exchangeRate });
      setText(normaliseRate(updated.exchangeRate));
      setConfirming(null);
      notify("success", "Exchange rate saved. Menu prices in LBP are updated.");
    } catch (error) {
      const sentence = settingsSentenceFor(error);
      setConfirming(null);
      setFormError(sentence);
      notify("error", sentence);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">Exchange rate</h2>
        <p className="text-sm text-ink-muted">
          Guests see every price in USD and LBP. The LBP price is the USD price times this rate.
        </p>
      </div>

      <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm">
        <span className="text-ink-muted">Current rate: </span>
        <span className="font-semibold tabular-nums text-ink">1 USD = {formatRate(current)} LBP</span>
      </p>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <fieldset disabled={saving} className="contents">
          <TextField
            label="LBP for 1 USD"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            error={hint ?? formError ?? undefined}
            hint="Up to four decimals. Orders already placed keep the price they were sold at."
            className="tabular-nums"
            onChange={(e) => {
              setText(e.target.value);
              setFormError(null);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!parsed || unchanged} loading={saving}>
              Save rate
            </Button>
            {!unchanged && (
              <Button
                variant="ghost"
                onClick={() => {
                  setText(current);
                  setFormError(null);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </fieldset>
      </form>

      {confirming && (
        <ConfirmDialog
          title={`Change the rate to ${formatRate(confirming)} LBP?`}
          confirmLabel="Change rate"
          loading={saving}
          onConfirm={() => void save(confirming)}
          onCancel={() => setConfirming(null)}
        >
          Every LBP price on your menu is recalculated at once, including archived items, and guests see the new prices
          straight away. Orders already placed keep the prices they were sold at.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function TimezoneCard({ settings, onSaved, notify }: CardProps) {
  const [timezone, setTimezone] = useState(settings.timezone);
  const [saving, setSaving] = useState(false);
  const unchanged = timezone === settings.timezone;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (unchanged) return;
    setSaving(true);
    try {
      const updated = await settingsApi.setTimezone(timezone);
      onSaved({ timezone: updated.timezone });
      setTimezone(updated.timezone);
      notify("success", `Timezone set to ${timezoneLabel(updated.timezone)}.`);
    } catch (error) {
      notify("error", settingsSentenceFor(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">Timezone</h2>
        <p className="text-sm text-ink-muted">The daily sales report counts each day from midnight in this timezone.</p>
      </div>
      <form onSubmit={save} className="flex flex-col gap-4">
        <fieldset disabled={saving} className="contents">
          <SelectField label="Timezone" value={timezone} options={TIMEZONE_OPTIONS} onChange={setTimezone} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={unchanged} loading={saving}>
              Save timezone
            </Button>
          </div>
        </fieldset>
      </form>
    </Card>
  );
}
