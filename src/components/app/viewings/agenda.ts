import type { ViewingView } from "@/lib/data/views";
import type { ID, ISODateTime, Viewing, ViewingStatus } from "@/lib/domain/types";
import { tashkentDateKey, type DateKey } from "@/lib/domain/working-days";
import { appPath } from "@/lib/routes";
import { addDaysToKey, dayDistance, dayStartIso } from "./time";

/**
 * Viewing calendar logic (§14.8, §22.10, §36.3 "Viewing Calendar"): URL
 * filters, Tashkent-day agenda grouping, schedule conflicts and the
 * "what needs the agent now" flags. Pure and deterministic — `now` is always
 * passed in (the app clock in pages).
 */

type SearchParams = Record<string, string | string[] | undefined>;

export const viewingStatuses = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const satisfies readonly ViewingStatus[];

/**
 * - `upcoming` (default): from the start of today, Tashkent time;
 * - `today`, `week` (today + 6 days);
 * - `past`: before today, most recent first;
 * - `all`.
 * `upcoming` and `past` split the calendar without a gap or overlap.
 */
export const viewingRanges = ["upcoming", "today", "week", "past", "all"] as const;
export type ViewingRange = (typeof viewingRanges)[number];

export interface ViewingListParams {
  range: ViewingRange;
  status?: ViewingStatus;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Unknown or malformed values fall back to the defaults instead of failing. */
export function parseViewingListParams(search: SearchParams): ViewingListParams {
  const params: ViewingListParams = { range: oneOf(first(search.range), viewingRanges) ?? "upcoming" };
  const status = oneOf(first(search.status), viewingStatuses);
  if (status) params.status = status;
  return params;
}

/** `/{locale}/app/viewings?range=…&status=…`; defaults stay out of the URL. */
export function viewingListHref(locale: string, params: Partial<ViewingListParams> = {}): string {
  const search = new URLSearchParams();
  if (params.range && params.range !== "upcoming") search.set("range", params.range);
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  return `${appPath(locale, "/viewings")}${query ? `?${query}` : ""}`;
}

export function viewingHref(locale: string, id: ID): string {
  return appPath(locale, `/viewings/${encodeURIComponent(id)}`);
}

/** `/viewings/new?clientId=…&listingId=…`, skipping missing ids. */
export function newViewingHref(locale: string, ids: { clientId?: ID; listingId?: ID } = {}): string {
  const search = new URLSearchParams();
  if (ids.clientId) search.set("clientId", ids.clientId);
  if (ids.listingId) search.set("listingId", ids.listingId);
  const query = search.toString();
  return `${appPath(locale, "/viewings/new")}${query ? `?${query}` : ""}`;
}

/** Time window of a range: `fromIso` inclusive, `toIso` exclusive (same contract as `listViewings`). */
export function rangeBounds(range: ViewingRange, now: Date): { fromIso?: ISODateTime; toIso?: ISODateTime } {
  const today = tashkentDateKey(now);
  switch (range) {
    case "upcoming":
      return { fromIso: dayStartIso(today) };
    case "today":
      return { fromIso: dayStartIso(today), toIso: dayStartIso(addDaysToKey(today, 1)) };
    case "week":
      return { fromIso: dayStartIso(today), toIso: dayStartIso(addDaysToKey(today, 7)) };
    case "past":
      return { toIso: dayStartIso(today) };
    case "all":
      return {};
  }
}

/** Applies range and status; past viewings read newest first, everything else in time order. */
export function filterViewings(views: readonly ViewingView[], params: ViewingListParams, now: Date): ViewingView[] {
  const { fromIso, toIso } = rangeBounds(params.range, now);
  const from = fromIso ? Date.parse(fromIso) : undefined;
  const to = toIso ? Date.parse(toIso) : undefined;
  const kept = views.filter((view) => {
    const start = Date.parse(view.viewing.startsAt);
    return (
      (from === undefined || start >= from) &&
      (to === undefined || start < to) &&
      (!params.status || view.viewing.status === params.status)
    );
  });
  const direction = params.range === "past" ? -1 : 1;
  return kept.sort(
    (a, b) =>
      direction * (Date.parse(a.viewing.startsAt) - Date.parse(b.viewing.startsAt)) ||
      a.viewing.id.localeCompare(b.viewing.id),
  );
}

export type RelativeDay = "today" | "tomorrow" | "yesterday";

export interface AgendaDay {
  /** Tashkent date, "YYYY-MM-DD". */
  key: DateKey;
  /** Set for today / tomorrow / yesterday so the heading can say so. */
  relative?: RelativeDay;
  /** Any instant on that day, for date formatting. */
  anchorIso: ISODateTime;
  views: ViewingView[];
}

/** Groups already-sorted viewings by their Tashkent date, keeping the order. */
export function groupByDay(views: readonly ViewingView[], now: Date): AgendaDay[] {
  const days: AgendaDay[] = [];
  for (const view of views) {
    const key = tashkentDateKey(view.viewing.startsAt);
    let group = days.find((day) => day.key === key);
    if (!group) {
      const distance = dayDistance(now, view.viewing.startsAt);
      group = { key, anchorIso: view.viewing.startsAt, views: [] };
      if (distance === 0) group.relative = "today";
      else if (distance === 1) group.relative = "tomorrow";
      else if (distance === -1) group.relative = "yesterday";
      days.push(group);
    }
    group.views.push(view);
  }
  return days;
}

/* ------------------------------------------------------------ conflicts */

/** Cancelled and missed viewings do not hold the agent's time. */
const INACTIVE = new Set<ViewingStatus>(["cancelled", "no_show"]);

export interface TimeSlot {
  id?: ID;
  startsAt: ISODateTime;
  durationMinutes: number;
  status?: ViewingStatus;
}

export function slotEnd(slot: TimeSlot): number {
  return Date.parse(slot.startsAt) + slot.durationMinutes * 60_000;
}

/** Half-open intervals: 10:00–11:00 and 11:00–11:45 do not overlap. */
export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return Date.parse(a.startsAt) < slotEnd(b) && Date.parse(b.startsAt) < slotEnd(a);
}

