import {
  AlarmClock,
  BellOff,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CircleCheck,
  Clock,
  FileClock,
  FileWarning,
  Flag,
  Handshake,
  Hourglass,
  Inbox,
  Lock,
  PhoneMissed,
  Sparkles,
  Timer,
  TimerOff,
  TrendingDown,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { CallKindBadge, dueText } from "@/components/app/calls/call-badges";
import { callKind, nextActionState } from "@/components/app/calls/call-list";
import { partyCaption, partyTitle } from "@/components/app/calls/labels";
import { contractHref } from "@/components/app/contracts/contract-rules";
import { BandBadge, FreshnessBadge, MoneyText, SourceBadge } from "@/components/domain/badges";
import { summarizeMatch } from "@/components/domain/match-explanation";
import { Badge, type Tone } from "@/components/ui/badge";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDate, formatDateTime, formatRelative, formatTime } from "@/i18n/format";
import calls from "@/i18n/messages/calls";
import domain from "@/i18n/messages/domain";
import tasks from "@/i18n/messages/tasks";
import today from "@/i18n/messages/today";
import type {
  CallView,
  CooperationView,
  DealView,
  ExpiringContractView,
  LeadView,
  ListingView,
  MatchView,
  PriceDropView,
  TaskState,
  TaskView,
  ViewingView,
} from "@/lib/data/views";
import { formatUzPhone } from "@/lib/domain/phone";
import type { Language, ViewingStatus } from "@/lib/domain/types";
import type { FeedRowData } from "./feed-row";
import { listingTitle, MIN_SHOWN_CONFIDENCE, telegramTitle } from "./labels";
import { entityHref, matchHref } from "./links";
import type { TodayBlock } from "./today-plan";

/**
 * One row description per kind of work item. Rows say what is due and why
 * in words plus an icon; colour only repeats what the text already says.
 * User-written text (lead messages, task titles, next actions) is shown as
 * written, in its source language.
 */

export function langOf(language: Language): string {
  return language === "uz" ? "uz-Latn" : "ru";
}

export function leadRow(locale: Locale, view: LeadView, at: Date): FeedRowData {
  const t = today[locale].lead;
  const d = domain[locale];
  const { lead, sla } = view;
  const breached = sla.state === "breached";
  return {
    id: lead.id,
    href: entityHref(locale, { kind: "lead", id: lead.id }),
    icon: Inbox,
    // No name is shown as Unknown; the phone (the viewer's own lead) helps recognise the person.
    title: lead.name ?? [t.noName, lead.phone ? formatUzPhone(lead.phone) : undefined].filter(Boolean).join(" · "),
    lines: [
      <>
        {d.leadSource[lead.source]} ·{" "}
        <span lang={langOf(lead.language)}>{lead.message}</span>
      </>,
      view.duplicateCandidate ? format(t.duplicate, { name: view.duplicateCandidate.name }) : null,
    ],
    badges:
      breached || sla.state === "due_soon" ? (
        <Badge tone={breached ? "danger" : "warning"} icon={breached ? TimerOff : Timer}>
          {breached
            ? format(t.breached, { ago: formatRelative(locale, sla.dueAt, at) })
            : format(t.dueSoon, { time: formatTime(locale, sla.dueAt) })}
        </Badge>
      ) : undefined,
  };
}

const taskStateStyle: Record<TaskState, { tone: Tone; icon: LucideIcon }> = {
  overdue: { tone: "danger", icon: AlarmClock },
  today: { tone: "warning", icon: Clock },
  upcoming: { tone: "neutral", icon: CalendarDays },
  snoozed: { tone: "neutral", icon: BellOff },
  done: { tone: "success", icon: CircleCheck },
};

export function taskRow(locale: Locale, view: TaskView): FeedRowData {
  const t = today[locale];
  const tt = tasks[locale];
  const { task, state } = view;
  const { tone, icon } = taskStateStyle[state];
  const due =
    state === "overdue"
      ? format(t.task.overdue, { date: formatDateTime(locale, task.dueAt) })
      : state === "today"
        ? format(t.task.today, { time: formatTime(locale, task.dueAt) })
        : format(t.task.due, { date: formatDateTime(locale, task.dueAt) });
  const related = task.related
    ? [t.entity[task.related.kind], view.relatedName].filter(Boolean).join(" · ")
    : null;
  return {
    id: task.id,
    href: task.related ? entityHref(locale, task.related) : undefined,
    icon,
    title: task.title,
    lines: [due, related],
    badges: (
      <>
        <Badge tone={tone} icon={icon}>
          {tt.state[state]}
        </Badge>
        {task.priority === "high" && state !== "done" ? (
          <Badge tone="warning" icon={Flag}>
            {tt.priority.high}
          </Badge>
        ) : null}
      </>
    ),
  };
}

