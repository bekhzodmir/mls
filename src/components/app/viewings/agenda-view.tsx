import Link from "next/link";
import { CalendarPlus, CalendarSearch, Clock, Lock, MapPin, TriangleAlert, UserRound, Users } from "lucide-react";
import { locationLine, typeLabel } from "@/components/app/inventory/labels";
import { MoneyText } from "@/components/domain/badges";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipLink } from "@/components/ui/misc";
import { format, plural } from "@/i18n/define-messages";
import { intlLocale, type Locale } from "@/i18n/config";
import { formatDate, formatTime } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import viewings from "@/i18n/messages/viewings";
import type { ViewingView } from "@/lib/data/views";
import type { ID } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import {
  newViewingHref,
  slotEnd,
  viewingAttention,
  viewingHref,
  viewingListHref,
  viewingRanges,
  viewingStatuses,
  type AgendaDay,
  type ViewingListParams,
} from "./agenda";
import { AttentionBadge, ConfirmationList, ViewingStatusBadge } from "./viewing-badges";

/**
 * Viewing calendar building blocks (§22.10, §36.3): filter chips, the day
 * agenda and the per-viewing card. Server components; all data arrives
 * already access-filtered from the repository.
 */

/** «14:00–15:00». */
export function timeRange(locale: Locale, startsAt: string, durationMinutes: number): string {
  const end = new Date(slotEnd({ startsAt, durationMinutes })).toISOString();
  return `${formatTime(locale, startsAt)}–${formatTime(locale, end)}`;
}

/** «Сегодня · среда, 30 сентября» or «пятница, 2 октября». */
export function dayHeading(locale: Locale, day: Pick<AgendaDay, "anchorIso" | "relative">): string {
  const date = formatDate(locale, day.anchorIso, { weekday: "long", day: "numeric", month: "long" });
  return day.relative ? `${viewings[locale].list.day[day.relative]} · ${date}` : capitalize(locale, date);
}

function capitalize(locale: Locale, text: string): string {
  return text.charAt(0).toLocaleUpperCase(intlLocale[locale]) + text.slice(1);
}

export function viewingCountText(locale: Locale, n: number): string {
  return format(plural(locale, n, viewings[locale].list.count), { n });
}

/** «10:30 · Елена Ковалёва, 11:15 · …» for the conflict line. */
export function conflictList(locale: Locale, ids: readonly ID[], all: readonly ViewingView[]): string | undefined {
  const found = ids
    .map((id) => all.find((view) => view.viewing.id === id))
    .filter((view): view is ViewingView => view !== undefined);
  if (found.length === 0) return undefined;
  return new Intl.ListFormat(intlLocale[locale], { type: "conjunction" }).format(
    found.map((view) => `${formatTime(locale, view.viewing.startsAt)} · ${view.client.name}`),
  );
}

