import { AlarmClock, Ban, Gauge, Lock } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import team from "@/i18n/messages/team";
import type { TeamMemberMetrics } from "@/lib/data/views";
import { cn } from "@/lib/cn";
import { METRIC_KEYS, type CapacityState } from "./team-model";

/**
 * Member metrics as plain counts (§36.5): no score, no ranking. Definitions
 * sit next to them (§41.1 "Definition of Metrics"), so a number never stands
 * without its meaning.
 */
export function MetricsGrid({ locale, metrics, className }: { locale: Locale; metrics: TeamMemberMetrics; className?: string }) {
  const t = team[locale].metrics;
  return (
    <dl className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      {METRIC_KEYS.map((key) => {
        const breach = key === "slaBreaches" && metrics[key] > 0;
        return (
          <div key={key} className="rounded-md bg-surface-muted px-3 py-2">
            <dt className="text-caption text-fg-muted">{t.labels[key]}</dt>
            <dd className={cn("flex items-center gap-1 text-h2 tabular", breach ? "text-danger-fg" : "text-fg")}>
              {breach ? <AlarmClock aria-hidden className="size-4 shrink-0" /> : null}
              {metrics[key]}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function MetricDefinitions({ locale }: { locale: Locale }) {
  const t = team[locale].metrics;
  return (
    <details className="rounded-md border border-border bg-surface px-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-small font-medium text-fg">{t.definitionsTitle}</summary>
      <dl className="space-y-2 pb-3 text-caption">
        {METRIC_KEYS.map((key) => (
          <div key={key}>
            <dt className="font-semibold text-fg">{t.labels[key]}</dt>
            <dd className="text-fg-muted">{t.definitions[key]}</dd>
          </div>
        ))}
        <p className="text-fg-muted">{t.totalsNote}</p>
      </dl>
    </details>
  );
}

/** "Осталось сегодня: 1 из 6" with a bar; the words carry the state, the bar only repeats it. */
export function CapacityLine({ locale, capacity }: { locale: Locale; capacity: CapacityState }) {
  const t = team[locale].capacity;
  const over = capacity.level === "over";
  const share = capacity.capacity > 0 ? Math.min(1, capacity.used / capacity.capacity) : 1;
  const Icon = over ? Ban : Gauge;
  return (
    <div className="space-y-1">
      <p className={cn("flex items-center gap-1.5 text-small", over ? "font-semibold text-warning-fg" : "text-fg")}>
        <Icon aria-hidden className="size-4 shrink-0" />
        {over
          ? format(t.over, { used: capacity.used, capacity: capacity.capacity })
          : format(t.left, { left: capacity.left, capacity: capacity.capacity })}
      </p>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className={cn("h-full rounded-full", over ? "bg-warning-fg" : capacity.level === "near" ? "bg-info-fg" : "bg-primary")}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** Where metrics would be: says they are hidden and why in one line; the page explains the right needed. */
export function HiddenMetrics({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-small text-fg-muted", className)}>
      <Lock aria-hidden className="size-4 shrink-0" />
      {team[locale].metrics.hidden}
    </p>
  );
}
