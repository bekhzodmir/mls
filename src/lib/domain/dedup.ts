import { normalizeUzPhone } from "./phone";
import { foldText } from "./text";
import type {
  DealType,
  DedupConflict,
  DistrictId,
  DuplicateSignal,
  ID,
  Listing,
  Money,
  ParsedField,
  Property,
  TelegramListing,
} from "./types";

/**
 * Duplicate candidate detection (§13.5, §34.5).
 *
 * A pair is compared on several independent signals — contact, district,
 * rooms, area, floor, price, text and media — and the result is always a
 * *suggestion* for the Duplicate Resolution Center, never an automatic merge:
 *
 * - "Совпадение телефонов или фото само по себе недостаточно": identity
 *   signals (phone, media, text) alone can at most ask for review.
 * - `likely_duplicate` needs at least four signals including a physical pair
 *   (district + rooms, or area + floor), no contradicting attribute, and a
 *   score above the threshold. Similar flats in identical Soviet-series
 *   buildings share district, rooms, area and floor, so physical attributes
 *   alone stay at "review" too.
 * - Contradictions (different floor, rooms, district, area, deal type) are
 *   reported so the UI can show which values disagree (§34.5).
 *
 * Weights and thresholds are configuration to be tuned against measured
 * precision; the function is pure and deterministic.
 */

export interface DedupRecord {
  id: string;
  /** Any spelling; compared after +998 normalization. */
  phone?: string;
  district?: DistrictId;
  rooms?: number;
  /** Square metres. */
  areaTotal?: number;
  floor?: number;
  price?: Money;
  /** Raw post text or listing description. */
  text?: string;
  /** Exact or perceptual image hashes. */
  mediaHashes?: string[];
  /** Sale and rent offers on the same flat are different offers, not duplicates. */
  dealType?: DealType;
}

/** Attributes known on both sides that disagree (defined with the domain model). */
export type { DedupConflict };

export type DuplicateRecommendation = "review" | "likely_duplicate";

export interface DuplicateCandidate {
  id: string;
  /** 0..100 integer, reproducible from the inputs. Never shown without the signals. */
  score: number;
  signals: DuplicateSignal[];
  conflicts: DedupConflict[];
  /** A recommendation only: merging is always a human decision (§13.5). */
  recommendation: DuplicateRecommendation;
}

export interface DedupConfig {
  /** Points per signal; sum to 100. */
  weights: Record<DuplicateSignal, number>;
  /** Points subtracted per conflicting attribute. */
  conflictPenalty: number;
  /** Candidates below this score are not shown at all. */
  minScore: number;
  /** Score needed (with the structural rules) for `likely_duplicate`. */
  likelyScore: number;
  minSignalsForLikely: number;
  /** Relative difference still counted as "similar" (0.05 = ±5%). */
  areaTolerance: number;
  priceTolerance: number;
  /** Area difference above this share is a conflict, not just "not similar". */
  areaConflictTolerance: number;
  /** `textSimilarity` at or above this value counts as `similar_text`. */
  textThreshold: number;
}

export const defaultDedupConfig: DedupConfig = {
  weights: {
    same_phone: 15,
    same_media: 20,
    similar_text: 15,
    same_district: 10,
    same_rooms: 10,
    similar_area: 15,
    same_floor: 10,
    // Prices change between reposts and cluster in bands, so they weigh least.
    similar_price: 5,
  },
  conflictPenalty: 15,
  minScore: 30,
  likelyScore: 55,
  minSignalsForLikely: 4,
  areaTolerance: 0.05,
  priceTolerance: 0.05,
  areaConflictTolerance: 0.1,
  textThreshold: 0.6,
};

/** Canonical order, matching the DuplicateSignal union. */
const SIGNAL_ORDER: DuplicateSignal[] = [
  "same_phone",
  "same_district",
  "same_rooms",
  "similar_area",
  "similar_price",
  "same_floor",
  "similar_text",
  "same_media",
];

/* ---------------------------------------------------------- similarity */

function trigrams(text: string): Set<string> {
  const normalized = foldText(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const grams = new Set<string>();
  if (!normalized) return grams;
  const padded = ` ${normalized} `;
  for (let i = 0; i + 3 <= padded.length; i += 1) grams.add(padded.slice(i, i + 3));
  return grams;
}

/**
 * Jaccard similarity of character trigrams, 0..1 rounded to two decimals.
 * Case, ё/е, apostrophe and dash variants, punctuation and emoji are
 * ignored, so a repost with a reformatted phone or extra emoji stays close
 * to 1 while a different flat in the same template scores clearly lower.
 */
export function textSimilarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return Math.round((shared / (left.size + right.size - shared)) * 100) / 100;
}

function relativeDifference(a: number, b: number): number {
  const larger = Math.max(Math.abs(a), Math.abs(b));
  return larger === 0 ? 0 : Math.abs(a - b) / larger;
}

function samePhone(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const left = normalizeUzPhone(a);
  const right = normalizeUzPhone(b);
  return left !== null && left === right;
}

/* ----------------------------------------------------------- comparison */