const viewingStatusStyle: Record<ViewingStatus, { tone: Tone; icon: LucideIcon }> = {
  scheduled: { tone: "neutral", icon: CalendarClock },
  confirmed: { tone: "success", icon: CircleCheck },
  completed: { tone: "info", icon: CircleCheck },
  cancelled: { tone: "neutral", icon: BellOff },
  no_show: { tone: "warning", icon: TriangleAlert },
};

export function viewingRow(locale: Locale, view: ViewingView): FeedRowData {
  const t = today[locale].viewing;
  const { viewing } = view;
  const { tone, icon } = viewingStatusStyle[viewing.status];
  return {
    id: viewing.id,
    href: entityHref(locale, { kind: "viewing", id: viewing.id }),
    icon: CalendarClock,
    title: `${formatTime(locale, viewing.startsAt)} · ${view.client.name}`,
    lines: [
      listingTitle(locale, view.listing.property),
      view.partner ? format(t.partner, { name: view.partner.name }) : null,
    ],
    badges: (
      <>
        <Badge tone={tone} icon={icon}>
          {domain[locale].viewingStatus[viewing.status]}
        </Badge>
        {view.conflictsWith.length > 0 ? (
          <Badge tone="warning" icon={TriangleAlert}>
            {t.conflict}
          </Badge>
        ) : null}
      </>
    ),
  };
}

/**
 * A missed call: who called (or the number), when, and the call-back step —
 * a missing step is a warning, since an unknown caller must not get lost (§14.7).
 */
export function missedCallRow(locale: Locale, view: CallView, at: Date): FeedRowData {
  const t = calls[locale].next;
  const { call } = view;
  const state = nextActionState(view, at);
  const next = call.nextAction?.text.trim() ? call.nextAction : undefined;
  return {
    id: call.id,
    href: entityHref(locale, { kind: "call", id: call.id }),
    icon: PhoneMissed,
    title: partyTitle(locale, view),
    lines: [
      <>
        {/* No number for a linked person: an owner's contact may be restricted (§34.2). */}
        {view.linked ? calls[locale].subjectKind[view.linked.kind] : partyCaption(locale, view)} ·{" "}
        <time dateTime={call.startedAt} title={formatDateTime(locale, call.startedAt)}>
          {formatRelative(locale, call.startedAt, at)}
        </time>
      </>,
      next ? (
        <>
          {t.label}: {next.text}
          {next.dueAt ? ` · ${dueText(locale, next.dueAt, state)}` : null}
        </>
      ) : null,
    ],
    badges: (
      <>
        <CallKindBadge locale={locale} kind={callKind(call)} />
        {state === "overdue" ? (
          <Badge tone="danger" icon={AlarmClock}>
            {t.overdue}
          </Badge>
        ) : state === "today" ? (
          <Badge tone="info" icon={Clock}>
            {t.today}
          </Badge>
        ) : state === "missing" ? (
          <Badge tone="warning" icon={TriangleAlert}>
            {t.none}
          </Badge>
        ) : null}
      </>
    ),
  };
}

export function contractRow(locale: Locale, item: ExpiringContractView): FeedRowData {
  const t = today[locale].contract;
  const left =
    item.daysLeft === 0
      ? t.lastDay
      : format(plural(locale, item.daysLeft, t.daysLeft), { n: item.daysLeft });
  // The listing carries its contract's document number; contract pages accept it.
  const contractId = item.view.listing.contractId;
  return {
    id: item.view.listing.id,
    href: contractId ? contractHref(locale, contractId) : entityHref(locale, { kind: "listing", id: item.view.listing.id }),
    icon: FileClock,
    title: listingTitle(locale, item.view.property),
    lines: [format(t.endsAt, { date: formatDate(locale, item.expiresAt) })],
    badges: (
      <Badge tone={item.daysLeft <= 1 ? "danger" : "warning"} icon={Hourglass}>
        {left}
      </Badge>
    ),
  };
}

export function matchRow(locale: Locale, view: MatchView): FeedRowData {
  const { target, ranked } = view;
  const place =
    target.kind === "listing"
      ? listingTitle(locale, target.view.property)
      : telegramTitle(locale, target.view.post);
  const price =
    target.kind === "listing"
      ? target.view.listing.price
      : target.view.post.parsed.price.confidence >= MIN_SHOWN_CONFIDENCE
        ? target.view.post.parsed.price.value
        : undefined;
  return {
    id: view.id,
    href: matchHref(locale, view.id),
    icon: Sparkles,
    title: view.client.name,
    lines: [
      <>
        {place}
        {price ? (
          <>
            {" · "}
            <MoneyText locale={locale} value={price} />
          </>
        ) : null}
      </>,
      summarizeMatch(locale, ranked.reasons),
    ],
    badges: (
      <>
        <BandBadge locale={locale} band={ranked.band} score={ranked.score} />
        <FreshnessBadge locale={locale} freshness={ranked.freshness} />
        <SourceBadge locale={locale} source={ranked.candidate.source} />
      </>
    ),
  };
}

