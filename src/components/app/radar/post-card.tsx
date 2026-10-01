import Link from "next/link";
import { CircleHelp, Copy, ExternalLink, Image as ImageIcon, Send, UserRound } from "lucide-react";
import { textLang } from "@/components/app/inventory/labels";
import { FreshnessBadge } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/misc";
import { format, plural } from "@/i18n/define-messages";
import { formatDateTime, formatRelative } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import radar from "@/i18n/messages/radar";
import type { TelegramListingView } from "@/lib/data/views";
import { cn } from "@/lib/cn";
import { CardActions } from "./card-actions";
import { ConfidenceMeter } from "./confidence-meter";
import { factChips, postTitle } from "./labels";
import { excerpt, parseQuality, postFacts } from "./parse-view";
import { radarPostHref } from "./radar-params";
import { joinList } from "../mls/listing-labels";

/**
 * One Radar post (§22.8): source and time, the raw text, what the parser
 * could read (with Unknown chips for what it could not), the overall parse
 * confidence, a duplicate hint and freshness. The original is one tap away.
 */
export function PostCard({ locale, view, now }: { locale: Locale; view: TelegramListingView; now: Date }) {
  const t = radar[locale];
  const d = domain[locale];
  const { post, source, freshness } = view;
  const facts = postFacts(post.parsed);
  const quality = parseQuality(post.parsed);
  const chips = factChips(locale, post.parsed);
  const titleId = `post-${post.id}-title`;
  const duplicate = post.duplicateCandidates[0];

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card",
        post.status === "hidden" && "opacity-80",
      )}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-muted">
        <span className="inline-flex min-w-0 items-center gap-1 font-medium text-fg">
          <Send aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{source.title}</span>
        </span>
        <span>@{source.handle}</span>
        <time dateTime={post.publishedAt} title={formatDateTime(locale, post.publishedAt)}>
          {format(t.card.published, { time: formatRelative(locale, post.publishedAt, now) })}
        </time>
        {source.status === "paused" ? <Badge tone="warning">{t.card.pausedSource}</Badge> : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <FreshnessBadge locale={locale} freshness={freshness} />
        {post.status !== "new" ? (
          <Badge tone={post.status === "saved" ? "brand" : "neutral"}>{d.telegramStatus[post.status]}</Badge>
        ) : null}
      </div>

      <h2 id={titleId} className="text-body font-semibold text-fg">
        <Link href={radarPostHref(locale, post.id)} className="underline-offset-4 hover:underline">
          {postTitle(locale, facts)}
        </Link>
      </h2>

      <p lang={textLang(post.rawText)} className="text-small text-fg-muted break-words">
        {excerpt(post.rawText)}
      </p>

      <ul className="flex flex-wrap gap-1.5" aria-label={t.detail.normalized}>
        {chips.map((chip) => (
          <li key={chip.key}>
            <Chip className={chip.unknown ? "border border-dashed border-border-strong bg-transparent" : undefined}>
              {chip.unknown ? <CircleHelp aria-hidden className="size-3.5" /> : null}
              {chip.text}
            </Chip>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-caption text-fg-muted">
          {t.confidence.label}: {format(t.confidence.recognized, { n: quality.recognized, total: quality.total })}
        </span>
        <ConfidenceMeter value={quality.score} level={quality.level} labels={t.confidence} />
      </div>

      <ul className="space-y-1 text-caption text-fg-muted">
        <li className="flex items-center gap-1.5">
          <ImageIcon aria-hidden className="size-3.5 shrink-0" />
          {post.mediaCount > 0
            ? format(plural(locale, post.mediaCount, t.card.media), { n: post.mediaCount })
            : t.card.noMedia}
        </li>
        {duplicate ? (
          <li className="flex items-start gap-1.5 text-warning-fg">
            <Copy aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {format(t.card.duplicate, {
              signals: joinList(
                locale,
                duplicate.reasons.map((reason) => d.duplicateSignal[reason]),
              ),
            })}
          </li>
        ) : null}
        {post.linkedClientIds.length > 0 ? (
          <li className="flex items-center gap-1.5">
            <UserRound aria-hidden className="size-3.5 shrink-0" />
            {format(plural(locale, post.linkedClientIds.length, t.card.linked), { n: post.linkedClientIds.length })}
          </li>
        ) : null}
      </ul>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        <ButtonLink href={radarPostHref(locale, post.id)} variant="primary" aria-describedby={titleId}>
          {t.card.open}
        </ButtonLink>
        <ButtonAnchor
          href={post.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          aria-label={`${t.card.originalFull} (${t.card.newTab})`}
        >
          <ExternalLink aria-hidden className="size-4" />
          {t.card.original}
        </ButtonAnchor>
      </div>
      <CardActions
        initialStatus={post.status}
        labels={{
          save: t.actions.save,
          saved: t.actions.saved,
          hide: t.actions.hide,
          hidden: t.actions.hidden,
          unhide: t.actions.unhide,
          reportShort: t.actions.reportShort,
          reported: t.actions.reported,
          undo: t.actions.undo,
          demo: t.actions.demo,
        }}
        describedBy={titleId}
      />
    </article>
  );
}
