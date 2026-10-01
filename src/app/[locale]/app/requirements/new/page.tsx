import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquareQuote } from "lucide-react";
import { editorCandidates } from "@/components/app/crm/editor-candidates";
import { firstParam } from "@/components/app/crm/filters";
import {
  RequirementEditor,
  type ActiveRequirementHint,
  type EditedRequirement,
} from "@/components/app/crm/requirement-editor";
import { formValuesFromRequirement } from "@/components/app/crm/requirement-form";
import { requirementSummary } from "@/components/app/crm/requirement-summary";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import leads from "@/i18n/messages/leads";
import editor from "@/i18n/messages/requirement-editor";
import { getLocale } from "@/i18n/server";
import {
  getClient,
  getLead,
  getRequirement,
  getViewer,
  listClients,
  listListings,
  listTelegramListings,
} from "@/lib/data/repository";
import { appHref, appPath } from "@/lib/routes";

/** Longer text is cut: the field is one or two sentences, not a document. */
const MAX_QUERY_LENGTH = 500;

export async function generateMetadata({ searchParams }: PageProps<"/[locale]/app/requirements/new">): Promise<Metadata> {
  const locale = await getLocale();
  const editing = firstParam((await searchParams).requirementId);
  return { title: editing ? editor[locale].meta.editTitle : editor[locale].meta.title };
}

/**
 * New requirement (§14.4, §22.4, §35.4). `?clientId=` sets the client,
 * `?leadId=` starts from the lead's message, `?q=` from a phrase (e.g. the
 * request a call summary extracted; it wins over the lead's message, which
 * stays shown above), and `?requirementId=` opens one
 * of the viewer's requirements for editing (its client wins over `clientId`;
 * an unknown id falls back to a new requirement). The server sends the editor the
 * match candidates the viewer may see (access rules applied by the
 * repository), and the browser counts matches live with the pure engine.
 */
export default async function NewRequirementPage({ searchParams }: PageProps<"/[locale]/app/requirements/new">) {
  const locale = await getLocale();
  const t = editor[locale];
  const params = await searchParams;
  const requirementId = firstParam(params.requirementId);
  const leadId = firstParam(params.leadId);
  const query = firstParam(params.q)?.slice(0, MAX_QUERY_LENGTH);
  const edited = requirementId ? (await getRequirement(requirementId))?.requirement : undefined;
  const clientId = edited?.clientId ?? firstParam(params.clientId);

  const [viewer, detail, leadView, clientItems, listings, posts] = await Promise.all([
    getViewer(),
    clientId ? getClient(clientId) : undefined,
    leadId && !edited ? getLead(leadId) : undefined,
    listClients(),
    listListings({ scope: "all" }),
    listTelegramListings(),
  ]);
  const lead = leadView?.lead;
  const editing: EditedRequirement | undefined = edited
    ? {
        id: edited.id,
        version: edited.version,
        values: formValuesFromRequirement(edited),
        hardCriteria: [...edited.hardCriteria],
      }
    : undefined;

  const activeRequirements: Record<string, ActiveRequirementHint> = {};
  for (const item of clientItems) {
    const active = item.requirements.find((requirement) => requirement.status === "active");
    if (active) activeRequirements[item.client.id] = { id: active.id, summary: requirementSummary(locale, active) };
  }

  const backHref = edited
    ? appPath(locale, `/requirements/${encodeURIComponent(edited.id)}`)
    : detail
      ? appPath(locale, `/clients/${encodeURIComponent(detail.client.id)}`)
      : lead
      ? appPath(locale, `/leads/${encodeURIComponent(lead.id)}`)
      : appHref(locale, "clients");

  return (
    <>
      <PageHeader
        locale={locale}
        backHref={backHref}
        title={edited ? t.header.editTitle : t.header.title}
        subtitle={edited ? format(t.header.editSubtitle, { version: edited.version }) : t.header.subtitle}
      />

      <div className="mb-6 space-y-3">
        {requirementId && !edited ? <Notice kind="warning">{t.context.requirementNotFound}</Notice> : null}
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
        initialText={edited?.naturalLanguageInput ?? query ?? lead?.message ?? ""}
        agentId={viewer.agent.id}
        organizationId={viewer.agent.organizationId}
        client={detail ? { id: detail.client.id, name: detail.client.name } : undefined}
        clientOptions={clientItems.map((item) => ({ id: item.client.id, name: item.client.name }))}
        lead={lead ? { id: lead.id, name: lead.name } : undefined}
        activeRequirements={activeRequirements}
        editing={editing}
      />
    </>
  );
}
