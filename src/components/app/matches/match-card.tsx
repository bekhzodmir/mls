import Link from "next/link";
import { Building2, ChevronDown, ExternalLink, Lock, Send, Sparkles, TriangleAlert, UserRound } from "lucide-react";
import { AttributeChips } from "@/components/app/inventory/listing-badges";
import { locationLine, propertyTitle } from "@/components/app/inventory/labels";
import { BandBadge, FreshnessBadge, MoneyText, SourceBadge } from "@/components/domain/badges";
import { MatchReasons, summarizeMatch } from "@/components/domain/match-explanation";
import { Badge } from "@/components/ui/badge";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import matchesScreen from "@/i18n/messages/matches-screen";
import type { MatchView } from "@/lib/data/views";
import { formatMoney } from "@/lib/domain/money";
import type { CommissionTerms } from "@/lib/domain/types";
import {
  cooperationRequestHref,
  isPartnerListing,
  isSetAside,
  isStale,
  matchDetailHref,
  targetFacts,
  targetHref,
  targetPrice,
} from "./feed";
import { MatchCardFrame } from "./match-card-frame";

export interface MatchCardProps {
  locale: Locale;
  match: MatchView;
  /** Name the client (feeds that are not grouped by client, reuse on other screens). */
  showClient?: boolean;
  /** Open the per-criterion explanation initially (match detail). */
  expanded?: boolean;
  /** Link the title to the match detail page (off on that page itself). */
  linkTitle?: boolean;
  headingLevel?: 2 | 3 | 4;
}

/** «Сотрудничество 70/30: 70% стороне объекта, 30% стороне покупателя» — roles always named (§35.6). */
export function termsLine(locale: Locale, terms: CommissionTerms): string {
  const t = matchesScreen[locale].card;
  if (terms.basis === "fixed_amount" && terms.fixedAmount) {
    return format(t.termsFixed, { amount: formatMoney(locale, terms.fixedAmount) });
  }
  return format(t.terms, {
    preset: domain[locale].splitPreset[terms.preset],
    listing: terms.listingSidePercent,
    buyer: terms.buyerSidePercent,
  });
}

/**
 * Match Card (§12.4, §22.7, §35.4 step 5): what was matched, why (reasons,
 * never a bare score), how fresh and trustworthy the source is, who holds a
 * partner listing and on which split. Internal listings and Telegram posts
 * carry clearly different source badges. Stale, expired, rejected and
 * duplicate matches are visibly muted and never look active (§36.3).
 *
 * Server-rendered content; the demo reactions live in `MatchCardFrame`.
 * Reusable on any screen that has a `MatchView`.
 */
