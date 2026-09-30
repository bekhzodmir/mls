import { CirclePause, Radio, Radar as RadarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "@/i18n/define-messages";
import { formatDateTime, formatRelative } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import radar from "@/i18n/messages/radar";
import type { TelegramSource } from "@/lib/domain/types";

/**
 * Coverage note (§7.2, §39.4, §41 D1): the canonical wording — more than
 * 10,000 listings from a large pool of Telegram sources — with no channel
 * count and no claim of exhaustive coverage, plus the demo's source registry
 * with each source's status and last check.
 */
export function SourceRegistry({ locale, sources, now }: { locale: Locale; sources: TelegramSource[]; now: Date }) {
  const t = radar[locale].coverage;
  return (
    <section aria-labelledby="radar-coverage" className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <h2 id="radar-coverage" className="flex items-center gap-2 text-body font-semibold text-fg">
        <RadarIcon aria-hidden className="size-4 text-primary" />
        {t.title}
      </h2>
      <p className="text-small text-fg-muted">{t.text}</p>
      <p className="text-small font-medium text-fg">{t.demo}</p>
      <ul className="space-y-3">
        {sources.map((source) => (
          <li key={source.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-small font-medium text-fg">{source.title}</span>
              <Badge
                tone={source.status === "enabled" ? "success" : "warning"}
                icon={source.status === "enabled" ? Radio : CirclePause}
              >
                {t.status[source.status]}
              </Badge>
            </div>
            <p className="text-caption text-fg-muted">
              @{source.handle} ·{" "}
              <time dateTime={source.lastCheckedAt} title={formatDateTime(locale, source.lastCheckedAt)}>
                {format(t.checked, { time: formatRelative(locale, source.lastCheckedAt, now) })}
              </time>
            </p>
            {source.status === "paused" ? <p className="text-caption text-warning-fg">{t.paused}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
