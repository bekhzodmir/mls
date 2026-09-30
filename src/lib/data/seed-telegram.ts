import { money } from "@/lib/domain/money";
import type {
  Currency,
  DealType,
  DistrictId,
  ID,
  ISODateTime,
  Money,
  ParsedField,
  ParsedListingFields,
  PropertyType,
  TelegramListing,
  TelegramSource,
} from "@/lib/domain/types";
import { day, minutesFromNow } from "./seed-time";

/**
 * Demo Telegram Radar data (§7.2, §13, §33.3): three fictional public
 * channels and twenty posts in Russian and Uzbek.
 *
 * Parsed fields are written by hand to agree with the raw text: every value
 * carries the verbatim span it was read from as evidence. Ambiguous posts
 * keep low confidence (< 0.6, which matching treats as Unknown) or no value
 * at all — a price without a currency, a colloquial district name, a post
 * without a deal verb. A TelegramListing is a discovered publication, never
 * a verified Property (§34.2).
 */

export const TELEGRAM_PARSER_VERSION = "demo-hand-labelled@1";

export const telegramSources: TelegramSource[] = [
  {
    id: "tgsrc-01",
    title: "Ташкент Квартиры · демо",
    handle: "tashkent_kvartiry_demo",
    status: "enabled",
    lastCheckedAt: minutesFromNow(-5),
  },
  {
    id: "tgsrc-02",
    title: "Toshkent Uy-Joy · demo",
    handle: "toshkent_uyjoy_demo",
    status: "enabled",
    lastCheckedAt: minutesFromNow(-12),
  },
  {
    id: "tgsrc-03",
    title: "Аренда Ташкент · демо",
    handle: "arenda_tashkent_demo",
    status: "paused",
    lastCheckedAt: minutesFromNow(-60),
  },
];

/* -------------------------------------------------------------- helpers */

function known<T>(value: T, confidence: number, evidence: string): ParsedField<T> {
  return { value, confidence, evidence };
}

/** Unknown is a value: no value, and evidence only when a span explains why. */
function unknown<T>(evidence?: string, confidence = 0): ParsedField<T> {
  return evidence === undefined ? { confidence } : { confidence, evidence };
}

function price(amount: number, currency: Currency, evidence: string, confidence = 0.9): ParsedField<Money> {
  return known(money(amount, currency, evidence), confidence, evidence);
}

/** Phone evidence is the span as written; the value is normalized +998XXXXXXXXX. */
function phone(evidence: string): ParsedField<string> {
  return known(`+${evidence.replace(/\D/g, "")}`, 0.95, evidence);
}

interface PostSpec {
  id: ID;
  sourceId: ID;
  messageId: number;
  rawText: string;
  mediaCount: number;
  publishedAt: ISODateTime;
  dealType: ParsedField<DealType>;
  propertyType: ParsedField<PropertyType>;
  district: ParsedField<DistrictId>;
  rooms: ParsedField<number>;
  areaTotal: ParsedField<number>;
  floor: ParsedField<number>;
  floorsTotal: ParsedField<number>;
  price: ParsedField<Money>;
  phone: ParsedField<string>;
  duplicateCandidates?: TelegramListing["duplicateCandidates"];
  status?: TelegramListing["status"];
  linkedClientIds?: ID[];
}

const handles: Record<ID, string> = Object.fromEntries(
  telegramSources.map((source) => [source.id, source.handle]),
);

function post(spec: PostSpec): TelegramListing {
  const parsed: ParsedListingFields = {
    dealType: spec.dealType,
    propertyType: spec.propertyType,
    district: spec.district,
    rooms: spec.rooms,
    areaTotal: spec.areaTotal,
    floor: spec.floor,
    floorsTotal: spec.floorsTotal,
    price: spec.price,
    phone: spec.phone,
  };
  return {
    id: spec.id,
    sourceId: spec.sourceId,
    messageId: spec.messageId,
    sourceUrl: `https://t.me/${handles[spec.sourceId]}/${spec.messageId}`,
    rawText: spec.rawText,
    mediaCount: spec.mediaCount,
    publishedAt: spec.publishedAt,
    // Collected a minute or two after publication (event time ≠ receipt time, §34.1).
    receivedAt: new Date(new Date(spec.publishedAt).getTime() + 90_000).toISOString(),
    parsed,
    parserVersion: TELEGRAM_PARSER_VERSION,
    duplicateCandidates: spec.duplicateCandidates ?? [],
    status: spec.status ?? "new",
    linkedClientIds: spec.linkedClientIds ?? [],
  };
}

