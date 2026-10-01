import Link from "next/link";
import { ChevronRight, Lightbulb, PhoneCall, PhoneOff, UserPlus } from "lucide-react";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { intlLocale, type Locale } from "@/i18n/config";
import { format, plural } from "@/i18n/define-messages";
import { formatDay, formatTime } from "@/i18n/format";
import calls from "@/i18n/messages/calls";
import { cn } from "@/lib/cn";
import type { CallView } from "@/lib/data/views";
import { normalizeUzPhone, telHref } from "@/lib/domain/phone";
import { appHref } from "@/lib/routes";
import { CallKindBadge, NextActionLine, RecordingBadge, SummaryBadge, durationText } from "./call-badges";
import {
  callFilterKeys,
  callHref,
  callKind,
  callsHref,
  nextActionState,
  noConversation,
  type CallDay,
  type CallFilterKey,
} from "./call-list";
import { looksLikeText, partyCaption, partyTitle } from "./labels";

/**
 * Call log building blocks (§14.7, §21.4 screen 58): filter chips, the day
 * groups and the per-call card. Server components; calls arrive already
 * access-filtered from the repository (the viewer's own calls only).
 */

export function callCountText(locale: Locale, n: number): string {
  return format(plural(locale, n, calls[locale].list.count), { n });
}

/** `/leads/new?phone=+998…` — the number as the lead form's starting point. */
export function newLeadHref(locale: Locale, phone: string): string {
  return `${appHref(locale, "leadsNew")}?${new URLSearchParams({ phone: normalizeUzPhone(phone) ?? phone })}`;
}

/** `/owners/new?phone=+998…` — an unknown caller may be an owner offering a property. */
export function newOwnerHref(locale: Locale, phone: string): string {
  return `${appHref(locale, "ownersNew")}?${new URLSearchParams({ phone: normalizeUzPhone(phone) ?? phone })}`;
}

/** `/clients/new?phone=+998…`, or `?leadId=` to qualify the call's lead into a client. */
export function newClientHref(locale: Locale, phone: string, leadId?: string): string {
  const search = new URLSearchParams();
  if (leadId) search.set("leadId", leadId);
  search.set("phone", normalizeUzPhone(phone) ?? phone);
  return `${appHref(locale, "clientsNew")}?${search}`;
}

function capitalize(locale: Locale, text: string): string {
  return text.charAt(0).toLocaleUpperCase(intlLocale[locale]) + text.slice(1);
}

/** «Сегодня · среда, 30 сентября» or «Понедельник, 28 сентября». */
export function callDayHeading(locale: Locale, day: Pick<CallDay, "anchorIso" | "relative">): string {
  const date = formatDay(locale, day.anchorIso);
  return day.relative ? `${calls[locale].list.day[day.relative]} · ${date}` : capitalize(locale, date);
}