export function cooperationRow(locale: Locale, view: CooperationView): FeedRowData {
  const t = today[locale].cooperation;
  const organization = view.direction === "incoming" ? view.fromOrganization : view.toOrganization;
  const terms = view.latest.terms;
  return {
    id: view.request.id,
    href: entityHref(locale, { kind: "cooperation", id: view.request.id }),
    icon: Handshake,
    title: [view.counterpart.name, organization?.name].filter(Boolean).join(" · "),
    lines: [
      listingTitle(locale, view.listing.property),
      // A split between two professionals — never a Binor fee (§7.4).
      format(t.split, { split: `${terms.listingSidePercent}/${terms.buyerSidePercent}` }),
    ],
    badges: (
      <>
        <Badge tone={view.overdue ? "danger" : "warning"} icon={view.overdue ? TimerOff : Timer}>
          {view.overdue ? t.overdue : format(t.respondBy, { date: formatDateTime(locale, view.request.respondBy) })}
        </Badge>
        <Badge>{domain[locale].cooperationStatus[view.request.status]}</Badge>
      </>
    ),
  };
}

export function staleRow(locale: Locale, view: ListingView, at: Date): FeedRowData {
  const t = today[locale].stale;
  const { listing, freshness } = view;
  const basisIso =
    freshness.basis === "last_confirmed" && listing.lastConfirmedAt ? listing.lastConfirmedAt : listing.publishedAt;
  const ago = formatRelative(locale, basisIso, at);
  return {
    id: listing.id,
    href: entityHref(locale, { kind: "listing", id: listing.id }),
    icon: Hourglass,
    title: listingTitle(locale, view.property),
    lines: [format(freshness.basis === "last_confirmed" ? t.confirmedAgo : t.publishedAgo, { ago })],
    badges: <FreshnessBadge locale={locale} freshness={freshness} />,
  };
}

export function priceDropRow(locale: Locale, item: PriceDropView): FeedRowData {
  const t = today[locale];
  const { view } = item;
  return {
    id: view.listing.id,
    href: entityHref(locale, { kind: "listing", id: view.listing.id }),
    icon: TrendingDown,
    title: listingTitle(locale, view.property),
    lines: [
      <>
        <MoneyText locale={locale} value={item.previous} className="line-through" /> →{" "}
        <MoneyText locale={locale} value={item.current} className="font-semibold text-fg" />
      </>,
      item.affectedRequirementsCount > 0
        ? format(t.priceDrop.fits, { n: item.affectedRequirementsCount })
        : t.priceDrop.fitsNone,
    ],
    badges:
      view.access === "partner_masked" ? (
        <Badge icon={Lock} title={t.masked}>
          {t.masked}
        </Badge>
      ) : undefined,
  };
}

export function dealRow(locale: Locale, view: DealView): FeedRowData {
  const t = today[locale].deal;
  const { deal, mlsReport } = view;
  const next = deal.nextAction?.text;
  return {
    id: deal.id,
    href: entityHref(locale, { kind: "deal", id: deal.id }),
    icon: Briefcase,
    title: `${view.client.name} · ${domain[locale].dealStage[deal.stage]}`,
    lines: [
      listingTitle(locale, view.listing.property),
      next ? format(view.nextActionOverdue ? t.nextOverdue : t.next, { text: next }) : null,
    ],
    badges: (
      <>
        {view.nextActionOverdue ? (
          <Badge tone="danger" icon={AlarmClock}>
            {today[locale].urgency.overdue}
          </Badge>
        ) : null}
        {view.missingRequiredDocuments > 0 ? (
          <Badge tone="warning" icon={FileWarning}>
            {format(t.missingDocs, { n: view.missingRequiredDocuments })}
          </Badge>
        ) : null}
        {mlsReport.state === "due" ? (
          <Badge tone="warning" icon={FileClock}>
            {format(t.mlsDue, { n: mlsReport.workingDaysLeft })}
          </Badge>
        ) : mlsReport.state === "overdue" ? (
          <Badge tone="danger" icon={FileClock}>
            {t.mlsOverdue}
          </Badge>
        ) : null}
      </>
    ),
  };
}

/** Rows for any Today block, in the block's order. */
export function blockRows(locale: Locale, block: TodayBlock, at: Date): FeedRowData[] {
  switch (block.key) {
    case "leads":
      return block.items.map((view) => leadRow(locale, view, at));
    case "calls":
      return block.items.map((view) => missedCallRow(locale, view, at));
    case "overdueTasks":
    case "todayTasks":
      return block.items.map((view) => taskRow(locale, view));
    case "viewings":
      return block.items.map((view) => viewingRow(locale, view));
    case "contracts":
      return block.items.map((item) => contractRow(locale, item));
    case "matches":
      return block.items.map((view) => matchRow(locale, view));
    case "cooperation":
      return block.items.map((view) => cooperationRow(locale, view));
    case "stale":
      return block.items.map((view) => staleRow(locale, view, at));
    case "priceDrops":
      return block.items.map((item) => priceDropRow(locale, item));
    case "deals":
      return block.items.map((view) => dealRow(locale, view));
  }
}
