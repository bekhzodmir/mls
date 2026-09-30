import { money, toMinor } from "./money";
import {
  decimalString,
  decimalValue,
  evidenceOf,
  foldText,
  knownField,
  maskSpans,
  pattern,
  scanAll,
  scanAreas,
  scanDealTypeCues,
  scanDistricts,
  scanLandmarks,
  scanMoney,
  scanPhones,
  scanPropertyTypeCues,
  scanRooms,
  spanOf,
  unique,
  unknownField,
  anyOf,
  wordOf,
  type MoneyHit,
  type RoomsHit,
  type Span,
} from "./text";
import {
  propertyTypes as propertyTypeOrder,
  type BuildingKind,
  type Currency,
  type DealType,
  type DistrictId,
  type Money,
  type ParsedField,
  type PropertyType,
  type Range,
  type RenovationState,
  type Requirement,
} from "./types";

/**
 * Natural-language requirement → structured draft (§14.4, §35.4 step 1).
 *
 * «2–3 комнаты, Мирзо-Улугбек, ремонт, до 100 тысяч» or «Yunusobodda 3 xonali
 * kvartira 90 ming dollargacha» becomes a draft whose every field carries a
 * confidence and the raw span it came from. The agent confirms the draft; the
 * parser never decides for them:
 *
 * - Unknown stays unknown: a field the text does not mention has no value
 *   and confidence 0.
 * - The currency is never guessed (§35.5): "до 70 000" keeps the amount, leaves
 *   the currency empty, raises `currency_unknown` and at most offers a
 *   low-confidence suggestion.
 * - Metro stations and landmarks are kept verbatim as extras and are not
 *   mapped to districts.
 * - Contradictions are reported as warnings instead of being resolved silently.
 *
 * Pure and deterministic; no network, no model calls.
 */

export const REQUIREMENT_PARSER_VERSION = "requirement-parser@1";

/** Fields below this confidence are shown as suggestions and not applied (§35.4 step 2). */
export const MIN_APPLY_CONFIDENCE = 0.6;

export type RequirementWarning =
  | "empty_text"
  | "nothing_recognized"
  /** An amount without "$ / у.е. / сум / so‘m…" — the agent must pick the currency. */
  | "currency_unknown"
  /** Amounts in two currencies; only the first currency's bounds are used. */
  | "currency_conflict"
  /** Two different values for the same budget bound, or min above max. */
  | "budget_conflict"
  | "area_conflict"
  | "deal_type_conflict"
  | "mortgage_conflict";

export interface BudgetDraft {
  /** Set only when the text names the currency. */
  min?: Money;
  max?: Money;
  currency?: Currency;
  /** Bounds as written, in minor units, kept even when the currency is unknown. */
  amountsMinor: Range<number>;
  /**
   * A hint for the confirmation UI when the currency is unknown (≥ 1 000 000
   * reads as сум, smaller amounts as $). Never applied automatically.
   */
  suggestedCurrency?: ParsedField<Currency>;
}

export type FloorPreference = NonNullable<Requirement["floor"]>;

export interface RequirementDraft {
  /** The agent's sentence, verbatim (§14.4, §34.3). */
  text: string;
  dealType: ParsedField<DealType>;
  propertyTypes: ParsedField<PropertyType[]>;
  districts: ParsedField<DistrictId[]>;
  rooms: ParsedField<Range<number>>;
  /** Square metres. */
  area: ParsedField<Range<number>>;
  budget: ParsedField<BudgetDraft>;
  buildingKind: ParsedField<BuildingKind>;
  renovation: ParsedField<RenovationState[]>;
  floor: ParsedField<FloorPreference>;
  mortgage: ParsedField<boolean>;
  /** Landmarks and must-haves kept verbatim: "метро Космонавтов", "парковка". */
  extras: ParsedField<string[]>;
  warnings: RequirementWarning[];
  parserVersion: string;
}

/* ------------------------------------------------------- vocabularies */

/** Word stems as `stem\p{L}*` alternatives. */
const stems = (...words: string[]) => words.map((word) => String.raw`${word}\p{L}*`);

