import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  FileText,
  History,
  Lightbulb,
  Mic,
  NotebookPen,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";
import { propertyTitle, textLang } from "@/components/app/inventory/labels";
import { Card, Field } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDate, formatDateTime } from "@/i18n/format";
import calls from "@/i18n/messages/calls";
import { cn } from "@/lib/cn";
import type { CallDetailView, SubjectRef } from "@/lib/data/views";
import { formatUzPhone, maskUzPhone, telHref } from "@/lib/domain/phone";
import type { Call, ISODateTime } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";
import { CallKindBadge, RecordingBadge, durationText } from "./call-badges";
import { callKind, recordingExplanation, subjectHref, transcriptLines } from "./call-list";
import { subjectName, subjectRefText } from "./labels";
import { timelineHref, type TimelineEntry } from "./timeline";
import { TimelineList } from "./timeline-view";

/**
 * Server-rendered sections of the call detail (§21.4 screens 59–61): the
 * call and who it was with, recording consent, the transcript, the agent's
 * note and the person's communication timeline. Interactive parts (AI
 * summary, "mark handled") are client islands in their own files.
 */

export function DetailSection({
  id,
  title,
  icon: Icon,
  action,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-h2 text-fg">
            <Icon aria-hidden className="size-5 shrink-0 text-fg-muted" />
            {title}
          </h2>
          {action}
        </div>
        {children}
      </Card>
    </section>
  );
}

const linkClasses =
  "inline-flex min-h-11 items-center gap-1 text-small font-semibold text-primary underline-offset-2 hover:underline";

/** A phone-match suggestion with an optional "contact consent revoked" date. */
export interface MatchHint {
  ref: SubjectRef;
  revokedAt?: ISODateTime;
}

/**
 * Who the call was with and its facts. An unattached number is never linked
 * automatically (§14.1): matches are offered as "похоже на" with a link to
 * check, and a number nobody knows says how not to lose the call (§14.7).
 */
