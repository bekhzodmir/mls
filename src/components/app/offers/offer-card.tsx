import Link from "next/link";
import { Briefcase, ChevronRight, Lock, Scale, Timer, UserRound } from "lucide-react";
import { dealHref } from "@/components/app/deals/pipeline";
import { DealStageBadge } from "@/components/app/deals/deal-badges";
import { locationLine, propertyTitle, typeLabel } from "@/components/app/inventory/labels";
import { MoneyText } from "@/components/domain/badges";
import { ButtonLink } from "@/components/ui/button";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import offers from "@/i18n/messages/offers";
import type { OfferView } from "@/lib/data/views";
import { formatMoney } from "@/lib/domain/money";
import { cn } from "@/lib/cn";
import { OfferStatusBadge, TurnBadge, deadlineText, gapText, sideLabel } from "./offer-badges";
import { offerHref, priceGap } from "./offer-list";

/**
 * One offer in the list (§21.4 screen 68): property, client, the latest
 * amount against the asking price (as money), whose answer it waits for and
 * whether that answer is overdue, the status, and the way to the deal.
 * Server component.
 */
export function OfferCard({ locale, view }: { locale: Locale; view: OfferView }) {
  const t = offers[locale].card;
  const { offer, listing, client, latest } = view;
  const dealType = listing.listing.dealType;
  const asking = listing.listing.price;
  const href = offerHref(locale, offer.id);
  const title = propertyTitle(locale, listing.property);
  const titleId = `offer-${offer.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "space-y-3 rounded-lg border bg-surface p-4 shadow-card",
        view.responseOverdue ? "border-danger-border" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={titleId} className="min-w-0 text-body font-semibold text-fg">
          <Link href={href} className="hover:underline">
            {typeLabel(locale, listing.property)}
          </Link>
          <span className="block text-small font-normal text-fg-muted">{locationLine(locale, listing.property)}</span>
        </h2>
        <OfferStatusBadge locale={locale} status={offer.status} />
      </div>

      <div className="space-y-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <MoneyText locale={locale} value={latest.amount} className="text-h2 text-fg" />
          <span className="text-caption text-fg-muted">
            {format(t.latest, { n: latest.version, side: sideLabel(locale, dealType, latest.by) })}
          </span>
        </p>
        <p className="flex items-start gap-1.5 text-small text-fg">
          <Scale aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <span>
            {gapText(locale, priceGap(latest.amount, asking), asking)}
            <span className="block text-caption text-fg-muted tabular">
              {format(t.asking, { amount: formatMoney(locale, asking) })}
            </span>
          </span>
        </p>
      </div>

      <ul className="space-y-1 text-small">
        <li className="flex items-start gap-1.5 text-fg">
          <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <span>{format(t.client, { name: client.name })}</span>
        </li>
        {view.awaitingSide ? (
          <li className={cn("flex items-start gap-1.5", view.responseOverdue ? "font-medium text-danger-fg" : "text-fg")}>
            <Timer aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{deadlineText(locale, latest, view.responseOverdue)}</span>
          </li>
        ) : null}
        <li className="text-caption text-fg-muted">
          {format(plural(locale, offer.versions.length, t.versions), { n: offer.versions.length })} ·{" "}
          {format(t.updated, { date: formatDateTime(locale, latest.at) })}
        </li>
      </ul>

      {view.awaitingSide || view.deal ? (
        <div className="flex flex-wrap gap-1.5">
          {view.awaitingSide ? (
            <TurnBadge locale={locale} dealType={dealType} side={view.awaitingSide} overdue={view.responseOverdue} />
          ) : null}
          {view.deal ? <DealStageBadge locale={locale} stage={view.deal.stage} /> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink
          href={href}
          variant="secondary"
          aria-label={format(t.openLabel, { property: title })}
          className="flex-1 sm:flex-none"
        >
          {t.open}
          <ChevronRight aria-hidden className="size-4" />
        </ButtonLink>
        {view.deal ? (
          <ButtonLink
            href={dealHref(locale, view.deal.id)}
            variant="ghost"
            aria-label={format(t.dealLabel, { property: title })}
            className="flex-1 sm:flex-none"
          >
            <Briefcase aria-hidden className="size-4" />
            {t.deal}
          </ButtonLink>
        ) : (
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            {offer.dealId ? <Lock aria-hidden className="size-3.5 shrink-0" /> : null}
            {offer.dealId ? t.dealHidden : t.noDeal}
          </p>
        )}
      </div>
    </article>
  );
}
