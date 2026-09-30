import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Handshake, Network } from "lucide-react";
import { criteriaRows, termsLabels } from "@/components/app/mls/cooperation-labels";
import {
  activeRequestFor,
  cooperationHref,
  cooperationListHref,
  deadlineChoices,
  partnerViewOf,
  responseDeadline,
} from "@/components/app/mls/cooperation-model";
import { joinList } from "@/components/app/mls/listing-labels";
import { MlsListingCard } from "@/components/app/mls/mls-listing-card";
import { mlsHref } from "@/components/app/mls/mls-params";
import { NewCooperationForm, type RequirementOption } from "@/components/app/mls/new-cooperation-form";
import { firstParam } from "@/components/app/mls/url";
import { PageHeader } from "@/components/app/page-header";
import { summarizeMatch } from "@/components/domain/match-explanation";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { format, plural } from "@/i18n/define-messages";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import cooperation from "@/i18n/messages/cooperation";
import domain from "@/i18n/messages/domain";
import mls from "@/i18n/messages/mls";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { getListing, getViewer, listCooperation, listRequirements } from "@/lib/data/repository";
import type { ListingDetailView, RequirementView } from "@/lib/data/views";
import { presetTerms } from "@/lib/domain/commission";
import { districtName } from "@/lib/domain/geo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: cooperation[locale].meta.new };
}

function requirementOption(locale: Locale, view: RequirementView, detail: ListingDetailView): RequirementOption {
  const d = domain[locale];
  const { requirement } = view;
  const place = requirement.districts.length
    ? joinList(
        locale,
        requirement.districts.map((id) => districtName(id, locale)),
      )
    : mls[locale].criteria.anyDistrict;
  const option: RequirementOption = {
    id: requirement.id,
    label: `${view.client.name} · ${d.dealType[requirement.dealType]} · ${place}`,
    criteria: criteriaRows(locale, partnerViewOf(requirement)),
  };
  const match = detail.reverseMatches.find((item) => item.requirement.id === requirement.id);
  if (match) {
    option.fit = { band: match.band, bandLabel: d.band[match.band], summary: summarizeMatch(locale, match.reasons) };
  }
  return option;
}

/**
 * New cooperation request (§7.4, §15.3, §35.6): starts from a partner's
 * listing, shows who authored it and how it was checked, and lets the agent
 * set terms that the partner sees before any client data (§16.3, §18.2).
 * Own and agency listings, and listings with an open request, are turned
 * away with an explanation instead of creating a competing request (§15.5).
 */
export default async function NewCooperationPage({ searchParams }: PageProps<"/[locale]/app/mls/cooperation/new">) {
  const locale = await getLocale();
  const t = cooperation[locale];
  const query = await searchParams;
  const listingId = firstParam(query, "listingId");
  const requirementId = firstParam(query, "requirementId");

  const header = (
    <PageHeader
      locale={locale}
      backHref={mlsHref(locale)}
      title={t.new.title}
      subtitle={t.new.subtitle}
      className="mb-0"
    />
  );

  if (!listingId) {
    return (
      <div className="space-y-4">
        {header}
        <EmptyState
          icon={Network}
          title={t.new.missingTitle}
          description={t.new.missingText}
          action={<ButtonLink href={mlsHref(locale)}>{t.new.missingAction}</ButtonLink>}
        />
      </div>
    );
  }

  const [detail, views, requirements, viewer] = await Promise.all([
    getListing(listingId),
    listCooperation(),
    listRequirements({ status: "active" }),
    getViewer(),
  ]);
  if (!detail) notFound();

  const at = now();
  const listingCard = <MlsListingCard locale={locale} view={detail} now={at} variant="summary" headingLevel={3} />;

  if (detail.access === "owner" || detail.access === "agency") {
    const own = detail.access === "owner";
    return (
      <div className="space-y-4">
        {header}
        <Notice
          kind="info"
          title={own ? t.new.ownTitle : t.new.agencyTitle}
          action={
            <ButtonLink
              href={own ? cooperationListHref(locale, { direction: "incoming" }) : mlsHref(locale)}
              variant="secondary"
            >
              {own ? t.new.toList : t.new.mlsBack}
            </ButtonLink>
          }
        >
          {own ? t.new.ownText : t.new.agencyText}
        </Notice>
        {listingCard}
      </div>
    );
  }

  const existing = activeRequestFor(views, listingId);
  if (existing) {
    return (
      <div className="space-y-4">
        {header}
        <Notice
          kind="warning"
          title={t.new.existingTitle}
          action={
            <ButtonLink href={cooperationHref(locale, existing.request.id)}>
              <Handshake aria-hidden className="size-4" />
              {t.new.existingAction}
            </ButtonLink>
          }
        >
          {format(t.new.existingText, { status: domain[locale].cooperationStatus[existing.request.status] })}
        </Notice>
        {listingCard}
      </div>
    );
  }

  const options = requirements.map((view) => requirementOption(locale, view, detail));
  const preselected = requirementId && options.some((option) => option.id === requirementId) ? requirementId : "";
  const invalidRequirement = requirementId && !preselected ? requirementId : undefined;
  const labels = termsLabels(locale);

  return (
    <div className="space-y-4">
      {header}
      <section aria-labelledby="new-coop-listing" className="space-y-2">
        <h2 id="new-coop-listing" className="text-h2 text-fg">
          {t.new.listing}
        </h2>
        {listingCard}
      </section>
      {invalidRequirement ? (
        <Notice kind="warning">{format(t.new.requirementInvalid, { id: invalidRequirement })}</Notice>
      ) : null}
      <NewCooperationForm
        locale={locale}
        viewerId={viewer.agent.id}
        listingId={detail.listing.id}
        toAgentId={detail.agent.id}
        initialTerms={detail.listing.cooperation ?? presetTerms("50/50", detail.listing.price.currency)}
        requirements={options}
        initialRequirementId={preselected}
        deadlines={deadlineChoices.map((hours) => ({
          hours,
          label: format(plural(locale, hours, t.new.deadlineOption), { n: hours }),
          until: format(t.new.deadlineValue, { date: formatDateTime(locale, responseDeadline(at, hours)) }),
        }))}
        labels={{
          c: t,
          editor: { editor: t.editor, issue: t.issue, example: t.example, terms: labels },
          terms: labels,
          status: domain[locale].cooperationStatus,
          mustHave: mls[locale].criteria.mustHave,
        }}
        links={{ list: cooperationListHref(locale), mls: mlsHref(locale) }}
      />
    </div>
  );
}
