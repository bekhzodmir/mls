import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CircleCheck,
  CircleMinus,
  Clock,
  Flag,
  Inbox,
  Languages,
  MessageSquareQuote,
  Phone,
  Send,
  UserPlus,
  UserRoundCheck,
} from "lucide-react";
import { CrmTabs } from "@/components/app/crm-tabs";
import { LeadSourceBadge, LeadStatusBadge, SlaBadge } from "@/components/app/crm/badges";
import { DuplicateNotice } from "@/components/app/crm/duplicate-notice";
import { contactCard, duplicateReasons, namesLookAlike, normalizeTelegram } from "@/components/app/crm/duplicates";
import { LeadAssignForm, LeadCloseForm } from "@/components/app/crm/lead-actions";
import { telegramHref } from "@/components/app/crm/lead-card";
import { CrmSection, StickyActionBar, StickyBarSpacer, stickyActionClasses } from "@/components/app/crm/layout-parts";
import { describeSla } from "@/components/app/crm/sla";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { format } from "@/i18n/define-messages";
import { formatDateTime, formatRelative } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import leads from "@/i18n/messages/leads";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadLead } from "@/lib/data/cached";
import { getViewer, listAgents, listClients } from "@/lib/data/repository";
import { formatUzPhone, normalizeUzPhone, telHref } from "@/lib/domain/phone";
import { tashkentDateKey } from "@/lib/domain/working-days";
import { appHref, appPath } from "@/lib/routes";

const DAY_MS = 86_400_000;
const primaryAction = "bg-primary text-primary-fg hover:bg-primary-hover";
const secondaryAction = "border border-border bg-surface text-fg hover:bg-surface-muted";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/leads/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadLead(id);
  const t = leads[locale];
  if (!view) return { title: t.meta.title };
  return { title: format(t.meta.detailTitle, { name: view.lead.name ?? t.card.noName }) };
}

/**
 * Lead profile (§14.1, §21.4 #15, §35.3): the original message verbatim, the
 * first-response SLA, assignment, qualification into Client / Requirement
 * (the lead itself stays in history), a reasoned Lost / Deferred and the
 * duplicate comparison.
 */
