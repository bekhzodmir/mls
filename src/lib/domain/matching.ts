import { computeFreshness, defaultFreshnessConfig, type FreshnessConfig } from "./freshness";
import { areNeighbours } from "./geo";
import { convertMoney, subtractMoney, type FxRates } from "./money";
import type {
  BuildingKind,
  CityId,
  ConfidenceBand,
  DealType,
  DistrictId,
  Freshness,
  HardFilterFailure,
  ISODateTime,
  Listing,
  MatchCriterion,
  MatchReason,
  MatchTarget,
  Money,
  Property,
  PropertyType,
  RenovationState,
  Requirement,
  SourceKind,
  TelegramListing,
} from "./types";

/**
 * Matching engine (§12, §35.4).
 *
 * 1. Hard filters remove impossible pairs: deal type, city, property type,
 *    budget beyond tolerance, inactive/expired source, and any criterion the
 *    agent explicitly marked as must-have.
 * 2. Soft criteria each earn 0..1 credit, multiplied by configurable weights
 *    (geo 25, price 25, type 15, rooms 15, area 10, floor/building 5, extras 5).
 * 3. The integer score maps to a confidence band; < 60 is not shown
 *    automatically.
 * 4. Every criterion yields a machine-readable reason so the UI can say
 *    "Подходит по району, бюджету и комнатам" or "На $8 000 дороже бюджета"
 *    instead of an opaque "AI score 87.43" (§12.4).
 *
 * Unknown data is never treated as a match or a mismatch: it earns partial
 * credit and is reported as missing so the agent can ask.
 *
 * The engine is pure and deterministic: the same inputs always produce the
 * same score, which makes matches reproducible and auditable.
 */

export interface MatchingConfig {
  /** Percent weights; must sum to 100. */
  weights: Record<MatchCriterion, number>;
  /** Lower bounds (inclusive) of each visible band. */
  bands: { excellent: number; good: number; possible: number };
  /** Share over the maximum budget that is still shown (0.1 = +10%). */
  budgetTolerance: number;
  /** Credit given to a criterion whose candidate value is unknown. */
  unknownCredit: number;
  /** Parsed Telegram fields below this confidence are treated as unknown. */
  minParseConfidence: number;
  fx: FxRates;
  freshness: FreshnessConfig;
}

export const defaultMatchingConfig: MatchingConfig = {
  weights: {
    location: 25,
    price: 25,
    property_type: 15,
    rooms: 15,
    area: 10,
    floor: 5,
    extras: 5,
  },
  bands: { excellent: 90, good: 75, possible: 60 },
  budgetTolerance: 0.1,
  unknownCredit: 0.5,
  minParseConfidence: 0.6,
  // Demo rate for converting mixed-currency comparisons. Replace with a rates
  // provider; conversions are always flagged to the user.
  fx: { uzsPerUsd: 12_700, asOf: "demo" },
  freshness: defaultFreshnessConfig,
};

/** Normalized view of anything that can satisfy a Requirement. */
export interface MatchCandidate {
  target: MatchTarget;
  dealType?: DealType;
  propertyType?: PropertyType;
  city: CityId;
  district?: DistrictId;
  rooms?: number;
  areaTotal?: number;
  floor?: number;
  floorsTotal?: number;
  buildingKind?: BuildingKind;
  renovation?: RenovationState;
  price?: Money;
  source: SourceKind;
  /** False for withdrawn / archived / hidden / reported-stale candidates. */
  active: boolean;
  publishedAt: ISODateTime;
  lastConfirmedAt?: ISODateTime;
  expiresAt?: ISODateTime;
  /** Free text searched for requirement extras (description / raw post). */
  text?: string;
}

export type MatchEvaluation =
  | { eligible: false; failures: HardFilterFailure[]; freshness: Freshness }
  | {
      eligible: true;
      score: number;
      band: ConfidenceBand;
      reasons: MatchReason[];
      freshness: Freshness;
    };

const ACTIVE_LISTING_STATUSES = new Set<Listing["status"]>([
  "verified",
  "active_mls",
  "offer",
  "verification_pending",
  "contract_signed",
]);

