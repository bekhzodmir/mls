import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleHelp, ListPlus, ListTodo, Phone, UserPlus, UserRound, UserRoundCheck } from "lucide-react";
import { CallKindBadge, NextActionLine, RecordingBadge, SummaryBadge, durationText } from "@/components/app/calls/call-badges";
import {
  CallFactsSection,
  CallTimelineSection,
  DetailSection,
  NoteSection,
  RecordingSection,
  TranscriptSection,
  type MatchHint,
} from "@/components/app/calls/call-detail-parts";
import { CallHandledForm } from "@/components/app/calls/call-handled-form";
import { callKind, callsHref, nextActionState, subjectHref } from "@/components/app/calls/call-list";
import { newClientHref, newLeadHref } from "@/components/app/calls/call-list-view";
import { CallSummaryCard } from "@/components/app/calls/call-summary";
import { partyCaption, partyTitle, subjectName } from "@/components/app/calls/labels";
import { mergeTimeline } from "@/components/app/calls/timeline";
import { StickyActionBar, StickyBarSpacer, stickyActionClasses } from "@/components/app/crm/layout-parts";
import { contactRevokedAt } from "@/components/app/crm/duplicates";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { format } from "@/i18n/define-messages";
import { formatDateTime } from "@/i18n/format";
import calls from "@/i18n/messages/calls";
import domain from "@/i18n/messages/domain";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { loadCall } from "@/lib/data/cached";
import { getAgent, getClient, getViewer } from "@/lib/data/repository";
import { formatUzPhone, telHref } from "@/lib/domain/phone";
import { tashkentDateKey } from "@/lib/domain/working-days";
import { appHref } from "@/lib/routes";

const primaryAction = "bg-primary text-primary-fg hover:bg-primary-hover";
const secondaryAction = "border border-border bg-surface text-fg hover:bg-surface-muted";

export async function generateMetadata({ params }: PageProps<"/[locale]/app/calls/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadCall(id);
  const t = calls[locale].meta;
  if (!view) return { title: t.detail };
  // The tab title names the person, never an unattached phone number.
  const name = view.linked ? subjectName(locale, view.linked) : partyCaption(locale, view);
  return { title: format(t.detailFor, { name }) };
}

/**
 * Call detail (§14.7, §21.4 screens 59–61, §8.3 flow 1): who it was with —
 * or an unknown number with "похоже на" suggestions that are never linked
 * automatically — recording consent and why there is no transcript, the
 * transcript, the AI summary as an assistant's draft, the agent's note, the
 * next action ("mark handled" needs one, or a reason) and the person's
 * timeline. Primary actions sit in the sticky bar: call back, create a lead
 * or client from the number, add a task.
 */
