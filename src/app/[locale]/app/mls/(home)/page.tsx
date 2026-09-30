import type { Metadata } from "next";
import { Building, Handshake, Network, Plus, Radar as RadarIcon, SearchX } from "lucide-react";
import { BuyerRequests } from "@/components/app/mls/buyer-requests";
import { activeRequestFor, cooperationListHref } from "@/components/app/mls/cooperation-model";
import { MlsFilterForm, type MlsFilterOptions } from "@/components/app/mls/mls-filter-form";
import { MlsListingCard } from "@/components/app/mls/mls-listing-card";
import {
  agencyOptions,
  facetOf,
  filterCount,
  filterMls,
  mlsHref,
  parseMlsParams,
  roomChoices,
  updatedChoices,
  type MlsParams,
} from "@/components/app/mls/mls-params";
import { MlsTabs } from "@/components/app/mls/mls-tabs";
import { SavedSearch } from "@/components/app/mls/saved-search";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { compareText } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import mls from "@/i18n/messages/mls";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listCooperation, listListings, listRequirements } from "@/lib/data/repository";
import type { ListingView } from "@/lib/data/views";
import { districtName } from "@/lib/domain/geo";
import { currencies, dealTypes, districtIds, propertyTypes, sourceKinds } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: mls[locale].meta.home };
}

function filterOptions(locale: Locale, views: ListingView[]): MlsFilterOptions {
  const d = domain[locale];
  const t = mls[locale].filters;
  return {
    dealType: dealTypes.map((value) => ({ value, label: d.dealType[value] })),
    propertyType: propertyTypes.map((value) => ({ value, label: d.propertyType[value] })),
    district: [...districtIds]
      .map((value) => ({ value, label: districtName(value, locale) }))
      .sort((a, b) => compareText(locale, a.label, b.label)),
    rooms: roomChoices.map((value) => ({
      value: String(value),
      label: value === 4 ? format(t.roomsPlus, { n: 4 }) : String(value),
    })),
    currency: currencies.map((value) => ({ value, label: value })),
    renovation: (["shell", "needs_repair", "renovated", "designer"] as const).map((value) => ({
      value,
      label: d.renovation[value],
    })),
    building: (["new_building", "secondary"] as const).map((value) => ({ value, label: d.buildingKind[value] })),
    updated: updatedChoices.map((value) => ({
      value: String(value),
      label: format(plural(locale, value, t.updatedDays), { n: value }),
    })),
    agency: [
      ...agencyOptions(views).map((org) => ({ value: org.id, label: org.name })),
      { value: "none", label: t.agencyNone },
    ],
    source: sourceKinds.map((value) => ({ value, label: d.source[value] })),
  };
}

function NoListings({ locale, params, total }: { locale: Locale; params: MlsParams; total: number }) {
  const t = mls[locale].results;
  if (filterCount(params) > 0 || total > 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={t.emptyTitle}
        description={t.emptyText}
        action={<ButtonLink href={mlsHref(locale, { tab: params.tab })}>{mls[locale].filters.reset}</ButtonLink>}
      />
    );
  }
  if (params.tab === "mine") {
    return (
      <EmptyState
        icon={Building}
        title={t.mineEmptyTitle}
        description={t.mineEmptyText}
        action={
          <ButtonLink href={appPath(locale, "/properties/new")}>
            <Plus aria-hidden className="size-4" />
            {t.addProperty}
          </ButtonLink>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={Network}
      title={t.baseEmptyTitle}
      description={t.baseEmptyText}
      action={
        <ButtonLink href={appPath(locale, "/radar")} variant="secondary">
          <RadarIcon aria-hidden className="size-4" />
          {t.radar}
        </ButtonLink>
      }
    />
  );
}

/**
 * MLS workspace (§15.1–15.2, §22.9): a professional base for cooperation,
 * not a public board. Tabs for the shared base, own listings and buyer
 * requests; every filter is URL state; partner data stays masked until
 * cooperation terms are accepted (§18.2).
 */
export default async function MlsPage({ searchParams }: PageProps<"/[locale]/app/mls">) {
  const locale = await getLocale();
  const t = mls[locale];
  const params = parseMlsParams(await searchParams);
  const at = now();
  const cooperation = await listCooperation();
  const awaiting = cooperation.filter((view) => view.awaitingViewer).length;

  const header = (
    <PageHeader
      locale={locale}
      title={t.home.title}
      subtitle={t.home.subtitle}
      className="mb-0"
      actions={
        <ButtonLink href={cooperationListHref(locale)} variant="secondary">
          <Handshake aria-hidden className="size-4" />
          {t.home.cooperation}
          {awaiting > 0 ? (
            <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-caption font-bold text-primary-fg">
              {awaiting}
            </span>
          ) : null}
        </ButtonLink>
      }
    >
      <MlsTabs locale={locale} params={params} />
    </PageHeader>
  );

  if (params.tab === "requests") {
    const own = await listRequirements({ status: "active" });
    const incoming = cooperation.filter((view) => view.direction === "incoming" && view.requirement);
    return (
      <div className="space-y-4">
        {header}
        <BuyerRequests locale={locale} incoming={incoming} own={own} />
      </div>
    );
  }

  const base = await listListings({ scope: params.tab === "mine" ? "mine" : "mls", q: params.q });
  const results = filterMls(base, params, at);

  return (
    <div className="space-y-4">
      {header}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <div className="rounded-lg border border-border bg-surface p-4 lg:sticky lg:top-6">
          <MlsFilterForm
            locale={locale}
            params={params}
            facets={base.map(facetOf)}
            nowIso={at.toISOString()}
            labels={t.filters}
            options={filterOptions(locale, base)}
          />
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p role="status" className="text-body font-semibold text-fg">
              {format(plural(locale, results.length, t.results.count), { n: results.length })}
            </p>
            <SavedSearch labels={t.saved} />
          </div>
          {results.length === 0 ? (
            <NoListings locale={locale} params={params} total={base.length} />
          ) : (
            <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {results.map((view) => (
                <li key={view.listing.id}>
                  <MlsListingCard
                    locale={locale}
                    view={view}
                    now={at}
                    request={activeRequestFor(cooperation, view.listing.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
