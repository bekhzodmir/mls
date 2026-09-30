import type { Freshness, FreshnessState, ISODateTime } from "./types";

/**
 * Freshness of an offer (§13.4, §34.6). Age is measured from the latest
 * confirmation if there is one, otherwise from publication. Thresholds are
 * configuration and must be calibrated on real data.
 *
 * Going stale never deletes history and never claims the object was sold.
 */
export interface FreshnessConfig {
  /** Inclusive upper bound in days for each band. */
  freshMaxDays: number;
  normalMaxDays: number;
  agingMaxDays: number;
}

export const defaultFreshnessConfig: FreshnessConfig = {
  freshMaxDays: 3,
  normalMaxDays: 7,
  agingMaxDays: 14,
};

const DAY_MS = 86_400_000;

export function daysBetween(fromIso: ISODateTime, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY_MS));
}

export function computeFreshness(
  input: { publishedAt: ISODateTime; lastConfirmedAt?: ISODateTime; expiresAt?: ISODateTime },
  now: Date,
  config: FreshnessConfig = defaultFreshnessConfig,
): Freshness {
  const confirmed = input.lastConfirmedAt;
  const basisIso =
    confirmed && new Date(confirmed).getTime() > new Date(input.publishedAt).getTime()
      ? confirmed
      : input.publishedAt;
  const basis = basisIso === confirmed ? "last_confirmed" : "published";
  const ageDays = daysBetween(basisIso, now);

  if (input.expiresAt && new Date(input.expiresAt).getTime() <= now.getTime()) {
    return { state: "expired", score: 0, ageDays, basis };
  }

  const state: FreshnessState =
    ageDays <= config.freshMaxDays
      ? "fresh"
      : ageDays <= config.normalMaxDays
        ? "normal"
        : ageDays <= config.agingMaxDays
          ? "aging"
          : "needs_confirmation";

  // Linear decay to 0.2 at the aging boundary, then a floor of 0.1 until confirmed.
  const score =
    ageDays > config.agingMaxDays
      ? 0.1
      : Math.round((1 - (0.8 * ageDays) / config.agingMaxDays) * 100) / 100;

  return { state, score, ageDays, basis };
}

/** True when the UI must show a stale warning instead of a plain "Active". */
export function needsAttention(freshness: Freshness): boolean {
  return freshness.state === "needs_confirmation" || freshness.state === "expired";
}
