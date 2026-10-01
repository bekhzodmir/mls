import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { contactRevokedAt } from "@/components/app/crm/duplicates";
import { listingHref, propertyLabel } from "@/components/app/crm/object-label";
import { ChipRow, StickyBarSpacer } from "@/components/app/crm/layout-parts";
import { OwnerActions } from "@/components/app/owners/owner-actions";
import { OwnerScopeBadge, RestrictedBadge, RightHolderBadge } from "@/components/app/owners/owner-badges";
import { callsTimelineHref, consentGaps, contractHref, ownerFacts, propertyGroups } from "@/components/app/owners/owner-model";
import {
  ConsentsSection,
  ContractsSection,
  HistorySection,
  OwnerVerificationSection,
  PropertiesSection,
  TimelineSection,
} from "@/components/app/owners/owner-sections";
import { PageHeader } from "@/components/app/page-header";
import { explainAccess } from "@/components/app/verification/access";
import { PermissionNotice } from "@/components/app/verification/permission-notice";
import { requestHref } from "@/components/app/verification/queue";
import { Card } from "@/components/ui/card";
import { ChipLink } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import { formatDate, formatList, formatRelative } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import owners from "@/i18n/messages/owners";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadOwner } from "@/lib/data/cached";
import { getViewer, listAgents, listVerificationQueue } from "@/lib/data/repository";
import { needsAttention } from "@/lib/domain/freshness";
import { formatUzPhone, telHref } from "@/lib/domain/phone";
import { tashkentDateKey } from "@/lib/domain/working-days";
import { appHref } from "@/lib/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/owners/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const detail = await loadOwner(id);
  return { title: detail?.owner.name ?? owners[locale].meta.detail };
}

/**
 * Owner profile (§14.6, §21.4 #25): who the owner is and how to reach them —
 * or which right that needs and who grants it (§23.5) —, sticky Позвонить /
 * Задача / Ещё, then consents per purpose and per right holder (art. 37),
 * properties with their listings, contracts, checked facts, listing price
 * and status history, and the viewer's own calls and messages.
 */
