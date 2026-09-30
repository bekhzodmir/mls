import { money } from "./money";
import {
  anyOf,
  decimalString,
  decimalValue,
  evidenceOf,
  foldText,
  knownField,
  maskSpans,
  NUMBER_START,
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
  textBefore,
  unique,
  unknownField,
  WORD_END,
  WORD_START,
  wordOf,
  type MoneyHit,
  type Span,
} from "./text";
import type { Money, ParsedField, ParsedListingFields, PropertyType } from "./types";

/**
 * Telegram post → ParsedListingFields (§13.2, §35.5, §39.4).
 *
 * «Продаётся 3-комн. квартира, Юнусабад-19, 4/9 этаж, 78 м², евроремонт,
 * 85 000 $. Тел: +998 90 123 45 67» becomes per-field values, each with a
 * confidence and the raw span it was read from. The result is a draft
 * interpretation of a publication — never a verified Property (§34.2).
 *
 * - Currency, floor and area are never guessed (§35.5 step 4): absent or
 *   contradictory → value undefined, confidence 0.
 * - Any field whose mentions disagree ("3-комн." … "2 комнаты") is reported
 *   as Unknown with every conflicting span as evidence and a warning.
 * - Phones are normalized to +998XXXXXXXXX for search and dedup.
 *
 * `POST_PARSER_VERSION` is stored on every TelegramListing so a parser
 * change can be traced and re-run (§39.4).
 */

export const POST_PARSER_VERSION = "post-parser@1";

export type PostParseWarning =
  | "empty_text"
  /** An amount without "$ / у.е. / сум / so‘m" — the price stays Unknown. */
  | "currency_unknown"
  | "price_conflict"
  | "deal_type_conflict"
  | "district_conflict"
  | "rooms_conflict"
  | "area_conflict"
  | "floor_conflict";

export interface PostAnalysis {
  parsed: ParsedListingFields;
  warnings: PostParseWarning[];
  parserVersion: string;
}

/* ------------------------------------------------------------- floors */

interface FloorReading {
  span: Span;
  floor?: number;
  floorsTotal?: number;
  /** Only from the "rooms/floor/floors" triple, e.g. "3/4/9". */
  rooms?: number;
  confidence: number;
}

const FLOOR_WORD = String.raw`(?:этаж\p{L}*|эт\.|эт${WORD_END}|qavat\p{L}*)`;
const AREA_OR_MONEY_AHEAD = String.raw`(?!\s*(?:м|m|кв|kv|\$|у\.?е|сум|so'm))`;

const FRACTION = String.raw`(\d{1,2})\s*/\s*(\d{1,2})(?![\d/])`;

