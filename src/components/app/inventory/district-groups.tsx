import Link from "next/link";
import { ChevronRight, MapPinned } from "lucide-react";
import { FreshnessBadge, MoneyText } from "@/components/domain/badges";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { compareText } from "@/i18n/format";
import properties from "@/i18n/messages/properties";
import type { ListingView } from "@/lib/data/views";
import { districtName } from "@/lib/domain/geo";
import { needsAttention } from "@/lib/domain/freshness";
import type { DistrictId } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { attributeChips, latestPriceChange, propertyTitle } from "./labels";
import { ListingStatusBadge, PriceChangeBadge } from "./listing-badges";
import { listingHref } from "./property-card";

/** Results grouped by district, alphabetically in the viewer's language; order inside is kept. */
export function groupByDistrict(locale: Locale, views: readonly ListingView[]): { district: DistrictId; views: ListingView[] }[] {
  const groups = new Map<DistrictId, ListingView[]>();
  for (const view of views) {
    const list = groups.get(view.property.district);
    if (list) list.push(view);
    else groups.set(view.property.district, [view]);
  }
  return [...groups.entries()]
    .map(([district, items]) => ({ district, views: items }))
    .sort((a, b) => compareText(locale, districtName(a.district, locale), districtName(b.district, locale)));
}

/**
 * The list fallback for a map (§36.4): no map provider is configured, so the
 * same results are grouped by district. The screen says so instead of
 * pretending a map exists.
 */
export function DistrictGroups({ locale, views }: { locale: Locale; views: readonly ListingView[] }) {
  const t = properties[locale].list.view;
  const groups = groupByDistrict(locale, views);
  return (
    <div className="space-y-4">
      <Notice kind="info">{t.mapNote}</Notice>
      <nav aria-label={t.districts} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          {groups.map((group) => (
            <li key={group.district}>
              <a
                href={`#district-${group.district}`}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-small font-medium text-fg hover:bg-surface-muted"
              >
                <MapPinned aria-hidden className="size-4 text-fg-muted" />
                {districtName(group.district, locale)}
                <span className="tabular text-fg-muted">{group.views.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <section key={group.district} id={`district-${group.district}`} aria-labelledby={`district-${group.district}-title`} className="scroll-mt-20">
            <Card className="overflow-hidden">
              <h2 id={`district-${group.district}-title`} className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2 text-h2 text-fg">
                {districtName(group.district, locale)}
                <span className="text-small font-normal text-fg-muted">
                  {format(plural(locale, group.views.length, t.districtCount), { n: group.views.length })}
                </span>
              </h2>
              <ul className="divide-y divide-border">
                {group.views.map((view) => (
                  <li key={view.listing.id}>
                    <CompactListingRow locale={locale} view={view} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}

function CompactListingRow({ locale, view }: { locale: Locale; view: ListingView }) {
  const { listing, property } = view;
  const change = latestPriceChange(listing);
  const stale = needsAttention(view.freshness);
  const facts = attributeChips(locale, property)
    .filter((chip) => !chip.unknown)
    .map((chip) => chip.text)
    .join(" · ");
  return (
    <Link
      href={listingHref(locale, listing.id)}
      className={cn(
        "flex min-h-11 items-start gap-3 px-4 py-3 -outline-offset-2 transition-colors hover:bg-surface-muted/60",
        stale && "bg-surface-muted/50",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-small font-semibold text-fg">{propertyTitle(locale, property)}</p>
        <p className="text-caption text-fg-muted">
          <MoneyText locale={locale} value={listing.price} className="font-semibold text-fg" />
          {facts ? ` · ${facts}` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <ListingStatusBadge locale={locale} status={listing.status} />
          <FreshnessBadge locale={locale} freshness={view.freshness} />
          {change ? <PriceChangeBadge locale={locale} change={change} /> : null}
        </div>
      </div>
      <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-fg-subtle" />
    </Link>
  );
}
