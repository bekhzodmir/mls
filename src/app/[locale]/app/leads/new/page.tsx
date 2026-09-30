import type { Metadata } from "next";
import { contactCard } from "@/components/app/crm/duplicates";
import { NewLeadForm } from "@/components/app/crm/new-lead-form";
import { PageHeader } from "@/components/app/page-header";
import leads from "@/i18n/messages/leads";
import { getLocale } from "@/i18n/server";
import { getViewer, listAgents, listClients } from "@/lib/data/repository";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: leads[locale].meta.newTitle };
}

/**
 * New lead (§35.3 steps 1–4, §36.3). The duplicate check runs against the
 * viewer's clients before saving; only contact data needed for the check is
 * sent to the browser.
 */
export default async function NewLeadPage() {
  const locale = await getLocale();
  const t = leads[locale];
  const [viewer, agents, clients] = await Promise.all([getViewer(), listAgents(), listClients()]);
  const colleagues = agents
    .filter((agent) => agent.organizationId && agent.organizationId === viewer.agent.organizationId)
    .map((agent) => ({ id: agent.id, name: agent.name }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader locale={locale} backHref={appHref(locale, "leads")} title={t.form.title} subtitle={t.form.subtitle} />
      <NewLeadForm
        locale={locale}
        clients={clients.map((item) => contactCard(item.client))}
        agents={colleagues}
        viewerId={viewer.agent.id}
      />
    </div>
  );
}