export function MatchCard({ locale, match, showClient = false, expanded = false, linkTitle = true, headingLevel = 3 }: MatchCardProps) {
  const t = matchesScreen[locale];
  const d = domain[locale];
  const facts = targetFacts(match);
  const price = targetPrice(match);
  const stale = isStale(match.ranked.freshness);
  const expired = match.ranked.freshness.state === "expired";
  const setAside = isSetAside(match.status);
  const partner = isPartnerListing(match);
  const titleId = `match-${match.id}-title`;
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";
  const title = propertyTitle(locale, facts);
  const source = match.target.kind === "listing" ? match.target.view.listing.source : "telegram";

  return (
    <MatchCardFrame
      labels={t.actions}
      reasonLabels={d.rejectionReason}
      openHref={targetHref(locale, match)}
      openLabel={match.target.kind === "listing" ? t.actions.openListing : t.actions.openPost}
      cooperationHref={
        partner && match.target.kind === "listing"
          ? cooperationRequestHref(locale, match.target.view.listing.id, match.requirement.id)
          : undefined
      }
      muted={stale || setAside}
      setAside={setAside}
      labelledBy={titleId}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <BandBadge locale={locale} band={match.ranked.band} score={match.ranked.score} />
          <SourceBadge locale={locale} source={source} />
          <FreshnessBadge locale={locale} freshness={match.ranked.freshness} />
          {match.status !== "new" ? (
            <Badge tone={setAside ? "neutral" : "brand"}>
              {match.statusAt
                ? format(t.card.status, { status: d.matchStatus[match.status], date: formatDate(locale, match.statusAt, { day: "numeric", month: "short" }) })
                : d.matchStatus[match.status]}
            </Badge>
          ) : null}
        </div>

        <Heading id={titleId} className="text-body font-semibold text-fg">
          {linkTitle ? (
            <Link href={matchDetailHref(locale, match.id)} className="underline-offset-2 hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </Heading>

        {showClient ? (
          <p className="flex items-center gap-1.5 text-small text-fg-muted">
            <UserRound aria-hidden className="size-4 shrink-0" />
            {format(t.card.client, { name: match.client.name })}
          </p>
        ) : null}

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {price ? (
            <MoneyText locale={locale} value={price} className="text-h2 text-fg" />
          ) : (
            <span className="text-small italic text-fg-muted">{t.card.priceUnknown}</span>
          )}
          <span className="text-caption text-fg-muted">{locationLine(locale, facts)}</span>
        </div>
        <AttributeChips locale={locale} facts={facts} />

        <p className="flex items-start gap-2 text-small font-medium text-fg">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          {summarizeMatch(locale, match.ranked.reasons)}
        </p>

        {stale ? (
          <p className="flex items-start gap-2 text-small text-warning-fg">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {expired ? t.card.expired : t.card.stale}
          </p>
        ) : null}
        {match.status === "rejected" && match.rejectionReason ? (
          <p className="text-small text-fg-muted">{format(t.card.rejected, { reason: d.rejectionReason[match.rejectionReason] })}</p>
        ) : null}
        {match.status === "duplicate" ? <p className="text-small text-fg-muted">{t.card.duplicate}</p> : null}

        <TargetContext locale={locale} match={match} />

        <details open={expanded} className="group rounded-md border border-border bg-surface">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-small font-medium text-fg [&::-webkit-details-marker]:hidden">
            {t.card.why}
            <ChevronDown aria-hidden className="size-4 text-fg-muted transition-transform group-open:rotate-180" />
          </summary>
          <MatchReasons locale={locale} reasons={match.ranked.reasons} className="border-t border-border p-3" />
        </details>
      </div>
    </MatchCardFrame>
  );
}

/** Who holds the offer and on which terms; for posts, the channel and the original link. */
function TargetContext({ locale, match }: { locale: Locale; match: MatchView }) {
  const t = matchesScreen[locale].card;
  if (match.target.kind === "telegram") {
    const { post, source } = match.target.view;
    return (
      <div className="space-y-1 text-small text-fg-muted">
        <p className="flex items-center gap-1.5">
          <Send aria-hidden className="size-4 shrink-0" />
          {format(t.channel, { title: source.title })}
        </p>
        <p>{t.telegramHint}</p>
        <a
          href={post.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink aria-hidden className="size-4" />
          {t.original}
        </a>
      </div>
    );
  }

  const view = match.target.view;
  if (view.access === "owner") {
    return <p className="text-small text-fg-muted">{t.own}</p>;
  }
  if (view.access === "agency") {
    return <p className="text-small text-fg-muted">{format(t.agency, { name: view.agent.name })}</p>;
  }
  const terms = view.listing.cooperation;
  return (
    <div className="space-y-1 rounded-md bg-surface-muted/70 p-3 text-small">
      <p className="flex items-center gap-1.5 font-medium text-fg">
        <Building2 aria-hidden className="size-4 shrink-0 text-fg-muted" />
        {format(t.partner, {
          name: view.organization ? `${view.agent.name}, ${view.organization.name}` : view.agent.name,
        })}
      </p>
      <p className="text-fg">{terms ? termsLine(locale, terms) : t.noTerms}</p>
      {view.access === "partner_masked" ? (
        <p className="flex items-center gap-1.5 text-fg-muted">
          <Lock aria-hidden className="size-3.5 shrink-0" />
          {t.masked}
        </p>
      ) : null}
    </div>
  );
}
