import Link from "next/link";
import { Star } from "lucide-react";
import { FreshnessBadge, MoneyText, SourceBadge } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import properties from "@/i18n/messages/properties";
import type { ListingView } from "@/lib/data/views";
import { needsAttention } from "@/lib/domain/freshness";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";
import { latestPriceChange, locationLine, propertyTitle } from "./labels";
import {
  AccessBadge,
  AttributeChips,
  ListingStatusBadge,
  PhotoPlaceholder,
  PriceChangeBadge,
  VerificationSummaryBadges,
} from "./listing-badges";

export function listingHref(locale: string, listingId: string): string {
  return appPath(locale, `/properties/${encodeURIComponent(listingId)}`);
}

/**
 * Property card for search results (§22.5): photo placeholder, price with a
 * price-change marker, rooms/area/floor, district and massif (never the
 * restricted address), then status, freshness, source, access and a compact
 * verification summary as separate badges (§36.4). Stale or expired offers
 * are visibly muted instead of looking active (§34.6).
 *
 * The title is the link; its hit area stretches over the whole card.
 */
export function PropertyCard({ locale, view, headingLevel = 3 }: { locale: Locale; view: ListingView; headingLevel?: 2 | 3 }) {
  const t = properties[locale].list.card;
  const { listing, property } = view;
  const change = latestPriceChange(listing);
  const stale = needsAttention(view.freshness);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const by = view.organization ? `${view.agent.name}, ${view.organization.name}` : view.agent.name;

  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 rounded-lg border p-3 shadow-card transition-colors hover:border-border-strong",
        // The title link carries focus; the whole card shows it (§20.6 explicit focus).
        "has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring",
        stale ? "border-dashed border-border-strong bg-surface-muted/60" : "border-border bg-surface",
      )}
    >
      <div className="flex gap-3">
        <PhotoPlaceholder locale={locale} count={listing.photoCount} className="h-24 w-24 shrink-0 sm:w-32" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <MoneyText locale={locale} value={listing.price} className={cn("text-h2", stale ? "text-fg-muted" : "text-fg")} />
            <span className="text-caption text-fg-muted">{domain[locale].dealType[listing.dealType]}</span>
            {change ? <PriceChangeBadge locale={locale} change={change} /> : null}
          </div>
          <Heading className="text-small font-semibold text-fg">
            <Link
              href={listingHref(locale, listing.id)}
              className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:underline focus-visible:outline-none"
            >
              {propertyTitle(locale, property)}
            </Link>
          </Heading>
          <p className="text-caption text-fg-muted">{locationLine(locale, property)}</p>
          <AttributeChips locale={locale} facts={property} />
        </div>
      </div>

      {view.access !== "owner" || view.otherListingsOnProperty > 0 ? (
        <div className="space-y-0.5 text-caption text-fg-muted">
          {view.access !== "owner" ? <p>{format(t.agent, { name: by })}</p> : null}
          {view.otherListingsOnProperty > 0 ? (
            <p>{format(t.otherListings, { n: view.otherListingsOnProperty })}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <ListingStatusBadge locale={locale} status={listing.status} />
        <FreshnessBadge locale={locale} freshness={view.freshness} />
        <SourceBadge locale={locale} source={listing.source} />
        <AccessBadge locale={locale} access={view.access} />
        <VerificationSummaryBadges locale={locale} items={listing.verifications} />
        {listing.exclusive ? (
          <Badge icon={Star} tone="neutral">
            {t.exclusive}
          </Badge>
        ) : null}
      </div>
    </article>
  );
}