const UZ_NOT = String.raw`\s+(?:emas|bo'lmasin|bo'lmas\p{L}*)`;
const FLOOR_WORD = String.raw`(?:\s+этаж\p{L}*)?`;
const FIRST = String.raw`(?:перв\p{L}*|1(?:-?\p{L}{1,2})?)`;

const FLOOR_BOTH_RE = pattern(
  wordOf(
    String.raw`не\s+(?:на\s+)?перв\p{L}*\s+и\s+(?:не\s+(?:на\s+)?)?последн\p{L}*${FLOOR_WORD}`,
    String.raw`кроме\s+перв\p{L}*\s+и\s+последн\p{L}*${FLOOR_WORD}`,
    String.raw`birinchi\s+(?:va|ham)\s+oxirgi\s+qavat\p{L}*${UZ_NOT}`,
  ),
);
const FLOOR_NOT_FIRST_RE = pattern(
  wordOf(
    String.raw`не\s+(?:на\s+)?${FIRST}${FLOOR_WORD}`,
    String.raw`кроме\s+${FIRST}${FLOOR_WORD}`,
    String.raw`(?:birinchi|1-?)\s*qavat\p{L}*${UZ_NOT}`,
  ),
);
const FLOOR_NOT_LAST_RE = pattern(
  wordOf(
    String.raw`не\s+(?:на\s+)?последн\p{L}*${FLOOR_WORD}`,
    String.raw`кроме\s+последн\p{L}*${FLOOR_WORD}`,
    String.raw`oxirgi\s+qavat\p{L}*${UZ_NOT}`,
  ),
);
const FLOOR_MIDDLE_RE = pattern(wordOf(String.raw`средн\p{L}*\s+этаж\p{L}*`));
const FLOOR_UNIT = String.raw`(?:этаж\p{L}*|qavat\p{L}*)`;
const ORDINAL = String.raw`(?:-?\p{L}{1,2})?`;
/** "от 3 до 7 этажа", "с 3 по 7 этаж", "3-7 этаж", "этаж 3-7". */
const FLOOR_RANGE_RE = pattern(
  wordOf(
    String.raw`(?:этаж\p{L}*\s+)?(?:с|от)\s+(\d{1,2})\s+(?:по|до)\s+(\d{1,2})${ORDINAL}\s*${FLOOR_UNIT}?`,
    String.raw`(\d{1,2})\s*-\s*(\d{1,2})${ORDINAL}\s*${FLOOR_UNIT}`,
    String.raw`${FLOOR_UNIT}\s*:?\s*(\d{1,2})\s*-\s*(\d{1,2})`,
  ),
);
const FLOOR_MAX_RE = pattern(wordOf(String.raw`не\s+выше\s+(\d{1,2})${ORDINAL}\s*этаж\p{L}*`));
const FLOOR_MIN_RE = pattern(wordOf(String.raw`не\s+ниже\s+(\d{1,2})${ORDINAL}\s*этаж\p{L}*`));
/** "3 этаж", "3-й этаж" — not "9-этажный" or "9 этажей" (the building height). */
const FLOOR_EXACT_RE = pattern(
  wordOf(String.raw`(\d{1,2})\s*-?\s*(?:й|ой|ом|м|ый)?\s*(?:этаж(?!н|ей|ност)\p{L}*|qavat(?!li)\p{L}*)`),
);

const BUILDING_CUES: { re: RegExp; value: BuildingKind }[] = [
  {
    re: pattern(
      wordOf(
        ...stems("новостро", "первичк", "первичн"),
        String.raw`нов(?:ый|ом|ого)\s+дом\p{L}*`,
        String.raw`yangi\s+(?:bino|uy|qurilgan)\p{L}*`,
        String.raw`янги\s+бино\p{L}*`,
      ),
    ),
    value: "new_building",
  },
  {
    re: pattern(wordOf(...stems("вторичк", "вторичн", "ikkilamchi", "иккиламчи"))),
    value: "secondary",
  },
];

/**
 * Renovation phrases, most specific first. "ремонт" / "с ремонтом" / "евроремонт"
 * accept any finished renovation, so they map to renovated + designer.
 */