export function CallFilters({
  locale,
  active,
  counts,
}: {
  locale: Locale;
  active?: CallFilterKey;
  counts: Record<CallFilterKey | "all", number>;
}) {
  const t = calls[locale].list.filter;
  return (
    <nav aria-label={t.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2 pb-1">
        <li>
          <ChipLink href={callsHref(locale)} active={!active}>
            {t.all} <span className="tabular text-caption">{counts.all}</span>
          </ChipLink>
        </li>
        {callFilterKeys.map((key) => (
          <li key={key}>
            <ChipLink href={callsHref(locale, key)} active={active === key}>
              {key === "missed" ? <PhoneOff aria-hidden className="size-4" /> : null}
              {t[key]} <span className="tabular text-caption">{counts[key]}</span>
            </ChipLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * One call: kind, time and duration, who (or the number), phone-match
 * suggestions, recording consent, AI summary state and the next action.
 * The quick action is the one that keeps the person from getting lost:
 * call back after a call without a conversation, create a lead for an
 * unknown number.
 */
export function CallCard({
  locale,
  view,
  now,
  phoneHidden = false,
}: {
  locale: Locale;
  view: CallView;
  now: Date;
  /** The viewer may not see this owner's contact (§34.2): masked number, no call-back. */
  phoneHidden?: boolean;
}) {
  const t = calls[locale];
  const { call } = view;
  const kind = callKind(call);
  const name = partyTitle(locale, view);
  const titleId = `call-${call.id}-title`;
  const state = nextActionState(view, now);
  const callBack = noConversation(call) && !phoneHidden;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "space-y-3 rounded-lg border bg-surface p-4 shadow-card",
        kind === "missed" ? "border-danger-border" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-body font-semibold text-fg tabular">
          <time dateTime={call.startedAt}>{formatTime(locale, call.startedAt)}</time>
          <span className="text-small font-normal text-fg-muted"> · {durationText(locale, call.durationSeconds)}</span>
        </p>
        <CallKindBadge locale={locale} kind={kind} />
      </div>

      <div className="min-w-0">
        <h3 id={titleId} className="text-body font-semibold text-fg">
          <Link href={callHref(locale, call.id)} className="tabular hover:underline">
            {name}
          </Link>
        </h3>
        <p className="text-caption text-fg-muted">
          <span className="tabular">{partyCaption(locale, view, phoneHidden)}</span>
        </p>
      </div>

      {view.phoneMatches.length > 0 ? (
        <p className="flex items-start gap-1.5 rounded-sm bg-info-bg px-2 py-1.5 text-caption text-info-fg">
          <Lightbulb aria-hidden className="mt-px size-4 shrink-0" />
          <span>
            <span className="font-medium">{looksLikeText(locale, view.phoneMatches)}</span> {t.card.suggestionOnly}
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <RecordingBadge locale={locale} call={call} party={view.linked?.kind} />
        {call.summary ? <SummaryBadge locale={locale} status={call.summary.status} /> : null}
      </div>

      <NextActionLine locale={locale} call={call} state={state} />

      <div className="flex flex-wrap gap-2">
        {callBack ? (
          <ButtonAnchor
            href={telHref(call.phone)}
            aria-label={format(t.card.callbackTo, { name })}
            className="flex-1 sm:flex-none"
          >
            <PhoneCall aria-hidden className="size-4" />
            {t.card.callback}
          </ButtonAnchor>
        ) : null}
        {view.unknownNumber ? (
          <ButtonLink
            href={newLeadHref(locale, call.phone)}
            variant={callBack ? "secondary" : "primary"}
            aria-label={format(t.card.createLeadFor, { phone: name })}
            className="flex-1 sm:flex-none"
          >
            <UserPlus aria-hidden className="size-4" />
            {t.card.createLead}
          </ButtonLink>
        ) : null}
        <ButtonLink
          href={callHref(locale, call.id)}
          variant="secondary"
          aria-label={format(t.card.openCall, { name })}
          className="flex-1 sm:flex-none"
        >
          {t.card.open}
          <ChevronRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
    </article>
  );
}

export function CallDays({
  locale,
  days,
  now,
  hiddenOwnerIds,
}: {
  locale: Locale;
  days: readonly CallDay[];
  now: Date;
  /** Owners whose contacts the viewer may not see. */
  hiddenOwnerIds: ReadonlySet<string>;
}) {
  const t = calls[locale].list;
  return (
    <div className="space-y-6">
      {days.map((day) => {
        const missed = day.relative === "today" && day.views.some((view) => view.call.outcome === "missed");
        return (
          <section key={day.key} aria-labelledby={`calls-day-${day.key}`} className="space-y-3">
            <div className="space-y-0.5">
              <h2 id={`calls-day-${day.key}`} className="flex items-baseline justify-between gap-2 text-h2 text-fg">
                <span>{callDayHeading(locale, day)}</span>
                <span className="text-small font-normal text-fg-muted">{callCountText(locale, day.views.length)}</span>
              </h2>
              {missed ? <p className="text-caption text-fg-muted">{t.missedFirst}</p> : null}
            </div>
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {day.views.map((view) => (
                <li key={view.call.id}>
                  <CallCard
                    locale={locale}
                    view={view}
                    now={now}
                    phoneHidden={view.linked?.kind === "owner" && hiddenOwnerIds.has(view.linked.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Empty log (§23.1): why it is empty and the next step. */
export function CallsEmpty({ locale, filtered }: { locale: Locale; filtered: boolean }) {
  const t = calls[locale].list.empty;
  return filtered ? (
    <EmptyState
      icon={PhoneOff}
      title={t.filteredTitle}
      description={t.filteredText}
      action={
        <ButtonLink href={callsHref(locale)} variant="secondary">
          {t.reset}
        </ButtonLink>
      }
    />
  ) : (
    <EmptyState
      icon={PhoneCall}
      title={t.title}
      description={t.text}
      action={
        <ButtonLink href={appHref(locale, "leadsNew")} variant="secondary">
          <UserPlus aria-hidden className="size-4" />
          {calls[locale].card.createLead}
        </ButtonLink>
      }
    />
  );
}