export default async function LeadPage({ params }: PageProps<"/[locale]/app/leads/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadLead(id);
  if (!view) notFound();

  const t = leads[locale];
  const d = domain[locale];
  const at = now();
  const { lead } = view;
  const name = lead.name ?? t.card.noName;
  const sla = describeSla(locale, lead, view.sla);
  const closed = lead.status === "converted" || lead.status === "lost";

  const [viewer, agents, clientItems] = await Promise.all([getViewer(), listAgents(), listClients()]);
  const colleagues = agents
    .filter((agent) => agent.organizationId && agent.organizationId === viewer.agent.organizationId)
    .map((agent) => ({ id: agent.id, name: agent.name }));
  const convertedClient = clientItems.find((item) => item.client.leadId === lead.id)?.client;
  const minReturnDate = tashkentDateKey(new Date(at.getTime() + DAY_MS));

  const newClientHref = `${appHref(locale, "clientsNew")}?leadId=${encodeURIComponent(lead.id)}`;
  const newRequirementHref = `${appHref(locale, "requirementsNew")}?leadId=${encodeURIComponent(lead.id)}`;

  const duplicate = view.duplicateCandidate;
  const duplicateHit = duplicate
    ? {
        client: contactCard(duplicate),
        reasons: duplicateReasons(
          { name: lead.name, phones: lead.phone ? [lead.phone] : [], telegramUsername: lead.telegramUsername },
          duplicate,
        ),
      }
    : undefined;

  const timeline = [
    { key: "received", icon: Inbox, label: t.detail.timelineReceived, at: lead.receivedAt },
    { key: "due", icon: Flag, label: t.detail.timelineDue, at: lead.slaDueAt },
    lead.firstResponseAt
      ? { key: "responded", icon: CircleCheck, label: t.detail.timelineResponded, at: lead.firstResponseAt }
      : { key: "none", icon: Clock, label: t.detail.timelineNoResponse, at: at.toISOString(), now: true },
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <>
      <PageHeader
        locale={locale}
        backHref={appHref(locale, "leads")}
        title={name}
        subtitle={
          <time dateTime={lead.receivedAt} title={formatDateTime(locale, lead.receivedAt)}>
            {format(t.card.received, { time: formatRelative(locale, lead.receivedAt, at) })}
          </time>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          <LeadStatusBadge locale={locale} status={lead.status} />
          <LeadSourceBadge locale={locale} source={lead.source} />
          <SlaBadge display={sla} label={t.sla.label} />
        </div>
        <CrmTabs locale={locale} />
      </PageHeader>

      {lead.phone || lead.telegramUsername || convertedClient || !closed ? (
        <StickyActionBar label={t.detail.actionsLabel}>
          {lead.phone ? (
            <a href={telHref(lead.phone)} className={cn(stickyActionClasses, primaryAction)}>
              <Phone aria-hidden className="size-5 lg:size-4" />
              {t.card.call}
            </a>
          ) : null}
          {lead.telegramUsername ? (
            <a
              href={telegramHref(lead.telegramUsername)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(stickyActionClasses, lead.phone ? secondaryAction : primaryAction)}
            >
              <Send aria-hidden className="size-5 lg:size-4" />
              {t.card.write}
            </a>
          ) : null}
          {convertedClient ? (
            <Link
              href={appPath(locale, `/clients/${encodeURIComponent(convertedClient.id)}`)}
              className={cn(stickyActionClasses, secondaryAction)}
            >
              <UserRoundCheck aria-hidden className="size-5 lg:size-4" />
              {t.detail.openClient}
            </Link>
          ) : !closed ? (
            <Link
              href={newClientHref}
              className={cn(stickyActionClasses, lead.phone || lead.telegramUsername ? secondaryAction : primaryAction)}
            >
              <UserPlus aria-hidden className="size-5 lg:size-4" />
              {t.detail.toClient}
            </Link>
          ) : null}
        </StickyActionBar>
      ) : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-6">
          <CrmSection id="message" title={t.detail.message} description={t.detail.messageHint}>
            <figure className="space-y-2">
              <blockquote
                lang={lead.language === "uz" ? "uz-Latn" : "ru"}
                className="flex gap-3 rounded-lg border-l-4 border-primary bg-surface p-4 text-body text-fg shadow-card"
              >
                <MessageSquareQuote aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
                <p className="whitespace-pre-line">{lead.message}</p>
              </blockquote>
              <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-fg-muted">
                <span className="inline-flex items-center gap-1">
                  <Languages aria-hidden className="size-3.5" />
                  {t.detail.language}: {t.language[lead.language]}
                </span>
                <span>
                  {t.detail.source}: {d.leadSource[lead.source]}
                </span>
              </figcaption>
            </figure>
          </CrmSection>

          <CrmSection id="sla" title={t.detail.timeline}>
            <ol className="space-y-0">
              {timeline.map((item, index) => {
                const Icon = item.icon;
                const isNow = "now" in item;
                return (
                  <li key={item.key} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < timeline.length - 1 ? (
                      <span aria-hidden className="absolute top-9 bottom-0 left-4 w-px bg-border" />
                    ) : null}
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex size-8 shrink-0 items-center justify-center rounded-full",
                        isNow && view.sla.state === "breached"
                          ? "bg-danger-bg text-danger-fg"
                          : "bg-surface-muted text-fg-muted",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="pt-1">
                      <p className="text-small font-medium text-fg">{item.label}</p>
                      <p className="text-caption text-fg-muted">
                        {isNow ? (
                          <>
                            {t.detail.timelineNow} · {sla.text}
                          </>
                        ) : (
                          <time dateTime={item.at}>{formatDateTime(locale, item.at)}</time>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CrmSection>

          {duplicate && duplicateHit ? (
            <CrmSection id="duplicate" title={t.detail.duplicateSection}>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-left text-small">
                  <caption className="px-4 pt-3 text-left text-small font-semibold text-fg">
                    {t.duplicate.compareTitle}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-caption text-fg-muted">
                      <th scope="col" className="px-4 py-2 font-medium">
                        <span className="sr-only">{t.duplicate.field.label}</span>
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        {t.duplicate.compareLead}
                      </th>
                      <th scope="col" className="px-2 py-2 font-medium">
                        {t.duplicate.compareClient}
                      </th>
                      <th scope="col" className="px-4 py-2 font-medium">
                        <span className="sr-only">{t.duplicate.same}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        key: "name",
                        label: t.duplicate.field.name,
                        lead: lead.name ?? d.unknown,
                        client: duplicate.name,
                        same: namesLookAlike(lead.name, duplicate.name),
                      },
                      {
                        key: "phone",
                        label: t.duplicate.field.phone,
                        lead: lead.phone ? formatUzPhone(lead.phone) : d.unknown,
                        client: duplicate.phones.map(formatUzPhone).join(", "),
                        same: Boolean(
                          lead.phone &&
                          duplicate.phones.some((phone) => normalizeUzPhone(phone) === normalizeUzPhone(lead.phone!)),
                        ),
                      },
                      {
                        key: "telegram",
                        label: t.duplicate.field.telegram,
                        lead: lead.telegramUsername ? `@${lead.telegramUsername}` : d.unknown,
                        client: duplicate.telegramUsername ? `@${duplicate.telegramUsername}` : d.unknown,
                        same: Boolean(
                          normalizeTelegram(lead.telegramUsername) &&
                          normalizeTelegram(lead.telegramUsername) === normalizeTelegram(duplicate.telegramUsername),
                        ),
                      },
                      {
                        key: "source",
                        label: t.duplicate.field.source,
                        lead: d.leadSource[lead.source],
                        client: d.leadSource[duplicate.source],
                        same: lead.source === duplicate.source,
                      },
                    ].map((row) => (
                      <tr key={row.key} className="border-b border-border last:border-0">
                        <th scope="row" className="px-4 py-2 font-medium text-fg-muted">
                          {row.label}
                        </th>
                        <td className="px-2 py-2 text-fg">{row.lead}</td>
                        <td className="px-2 py-2 text-fg">{row.client}</td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-caption font-medium whitespace-nowrap",
                              row.same ? "text-success-fg" : "text-fg-muted",
                            )}
                          >
                            {row.same ? (
                              <CircleCheck aria-hidden className="size-3.5" />
                            ) : (
                              <CircleMinus aria-hidden className="size-3.5" />
                            )}
                            {row.same ? t.duplicate.same : t.duplicate.differs}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              {!closed ? <DuplicateNotice locale={locale} hits={[duplicateHit]} variant="inbox" /> : null}
            </CrmSection>
          ) : null}

          {convertedClient || !closed ? (
            <CrmSection
              id="qualify"
              title={t.detail.qualify}
              description={convertedClient ? undefined : t.detail.qualifyText}
            >
              {convertedClient ? (
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="flex items-center gap-2 text-small font-medium text-success-fg">
                    <UserRoundCheck aria-hidden className="size-4" />
                    {t.detail.converted}: {convertedClient.name}
                  </p>
                  <ButtonLink
                    href={appPath(locale, `/clients/${encodeURIComponent(convertedClient.id)}`)}
                    variant="secondary"
                  >
                    {t.detail.openClient}
                  </ButtonLink>
                </Card>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={newClientHref}>
                    <UserPlus aria-hidden className="size-4" />
                    {t.detail.toClient}
                  </ButtonLink>
                  <ButtonLink href={newRequirementHref} variant="secondary">
                    {t.detail.toRequirement}
                  </ButtonLink>
                </div>
              )}
            </CrmSection>
          ) : null}
        </div>

        <aside className="space-y-6">
          <CrmSection id="contacts" title={t.detail.contacts}>
            <Card className="p-4">
              <dl className="space-y-3 text-small">
                <div>
                  <dt className="text-fg-muted">{t.detail.phone}</dt>
                  <dd className="font-medium text-fg">
                    {lead.phone ? (
                      <a href={telHref(lead.phone)} className="tabular underline-offset-2 hover:underline">
                        {formatUzPhone(lead.phone)}
                      </a>
                    ) : (
                      <span className="text-fg-muted">{t.detail.noPhone}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-fg-muted">{t.detail.telegram}</dt>
                  <dd className="font-medium text-fg">
                    {lead.telegramUsername ? (
                      <a
                        href={telegramHref(lead.telegramUsername)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        @{lead.telegramUsername}
                      </a>
                    ) : (
                      <span className="text-fg-muted">{t.detail.noTelegram}</span>
                    )}
                  </dd>
                </div>
                {!closed || lead.nextAction ? (
                  <div>
                    <dt className="text-fg-muted">{t.detail.nextAction}</dt>
                    <dd className={lead.nextAction ? "font-medium text-fg" : "text-fg-muted"}>
                      {lead.nextAction ?? t.card.noNextAction}
                    </dd>
                  </div>
                ) : null}
                {lead.status === "lost" && lead.lostReason ? (
                  <div>
                    <dt className="text-fg-muted">{t.card.lostReason}</dt>
                    <dd className="font-medium text-fg">{lead.lostReason}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          </CrmSection>

          {!closed ? (
            <CrmSection id="assign" title={t.assign.title}>
              <Card className="p-4">
                <LeadAssignForm
                  locale={locale}
                  agents={colleagues}
                  viewerId={viewer.agent.id}
                  currentId={view.assignedAgent?.id}
                />
              </Card>
            </CrmSection>
          ) : null}

          {!closed ? (
            <CrmSection id="close" title={t.close.title} description={t.close.text}>
              <Card className="p-4">
                <LeadCloseForm locale={locale} minReturnDate={minReturnDate} />
              </Card>
            </CrmSection>
          ) : null}
        </aside>
      </div>

      <StickyBarSpacer />
    </>
  );
}