/**
 * Active slots from `others` that overlap `slot` (§36.3 "Конфликт
 * расписания"), in time order. The slot itself (same id) is skipped, so a
 * rescheduled viewing is not reported as clashing with its old time.
 */
export function findOverlaps<T extends TimeSlot>(slot: TimeSlot, others: readonly T[]): T[] {
  if (slot.status && INACTIVE.has(slot.status)) return [];
  return others
    .filter((other) => other.id === undefined || other.id !== slot.id)
    .filter((other) => !other.status || !INACTIVE.has(other.status))
    .filter((other) => slotsOverlap(slot, other))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

/* ------------------------------------------------------------ attention */

/**
 * - `next_step_missing`: completed without the mandatory next action (§14.8);
 * - `outcome_missing`: the viewing ended but nobody marked what happened.
 * Silence is never read as "it went fine" (§35.7 step 6).
 */
export type ViewingAttention = "next_step_missing" | "outcome_missing";

export function viewingAttention(
  viewing: Pick<Viewing, "status" | "nextAction" | "startsAt" | "durationMinutes">,
  now: Date,
): ViewingAttention | undefined {
  if (viewing.status === "completed" && !viewing.nextAction?.trim()) return "next_step_missing";
  if ((viewing.status === "scheduled" || viewing.status === "confirmed") && slotEnd(viewing) <= now.getTime()) {
    return "outcome_missing";
  }
  return undefined;
}

/** Scheduled or confirmed, and not in the past: can still be confirmed, moved or cancelled. */
export function isOpen(viewing: Pick<Viewing, "status">): boolean {
  return viewing.status === "scheduled" || viewing.status === "confirmed";
}

/**
 * The outcome form is offered from the viewing day on: agents record the
 * result on the same day, often right after the meeting.
 */
export function canRecordOutcome(viewing: Pick<Viewing, "status" | "startsAt">, now: Date): boolean {
  return isOpen(viewing) && tashkentDateKey(viewing.startsAt) <= tashkentDateKey(now);
}

/** Viewings that need an action now, oldest first. */
export function needingAttention(views: readonly ViewingView[], now: Date): ViewingView[] {
  return views
    .filter((view) => viewingAttention(view.viewing, now) !== undefined)
    .sort((a, b) => Date.parse(a.viewing.startsAt) - Date.parse(b.viewing.startsAt));
}

/** Bookable durations in minutes; 60 is the default. */
export const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;
export const DEFAULT_DURATION = 60;
