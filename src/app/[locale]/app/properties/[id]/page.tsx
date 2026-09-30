import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrmTabs } from "@/components/app/crm-tabs";
import { DetailActions } from "@/components/app/inventory/detail-actions";
import {
  ContractSection,
  ListingSection,
  MlsSection,
  OffersSection,
  OtherListingsSection,
  OwnerSection,
  PropertyHero,
  PropertySection,
  ReverseMatchesSection,
  VerificationSection,
  ViewingsSection,
} from "@/components/app/inventory/detail-sections";
import { locationLine, propertyTitle } from "@/components/app/inventory/labels";
import { StaleConfirm } from "@/components/app/inventory/stale-confirm";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import { formatRelative } from "@/i18n/format";
import properties from "@/i18n/messages/properties";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadListing } from "@/lib/data/cached";
import type { ListingDetailView } from "@/lib/data/views";
import { needsAttention } from "@/lib/domain/freshness";
import { telHref } from "@/lib/domain/phone";
import { appPath } from "@/lib/routes";


export async function generateMetadata({ params }: PageProps<"/[locale]/app/properties/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const detail = await loadListing(id);
  // The title uses the privacy-safe label (type, rooms, massif) — never the address.
  return { title: detail ? propertyTitle(locale, detail.property) : properties[locale].meta.detail };
}

/** Who the call button reaches: the owner when visible, otherwise the listing agent's work phone. */
function callTarget(detail: ListingDetailView) {
  if (detail.owner) return { kind: "owner" as const, href: telHref(detail.owner.phone) };
  if (detail.access !== "owner") return { kind: "agent" as const, href: telHref(detail.agent.phone) };
  return undefined;
}

/**
 * Property / listing profile (§22.6, §36.3). The id is a Listing id: the page
 * shows the physical object and this agent's offer as separate cards, the
 * other offers on the same object, and only what the viewer's access allows.
 */
export default async function PropertyPage({ params }: PageProps<"/[locale]/app/properties/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const detail = await loadListing(id);
  if (!detail) notFound();

  const at = now();
  const t = properties[locale].detail;
  const { listing, property } = detail;
  const partner = detail.access === "partner_masked" || detail.access === "partner_shared";
  const stale = needsAttention(detail.freshness);
  const expired = detail.freshness.state === "expired";
  const confirmedAt = listing.lastConfirmedAt ?? listing.publishedAt;

  const clients = [...new Map(detail.reverseMatches.map((match) => [match.client.id, match.client.name])).entries()].map(
    ([clientId, name]) => ({ id: clientId, name }),
  );
  const listingQuery = new URLSearchParams({ listingId: listing.id }).toString();
  const more = [
    { href: `${appPath(locale, "/viewings/new")}?${listingQuery}`, label: t.actions.schedule },
    ...(partner ? [{ href: `${appPath(locale, "/mls/cooperation/new")}?${listingQuery}`, label: t.actions.cooperation }] : []),
    { href: appPath(locale, "/properties/new"), label: t.actions.newProperty },
    { href: appPath(locale, "/properties"), label: t.actions.allProperties },
  ];

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <PageHeader
        locale={locale}
        title={propertyTitle(locale, property)}
        subtitle={locationLine(locale, property)}
        backHref={appPath(locale, "/properties")}
        className="mb-0"
        actions={
          <DetailActions
            labels={t.actions}
            call={callTarget(detail)}
            clients={clients}
            masked={detail.access === "partner_masked"}
            more={more}
          />
        }
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      {stale ? (
        <Notice
          kind="warning"
          title={expired ? t.stale.expiredTitle : t.stale.title}
          action={
            detail.access === "owner" ? (
              <StaleConfirm label={t.stale.confirm} confirmedText={t.stale.confirmed} />
            ) : (
              <p>{format(t.stale.onlyAgent, { name: detail.agent.name })}</p>
            )
          }
        >
          {expired ? t.stale.expiredText : format(t.stale.text, { ago: formatRelative(locale, confirmedAt, at) })}
        </Notice>
      ) : null}

      <PropertyHero locale={locale} view={detail} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <PropertySection locale={locale} view={detail} />
          <OtherListingsSection locale={locale} views={detail.otherListings} />
          <OwnerSection locale={locale} detail={detail} />
          <ContractSection locale={locale} view={detail} at={at} />
        </div>
        <div className="space-y-4">
          <ListingSection locale={locale} view={detail} at={at} />
          <VerificationSection locale={locale} items={listing.verifications} />
          <MlsSection locale={locale} detail={detail} />
        </div>
      </div>

      <ReverseMatchesSection locale={locale} matches={detail.reverseMatches} listingId={listing.id} />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ViewingsSection locale={locale} viewings={detail.viewings} listingId={listing.id} />
        <OffersSection locale={locale} offers={detail.offers} />
      </div>
    </div>
  );
}
