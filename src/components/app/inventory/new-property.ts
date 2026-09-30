import type { ListingAccess } from "@/lib/data/views";
import {
  DEDUP_MIN_PARSE_CONFIDENCE,
  dedupRecordFromTelegram,
  findDuplicateCandidates,
  type DedupRecord,
  type DuplicateCandidate,
} from "@/lib/domain/dedup";
import { toMajor, toMinor } from "@/lib/domain/money";
import type {
  Currency,
  DealType,
  DistrictId,
  ID,
  Money,
  PropertyType,
  TelegramListing,
} from "@/lib/domain/types";
import { parseAmount } from "./amount";

/**
 * "New property" flow (§20.3, §22.5, §34.5) as plain data, shared by the
 * server page and the client form:
 *
 * - Step one asks only for type, deal, location, price with an explicit
 *   currency and the basic attributes. Owner, contract, documents and
 *   verification are offered after creation (progressive disclosure).
 * - A Telegram post can prefill the form, but only with fields the parser
 *   read confidently; everything else stays empty for the agent (Unknown is
 *   a value). Prefilled fields remember their evidence.
 * - Before saving, the draft is compared with visible listings and Telegram
 *   posts using the dedup engine. The result is a list of suggestions with
 *   signals; merging is always the agent's choice, never automatic.
 */

export interface NewPropertyValues {
  propertyType?: PropertyType;
  dealType?: DealType;
  district?: DistrictId;
  /** Massif / mahalla / residential complex. */
  areaName: string;
  /** Full address: RESTRICTED (§16.3). */
  address: string;
  /** Major units as typed, e.g. "68 000". */
  price: string;
  /** Never defaulted: the agent picks it (§35.5). */
  currency?: Currency;
  rooms: string;
  areaTotal: string;
  floor: string;
  floorsTotal: string;
}

export type PrefillField = "propertyType" | "dealType" | "district" | "price" | "rooms" | "areaTotal" | "floor" | "floorsTotal";

export const prefillFields: readonly PrefillField[] = [
  "dealType",
  "propertyType",
  "district",
  "price",
  "rooms",
  "areaTotal",
  "floor",
  "floorsTotal",
];

export interface PrefillMark {
  confidence: number;
  evidence?: string;
}

export interface TelegramPrefill {
  postId: ID;
  sourceUrl: string;
  values: NewPropertyValues;
  /** Fields filled from the post, with the text they were read from. */
  marks: Partial<Record<PrefillField, PrefillMark>>;
  /** Fields the post mentions without enough confidence: left empty on purpose. */
  uncertain: PrefillField[];
  /** Dedup context from the post (its phone and text), never shown as form values. */
  dedup: Pick<DedupRecord, "phone" | "text">;
}

export function emptyValues(): NewPropertyValues {
  return { areaName: "", address: "", price: "", rooms: "", areaTotal: "", floor: "", floorsTotal: "" };
}

/** "68000" from 6 800 000 minor units; "68000.5" keeps a fraction. */
export function majorAmountText(value: Money): string {
  return String(toMajor(value));
}

/** Only confident parsed fields prefill the form; the bar is the dedup/matching one (0.6). */
export function prefillFromTelegram(
  post: TelegramListing,
  minConfidence = DEDUP_MIN_PARSE_CONFIDENCE,
): TelegramPrefill {
  const values = emptyValues();
  const marks: TelegramPrefill["marks"] = {};
  const uncertain: PrefillField[] = [];
  const { parsed } = post;

  const take = <T>(key: PrefillField, field: { value?: T; confidence: number; evidence?: string }, apply: (value: T) => void) => {
    if (field.value === undefined) return;
    if (field.confidence < minConfidence) {
      uncertain.push(key);
      return;
    }
    apply(field.value);
    marks[key] = field.evidence === undefined ? { confidence: field.confidence } : { confidence: field.confidence, evidence: field.evidence };
  };

  take("dealType", parsed.dealType, (value) => (values.dealType = value));
  take("propertyType", parsed.propertyType, (value) => (values.propertyType = value));
  take("district", parsed.district, (value) => (values.district = value));
  take("price", parsed.price, (value) => {
    values.price = majorAmountText(value);
    values.currency = value.currency;
  });
  take("rooms", parsed.rooms, (value) => (values.rooms = String(value)));
  take("areaTotal", parsed.areaTotal, (value) => (values.areaTotal = String(value)));
  take("floor", parsed.floor, (value) => (values.floor = String(value)));
  take("floorsTotal", parsed.floorsTotal, (value) => (values.floorsTotal = String(value)));

  const context = dedupRecordFromTelegram(post, { minConfidence });
  const dedup: TelegramPrefill["dedup"] = { text: post.rawText };
  if (context.phone) dedup.phone = context.phone;
  return { postId: post.id, sourceUrl: post.sourceUrl, values, marks, uncertain, dedup };
}

/* ---------------------------------------------------------- validation */

/** Which attributes the form asks for, by property type. */
export function fieldsFor(type: PropertyType | undefined): { rooms: boolean; floor: boolean; floorsTotal: boolean } {
  switch (type) {
    case "land":
      return { rooms: false, floor: false, floorsTotal: false };
    case "house":
      return { rooms: true, floor: false, floorsTotal: true };
    case "commercial":
    case "room":
      return { rooms: false, floor: true, floorsTotal: true };
    default:
      return { rooms: true, floor: true, floorsTotal: true };
  }
}

