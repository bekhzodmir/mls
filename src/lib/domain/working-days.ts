import { DISPLAY_TIME_ZONE } from "@/i18n/config";
import type { ISODateTime } from "./types";

/**
 * Working-day arithmetic in the Tashkent calendar, used for legal deadlines
 * such as "act details reach the MLS within 3 working days" (§17.5, §38.5).
 *
 * - Saturday and Sunday are days off.
 * - Public holidays and transferred days are configuration, not code: the
 *   official calendar changes every year by government decision, so nothing
 *   here hard-codes a holiday list. Load it from the official source and pass
 *   it in; the default calendar has no holidays at all.
 * - Dates are evaluated on the Asia/Tashkent wall clock regardless of where
 *   the code runs; storage stays UTC ISO-8601.
 */

/** A local calendar date in Tashkent, "YYYY-MM-DD". */
export type DateKey = string;

export interface WorkCalendar {
  /** Public holidays and transferred days off, "YYYY-MM-DD" in Tashkent. */
  holidays: readonly DateKey[];
  /** Weekend days declared working by a transfer decision, "YYYY-MM-DD". */
  workingWeekends?: readonly DateKey[];
}

/** Either a bare holiday list or a full calendar. */
export type CalendarInput = readonly DateKey[] | WorkCalendar;

/**
 * Empty on purpose — load the official production calendar (holidays and
 * transfers) before relying on deadlines for compliance.
 */
export const DEFAULT_WORK_CALENDAR: WorkCalendar = { holidays: [] };

/** Legal window for entering act details into the MLS (§17.5, §38.5). */
export const MLS_REPORT_WORKING_DAYS = 3;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function toCalendar(input: CalendarInput): { off: Set<DateKey>; on: Set<DateKey> } {
  const calendar: WorkCalendar = Array.isArray(input)
    ? { holidays: input as readonly DateKey[] }
    : (input as WorkCalendar);
  for (const key of [...calendar.holidays, ...(calendar.workingWeekends ?? [])]) {
    if (!DATE_KEY.test(key)) throw new RangeError(`Calendar dates must be "YYYY-MM-DD": "${key}"`);
  }
  return { off: new Set(calendar.holidays), on: new Set(calendar.workingWeekends ?? []) };
}

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

function toWallClock(date: Date): WallClock {
  const parts: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    millisecond: date.getUTCMilliseconds(),
  };
}

/** Converts a Tashkent wall-clock time back to a UTC instant (tz-database driven). */
function fromWallClock(wall: WallClock): Date {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second, wall.millisecond);
  let guess = asUtc;
  // Two passes settle any offset change; Tashkent has none today but the
  // tz database, not this file, is the authority.
  for (let i = 0; i < 2; i += 1) {
    const seen = toWallClock(new Date(guess));
    const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second, seen.millisecond);
    guess += asUtc - seenUtc;
  }
  return new Date(guess);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Tashkent calendar date of an instant, "YYYY-MM-DD". */
export function tashkentDateKey(value: ISODateTime | Date): DateKey {
  const wall = toWallClock(typeof value === "string" ? parseInstant(value) : value);
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
}

function parseInstant(iso: ISODateTime): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Not an ISO-8601 instant: "${iso}"`);
  return date;
}

/** Shifts a wall-clock date by whole days; the time of day is kept. */
function shiftDays(wall: WallClock, days: number): WallClock {
  const shifted = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days));
  return {
    ...wall,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function keyOf(wall: WallClock): DateKey {
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
}

function isWorking(wall: WallClock, calendar: { off: Set<DateKey>; on: Set<DateKey> }): boolean {
  const key = keyOf(wall);
  if (calendar.on.has(key)) return true;
  if (calendar.off.has(key)) return false;
  const weekday = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

/** True when the Tashkent calendar date of `value` is a working day. */
export function isWorkingDay(
  value: ISODateTime | Date,
  calendar: CalendarInput = DEFAULT_WORK_CALENDAR,
): boolean {
  return isWorking(toWallClock(typeof value === "string" ? parseInstant(value) : value), toCalendar(calendar));
}

/**
 * Moves `n` working days forward (or backward for negative `n`) from the
 * instant's Tashkent date, keeping the wall-clock time. The start day itself
 * is day 0 and is never counted, even if it is a working day; n = 0 returns
 * the same instant.
 */
export function addWorkingDays(
  iso: ISODateTime,
  n: number,
  calendar: CalendarInput = DEFAULT_WORK_CALENDAR,
): ISODateTime {
  if (!Number.isInteger(n)) throw new RangeError(`Working days must be an integer: ${n}`);
  const start = parseInstant(iso);
  const cal = toCalendar(calendar);
  let wall = toWallClock(start);
  const step = n < 0 ? -1 : 1;
  for (let left = Math.abs(n); left > 0; ) {
    wall = shiftDays(wall, step);
    if (isWorking(wall, cal)) left -= 1;
  }
  return fromWallClock(wall).toISOString();
}

/** Last millisecond of the instant's Tashkent calendar day. */
export function endOfTashkentDay(iso: ISODateTime): ISODateTime {
  const wall = toWallClock(parseInstant(iso));
  return fromWallClock({ ...wall, hour: 23, minute: 59, second: 59, millisecond: 999 }).toISOString();
}

/**
 * Deadline for entering act details into the MLS: the end of the third
 * working day after the act was signed (Tashkent time). The signing day is
 * day 0; an act signed on a weekend starts counting from Monday.
 *
 * "Не позднее трёх рабочих дней" is read here as "until the end of the third
 * working day" — confirm with Legal before relying on it for enforcement.
 */
export function mlsReportDeadline(
  actSignedAtIso: ISODateTime,
  calendar: CalendarInput = DEFAULT_WORK_CALENDAR,
): ISODateTime {
  return endOfTashkentDay(addWorkingDays(actSignedAtIso, MLS_REPORT_WORKING_DAYS, calendar));
}

/**
 * Working days left before a deadline, counted on Tashkent dates:
 * - positive: working days after today up to and including the deadline day;
 * - 0: the deadline is today (or no working day remains before it);
 * - negative: overdue — minus the working days elapsed since the deadline
 *   day, and at least -1 as soon as the deadline instant has passed.
 */
export function workingDaysLeft(
  deadlineIso: ISODateTime,
  now: Date,
  calendar: CalendarInput = DEFAULT_WORK_CALENDAR,
): number {
  const deadline = parseInstant(deadlineIso);
  const cal = toCalendar(calendar);
  const today = toWallClock(now);
  const deadlineWall = toWallClock(deadline);

  if (now.getTime() <= deadline.getTime()) {
    let count = 0;
    for (let wall = shiftDays(today, 1); keyOf(wall) <= keyOf(deadlineWall); wall = shiftDays(wall, 1)) {
      if (isWorking(wall, cal)) count += 1;
    }
    return count;
  }

  let overdue = 0;
  for (let wall = shiftDays(deadlineWall, 1); keyOf(wall) <= keyOf(today); wall = shiftDays(wall, 1)) {
    if (isWorking(wall, cal)) overdue += 1;
  }
  return -Math.max(1, overdue);
}