const RENOVATION_CUES: { re: RegExp; states: RenovationState[]; confidence: number }[] = [
  {
    re: pattern(
      wordOf(
        ...stems("коробк", "karobka", "korobka", "предчистов"),
        String.raw`черн\p{L}*\s+отделк\p{L}*`,
        String.raw`без\s+отделки`,
        String.raw`qora\s+suvoq\p{L}*`,
      ),
    ),
    states: ["shell"],
    confidence: 0.85,
  },
  {
    re: pattern(
      wordOf(
        String.raw`без\s+ремонта`,
        String.raw`требует\s+ремонта`,
        String.raw`требуется\s+ремонт`,
        String.raw`нужен\s+ремонт`,
        String.raw`под\s+ремонт`,
        "ta'?mirsiz",
        String.raw`ta'?mir\s+talab\p{L}*`,
        "remontsiz",
        "таъмирсиз",
      ),
    ),
    states: ["needs_repair"],
    confidence: 0.85,
  },
  {
    re: pattern(
      wordOf(
        String.raw`(?:дизайнерск\p{L}*|авторск\p{L}*)(?:\s+ремонт\p{L}*)?`,
        String.raw`dizayner\p{L}*(?:\s+(?:ta'?mir\p{L}*|remont\p{L}*))?`,
      ),
    ),
    states: ["designer"],
    confidence: 0.85,
  },
  {
    re: pattern(
      wordOf(
        ...stems("евроремонт", "evroremont", "yevroremont", "ta'?mirl"),
        String.raw`(?:с|со|хорош\p{L}*|свеж\p{L}*|нов\p{L}*|капитальн\p{L}*|косметическ\p{L}*)\s+ремонт\p{L}*`,
        "remontli",
        "таъмирли",
      ),
    ),
    states: ["renovated", "designer"],
    confidence: 0.85,
  },
  {
    re: pattern(wordOf(String.raw`ремонт\p{L}*`, "remont", "ta'?mir")),
    states: ["renovated", "designer"],
    confidence: 0.7,
  },
];

const MORTGAGE_YES_RE = pattern(wordOf(...stems("ипотек", "ипотечн", "ipoteka")));
const MORTGAGE_NO_RE = pattern(
  wordOf(String.raw`без\s+ипотеки`, String.raw`за\s+наличные`, ...stems("наличн", "naqd", "нақд")),
);

/**
 * Must-haves kept verbatim with their preposition: "с парковкой",
 * "рядом со школой", "mebel bilan".
 */
const AMENITY_RE = pattern(
  wordOf(
    String.raw`(?:(?:рядом\s+(?:с|со)|возле|около|недалеко\s+от|с|со|есть)\s+)?` +
      anyOf(
        ...stems("парковк", "паркинг", "parkovka", "avtoturargoh", "гараж", "garaj"),
        ...stems("лифт", "lift", "балкон", "лоджи", "balkon"),
        ...stems("мебел", "mebel", "jihozl", "texnika", "кондиционер", "konditsioner"),
        String.raw`(?:бытов\p{L}*\s+)?техник\p{L}*`,
        ...stems("школ", "maktab", "садик", "bog'cha"),
        String.raw`детск\p{L}*\s+сад\p{L}*`,
        ...stems("охран", "консьерж", "видеонаблюдени"),
        String.raw`закрыт\p{L}*\s+двор\p{L}*`,
        String.raw`yopiq\s+hovli\p{L}*`,
      ) +
      String.raw`(?:\s+(?:bilan|yaqinida|yonida))?`,
  ),
);

/* ------------------------------------------------------------- helpers */

interface Reading<T> {
  value: T;
  span: Span;
}

/**
 * Merges bound readings. Exact values only ("двушка или трешка") → their
 * union; otherwise one reading per bound ("от 50 м² … до 80 м²"). Two
 * different values for the same bound, or min > max, is a conflict.
 */
function mergeRanges(readings: Range<number>[]): { range: Range<number>; conflict: boolean } {
  const exact = readings.every((r) => r.min !== undefined && r.min === r.max);
  const mins = unique(readings.flatMap((r) => (r.min === undefined ? [] : [r.min])));
  const maxs = unique(readings.flatMap((r) => (r.max === undefined ? [] : [r.max])));
  if (exact) return { range: { min: Math.min(...mins), max: Math.max(...maxs) }, conflict: false };
  const conflict = mins.length > 1 || maxs.length > 1 || (mins.length === 1 && maxs.length === 1 && mins[0] > maxs[0]);
  if (conflict) return { range: unionRange(readings), conflict: true };
  const range: Range<number> = {};
  if (mins.length === 1) range.min = mins[0];
  if (maxs.length === 1) range.max = maxs[0];
  return { range, conflict: false };
}

