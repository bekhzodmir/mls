import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, History, Lock, MessagesSquare, UserRound } from "lucide-react";
import { channelIcon } from "@/components/app/calls/call-badges";
import { callsHref, subjectHref } from "@/components/app/calls/call-list";
import { subjectName, subjectRefText } from "@/components/app/calls/labels";
import {
  callsOf,
  channelCounts,
  communicationChannels,
  mergeTimeline,
  parseTimelineParams,
  staleSince,
  timelineHref,
  type TimelineSubject,
} from "@/components/app/calls/timeline";
import { TimelineList } from "@/components/app/calls/timeline-view";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format, plural } from "@/i18n/define-messages";
import { formatDate, formatRelative } from "@/i18n/format";
import calls from "@/i18n/messages/calls";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadClient, loadLead, loadOwner } from "@/lib/data/cached";
import { getViewer, listCalls, listCommunications } from "@/lib/data/repository";
import type { SubjectRef } from "@/lib/data/views";
import { appHref } from "@/lib/routes";

/** The person behind `?clientId=` / `?ownerId=` / `?leadId=`, when the viewer may see them. */
async function loadSubject(subject: TimelineSubject): Promise<SubjectRef | undefined> {
  switch (subject.kind) {
    case "client": {
      const detail = await loadClient(subject.id);
      return detail ? { ...subject, name: detail.client.name } : undefined;
    }
    case "owner": {
      const detail = await loadOwner(subject.id);
      return detail ? { ...subject, name: detail.owner.name } : undefined;
    }
    case "lead": {
      const view = await loadLead(subject.id);
      if (!view) return undefined;
      return view.lead.name ? { ...subject, name: view.lead.name } : { ...subject };
    }
  }
}

export async function generateMetadata({ searchParams }: PageProps<"/[locale]/app/calls/timeline">): Promise<Metadata> {
  const locale = await getLocale();
  const t = calls[locale].meta;
  const { subject } = parseTimelineParams(await searchParams);
  const person = subject ? await loadSubject(subject) : undefined;
  return { title: person ? format(t.timelineFor, { name: subjectName(locale, person) }) : t.timeline };
}

/** No person in the URL: explain what the screen is and where to open it from (§23.1). */
function NoSubject({ locale }: { locale: Locale }) {
  const t = calls[locale].timeline;
  return (
    <>
      <PageHeader locale={locale} backHref={callsHref(locale)} title={t.title} />
      <EmptyState
        icon={MessagesSquare}
        title={t.noSubject.title}
        description={t.noSubject.text}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href={appHref(locale, "clients")}>{t.noSubject.clients}</ButtonLink>
            <ButtonLink href={appHref(locale, "owners")} variant="secondary">
              {t.noSubject.owners}
            </ButtonLink>
            <ButtonLink href={appHref(locale, "leads")} variant="secondary">
              {t.noSubject.leads}
            </ButtonLink>
            <ButtonLink href={callsHref(locale)} variant="secondary">
              {t.noSubject.calls}
            </ButtonLink>
          </div>
        }
      />
    </>
  );
}

/**
 * Communication timeline of one person (§36.5, §21.4 screen 61): calls,
 * messages and meetings on every channel, newest first, each with channel,
 * direction, time, agent, short result, next step and a link to the call or
 * the original message. Only the viewer's own touchpoints (§19). URL:
 * `?clientId=` | `?ownerId=` | `?leadId=`, optional `&channel=`.
 */
export default async function TimelinePage({ searchParams }: PageProps<"/[locale]/app/calls/timeline">) {
  const locale = await getLocale();
  const t = calls[locale].timeline;
  const { subject, channel } = parseTimelineParams(await searchParams);
  if (!subject) return <NoSubject locale={locale} />;
  const person = await loadSubject(subject);
  if (!person) notFound();

  const at = now();
  const filter =
    subject.kind === "client"
      ? { clientId: subject.id }
      : subject.kind === "owner"
        ? { ownerId: subject.id }
        : { leadId: subject.id };
  const [{ agent: viewer }, communications, callViews] = await Promise.all([
    getViewer(),
    listCommunications(filter),
    listCalls(),
  ]);
  const partyCalls = callsOf(callViews, subject);
  const all = mergeTimeline(communications, partyCalls);
  const shown = channel ? mergeTimeline(communications, partyCalls, channel) : all;
  const counts = channelCounts(all);
  const present = communicationChannels.filter((code) => counts[code] || code === channel);
  const stale = staleSince(all, at);
  const profileHref = subjectHref(locale, subject);

  return (
    <div className="space-y-4">
      <PageHeader
        locale={locale}
        backHref={profileHref}
        title={t.title}
        subtitle={subjectRefText(locale, person)}
        className="mb-0"
        actions={
          <ButtonLink href={profileHref} variant="secondary">
            <UserRound aria-hidden className="size-4" />
            {t.openProfile}
          </ButtonLink>
        }
      />

      {stale ? (
        <Notice kind="warning" title={t.stale.title}>
          {format(t.stale.text, {
            date: `${formatDate(locale, stale)} (${formatRelative(locale, stale, at)})`,
          })}
        </Notice>
      ) : null}

      {all.length > 0 ? (
        <nav aria-label={t.filterLabel} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-2 pb-1">
            <li>
              <ChipLink href={timelineHref(locale, subject)} active={!channel}>
                {t.all} <span className="tabular text-caption">{all.length}</span>
              </ChipLink>
            </li>
            {present.map((code) => {
              const Icon = channelIcon[code];
              return (
                <li key={code}>
                  <ChipLink href={timelineHref(locale, subject, code)} active={channel === code}>
                    <Icon aria-hidden className="size-4" />
                    {calls[locale].channel[code]} <span className="tabular text-caption">{counts[code] ?? 0}</span>
                  </ChipLink>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {all.length === 0 ? (
        <EmptyState
          icon={History}
          title={t.empty.title}
          description={t.empty.text}
          action={
            <ButtonLink href={profileHref}>
              {t.openProfile}
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={History}
          title={t.emptyChannel.title}
          description={t.emptyChannel.text}
          action={
            <ButtonLink href={timelineHref(locale, subject)} variant="secondary">
              {t.emptyChannel.reset}
            </ButtonLink>
          }
        />
      ) : (
        <section aria-labelledby="timeline-count" className="space-y-3">
          <div className="space-y-0.5">
            <h2 id="timeline-count" className="text-body font-semibold text-fg">
              {format(plural(locale, shown.length, t.count), { n: shown.length })}
            </h2>
            <p className="text-caption text-fg-muted">{t.order}</p>
          </div>
          <Card className="p-4">
            <TimelineList locale={locale} entries={shown} viewerId={viewer.id} label={t.title} />
          </Card>
        </section>
      )}

      <p className="flex items-start gap-1.5 pt-2 text-caption text-fg-muted">
        <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>{t.permission}</span>
      </p>
    </div>
  );
}
