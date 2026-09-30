/**
 * The workspace currently runs on seeded demo data. Freezing "now" keeps
 * freshness, SLA and "today" views deterministic, and guarantees server and
 * client render identical relative times (no hydration mismatch).
 *
 * Replace with `new Date()` once real data sources are connected.
 */
export const DEMO_NOW_ISO = "2026-09-30T06:00:00.000Z"; // 11:00 in Tashkent

export function now(): Date {
  return new Date(DEMO_NOW_ISO);
}
