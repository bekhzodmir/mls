import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UsersRound } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { ContractKindBadge } from "@/components/app/contracts/contract-badges";
import {
  ContractActionBar,
  ContractBarSpacer,
  ContractDemoProvider,
  ContractStatusPanel,
} from "@/components/app/contracts/contract-demo";
import {
  contractListHref,
  displayStatus,
  existingRenewal,
  issueContext,
  issuesOf,
  missingSignatures,
  newerTemplate,
} from "@/components/app/contracts/contract-rules";
import {
  ContractClausesSection,
  ContractLinksSection,
  ContractPartiesSection,
  ContractRelatedSection,
  ContractRemunerationSection,
  ContractRightHoldersSection,
  ContractServiceSection,
  ContractSignaturesSection,
  LegalDisclaimer,
} from "@/components/app/contracts/contract-sections";
import { loadContractRef } from "@/components/app/contracts/load";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { format } from "@/i18n/define-messages";
import contracts from "@/i18n/messages/contracts";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { getViewer, listAgents, listContracts } from "@/lib/data/repository";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/contracts/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadContractRef(id);
  const t = contracts[locale];
  return { title: view ? format(t.detail.title, { number: view.contract.number }) : t.meta.detail };
}

/**
 * Contract workspace (§17.5, §21.4 screen 39, §34.2, §38.5): parties,
 * service and term with the days left, remuneration, the §38.5 required
 * clauses, art. 37 right holders one by one, signatures with their method,
 * the `canActivate` result with every unmet condition, linked listing /
 * deal / request / cooperation and related contracts (renewals). Renew,
 * terminate (with a reason) and send for signature are local demo actions.
 * A visible notice says templates and legal force need a lawyer's review.
 */
export default async function ContractPage({ params }: PageProps<"/[locale]/app/contracts/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const [view, viewer, agents, all] = await Promise.all([loadContractRef(id), getViewer(), listAgents(), listContracts()]);
  if (!view) notFound();

  const t = contracts[locale];
  const at = now();
  const { contract } = view;
  const issues = issuesOf(view);
  const rules = issueContext(view);
  const status = displayStatus(view, at);
  const closed = status === "expired" || status === "terminated";
  const renewal = existingRenewal(contract, view.related);
  const agentNames = Object.fromEntries(agents.map((agent) => [agent.id, agent.name]));
  const holderNames = Object.fromEntries(view.rightHolders.map((holder) => [holder.ownerId, holder.name]));
  // The responsible agent manages the contract; so does agency management (§19).
  const canManage = view.scope === "own" || viewer.agent.role === "agency_owner";

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        title={format(t.detail.title, { number: contract.number })}
        subtitle={format(t.card.customer[view.customer.kind], { name: view.customer.name })}
        backHref={contractListHref(locale)}
        className="mb-0"
      >
        <div className="flex flex-wrap gap-1.5">
          <ContractKindBadge locale={locale} kind={contract.kind} />
          {view.scope === "agency" ? (
            <Badge icon={UsersRound}>{format(t.detail.scopeAgency, { agent: view.agent.name })}</Badge>
          ) : null}
        </div>
        <CrmTabs locale={locale} />
      </PageHeader>

      <LegalDisclaimer locale={locale} />

      <ContractDemoProvider
        locale={locale}
        contract={contract}
        nowIso={at.toISOString()}
        rules={rules}
        holderNames={holderNames}
        canManage={canManage}
        agentName={view.agent.name}
        existingRenewal={renewal ? { id: renewal.contract.id, number: renewal.contract.number } : undefined}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
            <ContractStatusPanel />
            <ContractPartiesSection locale={locale} view={view} />
            <ContractServiceSection
              locale={locale}
              view={view}
              now={at}
              newerTemplate={newerTemplate(contract, all.map((item) => item.contract))}
            />
            <ContractRemunerationSection locale={locale} contract={contract} />
          </div>
          <div className="space-y-4">
            <ContractClausesSection locale={locale} contract={contract} issues={issues} />
            <ContractRightHoldersSection locale={locale} view={view} />
            <ContractSignaturesSection
              locale={locale}
              contract={contract}
              agentNames={agentNames}
              missing={closed ? [] : missingSignatures(contract, at, rules)}
            />
            <ContractLinksSection locale={locale} detail={view} />
            <ContractRelatedSection locale={locale} related={view.related} renewalId={renewal?.contract.id} now={at} />
          </div>
        </div>
        <ContractBarSpacer />
        <ContractActionBar />
      </ContractDemoProvider>
    </div>
  );
}
