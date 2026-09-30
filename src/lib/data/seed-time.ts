import { DEMO_NOW_ISO } from "@/lib/clock";
import type { ISODateTime } from "@/lib/domain/types";

/**
 * Demo-time helpers for the seed. Every seeded timestamp is written relative
 * to the frozen demo "now" (`DEMO_NOW_ISO`: Wednesday 30 September 2026,
 * 11:00 in Tashkent), so the data always tells the same story — overdue,
 * today, this week, stale, expiring — and SSR and hydration agree.
 *
 * Tashkent is UTC+5 all year (no daylight saving time), so wall-clock
 * arithmetic is a fixed offset; storage stays UTC ISO-8601 (§34.1).
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const TASHKENT_OFFSET_MS = 5 * HOUR_MS;

const NOW_MS = Date.parse(DEMO_NOW_ISO);

/** UTC instant of 00:00 Tashkent time on the demo day. */
const DEMO_DAY_START_MS =
  Math.floor((NOW_MS + TASHKENT_OFFSET_MS) / DAY_MS) * DAY_MS - TASHKENT_OFFSET_MS;

/**
 * Tashkent wall-clock time on the day `dayOffset` days from the demo day:
 * `day(0, "14:00")` is today at 14:00, `day(-2, "15:00")` is Monday 15:00.
 */
export function day(dayOffset: number, time = "10:00"): ISODateTime {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) throw new RangeError(`Not an HH:MM time: "${time}"`);
  const offset = Number(match[1]) * HOUR_MS + Number(match[2]) * MINUTE_MS;
  return new Date(DEMO_DAY_START_MS + dayOffset * DAY_MS + offset).toISOString();
}

/** An instant `minutes` after the demo "now" (negative = before). */
export function minutesFromNow(minutes: number): ISODateTime {
  return new Date(NOW_MS + minutes * MINUTE_MS).toISOString();
}