/* ---------------------------------------------------------------- posts */

export const telegramListings: TelegramListing[] = [
  post({
    id: "tg-01",
    sourceId: "tgsrc-01",
    messageId: 4812,
    rawText:
      "🏠 Продаётся 2-комн. квартира\n📍 Чиланзар-6, рядом с метро Новза\n🏢 3/4 этаж, 54 м²\n🛠 С ремонтом, мебель остаётся\n💰 68 000 $\n📞 +998 97 000 51 01",
    mediaCount: 6,
    publishedAt: minutesFromNow(-130),
    dealType: known("sale", 0.95, "Продаётся"),
    propertyType: known("apartment", 0.9, "квартира"),
    district: known("chilanzar", 0.9, "Чиланзар"),
    rooms: known(2, 0.9, "2-комн."),
    areaTotal: known(54, 0.95, "54 м²"),
    floor: known(3, 0.9, "3/4 этаж"),
    floorsTotal: known(4, 0.9, "3/4 этаж"),
    price: price(68_000, "USD", "68 000 $"),
    phone: phone("+998 97 000 51 01"),
    duplicateCandidates: [
      {
        listingId: "tg-07",
        reasons: ["same_phone", "same_district", "same_rooms", "similar_area", "similar_price", "same_floor"],
      },
    ],
  }),
  post({
    id: "tg-02",
    sourceId: "tgsrc-02",
    messageId: 2231,
    rawText:
      "Sotiladi! 3 xonali kvartira, Yunusobod 4-kvartal.\nQavat: 5/9, maydoni 80 m².\nTa’mirlangan, avtoturargoh bor.\nNarxi: 102 000 $\nTel: +998 90 000 52 02",
    mediaCount: 8,
    publishedAt: day(-1, "19:20"),
    dealType: known("sale", 0.95, "Sotiladi"),
    propertyType: known("apartment", 0.9, "kvartira"),
    district: known("yunusabad", 0.9, "Yunusobod"),
    rooms: known(3, 0.9, "3 xonali"),
    areaTotal: known(80, 0.95, "80 m²"),
    floor: known(5, 0.85, "5/9"),
    floorsTotal: known(9, 0.85, "5/9"),
    price: price(102_000, "USD", "102 000 $"),
    phone: phone("+998 90 000 52 02"),
  }),
  post({
    id: "tg-03",
    sourceId: "tgsrc-01",
    messageId: 4815,
    rawText:
      "Сдаётся 2-комнатная квартира на Буюк Ипак Йули (Мирзо-Улугбекский р-н).\nС мебелью и техникой, 4/9 этаж.\n600$ в месяц, депозит за 1 месяц.\nЗвоните: +998 93 000 53 03",
    mediaCount: 5,
    publishedAt: minutesFromNow(-300),
    dealType: known("rent", 0.95, "Сдаётся"),
    propertyType: known("apartment", 0.9, "квартира"),
    district: known("mirzo_ulugbek", 0.9, "Мирзо-Улугбек"),
    rooms: known(2, 0.9, "2-комнатная"),
    areaTotal: unknown(),
    floor: known(4, 0.9, "4/9 этаж"),
    floorsTotal: known(9, 0.9, "4/9 этаж"),
    price: price(600, "USD", "600$"),
    phone: phone("+998 93 000 53 03"),
    duplicateCandidates: [{ listingId: "tg-17", reasons: ["same_district", "same_rooms", "similar_price"] }],
    status: "saved",
    linkedClientIds: ["cl-03"],
  }),
  post({
    id: "tg-04",
    sourceId: "tgsrc-03",
    messageId: 918,
    rawText: "Сдаю квартиру, Госпиталка, 3 ком, 700. Хозяин. +998 99 000 54 04",
    mediaCount: 0,
    publishedAt: day(-3, "21:05"),
    dealType: known("rent", 0.95, "Сдаю"),
    propertyType: known("apartment", 0.85, "квартиру"),
    // Colloquial area name, not a district: a guess below the confidence threshold.
    district: known("mirabad", 0.4, "Госпиталка"),
    rooms: known(3, 0.8, "3 ком"),
    areaTotal: unknown(),
    floor: unknown(),
    floorsTotal: unknown(),
    // "700" without a currency: never guessed (§35.5).
    price: unknown("700"),
    phone: phone("+998 99 000 54 04"),
  }),
  post({
    id: "tg-05",
    sourceId: "tgsrc-02",
    messageId: 2236,
    rawText:
      "Ijaraga beriladi: Chilonzor 7-kvartal, 3 xonali kvartira, 2/4 qavat, 75 m².\nOyiga 8 500 000 so‘m. Tel: +998 91 000 55 05",
    mediaCount: 4,
    publishedAt: day(-16, "10:00"),
    dealType: known("rent", 0.95, "Ijaraga beriladi"),
    propertyType: known("apartment", 0.9, "kvartira"),
    district: known("chilanzar", 0.9, "Chilonzor"),
    rooms: known(3, 0.9, "3 xonali"),
    areaTotal: known(75, 0.95, "75 m²"),
    floor: known(2, 0.9, "2/4 qavat"),
    floorsTotal: known(4, 0.9, "2/4 qavat"),
    price: price(8_500_000, "UZS", "8 500 000 so‘m"),
    phone: phone("+998 91 000 55 05"),
  }),
  post({
    id: "tg-06",
    sourceId: "tgsrc-01",
    messageId: 4820,
    rawText:
      "Продаётся дом в Бектемире, 6 соток, 4 комнаты, 160 м². Газ, свет, вода. Документы готовы. Цена 135 000 у.е. Тел. +998 94 000 56 06",
    mediaCount: 12,
    publishedAt: day(-2, "12:30"),
    dealType: known("sale", 0.95, "Продаётся"),
    propertyType: known("house", 0.9, "дом"),
    district: known("bektemir", 0.9, "Бектемир"),
    rooms: known(4, 0.9, "4 комнаты"),
    areaTotal: known(160, 0.9, "160 м²"),
    floor: unknown(),
    floorsTotal: unknown(),
    price: price(135_000, "USD", "135 000 у.е.", 0.8),
    phone: phone("+998 94 000 56 06"),
  }),
  post({
    id: "tg-07",
    sourceId: "tgsrc-02",
    messageId: 2240,
    rawText:
      "Chilonzor-6, Novza metrosi yonida 2 xonali kvartira sotiladi. 3/4 qavat, 54 kv.m, remont qilingan. Narxi 67 000$. Tel: +998 97 000 51 01",
    mediaCount: 6,
    publishedAt: day(-1, "09:10"),
    dealType: known("sale", 0.95, "sotiladi"),
    propertyType: known("apartment", 0.9, "kvartira"),
    district: known("chilanzar", 0.9, "Chilonzor"),
    rooms: known(2, 0.9, "2 xonali"),
    areaTotal: known(54, 0.9, "54 kv.m"),
    floor: known(3, 0.9, "3/4 qavat"),
    floorsTotal: known(4, 0.9, "3/4 qavat"),
    price: price(67_000, "USD", "67 000$"),
    phone: phone("+998 97 000 51 01"),
    duplicateCandidates: [
      {
        listingId: "tg-01",
        reasons: ["same_phone", "same_district", "same_rooms", "similar_area", "similar_price", "same_floor"],
      },
    ],
  }),
  post({
    id: "tg-08",
    sourceId: "tgsrc-01",
    messageId: 4826,
    rawText:
      "Срочно! Продаю 1-комн. квартиру в Сергели-5, 2/5 этаж, 36 м². 37 500 $, торг. +998 90 000 58 08",
    mediaCount: 3,
    publishedAt: day(0, "08:10"),
    dealType: known("sale", 0.95, "Продаю"),
    propertyType: known("apartment", 0.9, "квартиру"),
    district: known("sergeli", 0.9, "Сергели"),
    rooms: known(1, 0.9, "1-комн."),
    areaTotal: known(36, 0.95, "36 м²"),
    floor: known(2, 0.9, "2/5 этаж"),
    floorsTotal: known(5, 0.9, "2/5 этаж"),
    price: price(37_500, "USD", "37 500 $"),
    phone: phone("+998 90 000 58 08"),
  }),
  post({
    id: "tg-09",
    sourceId: "tgsrc-03",
    messageId: 921,
    rawText:
      "Сдаётся 1-комнатная квартира, Яккасарай, ул. Шота Руставели. 3/9 этаж, 40 м², евроремонт. 5 800 000 сум/мес. +998 88 000 59 09",
    mediaCount: 7,
    publishedAt: day(-1, "20:30"),
    dealType: known("rent", 0.95, "Сдаётся"),
    propertyType: known("apartment", 0.9, "квартира"),
    district: known("yakkasaray", 0.9, "Яккасарай"),
    rooms: known(1, 0.9, "1-комнатная"),
    areaTotal: known(40, 0.95, "40 м²"),
    floor: known(3, 0.9, "3/9 этаж"),
    floorsTotal: known(9, 0.9, "3/9 этаж"),
    price: price(5_800_000, "UZS", "5 800 000 сум"),
    phone: phone("+998 88 000 59 09"),
  }),
  post({
    id: "tg-10",
    sourceId: "tgsrc-02",
    messageId: 2244,
    rawText:
      "Mirzo Ulug‘bek tumani, Qorasuv-3. 3 xonali, 92 m², 6/9 qavat. Dizayner ta’mir. 125 000 $. Tel: +998 33 000 60 10",
    mediaCount: 10,
    publishedAt: day(-3, "14:00"),
    // No deal verb: "sale" is only inferred from the price scale.
    dealType: known("sale", 0.5, "125 000 $"),
    propertyType: known("apartment", 0.6, "3 xonali"),
    district: known("mirzo_ulugbek", 0.9, "Mirzo Ulug‘bek"),
    rooms: known(3, 0.9, "3 xonali"),
    areaTotal: known(92, 0.95, "92 m²"),
    floor: known(6, 0.9, "6/9 qavat"),
    floorsTotal: known(9, 0.9, "6/9 qavat"),
    price: price(125_000, "USD", "125 000 $"),
    phone: phone("+998 33 000 60 10"),
    status: "hidden",
  }),
  post({
    id: "tg-11",
    sourceId: "tgsrc-01",
    messageId: 4830,
    rawText:
      "Аренда офиса 85 м² на Мирзо-Улугбеке, 1 этаж, отдельный вход. 1 300 $/мес. +998 95 000 61 11",
    mediaCount: 4,
    publishedAt: day(-6, "11:15"),
    dealType: known("rent", 0.95, "Аренда"),
    propertyType: known("commercial", 0.85, "офиса"),
    district: known("mirzo_ulugbek", 0.9, "Мирзо-Улугбек"),
    rooms: unknown(),
    areaTotal: known(85, 0.95, "85 м²"),
    floor: known(1, 0.8, "1 этаж"),
    floorsTotal: unknown(),
    price: price(1_300, "USD", "1 300 $"),
    phone: phone("+998 95 000 61 11"),
  }),
  post({
    id: "tg-12",
    sourceId: "tgsrc-02",
    messageId: 2250,
    rawText: "Hovli sotiladi, 8 sotix, 5 xona. Narxi kelishiladi. Tel: +998 99 000 62 12",
    mediaCount: 5,
    publishedAt: day(-4, "16:40"),
    dealType: known("sale", 0.95, "sotiladi"),
    propertyType: known("house", 0.9, "Hovli"),
    district: unknown(),
    rooms: known(5, 0.85, "5 xona"),
    // "8 sotix" is the land plot, not the total area of the house.
    areaTotal: unknown("8 sotix"),
    floor: unknown(),
    floorsTotal: unknown(),
    price: unknown("Narxi kelishiladi"),
    phone: phone("+998 99 000 62 12"),
  }),
  post({
    id: "tg-13",
    sourceId: "tgsrc-03",
    messageId: 925,
    rawText:
      "Сдаю 3-комн. квартиру на Чиланзаре (квартал 14), 4/4 этаж, 70 м², мебель частично. 8 800 000 сум в месяц. +998 91 000 63 13",
    mediaCount: 6,
    publishedAt: day(-1, "12:00"),
    dealType: known("rent", 0.95, "Сдаю"),
    propertyType: known("apartment", 0.9, "квартиру"),
    district: known("chilanzar", 0.9, "Чиланзар"),
    rooms: known(3, 0.9, "3-комн."),
    areaTotal: known(70, 0.95, "70 м²"),
    floor: known(4, 0.9, "4/4 этаж"),
    floorsTotal: known(4, 0.9, "4/4 этаж"),
    price: price(8_800_000, "UZS", "8 800 000 сум"),
    phone: phone("+998 91 000 63 13"),
    status: "saved",
    linkedClientIds: ["cl-09"],
  }),
  post({
    id: "tg-14",
    sourceId: "tgsrc-01",
    messageId: 4835,
    rawText:
      "Продаётся 3-комнатная квартира, Чиланзар, 19 квартал. 4/5 этаж, 68 м². Состояние среднее. 76 000 $. +998 90 000 64 14",
    mediaCount: 9,
    publishedAt: day(-9, "10:00"),
    dealType: known("sale", 0.95, "Продаётся"),
    propertyType: known("apartment", 0.9, "квартира"),
    district: known("chilanzar", 0.9, "Чиланзар"),
    rooms: known(3, 0.9, "3-комнатная"),
    areaTotal: known(68, 0.95, "68 м²"),
    floor: known(4, 0.9, "4/5 этаж"),
    floorsTotal: known(5, 0.9, "4/5 этаж"),
    price: price(76_000, "USD", "76 000 $"),
    phone: phone("+998 90 000 64 14"),
  }),
  post({
    id: "tg-15",
    sourceId: "tgsrc-02",
    messageId: 2255,
    rawText: "Sergeli 7-mavze, 2 xonali kvartira, 1/4 qavat, 48 m². 41 000 $. +998 97 000 65 15",
    mediaCount: 3,
    publishedAt: day(-12, "13:00"),
    dealType: known("sale", 0.5, "41 000 $"),
    propertyType: known("apartment", 0.9, "kvartira"),
    district: known("sergeli", 0.9, "Sergeli"),
    rooms: known(2, 0.9, "2 xonali"),
    areaTotal: known(48, 0.95, "48 m²"),
    floor: known(1, 0.9, "1/4 qavat"),
    floorsTotal: known(4, 0.9, "1/4 qavat"),
    price: price(41_000, "USD", "41 000 $"),
    phone: phone("+998 97 000 65 15"),
    status: "hidden",
  }),
  post({
    id: "tg-16",
    sourceId: "tgsrc-01",
    messageId: 4840,
    rawText:
      "Продаётся 2-комн. квартира в Алмазаре, Кара-Камыш 2/1. 3/9 этаж, 55 м². 62 000 $. +998 93 000 66 16",
    mediaCount: 5,
    publishedAt: day(-20, "15:00"),
    dealType: known("sale", 0.95, "Продаётся"),
    propertyType: known("apartment", 0.9, "квартира"),
    district: known("olmazor", 0.9, "Алмазар"),
    rooms: known(2, 0.9, "2-комн."),
    areaTotal: known(55, 0.95, "55 м²"),
    floor: known(3, 0.9, "3/9 этаж"),
    floorsTotal: known(9, 0.9, "3/9 этаж"),
    price: price(62_000, "USD", "62 000 $"),
    phone: phone("+998 93 000 66 16"),
    status: "reported_stale",
  }),
  post({
    id: "tg-17",
    sourceId: "tgsrc-03",
    messageId: 930,
    rawText:
      "Сдаётся 2-комн. квартира, Мирзо-Улугбек, массив Карасу-6. 2/5 этаж, 56 м², с мебелью. 650 $ в месяц. +998 94 000 67 17",
    mediaCount: 8,
    publishedAt: day(0, "09:30"),
    dealType: known("rent", 0.95, "Сдаётся"),
    propertyType: known("apartment", 0.9, "квартира"),
    district: known("mirzo_ulugbek", 0.9, "Мирзо-Улугбек"),
    rooms: known(2, 0.9, "2-комн."),
    areaTotal: known(56, 0.95, "56 м²"),
    floor: known(2, 0.9, "2/5 этаж"),
    floorsTotal: known(5, 0.9, "2/5 этаж"),
    price: price(650, "USD", "650 $"),
    phone: phone("+998 94 000 67 17"),
    duplicateCandidates: [{ listingId: "tg-03", reasons: ["same_district", "same_rooms", "similar_price"] }],
  }),
  post({
    id: "tg-18",
    sourceId: "tgsrc-02",
    messageId: 2260,
    rawText:
      "Yunusobod tumanida 55 m² ofis ijaraga beriladi, 1-qavat. Oyiga 13 000 000 so‘m. Tel: +998 90 000 68 18",
    mediaCount: 4,
    publishedAt: day(-2, "10:30"),
    dealType: known("rent", 0.95, "ijaraga beriladi"),
    propertyType: known("commercial", 0.85, "ofis"),
    district: known("yunusabad", 0.9, "Yunusobod"),
    rooms: unknown(),
    areaTotal: known(55, 0.95, "55 m²"),
    floor: known(1, 0.8, "1-qavat"),
    floorsTotal: unknown(),
    price: price(13_000_000, "UZS", "13 000 000 so‘m"),
    phone: phone("+998 90 000 68 18"),
  }),
  post({
    id: "tg-19",
    sourceId: "tgsrc-01",
    messageId: 4845,
    rawText:
      "Продаётся дом, Яшнабадский район, массив Тузель. 5 комнат, 200 м², участок 5 соток. 148 000 $. +998 99 000 69 19",
    mediaCount: 14,
    publishedAt: day(-5, "17:20"),
    dealType: known("sale", 0.95, "Продаётся"),
    propertyType: known("house", 0.9, "дом"),
    district: known("yashnabad", 0.9, "Яшнабад"),
    rooms: known(5, 0.9, "5 комнат"),
    areaTotal: known(200, 0.95, "200 м²"),
    floor: unknown(),
    floorsTotal: unknown(),
    price: price(148_000, "USD", "148 000 $"),
    phone: phone("+998 99 000 69 19"),
    status: "saved",
    linkedClientIds: ["cl-05"],
  }),
  post({
    id: "tg-20",
    sourceId: "tgsrc-02",
    messageId: 2265,
    rawText: "Chilonzor, 2 xonali kvartira, 1-qavat, 50 m². Narxi 58 ming. Tel: +998 91 000 70 20",
    mediaCount: 2,
    publishedAt: day(0, "07:45"),
    // "Narxi" (price) without a deal verb or a currency: both stay uncertain.
    dealType: known("sale", 0.5, "Narxi 58 ming"),
    propertyType: known("apartment", 0.9, "kvartira"),
    district: known("chilanzar", 0.9, "Chilonzor"),
    rooms: known(2, 0.9, "2 xonali"),
    areaTotal: known(50, 0.95, "50 m²"),
    floor: known(1, 0.8, "1-qavat"),
    floorsTotal: unknown(),
    price: unknown("58 ming"),
    phone: phone("+998 91 000 70 20"),
  }),
];