/**
 * The physical attributes the engine compares. The address is not among them,
 * so a partner-safe property view (address withheld) is a valid input.
 */
export type MatchableProperty = Pick<
  Property,
  | "propertyType"
  | "city"
  | "district"
  | "rooms"
  | "areaTotal"
  | "floor"
  | "floorsTotal"
  | "buildingKind"
  | "renovation"
>;

export function candidateFromListing(listing: Listing, property: MatchableProperty): MatchCandidate {
  return {
    target: { kind: "listing", id: listing.id },
    dealType: listing.dealType,
    propertyType: property.propertyType,
    city: property.city,
    district: property.district,
    rooms: property.rooms,
    areaTotal: property.areaTotal,
    floor: property.floor,
    floorsTotal: property.floorsTotal,
    buildingKind: property.buildingKind,
    renovation: property.renovation,
    price: listing.price,
    source: listing.source,
    active: ACTIVE_LISTING_STATUSES.has(listing.status),
    publishedAt: listing.publishedAt,
    lastConfirmedAt: listing.lastConfirmedAt,
    expiresAt: listing.expiresAt,
    text: listing.description,
  };
}

export function candidateFromTelegram(
  post: TelegramListing,
  config: MatchingConfig = defaultMatchingConfig,
): MatchCandidate {
  const pick = <T>(field: { value?: T; confidence: number }): T | undefined =>
    field.confidence >= config.minParseConfidence ? field.value : undefined;
  return {
    target: { kind: "telegram", id: post.id },
    dealType: pick(post.parsed.dealType),
    propertyType: pick(post.parsed.propertyType),
    // Collected sources are Tashkent channels; region posts carry their own city later.
    city: "tashkent",
    district: pick(post.parsed.district),
    rooms: pick(post.parsed.rooms),
    areaTotal: pick(post.parsed.areaTotal),
    floor: pick(post.parsed.floor),
    floorsTotal: pick(post.parsed.floorsTotal),
    price: pick(post.parsed.price),
    source: "telegram",
    active: post.status !== "hidden" && post.status !== "reported_stale",
    publishedAt: post.publishedAt,
    text: post.rawText,
  };
}

export function bandFor(score: number, config: MatchingConfig = defaultMatchingConfig): ConfidenceBand {
  if (score >= config.bands.excellent) return "excellent";
  if (score >= config.bands.good) return "good";
  if (score >= config.bands.possible) return "possible";
  return "hidden";
}

export function evaluateMatch(
  requirement: Requirement,
  candidate: MatchCandidate,
  now: Date,
  config: MatchingConfig = defaultMatchingConfig,
): MatchEvaluation {
  const freshness = computeFreshness(candidate, now, config.freshness);
  const failures: HardFilterFailure[] = [];
  const hard = new Set(requirement.hardCriteria);

  // ---- Hard filters (§12.2) --------------------------------------------
  if (!candidate.active || freshness.state === "expired") failures.push("inactive_source");
  if (candidate.dealType && candidate.dealType !== requirement.dealType) failures.push("deal_type");
  if (candidate.city !== requirement.city) failures.push("city");
  if (
    candidate.propertyType &&
    requirement.propertyTypes.length > 0 &&
    !requirement.propertyTypes.includes(candidate.propertyType)
  ) {
    failures.push("property_type");
  }

  const reasons: MatchReason[] = [
    scoreLocation(requirement, candidate, config),
    scorePrice(requirement, candidate, config, hard.has("price")),
    scorePropertyType(requirement, candidate, config),
    scoreRooms(requirement, candidate, config),
    scoreArea(requirement, candidate, config),
    scoreFloor(requirement, candidate, config),
    scoreExtras(requirement, candidate, config),
  ];

  const price = reasons[1];
  if (price.outcome === "mismatch" && price.detail?.kind === "price_over") {
    failures.push("budget_out_of_range");
  }

  if (violatesHardCriteria(requirement, candidate, reasons)) failures.push("hard_criterion");

  if (failures.length > 0) return { eligible: false, failures, freshness };

  const raw = reasons.reduce((sum, reason) => sum + reason.weight * reason.credit, 0);
  const score = Math.round(raw);
  return { eligible: true, score, band: bandFor(score, config), reasons, freshness };
}

