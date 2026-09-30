import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ExternalLink, Info, UserRound } from "lucide-react";
import { requirementLine } from "@/components/app/mls/cooperation-labels";
import { DuplicateList } from "@/components/app/radar/duplicate-list";
import {
  duplicateListLabels,
  fieldListLabels,
  postDuplicates,
  postTitle,
  subscriptionText,
} from "@/components/app/radar/labels";
import { ConfidenceMeter } from "@/components/app/radar/confidence-meter";
import { ParsedFieldList } from "@/components/app/radar/parsed-field-list";
import { MIN_PARSE_CONFIDENCE, confidencePercent, parseQuality, postFacts } from "@/components/app/radar/parse-view";
import { PostActions } from "@/components/app/radar/post-actions";
import { convertHref, radarHref } from "@/components/app/radar/radar-params";
import { PageHeader } from "@/components/app/page-header";
import { BandBadge, FreshnessBadge, SourceBadge } from "@/components/domain/badges";
import { MatchReasons, summarizeMatch } from "@/components/domain/match-explanation";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { format, plural } from "@/i18n/define-messages";
import { formatDateTime, formatRelative } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import radar from "@/i18n/messages/radar";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadTelegramListing } from "@/lib/data/cached";
import { listClients, listListings, listTelegramListings } from "@/lib/data/repository";
import { needsAttention } from "@/lib/domain/freshness";
import { appPath } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/radar/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const detail = await loadTelegramListing(id);
  const t = radar[locale];
  return { title: detail ? postTitle(locale, postFacts(detail.post.parsed)) : format(t.meta.detail, { id }) };
}

/**
 * Telegram post (§22.8, §35.5): the verbatim text next to what the parser
 * made of it — each field with its confidence and evidence, Unknown shown as
 * such — the parser version, duplicate candidates with their reasons, and
 * which of the agent's clients the post fits. A post is a publication, not
 * a verified object (§34.2).
 */
