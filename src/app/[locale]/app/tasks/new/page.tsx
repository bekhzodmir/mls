import type { Metadata } from "next";
import { firstParam } from "@/components/app/crm/filters";
import { leadHref } from "@/components/app/crm/lead-card";
import { ownerHref } from "@/components/app/owners/owner-model";
import { PageHeader } from "@/components/app/page-header";
import { listHref } from "@/components/app/today/links";
import { Notice } from "@/components/ui/notice";
import { compareText } from "@/i18n/format";
import leads from "@/i18n/messages/leads";
import tasks from "@/i18n/messages/tasks";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadLead, loadOwner } from "@/lib/data/cached";
import { listClients } from "@/lib/data/repository";
import { tashkentDateKey } from "@/lib/domain/working-days";
import { TaskForm, type RelatedRecord } from "./task-form";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: tasks[locale].meta.newTitle };
}

/**
 * New task (§14.8): a demo form. `?clientId=` preselects one of the viewer's
 * clients; `?leadId=` or `?ownerId=` (e.g. from a call or an owner profile)
 * shows the lead or owner the task is about — the lead first when both are
 * given. Only records the viewer may see are used; anything else is
 * ignored with a notice.
 */
export default async function NewTaskPage({ searchParams }: PageProps<"/[locale]/app/tasks/new">) {
  const locale = await getLocale();
  const params = await searchParams;
  const clientId = firstParam(params.clientId);
  const leadId = firstParam(params.leadId);
  const ownerId = firstParam(params.ownerId);
  const [clientItems, leadView, ownerView] = await Promise.all([
    listClients(),
    leadId ? loadLead(leadId) : undefined,
    ownerId ? loadOwner(ownerId) : undefined,
  ]);
  const clients = clientItems
    .map(({ client }) => ({ id: client.id, name: client.name }))
    .sort((a, b) => compareText(locale, a.name, b.name));
  // Only a client the viewer can see may be preselected; anything else is ignored.
  const preselected = clients.find((client) => client.id === clientId)?.id;

  let related: RelatedRecord | undefined;
  if (leadView) {
    const { lead } = leadView;
    related = { kind: "lead", name: lead.name ?? leads[locale].card.noName, href: leadHref(locale, lead.id) };
  } else if (ownerView) {
    related = { kind: "owner", name: ownerView.owner.name, href: ownerHref(locale, ownerView.owner.id) };
  }
  const missingRelated = (leadId && !leadView) || (ownerId && !ownerView && !leadView);

  return (
    <div>
      <PageHeader locale={locale} title={tasks[locale].meta.newTitle} backHref={listHref(locale, "/tasks")} />
      {missingRelated ? (
        <Notice kind="warning" className="mb-5">
          {tasks[locale].form.relatedNotFound}
        </Notice>
      ) : null}
      <TaskForm
        locale={locale}
        clients={clients}
        today={tashkentDateKey(now())}
        defaultClientId={preselected}
        related={related}
      />
    </div>
  );
}
