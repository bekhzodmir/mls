import type { Metadata } from "next";
import { Building2, PlugZap, UserRound } from "lucide-react";
import { firstParam, oneOf } from "@/components/app/crm/filters";
import { CrmSection } from "@/components/app/crm/layout-parts";
import { propertyLabel } from "@/components/app/crm/object-label";
import { PageHeader } from "@/components/app/page-header";
import { explainAccess } from "@/components/app/verification/access";
import { AccessTable } from "@/components/app/verification/access-table";
import { PermissionNotice } from "@/components/app/verification/permission-notice";
import {
  requestContract,
  requesterStanding,
  requestListing,
  REQUEST_SUBJECTS,
} from "@/components/app/verification/request";
import { RequestForm } from "@/components/app/verification/request-form";
import { VerificationBadge } from "@/components/domain/badges";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import { compareText } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import verification from "@/i18n/messages/verification";
import { getLocale } from "@/i18n/server";
import { getViewer, listContracts, listListings } from "@/lib/data/repository";
import { displayedProfessionalStatus } from "@/lib/domain/professional-status";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: verification[locale].meta.request };
}

/**
 * New verification request (§17.4, §35.7 steps 1–4, §38.4). `?listingId=`
 * and `?subject=` prefill the form (from the queue's "Повторить проверку"
 * or an owner profile). The requester's legal status decides which §38.4
 * blocks are open; the viewer's role decides whether they may send it
 * themselves (§19 "Verification"). State integrations are not connected, so
 * the request becomes a demo checklist item only.
 */
export default async function VerificationRequestPage({
  searchParams,
}: PageProps<"/[locale]/app/verification/request">) {
  const locale = await getLocale();
  const t = verification[locale].request;
  const d = domain[locale];
  const params = await searchParams;
  const listingParam = firstParam(params.listingId);
  const subject = oneOf(params.subject, REQUEST_SUBJECTS);

  const [viewer, mine, contracts] = await Promise.all([
    getViewer(),
    listListings({ scope: "mine" }),
    listContracts(),
  ]);
  const { agent, organization } = viewer;
  const standing = requesterStanding(agent, organization);
  const listings = mine
    .map((view) => requestListing(view, propertyLabel(locale, view.property)))
    .sort((a, b) => compareText(locale, a.label, b.label) || a.id.localeCompare(b.id));
  // The viewer files the request, so only their own contracts can be its basis.
  const options = contracts.filter((view) => view.scope === "own").map(requestContract);
  const listingId = listings.find((item) => item.id === listingParam)?.id;
  const permission = explainAccess(agent.role, "verification", "own");
  const registry =
    standing === "real_estate_agent"
      ? agent.verifications.find((item) => item.subject === "org_registry")
      : organization?.registry;
  const StandingIcon = standing === "realtor_organization" ? Building2 : UserRound;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        locale={locale}
        backHref={appHref(locale, "verification")}
        title={t.title}
        subtitle={t.subtitle}
      />

      <div className="space-y-4">
        <Notice kind="info" title={t.integrationsTitle}>
          <p className="flex items-start gap-1.5">
            <PlugZap aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{t.integrationsText}</span>
          </p>
        </Notice>

        <section aria-labelledby="request-steps" className="space-y-2">
          <h2 id="request-steps" className="text-small font-semibold text-fg">
            {t.steps.label}
          </h2>
          <ol className="space-y-2">
            {[t.steps.s1, t.steps.s2, t.steps.s3, t.steps.s4].map((step, index) => (
              <li key={step} className="flex gap-3 text-small text-fg">
                <span
                  aria-hidden
                  className="tabular inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-caption font-semibold text-primary-soft-fg"
                >
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <PermissionNotice
          locale={locale}
          area="verification"
          explanation={permission}
          actor={agent.role}
          step={t.permissionStep}
        />

        <Card className="space-y-2 p-4">
          <h2 className="text-small font-semibold text-fg-muted">{t.standing.title}</h2>
          <p className="flex items-center gap-2 text-body font-semibold text-fg">
            <StandingIcon aria-hidden className="size-5 shrink-0 text-fg-muted" />
            {standing === "realtor_organization" && organization
              ? format(t.standing.realtor_organization, { name: organization.name })
              : standing === "real_estate_agent"
                ? format(t.standing.real_estate_agent, { name: agent.name })
                : t.standing.none}
          </p>
          <p className="text-small text-fg-muted">
            {
              {
                realtor_organization: t.standing.realtor_organizationText,
                real_estate_agent: t.standing.real_estate_agentText,
                none: t.standing.noneText,
              }[standing]
            }
          </p>
          <p className="text-small text-fg">
            {format(t.standing.yourStatus, { status: d.professionalStatus[displayedProfessionalStatus(agent)] })}
          </p>
          {standing !== "none" ? (
            <div className="flex flex-wrap items-center gap-2 text-small">
              <span className="text-fg-muted">{t.standing.registry}:</span>
              {registry ? (
                <VerificationBadge locale={locale} item={registry} />
              ) : (
                <span className="text-fg-muted">{t.standing.registryMissing}</span>
              )}
            </div>
          ) : null}
        </Card>

        {listingParam && !listingId ? <Notice kind="warning">{t.listingNotFound}</Notice> : null}

        <RequestForm
          locale={locale}
          standing={standing}
          listings={listings}
          contracts={options}
          initial={{ listingId, subject }}
        />

        <div className="pt-4">
          <CrmSection id="blocks" title={t.blocksTitle} description={t.blocksText}>
            <AccessTable locale={locale} standing={standing} />
          </CrmSection>
        </div>
      </div>
    </div>
  );
}
