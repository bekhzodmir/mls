import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareQuote } from "lucide-react";
import { editorCandidates } from "@/components/app/crm/editor-candidates";
import { firstParam } from "@/components/app/crm/filters";
import { RequirementEditor, type ActiveRequirementHint } from "@/components/app/crm/requirement-editor";
import { requirementSummary } from "@/components/app/crm/requirement-summary";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import leads from "@/i18n/messages/leads";
import editor from "@/i18n/messages/requirement-editor";
import { getLocale } from "@/i18n/server";
import { getClient, getLead, getViewer, listClients, listListings, listTelegramListings } from "@/lib/data/repository";
import { appHref, appPath } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: editor[locale].meta.title };
}

/**
 * New requirement (§14.4, §22.4, §35.4). `?clientId=` sets the client,
 * `?leadId=` starts from the lead's message. The server sends the editor the
 * match candidates the viewer may see (access rules applied by the
 * repository), and the browser counts matches live with the pure engine.
 */
export default async function NewRequirementPage({ searchParams }: PageProps<"/[locale]/app/requirements/new">) {
  const locale = await getLocale();
  const t = editor[locale];
  const params = await searchParams;
  const clientId = firstParam(params.clientId);
  const leadId = firstParam(params.leadId);

  const [viewer, detail, leadView, clientItems, listings, posts] = await Promise.all([
    getViewer(),
    clientId ? getClient(clientId) : undefined,
    leadId ? getLead(leadId) : undefined,
    listClients(),
    listListings({ scope: "all" }),
    listTelegramListings(),
  ]);
  const lead = leadView?.lead;

  const activeRequirements: Record<string, ActiveRequirementHint> = {};
  for (const item of clientItems) {
    const active = item.requirements.find((requirement) => requirement.status === "active");
    if (active) activeRequirements[item.client.id] = { id: active.id, summary: requirementSummary(locale, active) };
  }

  const backHref = detail
    ? appPath(locale, `/clients/${encodeURIComponent(detail.client.id)}`)
    : lead
      ? appPath(locale, `/leads/${encodeURIComponent(lead.id)}`)
      : appHref(locale, "clients");

  return (
    <>
      <PageHeader locale={locale} backHref={backHref} title={t.header.title} subtitle={t.header.subtitle} />

      <div className="mb-6 space-y-3">
        {detail ? (
          <p className="text-small text-fg">
            {t.context.client}:{" "}
            <Link
              href={appPath(locale, `/clients/${encodeURIComponent(detail.client.id)}`)}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              {detail.client.name}
            </Link>
          </p>
        ) : clientId ? (
          <Notice kind="warning">{t.context.clientNotFound}</Notice>
        ) : null}

        {lead ? (
          <Notice kind="info" title={format(t.context.fromLead, { name: lead.name ?? leads[locale].card.noName })}>
            <blockquote className="flex gap-2 italic">
              <MessageSquareQuote aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span lang={lead.language === "uz" ? "uz-Latn" : "ru"}>{lead.message}</span>
            </blockquote>
            <p className="mt-1">{t.context.leadText}</p>
          </Notice>
        ) : leadId ? (
          <Notice kind="warning">{t.context.leadNotFound}</Notice>
        ) : null}
      </div>

      <RequirementEditor
        locale={locale}
        candidates={editorCandidates(listings, posts)}
        initialText={lead?.message ?? ""}
        agentId={viewer.agent.id}
        organizationId={viewer.agent.organizationId}
        client={detail ? { id: detail.client.id, name: detail.client.name } : undefined}
        clientOptions={clientItems.map((item) => ({ id: item.client.id, name: item.client.name }))}
        lead={lead ? { id: lead.id, name: lead.name } : undefined}
        activeRequirements={activeRequirements}
      />
    </>
  );
}