export function ViewingFilters({ locale, params }: { locale: Locale; params: ViewingListParams }) {
  const t = viewings[locale].list;
  const d = domain[locale];
  return (
    <div className="space-y-2">
      <nav aria-label={t.range.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          {viewingRanges.map((range) => (
            <li key={range}>
              <ChipLink href={viewingListHref(locale, { ...params, range })} active={params.range === range}>
                {t.range[range]}
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label={t.status.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          <li>
            <ChipLink href={viewingListHref(locale, { range: params.range })} active={!params.status}>
              {t.status.all}
            </ChipLink>
          </li>
          {viewingStatuses.map((status) => (
            <li key={status}>
              <ChipLink href={viewingListHref(locale, { ...params, status })} active={params.status === status}>
                {d.viewingStatus[status]}
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/**
 * One viewing in the agenda: time and duration, the property (type, place,
 * price), client, partner, status, both confirmations, the address as far as
 * access allows, conflicts and missing follow-ups (§14.8, §36.3).
 */
export function ViewingCard({
  locale,
  view,
  all,
  now,
  headingLevel = 3,
}: {
  locale: Locale;
  view: ViewingView;
  /** Every viewing of the agent, to name what a conflict clashes with. */
  all: readonly ViewingView[];
  now: Date;
  headingLevel?: 2 | 3;
}) {
  const t = viewings[locale].item;
  const { viewing, listing, client, partner } = view;
  const property = listing.property;
  const attention = viewingAttention(viewing, now);
  const conflicts = view.conflictsWith.length > 0 ? conflictList(locale, view.conflictsWith, all) : undefined;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const muted = viewing.status === "cancelled" || viewing.status === "no_show";

  return (
    <Link
      href={viewingHref(locale, viewing.id)}
      className={cn(
        "block rounded-lg border bg-surface p-4 shadow-card transition-colors hover:border-border-strong hover:bg-surface-muted/40",
        view.conflictsWith.length > 0 && !muted ? "border-warning-border" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-body font-semibold text-fg tabular">
          <Clock aria-hidden className="size-4 shrink-0 text-fg-muted" />
          <time dateTime={viewing.startsAt}>{timeRange(locale, viewing.startsAt, viewing.durationMinutes)}</time>
          <span className="text-small font-normal text-fg-muted">
            · {format(t.duration, { n: viewing.durationMinutes })}
          </span>
        </p>
        <ViewingStatusBadge locale={locale} status={viewing.status} />
      </div>

      <Heading className={cn("mt-2 text-body font-semibold", muted ? "text-fg-muted" : "text-fg")}>
        {typeLabel(locale, property)}
        <span className="font-normal text-fg-muted"> · {locationLine(locale, property)}</span>
      </Heading>
      <p className="mt-0.5 text-small text-fg">
        <MoneyText locale={locale} value={listing.listing.price} className="font-semibold" />
        <span className="text-fg-muted"> · {domain[locale].dealType[listing.listing.dealType]}</span>
      </p>

      <ul className="mt-2 space-y-1 text-small">
        <li className="flex items-start gap-1.5 font-medium text-fg">
          <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <span>
            <span className="sr-only">{t.client}: </span>
            {client.name}
          </span>
        </li>
        {partner ? (
          <li className="flex items-start gap-1.5 text-fg">
            <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
            <span>{format(t.partner, { name: partner.name })}</span>
          </li>
        ) : null}
        <li className={cn("flex items-start gap-1.5", property.address ? "text-fg" : "text-fg-muted")}>
          {property.address ? (
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          ) : (
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          <span>
            <span className="sr-only">{t.address}: </span>
            {property.address ?? t.addressHidden}
          </span>
        </li>
      </ul>

      <ConfirmationList
        locale={locale}
        confirmations={viewing.confirmations}
        hasPartner={Boolean(viewing.partnerAgentId)}
        className="mt-2"
      />

      {view.conflictsWith.length > 0 && !muted ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-sm bg-warning-bg px-2 py-1.5 text-caption font-medium text-warning-fg">
          <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
          <span>{conflicts ? format(t.conflict, { list: conflicts }) : t.conflictUnknown}</span>
        </p>
      ) : null}
      {attention ? (
        <div className="mt-2">
          <AttentionBadge locale={locale} attention={attention} />
        </div>
      ) : null}
      <span className="sr-only">{t.open}</span>
    </Link>
  );
}

export function AgendaDays({
  locale,
  days,
  all,
  now,
}: {
  locale: Locale;
  days: readonly AgendaDay[];
  all: readonly ViewingView[];
  now: Date;
}) {
  return (
    <div className="space-y-6">
      {days.map((day) => (
        <section key={day.key} aria-labelledby={`day-${day.key}`} className="space-y-3">
          <h2 id={`day-${day.key}`} className="flex items-baseline justify-between gap-2 text-h2 text-fg">
            <span>{dayHeading(locale, day)}</span>
            <span className="text-small font-normal text-fg-muted">{viewingCountText(locale, day.views.length)}</span>
          </h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {day.views.map((view) => (
              <li key={view.viewing.id}>
                <ViewingCard locale={locale} view={view} all={all} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Empty agenda (§23.1): why it is empty and the first step. */
export function ViewingsEmpty({ locale, params }: { locale: Locale; params: ViewingListParams }) {
  const t = viewings[locale].list;
  const filtered = params.status !== undefined || (params.range !== "upcoming" && params.range !== "all");
  return (
    <EmptyState
      icon={filtered ? CalendarSearch : CalendarPlus}
      title={t.empty.title}
      description={filtered ? t.empty.filtered : t.empty.upcoming}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href={newViewingHref(locale)}>
            <CalendarPlus aria-hidden className="size-4" />
            {t.add}
          </ButtonLink>
          {filtered ? (
            <ButtonLink href={viewingListHref(locale, { range: "all" })} variant="secondary">
              {t.empty.reset}
            </ButtonLink>
          ) : null}
        </div>
      }
    />
  );
}
