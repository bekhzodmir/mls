import Link from "next/link";
import { ArrowRight, Briefcase, Building, UserRound } from "lucide-react";
import { ClientStatusBadge } from "@/components/app/crm/badges";
import { DealStageBadge } from "@/components/app/deals/deal-badges";
import { DealSection } from "@/components/app/deals/deal-section";
import { dealHref } from "@/components/app/deals/pipeline";
import { locationLine, propertyTitle } from "@/components/app/inventory/labels";
import { AccessBadge, AttributeChips } from "@/components/app/inventory/listing-badges";
import { MoneyText } from "@/components/domain/badges";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import offers from "@/i18n/messages/offers";
import type { OfferView } from "@/lib/data/views";
import type { ID } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Server-rendered context of the Offer Detail screen (§22.11 "link to
 * deal"): the property with its asking price, the client and the deal. The
 * negotiation itself lives in `offer-negotiation.tsx`.
 */

const linkClasses =
  "inline-flex min-h-11 items-center gap-1 text-small font-semibold text-primary underline-offset-2 hover:underline";

export function OfferPropertySection({ locale, view, viewerId }: { locale: Locale; view: OfferView; viewerId: ID }) {
  const t = offers[locale].detail;
  const { listing, property, agent } = view.listing;
  return (
    <DealSection id="offer-property" title={t.sections.property} icon={Building}>
      <div className="space-y-2">
        <p className="text-body font-semibold text-fg">{propertyTitle(locale, property)}</p>
        <p className="text-small text-fg-muted">{locationLine(locale, property)}</p>
        <AttributeChips locale={locale} facts={property} />
        <p className="text-small">
          <span className="text-fg-muted">{t.asking}: </span>
          <MoneyText locale={locale} value={listing.price} className="font-semibold text-fg" />
        </p>
        <p className="text-small text-fg">
          {format(t.listingAgent, { name: agent.id === viewerId ? `${agent.name} (${t.you})` : agent.name })}
        </p>
        <AccessBadge locale={locale} access={view.listing.access} />
      </div>
      <Link href={appPath(locale, `/properties/${encodeURIComponent(listing.id)}`)} className={linkClasses}>
        {t.openProperty}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </DealSection>
  );
}

export function OfferClientSection({ locale, view }: { locale: Locale; view: OfferView }) {
  const t = offers[locale].detail;
  return (
    <DealSection id="offer-client" title={t.sections.client} icon={UserRound}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body font-semibold text-fg">{view.client.name}</p>
        <ClientStatusBadge locale={locale} status={view.client.status} />
      </div>
      <Link href={appPath(locale, `/clients/${encodeURIComponent(view.client.id)}`)} className={linkClasses}>
        {t.openClient}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </DealSection>
  );
}

/** The deal when the viewer runs it; otherwise why it is not shown (no deal yet, or a colleague's). */
export function OfferDealSection({ locale, view }: { locale: Locale; view: OfferView }) {
  const t = offers[locale].detail;
  return (
    <DealSection id="offer-deal" title={t.sections.deal} icon={Briefcase}>
      {view.deal ? (
        <>
          <DealStageBadge locale={locale} stage={view.deal.stage} />
          <Link href={dealHref(locale, view.deal.id)} className={linkClasses}>
            {t.openDeal}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </>
      ) : view.offer.dealId ? (
        <Notice kind="permission">{t.dealHidden}</Notice>
      ) : (
        <p className="text-small text-fg-muted">{t.dealNone}</p>
      )}
    </DealSection>
  );
}
