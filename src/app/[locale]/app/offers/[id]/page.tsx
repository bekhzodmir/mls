import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrmTabs } from "@/components/app/crm-tabs";
import { locationLine, propertyTitle } from "@/components/app/inventory/labels";
import { offerListHref } from "@/components/app/offers/offer-list";
import {
  OfferActionBar,
  OfferBarSpacer,
  OfferNegotiationProvider,
  OfferStatePanel,
  OfferTimeline,
} from "@/components/app/offers/offer-negotiation";
import { OfferClientSection, OfferDealSection, OfferPropertySection } from "@/components/app/offers/offer-sections";
import { PageHeader } from "@/components/app/page-header";
import { format } from "@/i18n/define-messages";
import offers from "@/i18n/messages/offers";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadOffer } from "@/lib/data/cached";
import { getViewer } from "@/lib/data/repository";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/offers/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadOffer(id);
  const t = offers[locale].meta;
  // Privacy-safe label only (type, rooms, massif) — never the address.
  return { title: view ? `${t.detail}: ${propertyTitle(locale, view.listing.property)}` : t.detail };
}

/**
 * Offer Detail and Negotiation (§21.4 screens 69–70, §22.11, §35.2 row 10):
 * the current state, the full version timeline (every version kept with its
 * side, amount, time, expiry and note), and links to the property, client
 * and deal. Accepting (after an explicit confirmation), declining with a
 * reason and countering are local demo actions and say so.
 */
export default async function OfferPage({ params }: PageProps<"/[locale]/app/offers/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const [view, viewer] = await Promise.all([loadOffer(id), getViewer()]);
  if (!view) notFound();

  const t = offers[locale];
  const { listing, property, agent } = view.listing;

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={propertyTitle(locale, property)}
        subtitle={format(t.detail.subtitle, { client: view.client.name, place: locationLine(locale, property) })}
        backHref={offerListHref(locale)}
        className="mb-0"
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      <OfferNegotiationProvider
        locale={locale}
        offer={view.offer}
        nowIso={now().toISOString()}
        dealType={listing.dealType}
        asking={listing.price}
        access={view.listing.access}
        listingAgentName={agent.name}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
            <OfferStatePanel />
            <OfferTimeline />
          </div>
          <div className="space-y-4">
            <OfferPropertySection locale={locale} view={view} viewerId={viewer.agent.id} />
            <OfferClientSection locale={locale} view={view} />
            <OfferDealSection locale={locale} view={view} />
          </div>
        </div>
        <OfferBarSpacer />
        <OfferActionBar />
      </OfferNegotiationProvider>
    </div>
  );
}
