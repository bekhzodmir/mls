import {
  AlarmClock,
  BadgeCheck,
  Camera,
  CircleSlash,
  Clock,
  ListTodo,
  Mail,
  MessageCircle,
  Mic,
  MicOff,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Send,
  ShieldOff,
  Sparkles,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDateTime, formatTime } from "@/i18n/format";
import calls from "@/i18n/messages/calls";
import { cn } from "@/lib/cn";
import type { Call, CallSummary, CommunicationChannel } from "@/lib/domain/types";
import type { SubjectRef } from "@/lib/data/views";
import { durationParts, type CallKind, type NextActionState } from "./call-list";

/**
 * Call pills and icons. Every state pairs an icon with words, so nothing
 * depends on colour alone (§20.6). No hooks: usable from server and client
 * components alike.
 */

const kindStyle: Record<CallKind, { tone: Tone; icon: LucideIcon }> = {
  inbound: { tone: "neutral", icon: PhoneIncoming },
  outbound: { tone: "neutral", icon: PhoneOutgoing },
  missed: { tone: "danger", icon: PhoneMissed },
  no_answer: { tone: "warning", icon: PhoneOff },
  busy: { tone: "warning", icon: CircleSlash },
};

export const callKindIcon: Record<CallKind, LucideIcon> = {
  inbound: PhoneIncoming,
  outbound: PhoneOutgoing,
  missed: PhoneMissed,
  no_answer: PhoneOff,
  busy: CircleSlash,
};

export function CallKindBadge({ locale, kind }: { locale: Locale; kind: CallKind }) {
  const { tone, icon } = kindStyle[kind];
  return (
    <Badge tone={tone} icon={icon}>
      {calls[locale].kind[kind]}
    </Badge>
  );
}

/** Recording follows a separate consent (§36.5); a refusal names who refused. */
export function recordingLabel(locale: Locale, call: Pick<Call, "recording">, party?: SubjectRef["kind"]): string {
  const t = calls[locale].recording;
  switch (call.recording.consent) {
    case "granted":
      return t.granted;
    case "not_requested":
      return t.not_requested;
    case "refused":
      return party === "owner" ? t.refusedOwner : t.refusedClient;
  }
}

const recordingStyle: Record<Call["recording"]["consent"], { tone: Tone; icon: LucideIcon }> = {
  granted: { tone: "info", icon: Mic },
  not_requested: { tone: "neutral", icon: MicOff },
  refused: { tone: "neutral", icon: ShieldOff },
};

export function RecordingBadge({
  locale,
  call,
  party,
}: {
  locale: Locale;
  call: Pick<Call, "recording">;
  party?: SubjectRef["kind"];
}) {
  const { tone, icon } = recordingStyle[call.recording.consent];
  return (
    <Badge tone={tone} icon={icon}>
      {recordingLabel(locale, call, party)}
    </Badge>
  );
}

/** "Черновик ИИ" is an assistant's draft, never presented as a fact (§14.7). */
export function SummaryBadge({ locale, status }: { locale: Locale; status: CallSummary["status"] }) {
  return status === "confirmed" ? (
    <Badge tone="success" icon={BadgeCheck}>
      {calls[locale].summaryState.confirmed}
    </Badge>
  ) : (
    <Badge tone="warning" icon={Sparkles}>
      {calls[locale].summaryState.draft}
    </Badge>
  );
}

export const channelIcon: Record<CommunicationChannel, LucideIcon> = {
  phone: Phone,
  telegram: Send,
  whatsapp: MessageCircle,
  instagram: Camera,
  email: Mail,
  meeting: Users,
};

/** «3 мин 34 с» / «3 daq 34 s»; calls without a conversation say so. */
export function durationText(locale: Locale, seconds: number): string {
  const t = calls[locale].duration;
  if (seconds <= 0) return t.none;
  const { minutes, seconds: rest } = durationParts(seconds);
  if (minutes === 0) return format(t.sec, { s: rest });
  return rest === 0 ? format(t.min, { m: minutes }) : format(t.minSec, { m: minutes, s: rest });
}

/** «до 18:00» later today, «до 29 сент., 12:00» otherwise (overdue items keep their date). */
export function dueText(locale: Locale, dueAt: string, state: NextActionState): string {
  const when = state === "today" ? formatTime(locale, dueAt) : formatDateTime(locale, dueAt);
  return format(calls[locale].next.due, { when });
}

/**
 * The next action line of a call: text, due time and its state. A missing
 * next action on a call that needs one is a warning, not an empty line.
 */
export function NextActionLine({
  locale,
  call,
  state,
  className,
}: {
  locale: Locale;
  call: Pick<Call, "nextAction">;
  state: NextActionState;
  className?: string;
}) {
  const t = calls[locale].next;
  const next = call.nextAction;
  if (!next?.text.trim()) {
    return (
      <p
        className={cn(
          "flex items-start gap-1.5 text-small",
          state === "missing" ? "font-medium text-warning-fg" : "text-fg-muted",
          className,
        )}
      >
        {state === "missing" ? (
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        ) : (
          <ListTodo aria-hidden className="mt-0.5 size-4 shrink-0" />
        )}
        <span>{t.none}</span>
      </p>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-start gap-x-2 gap-y-1 text-small", className)}>
      <p className="flex min-w-0 items-start gap-1.5 text-fg">
        <ListTodo aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
        <span>
          <span className="sr-only">{t.label}: </span>
          {next.text}
          {next.dueAt ? (
            <span className="text-fg-muted">
              {" · "}
              <time dateTime={next.dueAt}>{dueText(locale, next.dueAt, state)}</time>
            </span>
          ) : null}
        </span>
      </p>
      {state === "overdue" ? (
        <Badge tone="danger" icon={AlarmClock}>
          {t.overdue}
        </Badge>
      ) : state === "today" ? (
        <Badge tone="info" icon={Clock}>
          {t.today}
        </Badge>
      ) : null}
    </div>
  );
}