function violatesHardCriteria(
  requirement: Requirement,
  candidate: MatchCandidate,
  reasons: MatchReason[],
): boolean {
  const byCriterion = new Map(reasons.map((reason) => [reason.criterion, reason]));
  for (const criterion of requirement.hardCriteria) {
    switch (criterion) {
      case "location":
      case "rooms":
      case "area":
      case "floor": {
        const reason = byCriterion.get(criterion);
        // A must-have is violated only by a known mismatch or partial fit;
        // unknown data stays visible so the agent can ask.
        if (reason && (reason.outcome === "mismatch" || reason.outcome === "partial")) return true;
        break;
      }
      case "building_kind":
        if (
          requirement.buildingKind &&
          candidate.buildingKind &&
          candidate.buildingKind !== requirement.buildingKind
        ) {
          return true;
        }
        break;
      case "renovation":
        if (
          requirement.renovation?.length &&
          candidate.renovation &&
          !requirement.renovation.includes(candidate.renovation)
        ) {
          return true;
        }
        break;
      case "price":
      case "property_type":
        // Already enforced: price via zero tolerance, type via the hard filter.
        break;
    }
  }
  return false;
}

/* ------------------------------------------------------------ criteria */

function reason(
  criterion: MatchCriterion,
  config: MatchingConfig,
  outcome: MatchReason["outcome"],
  credit: number,
  detail?: MatchReason["detail"],
): MatchReason {
  const base = { criterion, outcome, credit, weight: config.weights[criterion], requested: true };
  return detail ? { ...base, detail } : base;
}

/** The requirement says nothing about this criterion: full credit, not a "reason". */
function notRequested(criterion: MatchCriterion, config: MatchingConfig): MatchReason {
  return { criterion, outcome: "match", credit: 1, weight: config.weights[criterion], requested: false };
}

function unknown(criterion: MatchCriterion, config: MatchingConfig): MatchReason {
  return reason(criterion, config, "unknown", config.unknownCredit, { kind: "missing_data" });
}

function scoreLocation(req: Requirement, cand: MatchCandidate, config: MatchingConfig): MatchReason {
  if (req.districts.length === 0) return notRequested("location", config);
  if (!cand.district) return unknown("location", config);
  if (req.districts.includes(cand.district)) {
    return reason("location", config, "match", 1, { kind: "district_exact", district: cand.district });
  }
  const district = cand.district;
  if (req.districts.some((wanted) => areNeighbours(wanted, district))) {
    return reason("location", config, "partial", 0.5, { kind: "district_adjacent", district });
  }
  return reason("location", config, "mismatch", 0, { kind: "district_other", district });
}

function scorePrice(
  req: Requirement,
  cand: MatchCandidate,
  config: MatchingConfig,
  hardPrice: boolean,
): MatchReason {
  const { min, max } = req.budget;
  if (!min && !max) return notRequested("price", config);
  if (!cand.price) return unknown("price", config);

  const converted = cand.price.currency !== req.budget.currency;
  const price = convertMoney(cand.price, req.budget.currency, config.fx);
  const conversionDetail = { kind: "price_converted", from: cand.price.currency, to: req.budget.currency } as const;

  if (max && price.amountMinor > max.amountMinor) {
    const by = subtractMoney(price, max);
    const ratio = by.amountMinor / max.amountMinor;
    const tolerance = hardPrice ? 0 : config.budgetTolerance;
    if (ratio > tolerance) return reason("price", config, "mismatch", 0, { kind: "price_over", by });
    const credit = round2(1 - ratio / tolerance);
    return reason("price", config, "partial", credit, { kind: "price_over", by });
  }
  if (min && price.amountMinor < min.amountMinor) {
    // Cheaper than expected is usually acceptable but may signal a different class of object.
    return reason("price", config, "partial", 0.8, { kind: "price_under", by: subtractMoney(min, price) });
  }
  return reason("price", config, "match", 1, converted ? conversionDetail : { kind: "price_within" });
}

