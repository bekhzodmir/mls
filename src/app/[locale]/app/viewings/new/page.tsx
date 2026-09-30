import type { Metadata } from "next";
import { Building, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { propertyTitle } from "@/components/app/inventory/labels";
import { viewingListHref } from "@/components/app/viewings/agenda";
import {
  isSchedulable,
  sortListingOptions,
  toExistingSlot,
  toListingOption,
  type ClientOption,
} from "@/components/app/viewings/new-viewing";
import { NewViewingForm } from "@/components/app/viewings/new-viewing-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import viewings from "@/i18n/messages/viewings";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listClients, listListings, listRequirements, listViewings } from "@/lib/data/repository";
import { appPath } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: viewings[locale].meta.new };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * New viewing (§8.3 flow 9, §22.10). `?clientId=` and `?listingId=` come
 * from the client profile, the property profile and matches; an id the
 * viewer cannot see is ignored with an explanation instead of a failure.
 * Options are built from the repository, so partner listings arrive masked.
 */
export default async function NewViewingPage({ searchParams }: PageProps<"/[locale]/app/viewings/new">) {
  const locale = await getLocale();
  const t = viewings[locale].form;
  const search = await searchParams;
  const requestedClient = first(search.clientId);
  const requestedListing = first(search.listingId);

  const [clients, listings, requirements, all] = await Promise.all([
    listClients(),
    listListings(),
    listRequirements({ status: "active" }),
    listViewings(),
  ]);

  const clientOptions: ClientOption[] = clients.map(({ client }) => {
    const option: ClientOption = { id: client.id, name: client.name };
    const requirement = requirements.find((view) => view.client.id === client.id);
    if (requirement) option.requirementId = requirement.requirement.id;
    return option;
  });
  // A listing opened on purpose stays selectable even if it is no longer on the market.
  const listingOptions = sortListingOptions(
    listings
      .filter((view) => isSchedulable(view) || view.listing.id === requestedListing)
      .map((view) => toListingOption(locale, view)),
    locale,
  );
  const slots = all.map((view) =>
    toExistingSlot(view.viewing, view.client.name, propertyTitle(locale, view.listing.property)),
  );

  const clientFound = requestedClient ? clientOptions.some((option) => option.id === requestedClient) : true;
  const listingFound = requestedListing ? listingOptions.some((option) => option.id === requestedListing) : true;

  return (
    <div className="space-y-4">
      <PageHeader locale={locale} title={t.title} subtitle={t.subtitle} backHref={viewingListHref(locale)} className="mb-0" />

      {clientOptions.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={t.noClients.title}
          description={t.noClients.text}
          action={<ButtonLink href={appPath(locale, "/clients/new")}>{t.noClients.action}</ButtonLink>}
        />
      ) : listingOptions.length === 0 ? (
        <EmptyState
          icon={Building}
          title={t.noListings.title}
          description={t.noListings.text}
          action={<ButtonLink href={appPath(locale, "/properties/new")}>{t.noListings.action}</ButtonLink>}
        />
      ) : (
        <>
          {!clientFound ? <Notice kind="warning">{t.missingClient}</Notice> : null}
          {!listingFound ? <Notice kind="warning">{t.missingListing}</Notice> : null}
          <NewViewingForm
            locale={locale}
            clients={clientOptions}
            listings={listingOptions}
            slots={slots}
            nowIso={now().toISOString()}
            initialClientId={clientFound ? requestedClient : undefined}
            initialListingId={listingFound ? requestedListing : undefined}
            listHref={viewingListHref(locale)}
            cooperationHref={appPath(locale, "/mls/cooperation/new")}
          />
        </>
      )}
    </div>
  );
}
