import { DISPLAY_TIME_ZONE } from "@/i18n/config";
import type { ISODateTime } from "@/lib/domain/types";
import { tashkentDateKey, type DateKey } from "@/lib/domain/working-days";

/**
 * Tashkent wall-clock helpers for the viewing forms. `<input type="date">`
 * and `<input type="time">` give a local date and time without a zone; the
 * product defines them as Asia/Tashkent time (§34.1), whatever the device
 * zone is, and stores UTC ISO-8601.
 *
 * The offset comes from the tz database via `Intl`, not a hard-coded +5.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function wallOf(date: Date): Wall {
  const parts: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Date and time of an instant on the Tashkent clock: { date: "2026-10-01", time: "10:30" }. */
export function tashkentParts(iso: ISODateTime | Date): { date: DateKey; time: string } {
  const wall = wallOf(typeof iso === "string" ? new Date(iso) : iso);
  return { date: `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`, time: `${pad(wall.hour)}:${pad(wall.minute)}` };
}

/**
 * UTC instant of a Tashkent wall-clock date and time, or undefined when the
 * input is empty, malformed or not a real calendar date (2026-02-30).
 */
export function tashkentInstant(date: string, time: string): ISODateTime | undefined {
  const d = DATE_RE.exec(date.trim());
  const t = TIME_RE.exec(time.trim());
  if (!d || !t) return undefined;
  const [year, month, day, hour, minute] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  if (hour > 23 || minute > 59) return undefined;
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(asUtc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return undefined;
  }
  let guess = asUtc;
  // Two passes settle any offset change; the tz database is the authority.
  for (let i = 0; i < 2; i += 1) {
    const seen = wallOf(new Date(guess));
    guess += asUtc - Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
  }
  return new Date(guess).toISOString();
}

/** "2026-09-30" + 1 → "2026-10-01" (calendar arithmetic, no time zone involved). */
export function addDaysToKey(key: DateKey, days: number): DateKey {
  const match = DATE_RE.exec(key);
  if (!match) throw new RangeError(`Not a date key: "${key}"`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** UTC instant of 00:00 in Tashkent on the given date. */
export function dayStartIso(key: DateKey): ISODateTime {
  const iso = tashkentInstant(key, "00:00");
  if (!iso) throw new RangeError(`Not a date key: "${key}"`);
  return iso;
}

/** Whole-day distance between the Tashkent dates of two instants (b − a). */
export function dayDistance(a: ISODateTime | Date, b: ISODateTime | Date): number {
  const [ka, kb] = [tashkentDateKey(a), tashkentDateKey(b)];
  const toUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(kb) - toUtc(ka)) / 86_400_000);
}
