import type { Metadata } from "next";
import { Inbox, MessageSquarePlus } from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { LeadCard } from "@/components/app/crm/lead-card";
import { leadSourceIcon } from "@/components/app/crm/badges";
import { crmHref, firstParam, leadStatuses, oneOf } from "@/components/app/crm/filters";
import { ChipCount, ChipRow } from "@/components/app/crm/layout-parts";
import { isUrgent } from "@/components/app/crm/sla";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format } from "@/i18n/define-messages";
import domain from "@/i18n/messages/domain";
import leads from "@/i18n/messages/leads";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { listLeads } from "@/lib/data/repository";
import type { LeadView } from "@/lib/data/views";
import { leadSources } from "@/lib/domain/types";
import { appHref } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: leads[locale].meta.title };
}

/** Unanswered leads by deadline first, then everything else newest first. */
function byUrgency(a: LeadView, b: LeadView): number {
  const waitingA = a.sla.state === "breached" || a.sla.state === "due_soon" || a.sla.state === "on_track";
  const waitingB = b.sla.state === "breached" || b.sla.state === "due_soon" || b.sla.state === "on_track";
  if (waitingA !== waitingB) return waitingA ? -1 : 1;
  if (waitingA) return a.sla.dueAt.localeCompare(b.sla.dueAt);
  return b.lead.receivedAt.localeCompare(a.lead.receivedAt);
}

/**
 * Unified Lead Inbox (§14.1, §22.2, §36.3): every channel in one list with
 * source, received time, SLA, responsible, duplicate hint and next step.
 * Filters: ?status=…, ?sla=urgent, ?source=….
 */
export default async function LeadsPage({ searchParams }: PageProps<"/[locale]/app/leads">) {
  const locale = await getLocale();
  const t = leads[locale];
  const d = domain[locale];
  const params = await searchParams;
  const status = oneOf(params.status, leadStatuses);
  const urgent = !status && firstParam(params.sla) === "urgent";
  const source = oneOf(params.source, leadSources);
  const at = now();

  const all = await listLeads();
  const bySource = source ? all.filter((view) => view.lead.source === source) : all;
  const byStatus = urgent
    ? all.filter((view) => isUrgent(view.sla))
    : status
      ? all.filter((view) => view.lead.status === status)
      : all;
  const shown = bySource.filter((view) => byStatus.includes(view)).sort(byUrgency);
  const filtered = Boolean(status || urgent || source);

  const statusParams = (next: { status?: string; sla?: string }) => crmHref(locale, "/leads", { ...next, source });
  const sourceParams = (next?: string) =>
    crmHref(locale, "/leads", { status, sla: urgent ? "urgent" : undefined, source: next });
  const sourcesPresent = leadSources.filter((code) => byStatus.some((view) => view.lead.source === code));

  const summary = format(t.inbox.subtitle, {
    fresh: all.filter((view) => view.lead.status === "new").length,
    urgent: all.filter((view) => isUrgent(view.sla)).length,
    breached: all.filter((view) => view.sla.state === "breached").length,
  });

  return (
    <>
      <PageHeader
        locale={locale}
        title={t.inbox.title}
        subtitle={summary}
        actions={
          <ButtonLink href={appHref(locale, "leadsNew")}>
            <MessageSquarePlus aria-hidden className="size-4" />
            {t.inbox.add}
          </ButtonLink>
        }
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      <div className="mb-4 space-y-2">
        <ChipRow label={t.inbox.statusFilter}>
          <li>
            <ChipLink href={statusParams({})} active={!status && !urgent}>
              {t.inbox.all} <ChipCount n={bySource.length} />
            </ChipLink>
          </li>
          <li>
            <ChipLink href={statusParams({ sla: "urgent" })} active={urgent}>
              {t.inbox.urgent} <ChipCount n={bySource.filter((view) => isUrgent(view.sla)).length} />
            </ChipLink>
          </li>
          {leadStatuses.map((code) => (
            <li key={code}>
              <ChipLink href={statusParams({ status: code })} active={status === code}>
                {d.leadStatus[code]} <ChipCount n={bySource.filter((view) => view.lead.status === code).length} />
              </ChipLink>
            </li>
          ))}
        </ChipRow>
        <ChipRow label={t.inbox.sourceFilter}>
          <li>
            <ChipLink href={sourceParams()} active={!source}>
              {t.inbox.allSources}
            </ChipLink>
          </li>
          {(source && !sourcesPresent.includes(source) ? [...sourcesPresent, source] : sourcesPresent).map((code) => {
            const Icon = leadSourceIcon[code];
            return (
              <li key={code}>
                <ChipLink href={sourceParams(code)} active={source === code}>
                  <Icon aria-hidden className="size-4" />
                  {d.leadSource[code]}
                </ChipLink>
              </li>
            );
          })}
        </ChipRow>
      </div>

      {shown.length > 0 ? (
        <ul aria-label={t.inbox.listLabel} className="grid gap-3 lg:grid-cols-2">
          {shown.map((view) => (
            <li key={view.lead.id}>
              <LeadCard locale={locale} view={view} at={at} />
            </li>
          ))}
        </ul>
      ) : filtered ? (
        <EmptyState
          icon={Inbox}
          title={t.empty.filteredTitle}
          description={t.empty.filteredText}
          action={
            <ButtonLink href={appHref(locale, "leads")} variant="secondary">
              {t.empty.reset}
            </ButtonLink>
          }
        />
      ) : (
        <EmptyState
          icon={Inbox}
          title={t.empty.title}
          description={t.empty.text}
          action={
            <ButtonLink href={appHref(locale, "leadsNew")}>
              <MessageSquarePlus aria-hidden className="size-4" />
              {t.inbox.add}
            </ButtonLink>
          }
        />
      )}
    </>
  );
}