export function CallFactsSection({
  locale,
  view,
  viewerId,
  matches,
  revokedAt,
  phoneHidden,
  blockedHintId,
}: {
  locale: Locale;
  view: CallDetailView;
  viewerId: string;
  matches: readonly MatchHint[];
  /** The linked client withdrew contact consent. */
  revokedAt?: ISODateTime;
  /** The viewer may not see this owner's contact (§34.2). */
  phoneHidden: boolean;
  /** Id of the notice that explains a disabled call-back button. */
  blockedHintId: string;
}) {
  const t = calls[locale].detail;
  const { call } = view;
  const party = view.linked;
  return (
    <DetailSection id="call-facts" title={t.sections.call} icon={PhoneCall}>
      {revokedAt ? (
        <div id={blockedHintId}>
          <Notice kind="danger" title={t.revoked.title}>
            {format(t.revoked.text, { date: formatDate(locale, revokedAt) })}
          </Notice>
        </div>
      ) : phoneHidden && view.owner ? (
        <div id={blockedHintId}>
          <Notice kind="permission" title={t.ownerHidden.title}>
            {format(t.ownerHidden.text, { agent: view.owner.responsibleAgent.name })}
          </Notice>
        </div>
      ) : null}

      <dl className="divide-y divide-border">
        <Field
          label={t.fields.party}
          value={
            party ? (
              <Link href={subjectHref(locale, party)} className="text-primary underline-offset-2 hover:underline">
                {subjectRefText(locale, party)}
              </Link>
            ) : (
              <span className="text-fg-muted">
                {view.unknownNumber ? calls[locale].party.unknownNumber : calls[locale].party.unlinked}
              </span>
            )
          }
        />
        <Field
          label={t.fields.phone}
          value={
            phoneHidden ? (
              <span className="tabular text-fg-muted">{maskUzPhone(call.phone)}</span>
            ) : (
              <a href={telHref(call.phone)} className="tabular underline-offset-2 hover:underline">
                {formatUzPhone(call.phone)}
              </a>
            )
          }
        />
        <Field label={t.fields.type} value={<CallKindBadge locale={locale} kind={callKind(call)} />} />
        <Field
          label={t.fields.when}
          value={<time dateTime={call.startedAt}>{formatDateTime(locale, call.startedAt)}</time>}
        />
        <Field label={t.fields.duration} value={durationText(locale, call.durationSeconds)} />
        <Field
          label={t.fields.agent}
          value={view.agent.id === viewerId ? calls[locale].party.you : view.agent.name}
        />
        {view.listing ? (
          <Field
            label={t.fields.listing}
            value={
              <Link
                href={appPath(locale, `/properties/${encodeURIComponent(view.listing.listing.id)}`)}
                className="text-primary underline-offset-2 hover:underline"
              >
                {propertyTitle(locale, view.listing.property)}
              </Link>
            }
          />
        ) : null}
      </dl>

      {view.unknownNumber ? (
        <Notice kind="warning" title={t.unknownNumber.title}>
          {t.unknownNumber.text}
        </Notice>
      ) : null}

      {matches.length > 0 ? (
        <div className="space-y-2 rounded-md border border-info-border bg-info-bg p-3 text-small text-info-fg">
          <p className="flex items-start gap-2 font-semibold">
            <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t.suggestions.title}
          </p>
          <p>{t.suggestions.text}</p>
          <ul className="divide-y divide-info-border">
            {matches.map(({ ref }) => (
              <li key={`${ref.kind}-${ref.id}`} className="flex flex-wrap items-center justify-between gap-x-3">
                <span className="font-medium">{subjectRefText(locale, ref)}</span>
                <Link
                  href={subjectHref(locale, ref)}
                  aria-label={format(t.openParty, { name: subjectName(locale, ref) })}
                  className={cn(linkClasses, "text-info-fg")}
                >
                  {t.suggestions.open}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
          {matches
            .filter((match) => match.revokedAt)
            .map((match) => (
              <Notice key={`revoked-${match.ref.id}`} kind="warning">
                {format(t.suggestions.revoked, {
                  name: subjectName(locale, match.ref),
                  date: formatDate(locale, match.revokedAt as string),
                })}
              </Notice>
            ))}
        </div>
      ) : null}
    </DetailSection>
  );
}

/** Recording needs separate consent and a legal basis (§36.5); say why there is no transcript. */
export function RecordingSection({ locale, call, party }: { locale: Locale; call: Call; party?: SubjectRef["kind"] }) {
  const t = calls[locale].detail.recording;
  const reason = recordingExplanation(call, party);
  return (
    <DetailSection
      id="call-recording"
      title={calls[locale].detail.sections.recording}
      icon={Mic}
      action={reason === "noConversation" ? undefined : <RecordingBadge locale={locale} call={call} party={party} />}
    >
      <p className="text-small text-fg">{t[reason]}</p>
      <p className="text-caption text-fg-muted">{t.rule}</p>
    </DetailSection>
  );
}

/** Shown only when a transcript exists; its language comes from the text itself. */
export function TranscriptSection({ locale, transcript }: { locale: Locale; transcript: string }) {
  const t = calls[locale].detail.transcript;
  return (
    <DetailSection id="call-transcript" title={calls[locale].detail.sections.transcript} icon={FileText}>
      <p className="text-caption text-fg-muted">{t.hint}</p>
      <div
        lang={textLang(transcript)}
        aria-label={t.label}
        role="group"
        className="max-h-96 space-y-2 overflow-y-auto rounded-md bg-surface-muted p-3 text-small text-fg"
      >
        {transcriptLines(transcript).map((line, index) => (
          <p key={index}>
            {line.speaker ? <span className="font-semibold">{line.speaker}: </span> : null}
            {line.text}
          </p>
        ))}
      </div>
    </DetailSection>
  );
}

/** The agent's own words — not AI — kept verbatim. */
export function NoteSection({ locale, note }: { locale: Locale; note?: string }) {
  const t = calls[locale].detail;
  return (
    <DetailSection id="call-note" title={t.sections.note} icon={NotebookPen}>
      {note ? (
        <p lang={textLang(note)} className="text-body whitespace-pre-line text-fg">
          {note}
        </p>
      ) : (
        <p className="text-small text-fg-muted">{t.note.empty}</p>
      )}
    </DetailSection>
  );
}

/** How many touchpoints the call page shows before linking to the full timeline. */
export const TIMELINE_PREVIEW = 5;

export function CallTimelineSection({
  locale,
  view,
  entries,
  viewerId,
}: {
  locale: Locale;
  view: CallDetailView;
  entries: readonly TimelineEntry[];
  viewerId: string;
}) {
  const t = calls[locale].detail.timeline;
  const party = view.linked;
  const shown = entries.slice(0, TIMELINE_PREVIEW);
  const rest = entries.length - shown.length;
  return (
    <DetailSection id="call-timeline" title={calls[locale].detail.sections.timeline} icon={History}>
      <p className="text-small text-fg-muted">{party ? t.text : t.textUnlinked}</p>
      {shown.length > 0 ? (
        <TimelineList
          locale={locale}
          entries={shown}
          viewerId={viewerId}
          currentCallId={view.call.id}
          label={calls[locale].detail.sections.timeline}
        />
      ) : (
        <p className="text-small text-fg-muted">{party ? t.empty : t.emptyUnlinked}</p>
      )}
      {party ? (
        <Link href={timelineHref(locale, party)} className={linkClasses}>
          {rest > 0 ? format(t.more, { n: rest }) : t.all}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : null}
    </DetailSection>
  );
}
