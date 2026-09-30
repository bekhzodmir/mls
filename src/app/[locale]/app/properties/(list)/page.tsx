import type { Metadata } from "next";
import { Building, Plus, Radar, SearchX } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { DistrictGroups } from "@/components/app/inventory/district-groups";
import {
  activeFilters,
  parsePropertyListParams,
  propertyListHref,
  toListingFilter,
  withoutAllFilters,
  withoutFilter,
  type PropertyListParams,
} from "@/components/app/inventory/filters";
import { foundText } from "@/components/app/inventory/listing-badges";
import { PropertyCard } from "@/components/app/inventory/property-card";
import {
  ActiveFilterChips,
  FilterForm,
  filterLabel,
  PendingPriceNotice,
  QuickChips,
  ScopeChips,
  ViewSwitch,
} from "@/components/app/inventory/property-filters";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import properties from "@/i18n/messages/properties";
import { getLocale } from "@/i18n/server";
import { listListings } from "@/lib/data/repository";
import { appPath } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: properties[locale].meta.list };
}

/** No results: name each filter that can be removed (§23.1, §36.3), or explain the empty scope. */
function NoResults({ locale, params }: { locale: Locale; params: PropertyListParams }) {
  const t = properties[locale].list;
  const active = activeFilters(params);
  const add = (
    <ButtonLink href={appPath(locale, "/properties/new")}>
      <Plus aria-hidden className="size-4" />
      {t.add}
    </ButtonLink>
  );

  if (active.length > 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={t.empty.title}
        description={t.empty.filtered}
        action={
          <ul className="flex flex-wrap justify-center gap-2">
            {active.map((key) => {
              const label = filterLabel(locale, params, key);
              return (
                <li key={key}>
                  <ChipLink href={propertyListHref(locale, withoutFilter(params, key))} aria-label={format(t.active.remove, { filter: label })}>
                    {label} ×
                  </ChipLink>
                </li>
              );
            })}
            <li>
              <ChipLink href={propertyListHref(locale, withoutAllFilters(params))} active>
                {t.active.resetAll}
              </ChipLink>
            </li>
          </ul>
        }
      />
    );
  }

  if (params.scope === "mine") {
    return (
      <EmptyState
        icon={Building}
        title={t.empty.mineTitle}
        description={t.empty.mineText}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {add}
            <ButtonLink href={appPath(locale, "/radar")} variant="secondary">
              <Radar aria-hidden className="size-4" />
              {t.empty.radar}
            </ButtonLink>
          </div>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={Building}
      title={t.empty.scopeTitle}
      description={t.empty.scopeText}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <ChipLink href={propertyListHref(locale, { scope: "all", view: params.view })}>{t.empty.all}</ChipLink>
          {add}
        </div>
      }
    />
  );
}

/**
 * Property search (§15.2, §22.5, §36.3–36.4): own listings, the agency base
 * and the MLS in one list. Filters are URL state; the repository applies
 * access rules before anything reaches this page.
 */
export default async function PropertiesPage({ searchParams }: PageProps<"/[locale]/app/properties">) {
  const locale = await getLocale();
  const t = properties[locale].list;
  const params = parsePropertyListParams(await searchParams);
  const views = await listListings(toListingFilter(params));

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={t.title}
        subtitle={t.subtitle}
        className="mb-0"
        actions={
          <ButtonLink href={appPath(locale, "/properties/new")}>
            <Plus aria-hidden className="size-4" />
            {t.add}
          </ButtonLink>
        }
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      <ScopeChips locale={locale} params={params} />
      <QuickChips locale={locale} params={params} />
      <FilterForm locale={locale} params={params} />
      <PendingPriceNotice locale={locale} params={params} />
      <ActiveFilterChips locale={locale} params={params} />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p role="status" className="text-body font-semibold text-fg">
          {foundText(locale, views.length)}
        </p>
        <ViewSwitch locale={locale} params={params} />
      </div>

      {views.length === 0 ? (
        <NoResults locale={locale} params={params} />
      ) : params.view === "districts" ? (
        <DistrictGroups locale={locale} views={views} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {views.map((view) => (
            <li key={view.listing.id}>
              <PropertyCard locale={locale} view={view} headingLevel={2} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
