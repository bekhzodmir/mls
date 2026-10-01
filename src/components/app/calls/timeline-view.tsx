import Link from "next/link";
import { ArrowRight, ExternalLink, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDateTime } from "@/i18n/format";
import calls from "@/i18n/messages/calls";
import { cn } from "@/lib/cn";
import { textLang } from "@/components/app/inventory/labels";
import { callKindIcon, channelIcon } from "./call-badges";
import { callHref, callKind } from "./call-list";
import type { TimelineEntry } from "./timeline";

/**
 * Communication timeline items (§36.5): channel, direction, time, agent,
 * short result, next step and a link to the call or the original message.
 * The result and the next step are the agent's words and keep their own
 * language (`lang`); originals open in a new tab without an opener.
 */

function directionText(locale: Locale, entry: TimelineEntry): string {
  const t = calls[locale];
  return entry.call ? t.kind[callKind(entry.call)] : t.direction[entry.direction];
}

export function TimelineItem({
  locale,
  entry,
  viewerId,
  /** Hide the "open call" link for the call the page is about. */
  currentCallId,
}: {
  locale: Locale;
  entry: TimelineEntry;
  viewerId: string;
  currentCallId?: string;
}) {
  const t = calls[locale];
  const Icon = entry.call ? callKindIcon[callKind(entry.call)] : channelIcon[entry.channel];
  const channel = t.channel[entry.channel];
  const missed = entry.call?.outcome === "missed";
  return (
    <li className="group relative flex gap-3 pb-5 last:pb-0">
      <span aria-hidden className="absolute top-10 bottom-0 left-5 w-px bg-border group-last:hidden" />
      <span
        aria-hidden
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
          missed ? "bg-danger-bg text-danger-fg" : "bg-surface-muted text-fg-muted",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1 pt-0.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small">
          <span className="font-semibold text-fg">{channel}</span>
          <Badge tone={missed ? "danger" : "neutral"}>{directionText(locale, entry)}</Badge>
          <time dateTime={entry.at} className="text-fg-muted tabular">
            {formatDateTime(locale, entry.at)}
          </time>
        </p>
        {entry.summary ? (
          <p lang={textLang(entry.summary)} className="text-small text-fg">
            {entry.summary}
          </p>
        ) : (
          <p className="text-small text-fg-muted italic">{t.item.noSummary}</p>
        )}
        {entry.nextStep ? (
          <p className="flex items-start gap-1.5 text-small text-fg">
            <ListTodo aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
            <span>
              <span className="text-fg-muted">{t.next.label}: </span>
              <span lang={textLang(entry.nextStep)}>{entry.nextStep}</span>
            </span>
          </p>
        ) : null}
        <p className="text-caption text-fg-muted">
          {format(t.item.agent, { name: entry.agent.id === viewerId ? t.party.you : entry.agent.name })}
        </p>
        {(entry.call && entry.call.id !== currentCallId) || entry.originalUrl ? (
          <div className="flex flex-wrap gap-x-4">
            {entry.call && entry.call.id !== currentCallId ? (
              <Link
                href={callHref(locale, entry.call.id)}
                className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-primary underline-offset-2 hover:underline"
              >
                {t.item.openCall}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            ) : null}
            {entry.originalUrl ? (
              <a
                href={entry.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={format(t.item.originalLabel, { channel })}
                className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-primary underline-offset-2 hover:underline"
              >
                {format(t.item.original, { channel })}
                <ExternalLink aria-hidden className="size-4" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function TimelineList({
  locale,
  entries,
  viewerId,
  currentCallId,
  label,
}: {
  locale: Locale;
  entries: readonly TimelineEntry[];
  viewerId: string;
  currentCallId?: string;
  label?: string;
}) {
  return (
    <ol aria-label={label} className="space-y-0">
      {entries.map((entry) => (
        <TimelineItem
          key={entry.key}
          locale={locale}
          entry={entry}
          viewerId={viewerId}
          currentCallId={currentCallId}
        />
      ))}
    </ol>
  );
}