/** Compares two records; `id` in the result is the candidate's. */
export function compareForDuplicates(
  target: DedupRecord,
  candidate: DedupRecord,
  config: DedupConfig = defaultDedupConfig,
): DuplicateCandidate {
  const signals = new Set<DuplicateSignal>();
  const conflicts: DedupConflict[] = [];

  if (samePhone(target.phone, candidate.phone)) signals.add("same_phone");

  if (target.dealType && candidate.dealType && target.dealType !== candidate.dealType) {
    conflicts.push("deal_type");
  }

  if (target.district && candidate.district) {
    if (target.district === candidate.district) signals.add("same_district");
    else conflicts.push("district");
  }

  if (target.rooms !== undefined && candidate.rooms !== undefined) {
    if (target.rooms === candidate.rooms) signals.add("same_rooms");
    else conflicts.push("rooms");
  }

  if (target.areaTotal !== undefined && candidate.areaTotal !== undefined) {
    const diff = relativeDifference(target.areaTotal, candidate.areaTotal);
    if (diff <= config.areaTolerance) signals.add("similar_area");
    else if (diff > config.areaConflictTolerance) conflicts.push("area");
  }

  // Prices change between reposts, so a different price is not a conflict.
  // Different currencies are not compared: that would need a rate (§35.5).
  if (target.price && candidate.price && target.price.currency === candidate.price.currency) {
    if (relativeDifference(target.price.amountMinor, candidate.price.amountMinor) <= config.priceTolerance) {
      signals.add("similar_price");
    }
  }

  if (target.floor !== undefined && candidate.floor !== undefined) {
    if (target.floor === candidate.floor) signals.add("same_floor");
    else conflicts.push("floor");
  }

  if (target.text && candidate.text && textSimilarity(target.text, candidate.text) >= config.textThreshold) {
    signals.add("similar_text");
  }

  const targetMedia = new Set((target.mediaHashes ?? []).filter(Boolean));
  if ((candidate.mediaHashes ?? []).some((hash) => hash && targetMedia.has(hash))) signals.add("same_media");

  const ordered = SIGNAL_ORDER.filter((signal) => signals.has(signal));
  const raw = ordered.reduce((sum, signal) => sum + config.weights[signal], 0);
  const score = Math.max(0, Math.min(100, Math.round(raw - conflicts.length * config.conflictPenalty)));

  const physicalPair =
    (signals.has("same_district") && signals.has("same_rooms")) ||
    (signals.has("similar_area") && signals.has("same_floor"));
  const likely =
    ordered.length >= config.minSignalsForLikely &&
    physicalPair &&
    conflicts.length === 0 &&
    score >= config.likelyScore;

  return {
    id: candidate.id,
    score,
    signals: ordered,
    conflicts,
    recommendation: likely ? "likely_duplicate" : "review",
  };
}

/**
 * Candidates for the Duplicate Resolution Center, strongest first. The
 * target itself and candidates below `minScore` are left out. Ties are
 * broken by id so the order is stable.
 */
export function findDuplicateCandidates(
  target: DedupRecord,
  pool: readonly DedupRecord[],
  options: Partial<DedupConfig> = {},
): DuplicateCandidate[] {
  const config: DedupConfig = {
    ...defaultDedupConfig,
    ...options,
    weights: { ...defaultDedupConfig.weights, ...options.weights },
  };
  return pool
    .filter((record) => record.id !== target.id)
    .map((record) => compareForDuplicates(target, record, config))
    .filter((candidate) => candidate.signals.length > 0 && candidate.score >= config.minScore)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/* -------------------------------------------------------------- adapters */

/** Parsed Telegram fields below this confidence are treated as unknown. */
export const DEDUP_MIN_PARSE_CONFIDENCE = 0.6;

function confident<T>(field: ParsedField<T>, minConfidence: number): T | undefined {
  return field.confidence >= minConfidence ? field.value : undefined;
}

/** Omits undefined keys so records stay minimal and comparable. */
function compact(record: DedupRecord): DedupRecord {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as DedupRecord;
}

/** A TelegramListing as a dedup record: only confidently parsed fields count. */
export function dedupRecordFromTelegram(
  post: TelegramListing,
  options: { mediaHashes?: string[]; minConfidence?: number } = {},
): DedupRecord {
  const min = options.minConfidence ?? DEDUP_MIN_PARSE_CONFIDENCE;
  return compact({
    id: post.id,
    phone: confident(post.parsed.phone, min),
    district: confident(post.parsed.district, min),
    rooms: confident(post.parsed.rooms, min),
    areaTotal: confident(post.parsed.areaTotal, min),
    floor: confident(post.parsed.floor, min),
    price: confident(post.parsed.price, min),
    dealType: confident(post.parsed.dealType, min),
    text: post.rawText,
    mediaHashes: options.mediaHashes,
  });
}

/** A Listing with its Property; pass the contact phone only if the viewer may see it. */
export function dedupRecordFromListing(
  listing: Listing,
  property: Property,
  options: { id?: ID; phone?: string; mediaHashes?: string[] } = {},
): DedupRecord {
  return compact({
    id: options.id ?? listing.id,
    phone: options.phone,
    district: property.district,
    rooms: property.rooms,
    areaTotal: property.areaTotal,
    floor: property.floor,
    price: listing.price,
    dealType: listing.dealType,
    text: listing.description,
    mediaHashes: options.mediaHashes,
  });
}
