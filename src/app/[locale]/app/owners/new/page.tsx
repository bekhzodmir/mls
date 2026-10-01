import type { Metadata } from "next";
import { firstParam } from "@/components/app/crm/filters";
import { propertyLabel } from "@/components/app/crm/object-label";
import type { PersonCard } from "@/components/app/owners/new-owner";
import { NewOwnerForm, type PropertyOption } from "@/components/app/owners/new-owner-form";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/ui/notice";
import { compareText } from "@/i18n/format";
import owners from "@/i18n/messages/owners";
import { getLocale } from "@/i18n/server";
import { listClients, listListings, listOwners } from "@/lib/data/repository";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: owners[locale].meta.new };
}

/**
 * New owner (§8.3 Flow 3, §20.3, §21.4 #26). `?phone=` prefills the number
 * (e.g. from an unknown call), `?listingId=` one of the viewer's listings.
 * The duplicate check only compares numbers the viewer may see: owners with
 * a visible contact and the viewer's own clients (§34.2) — hidden phones
 * never reach the browser.
 */
export default async function NewOwnerPage({ searchParams }: PageProps<"/[locale]/app/owners/new">) {
  const locale = await getLocale();
  const t = owners[locale].form;
  const params = await searchParams;
  const listingParam = firstParam(params.listingId);
  const phone = firstParam(params.phone)?.slice(0, 32);

  const [ownerItems, clientItems, mine] = await Promise.all([
    listOwners(),
    listClients(),
    listListings({ scope: "mine" }),
  ]);
  const people: PersonCard[] = [
    ...ownerItems.flatMap((item): PersonCard[] =>
      item.owner.phone ? [{ kind: "owner", id: item.owner.id, name: item.owner.name, phones: [item.owner.phone] }] : [],
    ),
    ...clientItems.map(
      (item): PersonCard => ({ kind: "client", id: item.client.id, name: item.client.name, phones: item.client.phones }),
    ),
  ];
  const ownerNames = new Map(ownerItems.map((item) => [item.owner.id, item.owner.name]));
  const properties: PropertyOption[] = mine
    .map((view) => {
      const option: PropertyOption = {
        listingId: view.listing.id,
        label: `${propertyLabel(locale, view.property)} · ${view.listing.id}`,
      };
      const ownerName = view.property.ownerId ? ownerNames.get(view.property.ownerId) : undefined;
      if (ownerName) option.ownerName = ownerName;
      return option;
    })
    .sort((a, b) => compareText(locale, a.label, b.label));
  const listingId = properties.find((option) => option.listingId === listingParam)?.listingId;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader locale={locale} backHref={appHref(locale, "owners")} title={t.title} subtitle={t.subtitle} />
      {listingParam && !listingId ? (
        <Notice kind="warning" className="mb-5">
          {t.listingNotFound}
        </Notice>
      ) : null}
      <NewOwnerForm
        locale={locale}
        people={people}
        properties={properties}
        hiddenOwners={ownerItems.filter((item) => !item.contactVisible).length}
        initial={{ phone, listingId }}
      />
    </div>
  );
}