/** "3/4/9" — rooms / floor / floors, a common shorthand in Tashkent posts. */
const TRIPLE_RE = pattern(String.raw`${NUMBER_START}(\d{1,2})\s*/\s*${FRACTION}${AREA_OR_MONEY_AHEAD}`);
/** "4/9 этаж", "этаж 4/9", "3/4 qavat", "qavat: 3/4". */
const FRACTION_WITH_WORD_RE = pattern(
  anyOf(
    String.raw`${WORD_START}${FLOOR_WORD}\s*[:\-]?\s*${FRACTION}`,
    String.raw`${NUMBER_START}${FRACTION}\s*(?:-?\p{L}{1,2}\s+)?${FLOOR_WORD}`,
  ),
);
/** "4 этаж из 9", "4-й этаж / 9". */
const FLOOR_OF_RE = pattern(
  String.raw`${NUMBER_START}(\d{1,2})\s*(?:-?\s*(?:й|ой|ом|м))?\s*этаж\p{L}*\s+(?:из|/)\s*(\d{1,2})(?!\d)`,
);
/** "9-этажный", "9-ти этажного", "9 этажей", "Этажность: 9", "9 qavatli". */
const FLOORS_TOTAL_RE = pattern(
  anyOf(
    String.raw`${NUMBER_START}(\d{1,2})\s*-?\s*(?:х|ти|и)?\s*-?\s*(?:этажн\p{L}*|этажей|qavatli\p{L}*)${WORD_END}`,
    String.raw`${WORD_START}этажност\p{L}*\s*[:\-]?\s*(\d{1,2})(?!\d)`,
  ),
);
/** "4 этаж", "на 4-м этаже", "Этаж: 4", "4-qavat", "4-qavatda". */
const FLOOR_SINGLE_RE = pattern(
  anyOf(
    String.raw`${NUMBER_START}(\d{1,2})\s*-?\s*(?:й|ой|ом|м|ый|chi)?\s*(?:этаж(?!н|ей|ност)\p{L}*|qavat(?!li)\p{L}*)${WORD_END}`,
    String.raw`${WORD_START}(?:этаж|qavat)\s*[:\-]?\s*(\d{1,2})(?![\d/])`,
  ),
);
const FIRST_FLOOR_RE = pattern(String.raw`(?<!не\s)` + wordOf(String.raw`перв\p{L}*\s+этаж\p{L}*`, String.raw`birinchi\s+qavat\p{L}*`));
/** Bare "4/9" — floor/floors by convention, unless it looks like an address. */
const BARE_FRACTION_RE = pattern(`${NUMBER_START}${FRACTION}${AREA_OR_MONEY_AHEAD}`);
const ADDRESS_BEFORE_RE =
  /(?:дом|д\.|uy|кв\.?|квартал\p{L}*|kvartal\p{L}*|mavze\p{L}*|№|корп\p{L}*|ул\.|улиц\p{L}*|ko'cha\p{L}*)\s*$/u;

const MAX_FLOORS = 60;

function plausibleFloors(floor: number, floorsTotal: number): boolean {
  return floor >= 1 && floorsTotal >= 2 && floor <= floorsTotal && floorsTotal <= MAX_FLOORS;
}

function scanFloors(folded: string): FloorReading[] {
  const readings: FloorReading[] = [];
  let work = folded;
  const take = (reading: FloorReading) => {
    readings.push(reading);
    work = maskSpans(work, [reading.span]);
  };

  for (const match of scanAll(TRIPLE_RE, work)) {
    const [rooms, floor, total] = [match[1], match[2], match[3]].map(Number);
    if (rooms < 1 || rooms > 10 || !plausibleFloors(floor, total)) continue;
    take({ span: spanOf(match), rooms, floor, floorsTotal: total, confidence: 0.7 });
  }
  for (const match of scanAll(FRACTION_WITH_WORD_RE, work)) {
    const floor = Number(match[1] ?? match[3]);
    const total = Number(match[2] ?? match[4]);
    if (plausibleFloors(floor, total)) take({ span: spanOf(match), floor, floorsTotal: total, confidence: 0.9 });
  }
  for (const match of scanAll(FLOOR_OF_RE, work)) {
    const floor = Number(match[1]);
    const total = Number(match[2]);
    if (plausibleFloors(floor, total)) take({ span: spanOf(match), floor, floorsTotal: total, confidence: 0.9 });
  }
  for (const match of scanAll(FLOORS_TOTAL_RE, work)) {
    const total = Number(match[1] ?? match[2]);
    if (total >= 1 && total <= MAX_FLOORS) take({ span: spanOf(match), floorsTotal: total, confidence: 0.85 });
  }
  for (const match of scanAll(FLOOR_SINGLE_RE, work)) {
    const floor = Number(match[1] ?? match[2]);
    if (floor >= 1 && floor <= MAX_FLOORS) take({ span: spanOf(match), floor, confidence: 0.85 });
  }
  for (const match of scanAll(FIRST_FLOOR_RE, work)) {
    take({ span: spanOf(match), floor: 1, confidence: 0.85 });
  }
  for (const match of scanAll(BARE_FRACTION_RE, work)) {
    const floor = Number(match[1]);
    const total = Number(match[2]);
    if (!plausibleFloors(floor, total)) continue;
    if (ADDRESS_BEFORE_RE.test(textBefore(work, match.index, 12))) continue;
    take({ span: spanOf(match), floor, floorsTotal: total, confidence: 0.6 });
  }
  return readings.sort((a, b) => a.span.start - b.span.start);
}

/* ------------------------------------------------------------ helpers */

/** Which type wins when a post names several: "комната в квартире" is a room, "дом с участком" a house. */
const PROPERTY_PRECEDENCE: PropertyType[] = ["room", "house", "apartment", "commercial", "land"];

interface Reading<T> {
  value: T;
  span: Span;
  confidence: number;
}

/**
 * One agreed value → that value with the best confidence among its readings.
 * Disagreeing readings → Unknown with every span as evidence.
 */
function agree<T>(
  text: string,
  readings: readonly Reading<T>[],
  key: (value: T) => string = String,
): { field: ParsedField<T>; conflict: boolean } {
  if (readings.length === 0) return { field: unknownField(), conflict: false };
  const evidence = evidenceOf(text, readings.map((reading) => reading.span));
  if (unique(readings.map((reading) => key(reading.value))).length > 1) {
    return { field: unknownField(evidence), conflict: true };
  }
  const confidence = Math.max(...readings.map((reading) => reading.confidence));
  return { field: knownField(readings[0].value, confidence, evidence), conflict: false };
}

function emptyFields(): ParsedListingFields {
  return {
    dealType: unknownField(),
    propertyType: unknownField(),
    district: unknownField(),
    rooms: unknownField(),
    areaTotal: unknownField(),
    floor: unknownField(),
    floorsTotal: unknownField(),
    price: unknownField(),
    phone: unknownField(),
  };
}

/* ------------------------------------------------------------- parser */

/** Full analysis: fields plus warnings for the Copilot review screen (§35.5). */
export function analyzeTelegramPost(text: string): PostAnalysis {
  const parsed = emptyFields();
  const warnings: PostParseWarning[] = [];
  const warn = (warning: PostParseWarning) => {
    if (!warnings.includes(warning)) warnings.push(warning);
  };
  const result = () => ({ parsed, warnings, parserVersion: POST_PARSER_VERSION });

  const folded = foldText(text);
  if (!folded.trim()) {
    warn("empty_text");
    return result();
  }

  let work = folded;
  const consume = (spans: readonly Span[]) => {
    work = maskSpans(work, spans);
  };

  // Phones first: "90 123 45 67" must not be read as prices or floors.
  const phones = scanPhones(work);
  consume(phones);
  if (phones.length > 0) {
    const distinct = unique(phones.map((hit) => hit.e164));
    parsed.phone = knownField(distinct[0], distinct.length === 1 ? 0.95 : 0.85, evidenceOf(text, phones));
  }

  // Station and complex names are landmarks, not districts or numbers.
  consume(scanLandmarks(text, work));

  const floors = scanFloors(work);
  consume(floors.map((reading) => reading.span));
  const areas = scanAreas(work);
  consume(areas);
  const rooms = scanRooms(work);
  consume(rooms);
  const moneyHits = scanMoney(work);
  consume(moneyHits);

  // Floor and floors total.
  const floorResult = agree(
    text,
    floors.flatMap((r) => (r.floor === undefined ? [] : [{ value: r.floor, span: r.span, confidence: r.confidence }])),
  );
  const totalResult = agree(
    text,
    floors.flatMap((r) =>
      r.floorsTotal === undefined ? [] : [{ value: r.floorsTotal, span: r.span, confidence: r.confidence }],
    ),
  );
  const floorValue = floorResult.field.value;
  const totalValue = totalResult.field.value;
  if (floorResult.conflict || totalResult.conflict) warn("floor_conflict");
  if (floorValue !== undefined && totalValue !== undefined && floorValue > totalValue) {
    // "7 этаж" in a "5-этажный" building: one of them is wrong, keep both Unknown.
    warn("floor_conflict");
    parsed.floor = unknownField(floorResult.field.evidence);
    parsed.floorsTotal = unknownField(totalResult.field.evidence);
  } else {
    parsed.floor = floorResult.field;
    parsed.floorsTotal = totalResult.field;
  }

  // Area: the total area; kitchen, living and land areas are not it.
  const areaCandidates = areas.filter((hit) => !hit.label || hit.label === "total");
  const labelledTotal = areaCandidates.filter((hit) => hit.label === "total");
  const areaPool = labelledTotal.length > 0 ? labelledTotal : areaCandidates;
  const exactAreas = areaPool.filter((hit) => hit.min !== undefined && hit.min === hit.max);
  if (exactAreas.length > 0) {
    const areaResult = agree(
      text,
      exactAreas.map((hit) => ({ value: hit.min as number, span: hit, confidence: hit.label === "total" ? 0.95 : 0.85 })),
    );
    if (areaResult.conflict) warn("area_conflict");
    parsed.areaTotal = areaResult.field;
  } else if (areaPool.length > 0) {
    // "от 45 м²" or "45–120 м²" describes several units, not this one's area.
    parsed.areaTotal = unknownField(evidenceOf(text, areaPool));
  }

  // Rooms: explicit mentions and the "3/4/9" shorthand must agree. A range
  // ("1-3 комнатные") describes several units and leaves the count Unknown.
  const roomReadings: Reading<number | "range">[] = [
    ...rooms.map((hit) => ({
      value: hit.min !== undefined && hit.min === hit.max ? hit.min : ("range" as const),
      span: hit as Span,
      confidence: 0.9,
    })),
    ...floors.flatMap((r) => (r.rooms === undefined ? [] : [{ value: r.rooms, span: r.span, confidence: r.confidence }])),
  ];
  const roomsResult = agree(text, roomReadings);
  if (roomsResult.conflict) warn("rooms_conflict");
  parsed.rooms =
    roomsResult.field.value === "range"
      ? unknownField(roomsResult.field.evidence)
      : (roomsResult.field as ParsedField<number>);

  parsed.price = parsePrice(text, moneyHits, warn);

  // District.
  const districtHits = scanDistricts(work);
  const districtResult = agree(text, districtHits.map((hit) => ({ value: hit.id, span: hit, confidence: 0.9 })));
  if (districtResult.conflict) warn("district_conflict");
  parsed.district = districtResult.field;

  // Deal type: explicit words first, then hints such as "в месяц".
  const dealCues = scanDealTypeCues(work);
  const strongDeals = dealCues.filter((cue) => cue.strong);
  const dealPool = strongDeals.length > 0 ? strongDeals : dealCues;
  const dealResult = agree(
    text,
    dealPool.map((cue) => ({ value: cue.value, span: cue, confidence: cue.strong ? 0.95 : 0.6 })),
  );
  if (dealResult.conflict && strongDeals.length > 0) warn("deal_type_conflict");
  parsed.dealType = dealResult.field;

  // "двушка" names an apartment; a room count or a multi-storey building only hints at one.
  const apartmentWords: Span[] = rooms.filter((hit) => hit.apartment);
  const apartmentHints: Span[] = [
    ...rooms,
    ...floors.filter((r) => r.floorsTotal !== undefined && r.floorsTotal >= 3).map((r) => r.span),
  ];
  parsed.propertyType = parsePropertyType(text, work, apartmentWords, apartmentHints);

  return result();
}

/** ParsedListingFields for a TelegramListing; see `analyzeTelegramPost` for warnings. */
export function parseTelegramPost(text: string): ParsedListingFields {
  return analyzeTelegramPost(text).parsed;
}

/** Every Uzbek phone number in a text, normalized, with the original spelling. */
export function extractPhones(text: string): { e164: string; raw: string }[] {
  const seen = new Set<string>();
  const out: { e164: string; raw: string }[] = [];
  for (const hit of scanPhones(foldText(text))) {
    if (seen.has(hit.e164)) continue;
    seen.add(hit.e164);
    out.push({ e164: hit.e164, raw: text.slice(hit.start, hit.end).trim() });
  }
  return out;
}

function parsePrice(
  text: string,
  hits: readonly MoneyHit[],
  warn: (warning: PostParseWarning) => void,
): ParsedField<Money> {
  const candidates = hits.filter((hit) => !hit.perUnit && !hit.auxiliary);
  const priced = candidates.filter((hit) => hit.currency);
  if (priced.length === 0) {
    const bare = candidates.find((hit) => hit.marked || decimalValue(hit.amount) >= 1000);
    if (!bare) return unknownField();
    // §35.5: "85 000" alone could be $ or сум; the agent decides.
    warn("currency_unknown");
    return unknownField(evidenceOf(text, [bare]));
  }

  // "85 000 $ (≈ 1,08 млрд сум)" — the first currency is the asking price;
  // other currencies are usually a conversion.
  const currency = priced[0].currency;
  const sameCurrency = priced.filter((hit) => hit.currency === currency);
  const amounts = unique(sameCurrency.map((hit) => decimalString(hit.amount)));
  if (amounts.length > 1) {
    warn("price_conflict");
    return unknownField(evidenceOf(text, sameCurrency));
  }
  const first = sameCurrency[0];
  const raw = text.slice(first.start, first.end).trim();
  const value = money(decimalString(first.amount), first.currency ?? "USD", raw);
  const confidence = sameCurrency.length === priced.length ? 0.9 : 0.8;
  return knownField(value, confidence, evidenceOf(text, sameCurrency));
}

function parsePropertyType(
  text: string,
  folded: string,
  apartmentWords: readonly Span[],
  apartmentHints: readonly Span[],
): ParsedField<PropertyType> {
  const cues = scanPropertyTypeCues(folded);
  const strong = [
    ...cues.filter((cue) => cue.strong),
    ...apartmentWords.map((span) => ({ ...span, value: "apartment" as const })),
  ];
  if (strong.length > 0) {
    const present = new Set(strong.map((cue) => cue.value));
    const value = PROPERTY_PRECEDENCE.find((type) => present.has(type)) as PropertyType;
    const spans = strong.filter((cue) => cue.value === value);
    return knownField(value, present.size === 1 ? 0.9 : 0.75, evidenceOf(text, spans));
  }

  // Hints: "новостройка", "3-комн.", "4/9" → apartment; a bare "дом" → house.
  const hints: Reading<PropertyType>[] = [
    ...cues.map((cue) => ({ value: cue.value, span: cue as Span, confidence: cue.weight })),
    ...apartmentHints.map((span) => ({ value: "apartment" as const, span, confidence: 0.6 })),
  ];
  if (hints.length === 0) return unknownField();
  const best = Math.max(...hints.map((hint) => hint.confidence));
  const top = hints.filter((hint) => hint.confidence === best);
  const values = unique(top.map((hint) => hint.value));
  const evidence = evidenceOf(text, top.map((hint) => hint.span));
  if (values.length > 1) return unknownField(evidence);
  return knownField(values[0], best, evidence);
}
