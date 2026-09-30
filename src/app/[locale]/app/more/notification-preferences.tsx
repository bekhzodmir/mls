"use client";

import { useId, useState } from "react";
import { BellRing, Lock, Moon } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import more from "@/i18n/messages/more";
import type { NotificationCategory } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

const categories: readonly NotificationCategory[] = ["action", "clients", "matches", "deals", "system"];

type Preferences = Record<NotificationCategory, boolean>;

const defaults: Preferences = { action: true, clients: true, matches: true, deals: true, system: true };

function Switch({
  checked,
  disabled,
  labelledBy,
  describedBy,
  onChange,
  stateLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  labelledBy: string;
  describedBy: string;
  onChange?: () => void;
  stateLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onChange}
      className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-1 disabled:cursor-not-allowed"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full border transition-colors",
          checked ? "border-primary bg-primary" : "border-border-strong bg-surface-sunken",
          disabled && "opacity-70",
        )}
      >
        <span
          className={cn(
            "absolute size-5 rounded-full bg-surface shadow-card transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
      {/* The state is also written out, so it never depends on colour or knob position. */}
      <span className="w-24 text-left text-caption leading-tight font-medium text-fg-muted">{stateLabel}</span>
    </button>
  );
}

/**
 * Notification preferences (§36.4, §36.5) — UI only. Toggles change local
 * state and say they are not saved; security events are mandatory and
 * cannot be switched off.
 */
export function NotificationPreferences({ locale }: { locale: Locale }) {
  const t = more[locale].notifications;
  const d = domain[locale];
  const baseId = useId();
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const changed = categories.some((category) => prefs[category] !== defaults[category]);

  return (
    <div className="space-y-3">
      <Notice kind="warning" title={t.demoTitle}>
        {t.demo}
      </Notice>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {categories.map((category) => {
          const labelId = `${baseId}-${category}`;
          return (
            <li key={category} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="min-w-0 py-1">
                <p id={labelId} className="text-small font-semibold text-fg">
                  {d.notificationCategory[category]}
                </p>
                <p id={`${labelId}-hint`} className="text-caption text-fg-muted">
                  {t.categoryHint[category]}
                </p>
              </div>
              <Switch
                checked={prefs[category]}
                labelledBy={labelId}
                describedBy={`${labelId}-hint`}
                stateLabel={prefs[category] ? t.on : t.off}
                onChange={() => setPrefs((current) => ({ ...current, [category]: !current[category] }))}
              />
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-3 bg-surface-muted/50 px-4 py-2">
          <div className="min-w-0 py-1">
            <p id={`${baseId}-security`} className="flex items-center gap-1.5 text-small font-semibold text-fg">
              <Lock aria-hidden className="size-3.5" />
              {t.security}
            </p>
            <p id={`${baseId}-security-hint`} className="text-caption text-fg-muted">
              {t.securityHint}
            </p>
          </div>
          <Switch
            checked
            disabled
            labelledBy={`${baseId}-security`}
            describedBy={`${baseId}-security-hint`}
            stateLabel={t.alwaysOn}
          />
        </li>
      </ul>
      <p className="flex items-start gap-2 text-caption text-fg-muted">
        <Moon aria-hidden className="mt-px size-3.5 shrink-0" />
        {t.quietHours}
      </p>
      <p role="status" aria-live="polite" className="flex items-start gap-2 text-caption font-medium text-warning-fg">
        {changed ? (
          <>
            <BellRing aria-hidden className="mt-px size-3.5 shrink-0" />
            {t.changed}
          </>
        ) : null}
      </p>
    </div>
  );
}