export type FieldError = "required" | "amount" | "integer" | "decimal" | "floor_above_total";
export type FormField = "propertyType" | "dealType" | "district" | "price" | "currency" | "rooms" | "areaTotal" | "floor" | "floorsTotal";

export interface NewPropertyDraft {
  propertyType: PropertyType;
  dealType: DealType;
  district: DistrictId;
  areaName?: string;
  address?: string;
  price: Money;
  rooms?: number;
  areaTotal?: number;
  floor?: number;
  floorsTotal?: number;
}

export type ValidationResult =
  | { ok: true; draft: NewPropertyDraft }
  | { ok: false; errors: Partial<Record<FormField, FieldError>> };

function integerIn(text: string, min: number, max: number): number | null | undefined {
  const value = text.trim();
  if (!value) return undefined;
  if (!/^-?\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

function decimalIn(text: string, max: number): number | null | undefined {
  const value = text.trim();
  if (!value) return undefined;
  const amount = parseAmount(value);
  return amount !== undefined && amount <= max ? amount : null;
}

/** Validates step one. Hidden attributes (rooms of a plot…) are dropped, not validated. */
export function validateNewProperty(values: NewPropertyValues): ValidationResult {
  const errors: Partial<Record<FormField, FieldError>> = {};
  const shown = fieldsFor(values.propertyType);

  if (!values.propertyType) errors.propertyType = "required";
  if (!values.dealType) errors.dealType = "required";
  if (!values.district) errors.district = "required";

  let price: Money | undefined;
  const amount = values.price.trim() ? parseAmount(values.price) : undefined;
  if (!values.price.trim()) errors.price = "required";
  else if (amount === undefined) errors.price = "amount";
  if (!values.currency) errors.currency = "required";
  if (amount !== undefined && values.currency) {
    price = { amountMinor: toMinor(String(amount)), currency: values.currency };
  }

  const rooms = shown.rooms ? integerIn(values.rooms, 1, 50) : undefined;
  if (rooms === null) errors.rooms = "integer";
  const areaTotal = decimalIn(values.areaTotal, 1_000_000);
  if (areaTotal === null) errors.areaTotal = "decimal";
  const floor = shown.floor ? integerIn(values.floor, -3, 150) : undefined;
  if (floor === null) errors.floor = "integer";
  const floorsTotal = shown.floorsTotal ? integerIn(values.floorsTotal, 1, 150) : undefined;
  if (floorsTotal === null) errors.floorsTotal = "integer";
  if (typeof floor === "number" && typeof floorsTotal === "number" && floor > floorsTotal) {
    errors.floor = "floor_above_total";
  }

  if (Object.keys(errors).length > 0 || !price || !values.propertyType || !values.dealType || !values.district) {
    return { ok: false, errors };
  }
  const draft: NewPropertyDraft = {
    propertyType: values.propertyType,
    dealType: values.dealType,
    district: values.district,
    price,
  };
  if (values.areaName.trim()) draft.areaName = values.areaName.trim();
  if (values.address.trim()) draft.address = values.address.trim();
  if (typeof rooms === "number") draft.rooms = rooms;
  if (typeof areaTotal === "number") draft.areaTotal = areaTotal;
  if (typeof floor === "number") draft.floor = floor;
  if (typeof floorsTotal === "number") draft.floorsTotal = floorsTotal;
  return { ok: true, draft };
}

/* ---------------------------------------------------- duplicate check */

export const DRAFT_RECORD_ID = "draft";

/**
 * Everything the Duplicate Check panel shows about one existing record. The
 * server prepares the labels (access rules already applied: no address of a
 * masked listing), the client only compares and renders.
 */
export interface DuplicatePoolEntry {
  record: DedupRecord;
  kind: "listing" | "telegram";
  id: ID;
  /** The physical object behind a listing (Property ≠ Listing). */
  propertyId?: ID;
  title: string;
  place: string;
  price?: Money;
  /** Listing agent and agency, or the Telegram channel. */
  by: string;
  access?: ListingAccess;
  /** Workspace path after `/{locale}/app`. */
  path: string;
}

export interface DuplicateMatch {
  entry: DuplicatePoolEntry;
  candidate: DuplicateCandidate;
}

export function draftDedupRecord(draft: NewPropertyDraft, context: Pick<DedupRecord, "phone" | "text"> = {}): DedupRecord {
  const record: DedupRecord = {
    id: DRAFT_RECORD_ID,
    district: draft.district,
    price: draft.price,
    dealType: draft.dealType,
  };
  if (draft.rooms !== undefined) record.rooms = draft.rooms;
  if (draft.areaTotal !== undefined) record.areaTotal = draft.areaTotal;
  if (draft.floor !== undefined) record.floor = draft.floor;
  if (context.phone) record.phone = context.phone;
  if (context.text) record.text = context.text;
  return record;
}

/**
 * Candidates for the draft, best first. `excludeIds` removes the Telegram
 * post the draft was created from (it is the source, not a duplicate).
 */
export function checkDuplicates(
  target: DedupRecord,
  pool: readonly DuplicatePoolEntry[],
  excludeIds: readonly ID[] = [],
): DuplicateMatch[] {
  const excluded = new Set(excludeIds);
  const entries = pool.filter((entry) => !excluded.has(entry.id));
  const byId = new Map(entries.map((entry) => [entry.record.id, entry]));
  return findDuplicateCandidates(
    target,
    entries.map((entry) => entry.record),
  ).flatMap((candidate) => {
    const entry = byId.get(candidate.id);
    return entry ? [{ entry, candidate }] : [];
  });
}
