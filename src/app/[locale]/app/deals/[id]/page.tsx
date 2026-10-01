import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auditHref } from "@/components/app/audit/audit-model";
import { contractHref } from "@/components/app/contracts/contract-rules";
import { CrmTabs } from "@/components/app/crm-tabs";
import { propertyTitle } from "@/components/app/inventory/labels";
import { PageHeader } from "@/components/app/page-header";
import { MlsReportBadge, OverdueBadge } from "@/components/app/deals/deal-badges";
import {
  DealActionBar,
  DealAudit,
  DealDemoProvider,
  DealDocuments,
  DealFinancials,
  DealStagePanel,
  type DealContractLink,
} from "@/components/app/deals/deal-demo";
import {
  ActSection,
  ChecklistSection,
  CommissionSection,
  NextActionSection,
  PartiesSection,
  PropertySection,
  VerificationSection,
} from "@/components/app/deals/deal-sections";
import { dealListHref } from "@/components/app/deals/pipeline";
import { format } from "@/i18n/define-messages";
import contracts from "@/i18n/messages/contracts";
import deals from "@/i18n/messages/deals";
import domain from "@/i18n/messages/domain";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadDeal } from "@/lib/data/cached";
import { getOrganization, getViewer, listAgents } from "@/lib/data/repository";
import type { Organization } from "@/lib/domain/types";


export async function generateMetadata({ params }: PageProps<"/[locale]/app/deals/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadDeal(id);
  const t = deals[locale].meta;
  // Privacy-safe label only (type, rooms, massif) — never the address.
  return { title: view ? `${t.detail}: ${propertyTitle(locale, view.listing.property)}` : t.detail };
}

/**
 * Deal Workspace (§7.7, §22.12, §35.7, §36.3): stage stepper with a real
 * prerequisite check, parties with roles, property, price negotiation,
 * checklist, documents, verification, the commission split between realtors
 * (accrued ≠ paid), the act and its 3-working-day MLS window, next step and
 * an append-only audit log. Advancing, accepting, countering and uploading
 * are local demo actions and say so.
 */
export default async function DealPage({ params }: PageProps<"/[locale]/app/deals/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadDeal(id);
  if (!view) notFound();

  const at = now();
  const t = deals[locale];
  const [{ agent: viewer }, agents] = await Promise.all([getViewer(), listAgents()]);
  const agentNames = Object.fromEntries(agents.map((agent) => [agent.id, agent.name]));
  const partyAgents = [view.agent, view.listing.agent, ...(view.partner ? [view.partner] : [])];
  const organizationIds = [...new Set(partyAgents.map((agent) => agent.organizationId).filter((org): org is string => Boolean(org)))];
  const contractLinks: DealContractLink[] = view.contracts.map(({ contract }) => ({
    id: contract.id,
    number: contract.number,
    href: contractHref(locale, contract.id),
    kindLabel: contracts[locale].kind[contract.kind],
    service: contract.kind !== "cooperation",
  }));
  const serviceContract = contractLinks.find((link) => link.service);
  const organizations = Object.fromEntries(
    (await Promise.all(organizationIds.map((orgId) => getOrganization(orgId))))
      .filter((org): org is Organization => org !== undefined)
      .map((org) => [org.id, org]),
  );

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <PageHeader
        locale={locale}
        title={propertyTitle(locale, view.listing.property)}
        subtitle={format(t.header.subtitle, { client: view.client.name, stage: domain[locale].dealStage[view.deal.stage] })}
        backHref={dealListHref(locale)}
        className="mb-0"
      >
        {view.nextActionOverdue || view.mlsReport.state === "due" || view.mlsReport.state === "overdue" ? (
          <div className="flex flex-wrap gap-1.5">
            {view.nextActionOverdue ? <OverdueBadge locale={locale} /> : null}
            <MlsReportBadge locale={locale} report={view.mlsReport} />
          </div>
        ) : null}
        <CrmTabs locale={locale} />
      </PageHeader>

      <DealDemoProvider
        locale={locale}
        deal={view.deal}
        offers={view.offers.map((item) => item.offer)}
        viewerId={viewer.id}
        nowIso={at.toISOString()}
        viewings={view.viewings.map((item) => item.viewing)}
        listing={view.listing.listing}
        access={view.listing.access}
        listingAgentName={view.listing.agent.name}
        agentNames={agentNames}
      >
        <DealStagePanel />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
            <NextActionSection locale={locale} view={view} now={at} />
            <DealFinancials />
            <DealDocuments contracts={contractLinks} />
            <ChecklistSection
              locale={locale}
              items={view.deal.checklist}
              agentNames={agentNames}
              serviceContract={serviceContract}
            />
          </div>
          <div className="space-y-4">
            <PartiesSection locale={locale} view={view} viewerId={viewer.id} organizations={organizations} />
            <PropertySection locale={locale} view={view} />
            <VerificationSection
              locale={locale}
              items={view.listing.listing.verifications}
              detailed={view.listing.ownerData}
            />
            <CommissionSection locale={locale} view={view} />
            <ActSection locale={locale} view={view} />
          </div>
        </div>
        <DealAudit journalHref={auditHref(locale, { target: "deal" })} />
        <DealActionBar />
      </DealDemoProvider>
    </div>
  );
}