export default async function RadarPostPage({ params }: PageProps<"/[locale]/app/radar/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const detail = await loadTelegramListing(id);
  if (!detail) notFound();

  const [posts, listings, clients] = await Promise.all([listTelegramListings(), listListings(), listClients()]);
  const at = now();
  const t = radar[locale];
  const d = domain[locale];
  const { post, source, freshness } = detail;
  const facts = postFacts(post.parsed);
  const quality = parseQuality(post.parsed);
  const duplicates = postDuplicates(locale, post, posts, listings);
  const inactive = post.status === "hidden" || post.status === "reported_stale";
  const originalLabel = `${t.card.originalFull} (${t.card.newTab})`;

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        locale={locale}
        backHref={radarHref(locale)}
        title={postTitle(locale, facts)}
        subtitle={format(t.detail.subtitle, {
          source: source.title,
          time: formatRelative(locale, post.publishedAt, at),
        })}
        className="mb-0"
      >
        <div className="flex flex-wrap gap-2">
          <SourceBadge locale={locale} source="telegram" />
          <FreshnessBadge locale={locale} freshness={freshness} />
          {post.status !== "new" ? <Badge tone="neutral">{d.telegramStatus[post.status]}</Badge> : null}
        </div>
      </PageHeader>

      <div className="space-y-3">
        <Notice kind="info" title={t.detail.notVerifiedTitle}>
          {t.detail.notVerifiedText}
        </Notice>
        {post.status === "hidden" ? <Notice kind="permission">{t.detail.hidden}</Notice> : null}
        {post.status === "reported_stale" ? <Notice kind="warning">{t.detail.reportedStale}</Notice> : null}
        {post.status === "converted" ? <Notice kind="info">{t.detail.converted}</Notice> : null}
        {source.status === "paused" ? (
          <Notice kind="warning">{format(t.detail.sourcePaused, { source: source.title })}</Notice>
        ) : null}
        {needsAttention(freshness) ? (
          <Notice kind="warning">{format(t.detail.stale, { n: freshness.ageDays })}</Notice>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="post-raw" className="space-y-3">
          <SectionHeader id="post-raw" title={t.detail.raw} />
          <p className="text-caption text-fg-muted">{t.detail.rawHint}</p>
          <blockquote
            cite={post.sourceUrl}
            className="rounded-lg border border-border bg-surface-muted p-4 text-small whitespace-pre-wrap text-fg break-words"
          >
            {post.rawText}
          </blockquote>
          <dl className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
            <Row label={t.detail.source} value={`${source.title} · @${source.handle}`} />
            <Row
              label={t.detail.publishedAt}
              value={<time dateTime={post.publishedAt}>{formatDateTime(locale, post.publishedAt)}</time>}
            />
            <Row
              label={t.detail.receivedAt}
              value={<time dateTime={post.receivedAt}>{formatDateTime(locale, post.receivedAt)}</time>}
            />
            <Row label={t.detail.messageId} value={String(post.messageId)} />
            <Row
              label={t.detail.media}
              value={
                post.mediaCount > 0
                  ? format(plural(locale, post.mediaCount, t.card.media), { n: post.mediaCount })
                  : t.card.noMedia
              }
            />
            <Row label={t.detail.parserVersion} value={<code className="text-caption">{post.parserVersion}</code>} />
            <Row
              label={t.detail.link}
              value={
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={originalLabel}
                  className="inline-flex min-h-11 items-center gap-1 break-all text-primary underline-offset-4 hover:underline"
                >
                  {post.sourceUrl.replace(/^https:\/\//, "")}
                  <ExternalLink aria-hidden className="size-3.5 shrink-0" />
                </a>
              }
            />
          </dl>
        </section>

        <section aria-labelledby="post-parsed" className="space-y-3">
          <SectionHeader id="post-parsed" title={t.detail.normalized} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-small text-fg">
              {t.confidence.label}: {format(t.confidence.recognized, { n: quality.recognized, total: quality.total })}
            </span>
            <ConfidenceMeter value={quality.score} level={quality.level} labels={t.confidence} />
          </div>
          <p className="flex items-start gap-1.5 text-caption text-fg-muted">
            <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {format(t.confidence.threshold, { n: confidencePercent(MIN_PARSE_CONFIDENCE) })}
          </p>
          <div className="rounded-lg border border-border bg-surface px-4">
            <ParsedFieldList locale={locale} parsed={post.parsed} labels={fieldListLabels(locale)} />
          </div>
        </section>
      </div>

      <section aria-labelledby="post-duplicates" className="space-y-3">
        <SectionHeader id="post-duplicates" title={t.duplicates.title} />
        <p className="text-caption text-fg-muted">{t.duplicates.hint}</p>
        {duplicates.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">
            {t.duplicates.none}
          </p>
        ) : (
          <DuplicateList locale={locale} entries={duplicates} labels={duplicateListLabels(locale)} />
        )}
      </section>

      <section aria-labelledby="post-matches" className="space-y-3">
        <SectionHeader id="post-matches" title={t.matches.title} />
        {inactive ? (
          <p className="rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">
            {t.matches.inactive}
          </p>
        ) : detail.reverseMatches.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">
            {t.matches.none}
          </p>
        ) : (
          <ul className="space-y-3">
            {detail.reverseMatches.map((match) => (
              <li key={match.requirement.id} className="space-y-2 rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={appPath(locale, `/clients/${encodeURIComponent(match.client.id)}`)}
                    className="inline-flex min-h-11 items-center gap-2 text-body font-semibold text-fg underline-offset-4 hover:underline"
                  >
                    <UserRound aria-hidden className="size-4 text-fg-muted" />
                    {match.client.name}
                  </Link>
                  <BandBadge locale={locale} band={match.band} score={match.score} />
                </div>
                <p className="text-caption text-fg-muted">{requirementLine(locale, match.requirement)}</p>
                <p className="text-small text-fg">{summarizeMatch(locale, match.reasons)}</p>
                <details className="group">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-small font-medium text-primary">
                    {t.matches.reasons}
                  </summary>
                  <MatchReasons locale={locale} reasons={match.reasons} className="pt-2" />
                </details>
                <Link
                  href={appPath(locale, `/requirements/${encodeURIComponent(match.requirement.id)}`)}
                  className="inline-flex min-h-11 items-center text-small font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t.matches.openRequirement}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="post-linked" className="space-y-3">
        <SectionHeader id="post-linked" title={t.detail.linkedTitle} />
        {detail.linkedClients.length === 0 ? (
          <p className="text-small text-fg-muted">{t.detail.linkedNone}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {detail.linkedClients.map((client) => (
              <li key={client.id}>
                <Link
                  href={appPath(locale, `/clients/${encodeURIComponent(client.id)}`)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-small font-medium text-fg hover:bg-surface-muted"
                >
                  <UserRound aria-hidden className="size-4 text-fg-muted" />
                  {client.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PostActions
        labels={t.actions}
        initialStatus={post.status}
        convertHref={convertHref(locale, post.id)}
        original={{ href: post.sourceUrl, label: originalLabel }}
        clients={clients
          .filter((item) => !post.linkedClientIds.includes(item.client.id))
          .map((item) => ({ id: item.client.id, name: item.client.name }))}
        duplicates={duplicates.map((entry) => ({ id: entry.id, title: `${entry.title} — ${entry.subtitle ?? ""}` }))}
        subscription={subscriptionText(locale, facts)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
      <dt className="text-small text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right text-small font-medium text-fg">{value}</dd>
    </div>
  );
}