/** Widest range covering every reading; an open bound in any reading stays open. */
function unionRange(readings: Range<number>[]): Range<number> {
  const range: Range<number> = {};
  if (readings.every((r) => r.min !== undefined)) range.min = Math.min(...readings.map((r) => r.min as number));
  if (readings.every((r) => r.max !== undefined)) range.max = Math.max(...readings.map((r) => r.max as number));
  return range;
}

function cleanRange(range: Range<number>): Range<number> {
  const out: Range<number> = {};
  if (range.min !== undefined) out.min = range.min;
  if (range.max !== undefined) out.max = range.max;
  return out;
}

function hasValue(field: ParsedField<unknown>): boolean {
  return field.value !== undefined;
}

/* -------------------------------------------------------------- parser */

function emptyDraft(text: string): RequirementDraft {
  return {
    text,
    dealType: unknownField(),
    propertyTypes: unknownField(),
    districts: unknownField(),
    rooms: unknownField(),
    area: unknownField(),
    budget: unknownField(),
    buildingKind: unknownField(),
    renovation: unknownField(),
    floor: unknownField(),
    mortgage: unknownField(),
    extras: unknownField(),
    warnings: [],
    parserVersion: REQUIREMENT_PARSER_VERSION,
  };
}

/** Free text → draft with per-field confidence and evidence. The input is kept verbatim. */
export function parseRequirementText(text: string): RequirementDraft {
  const draft = emptyDraft(text);
  const folded = foldText(text);
  if (!folded.trim()) {
    draft.warnings.push("empty_text");
    return draft;
  }

  let work = folded;
  const consume = (spans: readonly Span[]) => {
    work = maskSpans(work, spans);
  };
  const warn = (warning: RequirementWarning) => {
    if (!draft.warnings.includes(warning)) draft.warnings.push(warning);
  };

  // Order matters: each scanner masks what it consumed, so a client phone,
  // a station name, "не первый этаж", "70 м²" or "3 комнаты" is never re-read
  // as a budget or a district.
  consume(scanPhones(work));
  const landmarks = scanLandmarks(text, work);
  consume(landmarks);

  const floor = parseFloorPreference(text, work);
  draft.floor = floor.field;
  consume(floor.spans);

  const areaHits = scanAreas(work);
  consume(areaHits);
  const roomHits = scanRooms(work);
  consume(roomHits);
  const moneyHits = scanMoney(work);
  consume(moneyHits);

  // Area.
  if (areaHits.length > 0) {
    const { range, conflict } = mergeRanges(areaHits.map(cleanRange));
    const evidence = evidenceOf(text, areaHits);
    if (conflict) {
      warn("area_conflict");
      draft.area = unknownField(evidence);
    } else {
      draft.area = knownField(range, areaHits.length === 1 ? 0.9 : 0.75, evidence);
    }
  }

  // Rooms: several mentions are alternatives ("двушка или трешка") → union.
  if (roomHits.length > 0) {
    const merged = mergeRanges(roomHits.map(cleanRange));
    const range = merged.conflict ? unionRange(roomHits) : merged.range;
    const confidence = roomHits.length === 1 ? 0.9 : merged.conflict ? 0.6 : 0.75;
    draft.rooms = knownField(range, confidence, evidenceOf(text, roomHits));
  }

  draft.budget = parseBudget(text, moneyHits, warn);

  // Districts.
  const districtHits = scanDistricts(work);
  if (districtHits.length > 0) {
    draft.districts = knownField(unique(districtHits.map((hit) => hit.id)), 0.9, evidenceOf(text, districtHits));
  }

  // Deal type.
  const dealCues = scanDealTypeCues(work);
  const strongDeals = dealCues.filter((cue) => cue.strong);
  const dealPool = strongDeals.length > 0 ? strongDeals : dealCues;
  const dealValues = unique(dealPool.map((cue) => cue.value));
  if (dealValues.length === 1) {
    draft.dealType = knownField(dealValues[0], strongDeals.length > 0 ? 0.9 : 0.6, evidenceOf(text, dealPool));
  } else if (dealValues.length > 1) {
    if (strongDeals.length > 0) warn("deal_type_conflict");
    draft.dealType = unknownField(evidenceOf(text, dealPool));
  }

  // Property types.
  draft.propertyTypes = parsePropertyTypes(text, work, roomHits);

  // Building kind: "новостройка или вторичка" means no preference → unknown.
  const buildingHits = BUILDING_CUES.flatMap(({ re, value }) =>
    scanAll(re, work).map((match) => ({ value, span: spanOf(match) })),
  );
  const buildingValues = unique(buildingHits.map((hit) => hit.value));
  if (buildingValues.length === 1) {
    draft.buildingKind = knownField(buildingValues[0], 0.9, evidenceOf(text, buildingHits.map((hit) => hit.span)));
  } else if (buildingValues.length > 1) {
    draft.buildingKind = unknownField(evidenceOf(text, buildingHits.map((hit) => hit.span)));
  }

  // Renovation.
  const renovation: Reading<RenovationState[]>[] = [];
  let renovationConfidence = 0;
  for (const cue of RENOVATION_CUES) {
    for (const match of scanAll(cue.re, work)) {
      renovation.push({ value: cue.states, span: spanOf(match) });
      renovationConfidence = Math.max(renovationConfidence, cue.confidence);
      consume([spanOf(match)]);
    }
  }
  if (renovation.length > 0) {
    const states = unique(renovation.flatMap((reading) => reading.value));
    draft.renovation = knownField(states, renovationConfidence, evidenceOf(text, renovation.map((r) => r.span)));
  }

  // Mortgage.
  const mortgageYes = scanAll(MORTGAGE_YES_RE, work).map(spanOf);
  const mortgageNo = scanAll(MORTGAGE_NO_RE, work).map(spanOf);
  const mortgageYesOnly = mortgageYes.filter((yes) => !mortgageNo.some((no) => yes.start >= no.start && yes.end <= no.end));
  if (mortgageYesOnly.length > 0 && mortgageNo.length > 0) {
    warn("mortgage_conflict");
    draft.mortgage = unknownField(evidenceOf(text, [...mortgageYesOnly, ...mortgageNo]));
  } else if (mortgageYesOnly.length > 0) {
    draft.mortgage = knownField(true, 0.9, evidenceOf(text, mortgageYesOnly));
  } else if (mortgageNo.length > 0) {
    draft.mortgage = knownField(false, 0.7, evidenceOf(text, mortgageNo));
  }

  // Extras: landmarks first (already verbatim), then amenities.
  const extras: Reading<string>[] = landmarks.map((hit) => ({ value: hit.text, span: hit }));
  for (const match of scanAll(AMENITY_RE, work)) {
    const span = spanOf(match);
    extras.push({ value: text.slice(span.start, span.end).trim(), span });
  }
  if (extras.length > 0) {
    extras.sort((a, b) => a.span.start - b.span.start);
    const seen = new Set<string>();
    const values = extras
      .map((extra) => extra.value)
      .filter((value) => {
        const key = foldText(value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    draft.extras = knownField(values, 0.8, evidenceOf(text, extras.map((extra) => extra.span)));
  }

  const fields = [
    draft.dealType,
    draft.propertyTypes,
    draft.districts,
    draft.rooms,
    draft.area,
    draft.budget,
    draft.buildingKind,
    draft.renovation,
    draft.floor,
    draft.mortgage,
    draft.extras,
  ];
  if (!fields.some(hasValue) && draft.warnings.length === 0) warn("nothing_recognized");
  return draft;
}

function parseFloorPreference(text: string, folded: string): { field: ParsedField<FloorPreference>; spans: Span[] } {
  let work = folded;
  const spans: Span[] = [];
  const pref: FloorPreference = {};
  let confidence = 0;
  const take = (match: RegExpExecArray, level: number) => {
    const span = spanOf(match);
    spans.push(span);
    work = maskSpans(work, [span]);
    confidence = Math.max(confidence, level);
  };

  for (const match of scanAll(FLOOR_BOTH_RE, work)) {
    pref.notFirst = true;
    pref.notLast = true;
    take(match, 0.9);
  }
  for (const match of scanAll(FLOOR_NOT_FIRST_RE, work)) {
    pref.notFirst = true;
    take(match, 0.9);
  }
  for (const match of scanAll(FLOOR_NOT_LAST_RE, work)) {
    pref.notLast = true;
    take(match, 0.9);
  }
  for (const match of scanAll(FLOOR_MIDDLE_RE, work)) {
    pref.notFirst = true;
    pref.notLast = true;
    take(match, 0.7);
  }
  for (const match of scanAll(FLOOR_RANGE_RE, work)) {
    const min = Number(match[1] ?? match[3] ?? match[5]);
    const max = Number(match[2] ?? match[4] ?? match[6]);
    if (!(min >= 1 && max >= min && max <= 60)) continue;
    pref.min = min;
    pref.max = max;
    take(match, 0.85);
  }
  for (const match of scanAll(FLOOR_MAX_RE, work)) {
    pref.max = Number(match[1]);
    take(match, 0.85);
  }
  for (const match of scanAll(FLOOR_MIN_RE, work)) {
    pref.min = Number(match[1]);
    take(match, 0.85);
  }
  for (const match of scanAll(FLOOR_EXACT_RE, work)) {
    const floor = Number(match[1]);
    if (floor < 1 || floor > 60) continue;
    if (pref.min === undefined && pref.max === undefined) {
      pref.min = floor;
      pref.max = floor;
    }
    take(match, 0.7);
  }

  if (spans.length === 0) return { field: unknownField(), spans };
  return { field: knownField(pref, confidence, evidenceOf(text, spans)), spans };
}

function parsePropertyTypes(
  text: string,
  folded: string,
  roomHits: readonly RoomsHit[],
): ParsedField<PropertyType[]> {
  const cues = scanPropertyTypeCues(folded);
  // "трёшку" was consumed as a room count but also names an apartment.
  const colloquial = roomHits
    .filter((hit) => hit.apartment)
    .map((hit) => ({ start: hit.start, end: hit.end, value: "apartment" as const, strong: true, weight: 0.9 }));
  const strong = [...cues.filter((cue) => cue.strong), ...colloquial];
  if (strong.length > 0) {
    const set = new Set(strong.map((cue) => cue.value));
    // "комнату в квартире" is a room; "дом с участком" is a house.
    if (set.has("room")) set.delete("apartment");
    if (set.has("house")) set.delete("land");
    const values = propertyTypeOrder.filter((type) => set.has(type));
    const used = strong.filter((cue) => set.has(cue.value));
    return knownField(values, values.length === 1 ? 0.9 : 0.8, evidenceOf(text, used));
  }

  // Hints only: "новостройка" → apartment, "дом" → house, "2 комнаты" → probably an apartment.
  const hints = cues.map((cue) => ({ value: cue.value, weight: cue.weight, span: cue as Span }));
  if (roomHits.length > 0) hints.push({ value: "apartment", weight: 0.5, span: roomHits[0] as Span });
  if (hints.length === 0) return unknownField();
  const best = Math.max(...hints.map((hint) => hint.weight));
  const top = hints.filter((hint) => hint.weight === best);
  const values = unique(top.map((hint) => hint.value));
  if (values.length > 1) return unknownField(evidenceOf(text, top.map((hint) => hint.span)));
  return knownField(values, best, evidenceOf(text, top.map((hint) => hint.span)));
}

function parseBudget(
  text: string,
  hits: readonly MoneyHit[],
  warn: (warning: RequirementWarning) => void,
): ParsedField<BudgetDraft> {
  const readings = hits.filter((hit) => !hit.perUnit && !hit.auxiliary);
  if (readings.length === 0) return unknownField();

  const currencies = unique(readings.flatMap((hit) => (hit.currency ? [hit.currency] : [])));
  if (currencies.length > 1) warn("currency_conflict");
  const currency = currencies[0];
  // With a named currency, amounts in another (or no) currency are not mixed in.
  const used = currency ? readings.filter((hit) => hit.currency === currency) : readings;
  const spanOfHit = (hit: MoneyHit): Span => hit.range ?? hit;
  const evidence = evidenceOf(text, used.map(spanOfHit));

  // A bare amount without "до/от" is read as the ceiling: "бюджет 100 000$".
  const bounded = used.map((hit) => ({ hit, bound: hit.bound ?? "max" }));
  const minHits = bounded.filter((b) => b.bound === "min").map((b) => b.hit);
  const maxHits = bounded.filter((b) => b.bound === "max").map((b) => b.hit);
  const distinct = (list: MoneyHit[]) => unique(list.map((hit) => decimalString(hit.amount)));
  const minValues = distinct(minHits);
  const maxValues = distinct(maxHits);
  const minHit = minHits[0];
  const maxHit = maxHits[0];
  if (
    minValues.length > 1 ||
    maxValues.length > 1 ||
    (minHit && maxHit && decimalValue(minHit.amount) > decimalValue(maxHit.amount))
  ) {
    warn("budget_conflict");
    return unknownField(evidence);
  }

  const amountsMinor: Range<number> = {};
  if (minHit) amountsMinor.min = toMinor(decimalString(minHit.amount));
  if (maxHit) amountsMinor.max = toMinor(decimalString(maxHit.amount));
  const budget: BudgetDraft = { amountsMinor };
  const explicitBounds = used.every((hit) => hit.bound !== undefined);

  if (currency) {
    budget.currency = currency;
    const raw = (hit: MoneyHit) => {
      const span = spanOfHit(hit);
      return text.slice(span.start, span.end).trim();
    };
    if (minHit) budget.min = money(decimalString(minHit.amount), currency, raw(minHit));
    if (maxHit) budget.max = money(decimalString(maxHit.amount), currency, raw(maxHit));
    const confidence = currencies.length > 1 ? 0.5 : explicitBounds ? 0.9 : 0.7;
    return knownField(budget, confidence, evidence);
  }

  // §35.5: the currency is never guessed. Keep the amount, flag it, suggest at low confidence.
  warn("currency_unknown");
  const reference = decimalValue((maxHit ?? minHit).amount);
  budget.suggestedCurrency = knownField<Currency>(reference >= 1_000_000 ? "UZS" : "USD", 0.3, evidence);
  return knownField(budget, 0.3, evidence);
}

/* --------------------------------------------------------- application */

type Confident<T> = ParsedField<T> & { value: T };

/**
 * Converts the confident part of a draft into Requirement fields the form can
 * prefill. Fields below `minConfidence` or without a value are left out; the
 * budget is included only when its currency is known (§35.5). The original
 * sentence is always kept as `naturalLanguageInput`.
 */
export function draftToRequirementFields(
  draft: RequirementDraft,
  minConfidence: number = MIN_APPLY_CONFIDENCE,
): Partial<Requirement> {
  const ok = <T>(field: ParsedField<T>): field is Confident<T> =>
    field.value !== undefined && field.confidence >= minConfidence;
  const out: Partial<Requirement> = {};

  if (ok(draft.dealType)) out.dealType = draft.dealType.value;
  if (ok(draft.propertyTypes)) out.propertyTypes = [...draft.propertyTypes.value];
  if (ok(draft.districts)) out.districts = [...draft.districts.value];
  if (ok(draft.rooms)) out.rooms = cleanRange(draft.rooms.value);
  if (ok(draft.area)) out.area = cleanRange(draft.area.value);
  if (ok(draft.budget)) {
    const { currency, min, max } = draft.budget.value;
    if (currency && (min || max)) {
      out.budget = { currency, ...(min ? { min } : {}), ...(max ? { max } : {}) };
    }
  }
  if (ok(draft.buildingKind)) out.buildingKind = draft.buildingKind.value;
  if (ok(draft.renovation)) out.renovation = [...draft.renovation.value];
  if (ok(draft.floor)) out.floor = { ...draft.floor.value };
  if (ok(draft.mortgage)) out.mortgage = draft.mortgage.value;
  if (ok(draft.extras)) out.extras = [...draft.extras.value];
  if (draft.text.trim()) out.naturalLanguageInput = draft.text;
  return out;
}