function scorePropertyType(req: Requirement, cand: MatchCandidate, config: MatchingConfig): MatchReason {
  if (req.propertyTypes.length === 0) return notRequested("property_type", config);
  if (!cand.propertyType) return unknown("property_type", config);
  return req.propertyTypes.includes(cand.propertyType)
    ? reason("property_type", config, "match", 1)
    : reason("property_type", config, "mismatch", 0);
}

function scoreRooms(req: Requirement, cand: MatchCandidate, config: MatchingConfig): MatchReason {
  const { min, max } = req.rooms;
  if (min === undefined && max === undefined) return notRequested("rooms", config);
  if (cand.rooms === undefined) return unknown("rooms", config);
  const delta =
    min !== undefined && cand.rooms < min
      ? cand.rooms - min
      : max !== undefined && cand.rooms > max
        ? cand.rooms - max
        : 0;
  if (delta === 0) return reason("rooms", config, "match", 1);
  if (Math.abs(delta) === 1) return reason("rooms", config, "partial", 0.5, { kind: "rooms_off_by", delta });
  return reason("rooms", config, "mismatch", 0, { kind: "rooms_off_by", delta });
}

function scoreArea(req: Requirement, cand: MatchCandidate, config: MatchingConfig): MatchReason {
  const { min, max } = req.area;
  if (min === undefined && max === undefined) return notRequested("area", config);
  if (cand.areaTotal === undefined) return unknown("area", config);
  const area = cand.areaTotal;
  let deltaSqm = 0;
  let boundary = 1;
  if (min !== undefined && area < min) {
    deltaSqm = area - min;
    boundary = min;
  } else if (max !== undefined && area > max) {
    deltaSqm = area - max;
    boundary = max;
  }
  if (deltaSqm === 0) return reason("area", config, "match", 1);
  const relative = Math.abs(deltaSqm) / boundary;
  const detail = { kind: "area_off_by", deltaSqm: round2(deltaSqm) } as const;
  if (relative <= 0.1) return reason("area", config, "partial", 0.7, detail);
  if (relative <= 0.2) return reason("area", config, "partial", 0.4, detail);
  return reason("area", config, "mismatch", 0, detail);
}

/** "Этаж/дом" (§12.3): floor preferences and new-building vs secondary. */
function scoreFloor(req: Requirement, cand: MatchCandidate, config: MatchingConfig): MatchReason {
  const prefs = req.floor;
  const wantsFloor = Boolean(
    prefs && (prefs.notFirst || prefs.notLast || prefs.min !== undefined || prefs.max !== undefined),
  );
  const wantsBuilding = req.buildingKind !== undefined;
  if (!wantsFloor && !wantsBuilding) return notRequested("floor", config);

  if (wantsBuilding && req.buildingKind && cand.buildingKind && cand.buildingKind !== req.buildingKind) {
    return reason("floor", config, "mismatch", 0, {
      kind: "building_kind_mismatch",
      expected: req.buildingKind,
      actual: cand.buildingKind,
    });
  }

  if (wantsFloor && prefs) {
    if (cand.floor === undefined) return unknown("floor", config);
    if (prefs.notFirst && cand.floor === 1) {
      return reason("floor", config, "mismatch", 0, { kind: "floor_first" });
    }
    if (prefs.notLast && cand.floorsTotal !== undefined && cand.floor === cand.floorsTotal) {
      return reason("floor", config, "mismatch", 0, { kind: "floor_last" });
    }
    if (
      (prefs.min !== undefined && cand.floor < prefs.min) ||
      (prefs.max !== undefined && cand.floor > prefs.max)
    ) {
      return reason("floor", config, "mismatch", 0, { kind: "floor_out_of_range", floor: cand.floor });
    }
  }

  if (wantsBuilding && !cand.buildingKind) return unknown("floor", config);
  return reason("floor", config, "match", 1);
}