export default async function OwnerPage({ params }: PageProps<"/[locale]/app/owners/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const [detail, viewer, agents] = await Promise.all([loadOwner(id), getViewer(), listAgents()]);
  if (!detail) notFound();

  const t = owners[locale];
  const d = domain[locale];
  const at = now();
  const { owner } = detail;
  const revokedAt = contactRevokedAt(owner);
  const gaps = consentGaps(detail.contracts, owner.id);
  const groups = propertyGroups(detail);
  const facts = groups.some((group) => group.viaContract)
    ? ownerFacts(detail.verification, await listVerificationQueue({ target: "listing" }), groups)
    : detail.verification;
  const listings = [...new Map(groups.flatMap((group) => group.listings).map((view) => [view.listing.id, view])).values()];
  const ownListing = listings.find((view) => view.access === "owner");
  const stale = listings.filter((view) => needsAttention(view.freshness));
  const verificationRequest = ownListing ? requestHref(locale, { listingId: ownListing.listing.id }) : undefined;
  const performers = Object.fromEntries(agents.map((agent) => [agent.id, agent.name]));
  const callHintId = "owner-call-hint";
  const permission = detail.contactVisible
    ? undefined
    : explainAccess(viewer.agent.role, "sensitive_owner_data", detail.scope);

  const sections = [
    { id: "consents", label: t.sections.consents },
    { id: "properties", label: t.sections.properties },
    { id: "contracts", label: t.sections.contracts },
    { id: "verification", label: t.sections.verification },
    { id: "history", label: t.sections.history },
    { id: "timeline", label: t.sections.timeline },
  ];

  return (
    <>
      <PageHeader locale={locale} backHref={appHref(locale, "owners")} title={owner.name}>
        <div className="flex flex-wrap gap-1.5">
          <OwnerScopeBadge locale={locale} scope={detail.scope} />
          {detail.rightHolderOnly ? <RightHolderBadge locale={locale} /> : null}
          <RestrictedBadge locale={locale} />
        </div>
        <CrmTabs locale={locale} />
      </PageHeader>

      <Card className="space-y-4 p-4">
        {revokedAt ? (
          <Notice kind="danger" title={d.consentPurpose.contact}>
            <p id={callHintId}>{format(t.profile.consentRevoked, { date: formatDate(locale, revokedAt) })}</p>
          </Notice>
        ) : null}

        {gaps.map((gap) => (
          <Notice
            key={gap.contract.contract.id}
            kind="warning"
            action={
              <Link
                href={contractHref(locale, gap.contract.contract.id)}
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
              >
                {t.profile.openContract}
              </Link>
            }
          >
            {gap.ownMissing
              ? format(t.profile.gapOwn, { number: gap.contract.contract.number })
              : format(t.profile.gapOther, {
                  number: gap.contract.contract.number,
                  names: formatList(
                    locale,
                    gap.missing.map((holder) => holder.name),
                  ),
                })}
          </Notice>
        ))}

        {stale.map((view) => {
          const expired = view.freshness.state === "expired";
          const label = propertyLabel(locale, view.property);
          return (
            <Notice
              key={view.listing.id}
              kind="warning"
              title={expired ? t.profile.staleExpiredTitle : t.profile.staleTitle}
              action={
                <Link
                  href={listingHref(locale, view.listing.id)}
                  className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
                >
                  {t.profile.staleOpen}
                </Link>
              }
            >
              {expired
                ? format(t.profile.staleExpired, { label })
                : format(t.profile.staleText, {
                    label,
                    ago: formatRelative(locale, view.listing.lastConfirmedAt ?? view.listing.publishedAt, at),
                  })}
            </Notice>
          );
        })}

        <dl className="grid grid-cols-1 gap-3 text-small sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted">{t.profile.phone}</dt>
            <dd className="font-medium text-fg">
              {owner.phone ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <a href={telHref(owner.phone)} className="tabular underline-offset-2 hover:underline">
                    {formatUzPhone(owner.phone)}
                  </a>
                  <RestrictedBadge locale={locale} />
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-fg-muted">
                  <Lock aria-hidden className="size-3.5" />
                  {t.profile.hiddenValue}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t.profile.responsible}</dt>
            <dd className="font-medium text-fg">
              {detail.responsibleAgent.name} · {d.role[detail.responsibleAgent.role]}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">
              {t.profile.properties} / {t.profile.contracts}
            </dt>
            <dd className="tabular font-medium text-fg">
              {detail.propertyIds.length} / {detail.contractIds.length}
            </dd>
          </div>
          <div>
            <dt className="text-fg-muted">{t.profile.lastContact}</dt>
            <dd className="font-medium text-fg">
              {detail.lastContactAt ? (
                <time dateTime={detail.lastContactAt}>{formatRelative(locale, detail.lastContactAt, at)}</time>
              ) : (
                t.profile.noContact
              )}
            </dd>
          </div>
        </dl>

        {detail.rightHolderOnly ? <p className="text-caption text-fg-muted">{t.profile.rightHolderNote}</p> : null}

        {permission ? (
          <PermissionNotice
            locale={locale}
            area="sensitive_owner_data"
            explanation={permission}
            actor={viewer.agent.role}
            step={format(t.profile.safeStep, { name: detail.responsibleAgent.name })}
          />
        ) : null}
      </Card>

      <div className="mt-4">
        <OwnerActions
          locale={locale}
          ownerName={owner.name}
          phone={owner.phone}
          callBlockedHintId={revokedAt ? callHintId : undefined}
          links={{
            calls: callsTimelineHref(locale, owner.id),
            request: verificationRequest,
            property: appHref(locale, "propertiesNew"),
            newOwner: appHref(locale, "ownersNew"),
          }}
          today={tashkentDateKey(at)}
        />
      </div>

      <div className="mt-6">
        <ChipRow label={t.profile.sectionsLabel}>
          {sections.map((section) => (
            <li key={section.id}>
              <ChipLink href={`#${section.id}`}>{section.label}</ChipLink>
            </li>
          ))}
        </ChipRow>
      </div>

      <div className="mt-6 space-y-8">
        <ConsentsSection locale={locale} detail={detail} />
        <PropertiesSection locale={locale} groups={groups} />
        <ContractsSection locale={locale} contracts={detail.contracts} />
        <OwnerVerificationSection
          locale={locale}
          items={facts}
          at={at}
          viewerId={viewer.agent.id}
          performers={performers}
          requestHref={verificationRequest}
        />
        <HistorySection locale={locale} listings={listings} at={at} />
        <TimelineSection locale={locale} detail={detail} />
      </div>

      <StickyBarSpacer />
    </>
  );
}