export default async function CallPage({ params }: PageProps<"/[locale]/app/calls/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadCall(id);
  if (!view) notFound();

  const t = calls[locale];
  const at = now();
  const { call } = view;
  const party = view.linked;
  const kind = callKind(call);
  const title = partyTitle(locale, view);

  const [{ agent: viewer }, confirmer, matchClients] = await Promise.all([
    getViewer(),
    call.summary?.status === "confirmed" && call.summary.confirmedById ? getAgent(call.summary.confirmedById) : undefined,
    Promise.all(view.phoneMatches.filter((ref) => ref.kind === "client").map((ref) => getClient(ref.id))),
  ]);

  // Suggestions only (§14.1); a matching client who withdrew contact consent is flagged.
  const matches: MatchHint[] = view.phoneMatches.map((ref) => {
    const client = ref.kind === "client" ? matchClients.find((item) => item?.client.id === ref.id)?.client : undefined;
    const revokedAt = client ? contactRevokedAt(client) : undefined;
    return revokedAt ? { ref, revokedAt } : { ref };
  });
  const revokedAt = view.client ? contactRevokedAt(view.client) : undefined;
  // A call outlives access: a restricted owner's number stays masked (§34.2).
  const phoneHidden = Boolean(view.owner && !view.owner.contactVisible);
  const blockedHintId = "call-callback-blocked";

  const confirmedByName = confirmer
    ? confirmer.id === viewer.id
      ? t.party.you
      : confirmer.name
    : call.summary?.status === "confirmed"
      ? domain[locale].unknown
      : undefined;

  // Requirement editor: the extracted phrase plus the person it is for, when known.
  let requirementHref: string | undefined;
  if (call.summary?.extractedRequest) {
    const search = new URLSearchParams();
    if (party?.kind === "client") search.set("clientId", party.id);
    if (party?.kind === "lead") search.set("leadId", party.id);
    search.set("q", call.summary.extractedRequest);
    requirementHref = `${appHref(locale, "requirementsNew")}?${search}`;
  }
  const taskHref =
    party?.kind === "client"
      ? `${appHref(locale, "tasksNew")}?clientId=${encodeURIComponent(party.id)}`
      : appHref(locale, "tasksNew");
  const leadOpen = view.lead && view.lead.lead.status !== "converted" && view.lead.lead.status !== "lost";
  const phone = formatUzPhone(call.phone);

  const entries = mergeTimeline(view.communications, view.otherCalls);
  const nextState = nextActionState(view, at);

  return (
    <>
      <PageHeader
        locale={locale}
        backHref={callsHref(locale)}
        title={<span className={party ? undefined : "tabular"}>{title}</span>}
        subtitle={
          <>
            <time dateTime={call.startedAt}>{formatDateTime(locale, call.startedAt)}</time> ·{" "}
            {durationText(locale, call.durationSeconds)}
          </>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {party ? (
            <Badge tone="brand" icon={UserRound}>
              {t.subjectKind[party.kind]}
            </Badge>
          ) : (
            <Badge tone="warning" icon={CircleHelp}>
              {view.unknownNumber ? t.party.unknownNumber : t.party.unlinked}
            </Badge>
          )}
          <CallKindBadge locale={locale} kind={kind} />
          <RecordingBadge locale={locale} call={call} party={party?.kind} />
          {call.summary ? <SummaryBadge locale={locale} status={call.summary.status} /> : null}
        </div>
      </PageHeader>

      <StickyActionBar label={t.detail.actionsLabel}>
        {revokedAt || phoneHidden ? (
          <button
            type="button"
            disabled
            aria-describedby={blockedHintId}
            title={revokedAt ? t.detail.callbackBlocked : t.detail.callbackHidden}
            className={cn(stickyActionClasses, primaryAction, "opacity-50")}
          >
            <Phone aria-hidden className="size-5 lg:size-4" />
            {t.detail.callback}
          </button>
        ) : (
          <a href={telHref(call.phone)} className={cn(stickyActionClasses, primaryAction)}>
            <Phone aria-hidden className="size-5 lg:size-4" />
            {t.detail.callback}
          </a>
        )}
        {!party ? (
          <>
            <Link
              href={newLeadHref(locale, call.phone)}
              aria-label={format(t.detail.newLeadLabel, { phone })}
              className={cn(stickyActionClasses, secondaryAction)}
            >
              <UserPlus aria-hidden className="size-5 lg:size-4" />
              {t.detail.newLead}
            </Link>
            <Link
              href={newClientHref(locale, call.phone)}
              aria-label={format(t.detail.newClientLabel, { phone })}
              className={cn(stickyActionClasses, secondaryAction)}
            >
              <UserRoundCheck aria-hidden className="size-5 lg:size-4" />
              {t.detail.newClient}
            </Link>
          </>
        ) : party.kind === "lead" && leadOpen ? (
          <Link
            href={newClientHref(locale, call.phone, party.id)}
            aria-label={format(t.detail.toClientLabel, { name: subjectName(locale, party) })}
            className={cn(stickyActionClasses, secondaryAction)}
          >
            <UserRoundCheck aria-hidden className="size-5 lg:size-4" />
            {t.detail.toClient}
          </Link>
        ) : (
          <Link
            href={subjectHref(locale, party)}
            aria-label={format(t.detail.openParty, { name: subjectName(locale, party) })}
            className={cn(stickyActionClasses, secondaryAction)}
          >
            <UserRound aria-hidden className="size-5 lg:size-4" />
            {t.subjectKind[party.kind]}
          </Link>
        )}
        <Link href={taskHref} className={cn(stickyActionClasses, secondaryAction)}>
          <ListPlus aria-hidden className="size-5 lg:size-4" />
          {t.detail.task}
        </Link>
      </StickyActionBar>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <CallFactsSection
            locale={locale}
            view={view}
            viewerId={viewer.id}
            matches={matches}
            revokedAt={revokedAt}
            phoneHidden={phoneHidden}
            blockedHintId={blockedHintId}
          />
          {call.summary ? (
            <CallSummaryCard
              locale={locale}
              summary={call.summary}
              confirmedByName={confirmedByName}
              viewerName={t.party.you}
              nowIso={at.toISOString()}
              requirementHref={requirementHref}
            />
          ) : null}
          <NoteSection locale={locale} note={call.note} />
          <DetailSection id="call-next" title={t.detail.sections.next} icon={ListTodo}>
            <div className="space-y-1">
              <p className="text-caption font-semibold tracking-wide text-fg-subtle uppercase">{t.detail.next.current}</p>
              <NextActionLine locale={locale} call={call} state={nextState} />
            </div>
            <div className="border-t border-border pt-3">
              <h3 className="mb-2 text-body font-semibold text-fg">{t.detail.handled.title}</h3>
              <CallHandledForm
                locale={locale}
                today={tashkentDateKey(at)}
                current={call.nextAction ? { text: call.nextAction.text, dueAt: call.nextAction.dueAt } : undefined}
              />
            </div>
          </DetailSection>
        </div>
        <div className="space-y-4">
          <RecordingSection locale={locale} call={call} party={party?.kind} />
          {call.transcript ? <TranscriptSection locale={locale} transcript={call.transcript} /> : null}
          <CallTimelineSection locale={locale} view={view} entries={entries} viewerId={viewer.id} />
        </div>
      </div>

      <StickyBarSpacer />
    </>
  );
}