/** Renovation state and free-form extras such as "парковка" (§12.3 "Дополнительные параметры"). */
function scoreExtras(req: Requirement, cand: MatchCandidate, config: MatchingConfig): MatchReason {
  const wantsRenovation = Boolean(req.renovation?.length);
  const extras = req.extras.map((extra) => extra.trim()).filter(Boolean);
  if (!wantsRenovation && extras.length === 0) return notRequested("extras", config);

  if (wantsRenovation && cand.renovation && !req.renovation?.includes(cand.renovation)) {
    return reason("extras", config, "mismatch", 0, { kind: "renovation_mismatch", actual: cand.renovation });
  }
  if (extras.length === 0) {
    return cand.renovation ? reason("extras", config, "match", 1) : unknown("extras", config);
  }

  const haystack = (cand.text ?? "").toLocaleLowerCase("ru");
  const matched = extras.filter((extra) => haystack.includes(extra.toLocaleLowerCase("ru")));
  const missing = extras.filter((extra) => !matched.includes(extra));
  const credit = round2(matched.length / extras.length);
  const outcome = credit === 1 ? "match" : credit === 0 ? "unknown" : "partial";
  // Absence of a keyword in free text is not proof of absence: report as unknown, not mismatch.
  return reason("extras", config, outcome, outcome === "unknown" ? config.unknownCredit : credit, {
    kind: "extras",
    matched,
    missing,
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* ------------------------------------------------------------- queries */

export interface RankedMatch {
  candidate: MatchCandidate;
  score: number;
  band: ConfidenceBand;
  reasons: MatchReason[];
  freshness: Freshness;
}

export type MatchSort = "relevance" | "freshness" | "price";

/** Requirement → candidates (§12.1). Hidden-band results are dropped unless asked for. */
export function findMatches(
  requirement: Requirement,
  candidates: MatchCandidate[],
  now: Date,
  options: { config?: MatchingConfig; includeHidden?: boolean; sort?: MatchSort } = {},
): RankedMatch[] {
  const config = options.config ?? defaultMatchingConfig;
  const ranked: RankedMatch[] = [];
  for (const candidate of candidates) {
    const result = evaluateMatch(requirement, candidate, now, config);
    if (!result.eligible) continue;
    if (result.band === "hidden" && !options.includeHidden) continue;
    ranked.push({ candidate, ...result });
  }
  return sortMatches(ranked, options.sort ?? "relevance", requirement, config);
}

/** Candidate → requirements: "Подходит 14 вашим клиентам" (§12.5). */
export function reverseMatch(
  candidate: MatchCandidate,
  requirements: Requirement[],
  now: Date,
  config: MatchingConfig = defaultMatchingConfig,
): { requirement: Requirement; score: number; band: ConfidenceBand; reasons: MatchReason[] }[] {
  return requirements
    .filter((requirement) => requirement.status === "active")
    .map((requirement) => ({ requirement, result: evaluateMatch(requirement, candidate, now, config) }))
    .flatMap(({ requirement, result }) =>
      result.eligible && result.band !== "hidden"
        ? [{ requirement, score: result.score, band: result.band, reasons: result.reasons }]
        : [],
    )
    .sort((a, b) => b.score - a.score || a.requirement.id.localeCompare(b.requirement.id));
}

export function sortMatches(
  matches: RankedMatch[],
  sort: MatchSort,
  requirement: Requirement,
  config: MatchingConfig = defaultMatchingConfig,
): RankedMatch[] {
  const priceOf = (match: RankedMatch) =>
    match.candidate.price
      ? convertMoney(match.candidate.price, requirement.budget.currency, config.fx).amountMinor
      : Number.POSITIVE_INFINITY;
  const tieBreak = (a: RankedMatch, b: RankedMatch) =>
    a.candidate.target.id.localeCompare(b.candidate.target.id);
  const copy = [...matches];
  switch (sort) {
    case "freshness":
      return copy.sort(
        (a, b) => b.freshness.score - a.freshness.score || b.score - a.score || tieBreak(a, b),
      );
    case "price":
      return copy.sort((a, b) => priceOf(a) - priceOf(b) || b.score - a.score || tieBreak(a, b));
    case "relevance":
      return copy.sort(
        (a, b) => b.score - a.score || b.freshness.score - a.freshness.score || tieBreak(a, b),
      );
  }
}

/** Criteria that fully matched, for the one-line "Подходит по …" summary. */
export function matchedCriteria(reasons: MatchReason[]): MatchCriterion[] {
  return reasons
    .filter((reason) => reason.requested && reason.outcome === "match")
    .map((reason) => reason.criterion);
}
