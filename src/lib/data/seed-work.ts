import { money } from "@/lib/domain/money";
import type {
  AppNotification,
  AuditEvent,
  ChecklistItem,
  CooperationRequest,
  Deal,
  DealDocument,
  ID,
  ISODateTime,
  MatchRejectionReason,
  MatchStatus,
  MatchTarget,
  Offer,
  Task,
  Viewing,
} from "@/lib/domain/types";
import { split } from "./seed-inventory";
import { day, minutesFromNow } from "./seed-time";

/**
 * Demo work in progress: co-broking requests (§15.3), viewings (§14.8),
 * offers (§22.11), deals (§22.12), tasks and notifications (§36.5), plus the
 * agent's reactions to matches.
 *
 * - Commission terms are always fully specified and are an agreement between
 *   two professionals, not a Binor fee (§15.4, §41 D10).
 * - Every proposal is a new version; nothing is rewritten (§36.3).
 * - deal-06 went through the MLS: the act was signed on Monday, two working
 *   days before the demo "now", and the act details are not in the MLS yet —
 *   the 3-working-day deadline (§17.5, §38.5) ends on Thursday.
 * - vw-03 and vw-04 overlap on purpose to demonstrate schedule conflicts.
 */

/* ---------------------------------------------------------- cooperation */

export const cooperationRequests: CooperationRequest[] = [
  {
    id: "coop-01",
    listingId: "lst-15",
    requirementId: "req-13",
    fromAgentId: "agent-01",
    toAgentId: "agent-04",
    status: "accepted",
    versions: [
      {
        version: 1,
        terms: split("50/50", 50, "USD"),
        proposedById: "agent-01",
        proposedAt: day(-40, "11:00"),
      },
      {
        version: 2,
        terms: split("70/30", 70, "USD"),
        proposedById: "agent-04",
        proposedAt: day(-39, "10:30"),
        note: "Эксклюзивный договор, собственник работает только со мной.",
      },
      {
        version: 3,
        terms: split("custom", 60, "USD", { payoutCondition: "on_act_signed" }),
        proposedById: "agent-01",
        proposedAt: day(-39, "18:00"),
        note: "Компромисс: 60% листинговой стороне, выплата после подписания акта.",
      },
    ],
    acceptedVersion: 3,
    respondBy: day(-37, "18:00"),
    disclosure: "contacts_shared",
    createdAt: day(-40, "11:00"),
  },
  {
    id: "coop-02",
    listingId: "lst-23",
    requirementId: "req-01",
    fromAgentId: "agent-01",
    toAgentId: "agent-06",
    status: "negotiation",
    versions: [
      {
        version: 1,
        terms: split("50/50", 50, "USD"),
        proposedById: "agent-01",
        proposedAt: day(-1, "10:00"),
        note: "Клиент готов смотреть в выходные.",
      },
      {
        version: 2,
        terms: split("70/30", 70, "USD", { payoutCondition: "on_act_signed" }),
        proposedById: "agent-06",
        proposedAt: day(0, "09:40"),
        note: "Объект эксклюзивный, собственник на мне.",
      },
    ],
    respondBy: day(1, "18:00"),
    disclosure: "masked",
    createdAt: day(-1, "10:00"),
  },
  {
    id: "coop-03",
    listingId: "lst-01",
    requirementId: "req-17",
    fromAgentId: "agent-05",
    toAgentId: "agent-01",
    status: "sent",
    versions: [
      {
        version: 1,
        terms: split("50/50", 50, "USD"),
        proposedById: "agent-05",
        proposedAt: day(0, "10:40"),
        note: "Клиент готов смотреть завтра после 17:00.",
      },
    ],
    respondBy: day(0, "20:00"),
    disclosure: "masked",
    createdAt: day(0, "10:40"),
  },
  {
    id: "coop-04",
    listingId: "lst-02",
    requirementId: "req-18",
    fromAgentId: "agent-08",
    toAgentId: "agent-01",
    status: "viewed",
    versions: [
      {
        version: 1,
        terms: split("50/50", 50, "USD", { payoutCondition: "on_act_signed" }),
        proposedById: "agent-08",
        proposedAt: day(-1, "16:00"),
      },
    ],
    respondBy: day(1, "12:00"),
    disclosure: "masked",
    createdAt: day(-1, "16:00"),
  },
  {
    id: "coop-05",
    listingId: "lst-26",
    requirementId: "req-10",
    fromAgentId: "agent-01",
    toAgentId: "agent-07",
    status: "declined",
    versions: [
      {
        version: 1,
        terms: split("50/50", 50, "UZS"),
        proposedById: "agent-01",
        proposedAt: day(-9, "11:00"),
      },
    ],
    respondBy: day(-7, "18:00"),
    disclosure: "masked",
    createdAt: day(-9, "11:00"),
  },
  {
    id: "coop-06",
    listingId: "lst-09",
    fromAgentId: "agent-07",
    toAgentId: "agent-01",
    status: "expired",
    versions: [
      {
        version: 1,
        terms: split("custom", 40, "USD", {
          basis: "fixed_amount",
          fixedAmount: money(1_500, "USD"),
          payoutCondition: "custom",
          payoutNote: "50% при задатке, 50% после регистрации сделки",
        }),
        proposedById: "agent-07",
        proposedAt: day(-6, "15:00"),
      },
    ],
    respondBy: day(-3, "18:00"),
    disclosure: "masked",
    createdAt: day(-6, "15:00"),
  },
  {
    id: "coop-07",
    listingId: "lst-29",
    requirementId: "req-06",
    fromAgentId: "agent-01",
    toAgentId: "agent-08",
    status: "accepted",
    versions: [
      {
        version: 1,
        terms: split("50/50", 50, "USD"),
        proposedById: "agent-01",
        proposedAt: day(-3, "12:00"),
      },
    ],
    acceptedVersion: 1,
    respondBy: day(-1, "18:00"),
    disclosure: "contacts_shared",
    createdAt: day(-3, "12:00"),
  },
];

/* -------------------------------------------------------------- viewings */

export const viewings: Viewing[] = [
  {
    id: "vw-01",
    listingId: "lst-01",
    clientId: "cl-02",
    agentId: "agent-01",
    startsAt: day(0, "14:00"),
    durationMinutes: 60,
    status: "confirmed",
    confirmations: { client: true, ownerOrPartner: true },
  },
  {
    id: "vw-02",
    listingId: "lst-24",
    clientId: "cl-09",
    agentId: "agent-01",
    partnerAgentId: "agent-03",
    startsAt: day(0, "16:30"),
    durationMinutes: 45,
    status: "scheduled",
    confirmations: { client: true, ownerOrPartner: false },
  },
  {
    id: "vw-03",
    listingId: "lst-06",
    clientId: "cl-01",
    agentId: "agent-01",
    startsAt: day(1, "10:00"),
    durationMinutes: 60,
    status: "scheduled",
    confirmations: { client: true, ownerOrPartner: false },
  },
  {
    // Overlaps vw-03 (10:00–11:00): the schedule conflict demo.
    id: "vw-04",
    listingId: "lst-04",
    clientId: "cl-04",
    agentId: "agent-01",
    startsAt: day(1, "10:30"),
    durationMinutes: 45,
    status: "scheduled",
    confirmations: { client: false, ownerOrPartner: true },
  },
  {
    id: "vw-05",
    listingId: "lst-08",
    clientId: "cl-03",
    agentId: "agent-01",
    startsAt: day(2, "15:00"),
    durationMinutes: 45,
    status: "scheduled",
    confirmations: { client: false, ownerOrPartner: false },
  },
  {
    id: "vw-06",
    listingId: "lst-29",
    clientId: "cl-05",
    agentId: "agent-01",
    partnerAgentId: "agent-08",
    startsAt: day(3, "11:00"),
    durationMinutes: 90,
    status: "confirmed",
    confirmations: { client: true, ownerOrPartner: true },
  },
  {
    id: "vw-07",
    listingId: "lst-12",
    clientId: "cl-02",
    agentId: "agent-01",
    partnerAgentId: "agent-02",
    startsAt: day(-3, "17:00"),
    durationMinutes: 45,
    status: "completed",
    confirmations: { client: true, ownerOrPartner: true },
    feedback: { rating: 4, text: "Понравились ремонт и планировка, смущает цена — выше бюджета." },
    nextAction: "Сделать предложение $108 000 и показать ещё варианты в Юнусабаде",
  },
  {
    id: "vw-08",
    listingId: "lst-11",
    clientId: "cl-14",
    agentId: "agent-01",
    partnerAgentId: "agent-03",
    startsAt: day(-5, "11:00"),
    durationMinutes: 60,
    status: "completed",
    confirmations: { client: true, ownerOrPartner: true },
    feedback: { rating: 5, text: "Всё устроило, готовы обсуждать цену." },
    nextAction: "Подготовить предложение собственнику",
  },
  {
    id: "vw-09",
    listingId: "lst-05",
    clientId: "cl-06",
    agentId: "agent-01",
    startsAt: day(-10, "15:00"),
    durationMinutes: 60,
    status: "completed",
    confirmations: { client: true, ownerOrPartner: true },
    feedback: { rating: 4, text: "Локация отличная, просит скидку на ремонт фасада." },
    nextAction: "Передать собственнику предложение $215 000",
  },
  {
    id: "vw-10",
    listingId: "lst-07",
    clientId: "cl-10",
    agentId: "agent-01",
    startsAt: day(-4, "12:00"),
    durationMinutes: 45,
    status: "cancelled",
    confirmations: { client: false, ownerOrPartner: true },
  },
  {
    id: "vw-11",
    listingId: "lst-10",
    clientId: "cl-07",
    agentId: "agent-01",
    partnerAgentId: "agent-02",
    startsAt: day(-20, "11:00"),
    durationMinutes: 60,
    status: "completed",
    confirmations: { client: true, ownerOrPartner: true },
    feedback: { rating: 5, text: "Клиентке и супругу понравилось, готовы брать в ипотеку." },
    nextAction: "Оформить предложение $84 000",
  },
  {
    id: "vw-12",
    listingId: "lst-03",
    clientId: "cl-08",
    agentId: "agent-01",
    startsAt: day(-15, "16:00"),
    durationMinutes: 60,
    status: "completed",
    confirmations: { client: true, ownerOrPartner: true },
    feedback: { rating: 4, text: "Подходит по комнатам, просят скидку." },
    nextAction: "Согласовать цену с собственником",
  },
  {
    id: "vw-13",
    listingId: "lst-15",
    clientId: "cl-12",
    agentId: "agent-01",
    partnerAgentId: "agent-04",
    startsAt: day(-37, "12:00"),
    durationMinutes: 60,
    status: "completed",
    confirmations: { client: true, ownerOrPartner: true },
    feedback: { rating: 5, text: "Квартира подходит, супруга согласна." },
    nextAction: "Сделать предложение $80 000",
  },
];

/* ---------------------------------------------------------------- offers */

const usd = (amount: number) => money(amount, "USD");

export const offers: Offer[] = [
  {
    id: "offer-01",
    listingId: "lst-05",
    clientId: "cl-06",
    dealId: "deal-02",
    status: "countered",
    versions: [
      { version: 1, amount: usd(215_000), by: "buyer", at: day(-9, "12:00"), expiresAt: day(-6, "18:00") },
      {
        version: 2,
        amount: usd(232_000),
        by: "owner",
        at: day(-7, "15:00"),
        expiresAt: day(-3, "18:00"),
        note: "Собственник готов уступить, но не ниже $230 000.",
      },
      {
        version: 3,
        amount: usd(225_000),
        by: "buyer",
        at: day(-1, "16:00"),
        expiresAt: day(2, "18:00"),
        note: "Готовы выйти на сделку за две недели.",
      },
    ],
  },
  {
    id: "offer-02",
    listingId: "lst-10",
    clientId: "cl-07",
    dealId: "deal-03",
    status: "accepted",
    versions: [
      { version: 1, amount: usd(84_000), by: "buyer", at: day(-18, "12:00") },
      { version: 2, amount: usd(87_000), by: "owner", at: day(-17, "11:00") },
      { version: 3, amount: usd(86_000), by: "buyer", at: day(-16, "10:00"), note: "Ипотека одобрена." },
    ],
  },
  {
    id: "offer-03",
    listingId: "lst-03",
    clientId: "cl-08",
    dealId: "deal-04",
    status: "accepted",
    versions: [
      { version: 1, amount: usd(165_000), by: "buyer", at: day(-14, "11:00") },
      { version: 2, amount: usd(172_000), by: "owner", at: day(-13, "15:00"), note: "Окончательная цена." },
    ],
  },
  {
    id: "offer-04",
    listingId: "lst-11",
    clientId: "cl-14",
    dealId: "deal-05",
    status: "accepted",
    versions: [
      { version: 1, amount: usd(78_000), by: "buyer", at: day(-4, "12:00") },
      { version: 2, amount: usd(80_500), by: "owner", at: day(-3, "10:00") },
    ],
  },
  {
    id: "offer-05",
    listingId: "lst-12",
    clientId: "cl-02",
    status: "countered",
    versions: [
      { version: 1, amount: usd(108_000), by: "buyer", at: day(-2, "11:00"), expiresAt: day(1, "18:00") },
      {
        version: 2,
        amount: usd(114_000),
        by: "owner",
        at: day(-1, "13:00"),
        expiresAt: day(2, "18:00"),
        note: "Мебель остаётся в цене.",
      },
    ],
  },
  {
    id: "offer-06",
    listingId: "lst-15",
    clientId: "cl-12",
    dealId: "deal-06",
    status: "accepted",
    versions: [
      { version: 1, amount: usd(80_000), by: "buyer", at: day(-36, "12:00") },
      { version: 2, amount: usd(83_000), by: "owner", at: day(-35, "12:00") },
      { version: 3, amount: usd(82_000), by: "buyer", at: day(-34, "12:00") },
    ],
  },
];

/* ----------------------------------------------------------------- deals */

/** Checklist codes; labels live in the deals message namespace. */
type ChecklistCode =
  | "service_contract"
  | "owner_consent"
  | "ownership_check"
  | "encumbrance_check"
  | "final_price"
  | "act_signed"
  | "mls_report";

function checklist(dealId: ID, items: [ChecklistCode, ISODateTime | undefined, ID?][]): ChecklistItem[] {
  return items.map(([code, doneAt, doneById], index) => {
    const item: ChecklistItem = { id: `chk-${dealId}-${index + 1}`, labelKey: `checklist.${code}`, required: true };
    if (doneAt) {
      item.doneAt = doneAt;
      item.doneById = doneById ?? "agent-01";
    }
    return item;
  });
}

/** Passports and title documents are RESTRICTED (§16.3, §34.3). */
const RESTRICTED_TYPES = new Set<DealDocument["type"]>([
  "passport_copy",
  "ownership_certificate",
  "owner_consent",
]);

function documents(
  dealId: ID,
  items: [DealDocument["type"], DealDocument["status"], ISODateTime?][],
): DealDocument[] {
  return items.map(([type, status, uploadedAt], index) => {
    const doc: DealDocument = {
      id: `doc-${dealId}-${index + 1}`,
      type,
      status,
      sensitivity: RESTRICTED_TYPES.has(type) ? "restricted" : "normal",
    };
    if (uploadedAt) doc.uploadedAt = uploadedAt;
    return doc;
  });
}

function audit(
  dealId: ID,
  events: [ISODateTime, ID, string, { kind: string; id: ID }?, string?][],
): AuditEvent[] {
  return events.map(([at, actorId, action, target, reason], index) => {
    const event: AuditEvent = {
      id: `aud-${dealId}-${index + 1}`,
      at,
      actorId,
      action,
      target: target ?? { kind: "deal", id: dealId },
    };
    if (reason) event.reason = reason;
    return event;
  });
}

export const deals: Deal[] = [
  {
    id: "deal-01",
    listingId: "lst-01",
    clientId: "cl-02",
    agentId: "agent-01",
    stage: "viewing",
    checklist: checklist("deal-01", [
      ["service_contract", day(-3, "18:30")],
      ["owner_consent", day(-45, "11:30")],
      ["ownership_check", day(-40, "11:00")],
      ["encumbrance_check", undefined],
      ["final_price", undefined],
      ["act_signed", undefined],
    ]),
    documents: documents("deal-01", [
      ["service_contract", "uploaded", day(-3, "18:40")],
      ["owner_consent", "verified", day(-45, "11:30")],
      ["ownership_certificate", "verified", day(-40, "11:00")],
    ]),
    nextAction: { text: "Провести просмотр и записать отзыв клиента", dueAt: day(0, "15:00") },
    audit: audit("deal-01", [
      [day(-3, "18:30"), "agent-01", "deal.created"],
      [day(-3, "18:40"), "agent-01", "document.uploaded", { kind: "document", id: "doc-deal-01-1" }],
    ]),
    createdAt: day(-3, "18:30"),
  },
  {
    id: "deal-02",
    listingId: "lst-05",
    clientId: "cl-06",
    agentId: "agent-01",
    stage: "negotiation",
    checklist: checklist("deal-02", [
      ["service_contract", day(-9, "11:30")],
      ["owner_consent", day(-40, "15:00")],
      ["ownership_check", undefined],
      ["encumbrance_check", undefined],
      ["final_price", undefined],
      ["act_signed", undefined],
    ]),
    documents: documents("deal-02", [
      ["service_contract", "uploaded", day(-9, "11:30")],
      ["owner_consent", "uploaded", day(-40, "15:00")],
      ["ownership_certificate", "missing"],
      ["cadastre_extract", "missing"],
    ]),
    nextAction: { text: "Получить ответ собственника на $225 000", dueAt: day(1, "12:00") },
    audit: audit("deal-02", [
      [day(-9, "11:30"), "agent-01", "deal.created"],
      [day(-9, "12:00"), "agent-01", "deal.stage_changed", undefined, "viewing → offer"],
      [day(-7, "15:10"), "agent-01", "deal.stage_changed", undefined, "offer → negotiation"],
      [day(-1, "16:00"), "agent-01", "offer.version_added", { kind: "offer", id: "offer-01" }],
    ]),
    createdAt: day(-9, "11:30"),
  },
  {
    id: "deal-03",
    listingId: "lst-10",
    clientId: "cl-07",
    agentId: "agent-01",
    partnerAgentId: "agent-02",
    stage: "under_contract",
    agreedPrice: usd(86_000),
    checklist: checklist("deal-03", [
      ["service_contract", day(-18, "12:30")],
      ["owner_consent", day(-35, "10:00"), "agent-02"],
      ["final_price", day(-16, "10:30")],
      ["ownership_check", undefined],
      ["encumbrance_check", undefined],
      ["act_signed", undefined],
    ]),
    documents: documents("deal-03", [
      ["service_contract", "verified", day(-18, "12:30")],
      ["owner_consent", "uploaded", day(-35, "10:00")],
      ["passport_copy", "uploaded", day(-15, "14:00")],
      ["ownership_certificate", "missing"],
      ["cadastre_extract", "missing"],
    ]),
    nextAction: { text: "Заказать выписку из реестра прав", dueAt: day(0, "16:00") },
    audit: audit("deal-03", [
      [day(-18, "12:30"), "agent-01", "deal.created"],
      [day(-16, "10:30"), "agent-02", "offer.accepted", { kind: "offer", id: "offer-02" }],
      [day(-15, "12:00"), "agent-01", "deal.stage_changed", undefined, "negotiation → under_contract"],
      [day(-15, "14:00"), "agent-01", "document.uploaded", { kind: "document", id: "doc-deal-03-3" }],
    ]),
    createdAt: day(-18, "12:30"),
  },
  {
    id: "deal-04",
    listingId: "lst-03",
    clientId: "cl-08",
    agentId: "agent-01",
    stage: "verification",
    agreedPrice: usd(172_000),
    checklist: checklist("deal-04", [
      ["service_contract", day(-14, "10:00")],
      ["owner_consent", day(-50, "10:00")],
      ["final_price", day(-13, "15:30")],
      ["ownership_check", day(-20, "15:00")],
      ["encumbrance_check", undefined],
      ["act_signed", undefined],
    ]),
    documents: documents("deal-04", [
      ["service_contract", "verified", day(-14, "10:00")],
      ["owner_consent", "verified", day(-50, "10:00")],
      ["ownership_certificate", "verified", day(-20, "15:00")],
      ["passport_copy", "uploaded", day(-12, "11:00")],
      ["cadastre_extract", "missing"],
    ]),
    nextAction: {
      text: "Повторить запрос о запретах и получить кадастровую выписку",
      dueAt: day(-1, "18:00"),
    },
    audit: audit("deal-04", [
      [day(-14, "10:00"), "agent-01", "deal.created"],
      [day(-13, "15:30"), "agent-01", "offer.accepted", { kind: "offer", id: "offer-03" }],
      [day(-12, "10:00"), "agent-01", "deal.stage_changed", undefined, "negotiation → under_contract"],
      [day(-6, "10:00"), "agent-01", "deal.stage_changed", undefined, "under_contract → verification"],
      [
        day(-2, "12:15"),
        "agent-01",
        "document.viewed",
        { kind: "document", id: "doc-deal-04-4" },
        "Сверка данных покупателя для договора",
      ],
      [
        day(-1, "17:40"),
        "agent-01",
        "verification.requested",
        { kind: "listing", id: "lst-03" },
        "Запреты: сервис не ответил, запрос нужно повторить",
      ],
    ]),
    createdAt: day(-14, "10:00"),
  },
  {
    id: "deal-05",
    listingId: "lst-11",
    clientId: "cl-14",
    agentId: "agent-01",
    partnerAgentId: "agent-03",
    stage: "closing",
    agreedPrice: usd(80_500),
    checklist: checklist("deal-05", [
      ["service_contract", day(-4, "13:00")],
      ["owner_consent", day(-30, "11:00"), "agent-03"],
      ["ownership_check", day(-6, "12:00"), "agent-03"],
      ["encumbrance_check", day(-6, "12:10"), "agent-03"],
      ["final_price", day(-3, "10:30")],
      ["act_signed", undefined],
    ]),
    documents: documents("deal-05", [
      ["service_contract", "verified", day(-4, "13:00")],
      ["owner_consent", "verified", day(-30, "11:00")],
      ["ownership_certificate", "verified", day(-6, "12:00")],
      ["cadastre_extract", "verified", day(-6, "12:05")],
      ["passport_copy", "verified", day(-3, "11:00")],
      ["sale_agreement", "uploaded", day(-1, "16:00")],
      ["completion_act", "missing"],
    ]),
    nextAction: { text: "Подписание у нотариуса", dueAt: day(1, "11:00") },
    audit: audit("deal-05", [
      [day(-4, "13:00"), "agent-01", "deal.created"],
      [day(-3, "10:30"), "agent-03", "offer.accepted", { kind: "offer", id: "offer-04" }],
      [day(-3, "12:00"), "agent-01", "deal.stage_changed", undefined, "negotiation → under_contract"],
      [day(-2, "12:00"), "agent-01", "deal.stage_changed", undefined, "under_contract → verification"],
      [day(-1, "15:00"), "agent-01", "deal.stage_changed", undefined, "verification → closing"],
      [day(-1, "16:00"), "agent-01", "document.uploaded", { kind: "document", id: "doc-deal-05-6" }],
    ]),
    createdAt: day(-4, "13:00"),
  },
  {
    id: "deal-06",
    listingId: "lst-15",
    clientId: "cl-12",
    agentId: "agent-01",
    partnerAgentId: "agent-04",
    cooperationId: "coop-01",
    stage: "act",
    agreedPrice: usd(82_000),
    checklist: checklist("deal-06", [
      ["service_contract", day(-37, "13:00")],
      ["owner_consent", day(-70, "10:00"), "agent-04"],
      ["ownership_check", day(-30, "12:00"), "agent-04"],
      ["encumbrance_check", day(-30, "12:05"), "agent-04"],
      ["final_price", day(-34, "12:30")],
      ["act_signed", day(-2, "15:00")],
      ["mls_report", undefined],
    ]),
    documents: documents("deal-06", [
      ["service_contract", "verified", day(-37, "13:00")],
      ["owner_consent", "verified", day(-70, "10:00")],
      ["ownership_certificate", "verified", day(-30, "12:00")],
      ["cadastre_extract", "verified", day(-30, "12:05")],
      ["passport_copy", "verified", day(-8, "11:00")],
      ["sale_agreement", "verified", day(-5, "12:00")],
      ["completion_act", "uploaded", day(-2, "15:20")],
    ]),
    commission: {
      terms: split("custom", 60, "USD", { payoutCondition: "on_act_signed" }),
      // 3% of the agreed price, split between the two agents.
      gross: usd(2_460),
    },
    actSignedAt: day(-2, "15:00"),
    nextAction: { text: "Внести данные акта в MLS", dueAt: day(1, "23:59") },
    audit: audit("deal-06", [
      [day(-38, "10:00"), "agent-04", "cooperation.accepted", { kind: "cooperation", id: "coop-01" }],
      [day(-37, "13:00"), "agent-01", "deal.created"],
      [day(-34, "12:30"), "agent-04", "offer.accepted", { kind: "offer", id: "offer-06" }],
      [day(-20, "11:00"), "agent-01", "deal.stage_changed", undefined, "negotiation → under_contract"],
      [day(-12, "11:00"), "agent-01", "deal.stage_changed", undefined, "under_contract → verification"],
      [
        day(-6, "09:30"),
        "agent-04",
        "document.viewed",
        { kind: "document", id: "doc-deal-06-5" },
        "Проверка паспорта покупателя перед нотариусом",
      ],
      [day(-5, "12:00"), "agent-01", "deal.stage_changed", undefined, "verification → closing"],
      [day(-2, "15:00"), "agent-01", "act.signed"],
      [day(-2, "15:20"), "agent-01", "deal.stage_changed", undefined, "closing → act"],
    ]),
    createdAt: day(-37, "13:00"),
  },
];

/* ----------------------------------------------------------------- tasks */

export const tasks: Task[] = [
  {
    id: "task-01",
    title: "Перезвонить Нодиру по 3-комнатной на Юнусабаде",
    dueAt: day(-1, "18:00"),
    assigneeId: "agent-01",
    status: "open",
    priority: "high",
    related: { kind: "lead", id: "lead-02" },
  },
  {
    id: "task-02",
    title: "Запросить у собственника кадастровую выписку",
    dueAt: day(-2, "12:00"),
    assigneeId: "agent-01",
    status: "open",
    priority: "high",
    related: { kind: "deal", id: "deal-04" },
  },
  {
    id: "task-03",
    title: "Подтвердить актуальность квартиры у метро Буюк Ипак Йули",
    dueAt: day(-1, "12:00"),
    assigneeId: "agent-01",
    status: "open",
    priority: "normal",
    related: { kind: "listing", id: "lst-08" },
  },
  {
    id: "task-04",
    title: "Отправить Гульнаре 3 варианта с парковкой",
    dueAt: day(0, "13:00"),
    assigneeId: "agent-01",
    status: "open",
    priority: "high",
    related: { kind: "requirement", id: "req-03" },
  },
  {
    id: "task-05",
    title: "Взять ключи и договор на просмотр Юнусабад-19",
    dueAt: day(0, "13:30"),
    assigneeId: "agent-01",
    status: "open",
    priority: "normal",
    related: { kind: "viewing", id: "vw-01" },
  },
  {
    id: "task-06",
    title: "Внести данные акта в MLS",
    dueAt: day(0, "17:00"),
    assigneeId: "agent-01",
    status: "open",
    priority: "high",
    related: { kind: "deal", id: "deal-06" },
  },
  {
    id: "task-07",
    title: "Ответить на запрос о сотрудничестве по Юнусабаду-19",
    dueAt: day(0, "18:00"),
    assigneeId: "agent-01",
    status: "open",
    priority: "normal",
    related: { kind: "cooperation", id: "coop-03" },
  },
  {
    id: "task-08",
    title: "Продлить договор с собственником (Чиланзар-9)",
    dueAt: day(1, "09:30"),
    assigneeId: "agent-01",
    status: "open",
    priority: "high",
    related: { kind: "listing", id: "lst-06" },
  },
  {
    id: "task-09",
    title: "Farrux bilan uchrashuv: Bektemirdagi hovlilarni muhokama qilish",
    dueAt: day(2, "18:00"),
    assigneeId: "agent-01",
    status: "open",
    priority: "normal",
    related: { kind: "client", id: "cl-05" },
  },
  {
    id: "task-10",
    title: "Позвонить Сергею Ли: возобновлять ли поиск",
    dueAt: day(5, "11:00"),
    assigneeId: "agent-01",
    status: "snoozed",
    priority: "normal",
    related: { kind: "client", id: "cl-10" },
  },
  {
    id: "task-11",
    title: "Согласовать условия сотрудничества с Маликой Назаровой",
    dueAt: day(-2, "18:00"),
    assigneeId: "agent-01",
    status: "done",
    priority: "normal",
    related: { kind: "cooperation", id: "coop-07" },
  },
  {
    id: "task-12",
    title: "Отправить Otabek подборку квартир с мебелью",
    dueAt: day(-1, "12:00"),
    assigneeId: "agent-01",
    status: "done",
    priority: "normal",
    related: { kind: "client", id: "cl-03" },
  },
];

/* --------------------------------------------------------- notifications */

export const notifications: AppNotification[] = [
  {
    id: "ntf-01",
    category: "action",
    kind: "sla_breach",
    at: minutesFromNow(-45),
    read: false,
    related: { kind: "lead", id: "lead-06" },
    context: "Гульнара Сафарова — заявка с сайта без ответа",
  },
  {
    id: "ntf-02",
    category: "action",
    kind: "cooperation_request",
    at: day(0, "10:41"),
    read: false,
    related: { kind: "cooperation", id: "coop-03" },
    context: "Jasur Tursunov (Namuna Estate Demo) — Юнусабад-19, 3 комнаты",
  },
  {
    id: "ntf-03",
    category: "action",
    kind: "task_overdue",
    at: day(-2, "12:00"),
    read: false,
    related: { kind: "deal", id: "deal-04" },
    context: "Запросить у собственника кадастровую выписку",
  },
  {
    id: "ntf-04",
    category: "action",
    kind: "contract_expiring",
    at: day(0, "08:00"),
    read: false,
    related: { kind: "listing", id: "lst-06" },
    context: "Чиланзар-9, 2 комнаты — договор с собственником заканчивается",
  },
  {
    id: "ntf-05",
    category: "matches",
    kind: "new_match",
    at: day(0, "09:05"),
    read: false,
    related: { kind: "match", id: "req-03--lst-16" },
    context: "Юнусабад-4, 3 комнаты — подходит Гульнаре Сафаровой",
  },
  {
    id: "ntf-06",
    category: "matches",
    kind: "price_drop",
    at: day(-1, "09:01"),
    read: false,
    related: { kind: "listing", id: "lst-23" },
    context: "Чиланзар-19, 3 комнаты: $77 000 → $74 500",
  },
  {
    id: "ntf-07",
    category: "matches",
    kind: "new_match",
    at: day(-1, "12:02"),
    read: true,
    related: { kind: "match", id: "req-10--tg-13" },
    context: "Telegram: Чиланзар-14, 3 комнаты, 8,8 млн сум — подходит Zarina Abdullayeva",
  },
  {
    id: "ntf-08",
    category: "matches",
    kind: "listing_stale",
    at: day(-2, "09:00"),
    read: true,
    related: { kind: "listing", id: "lst-08" },
    context: "Буюк Ипак Йули, 2 комнаты — не подтверждался больше 15 дней",
  },
  {
    id: "ntf-09",
    category: "clients",
    kind: "viewing_confirmed",
    at: day(0, "09:40"),
    read: false,
    related: { kind: "viewing", id: "vw-01" },
    context: "Гульнара Сафарова подтвердила просмотр в 14:00",
  },
  {
    id: "ntf-10",
    category: "clients",
    kind: "viewing_confirmed",
    at: day(0, "09:12"),
    read: true,
    related: { kind: "viewing", id: "vw-02" },
    context: "Zarina Abdullayeva ko‘rikni tasdiqladi (16:30)",
  },
  {
    id: "ntf-11",
    category: "deals",
    kind: "deal_stage_changed",
    at: day(-1, "15:00"),
    read: true,
    related: { kind: "deal", id: "deal-05" },
    context: "Виктория Ким — Чиланзар-12, 3 комнаты",
  },
  {
    id: "ntf-12",
    category: "deals",
    kind: "cooperation_answered",
    at: day(0, "09:41"),
    read: false,
    related: { kind: "cooperation", id: "coop-02" },
    context: "Shaxlo Mirzayeva предложила новую версию условий (v2)",
  },
  {
    id: "ntf-13",
    category: "deals",
    kind: "deal_stage_changed",
    at: day(-2, "15:20"),
    read: false,
    related: { kind: "deal", id: "deal-06" },
    context: "Алишер Хасанов — Учтепа-22: акт подписан, внесите данные в MLS",
  },
  {
    id: "ntf-14",
    category: "system",
    kind: "security",
    at: day(0, "07:58"),
    read: false,
    context: "Вход с нового устройства: Telegram Desktop, Ташкент",
  },
  {
    id: "ntf-15",
    category: "system",
    kind: "listing_stale",
    at: day(-2, "00:00"),
    read: true,
    related: { kind: "listing", id: "lst-07" },
    context: "Сергели-8: срок публикации истёк, объект снят с поиска автоматически",
  },
];

/* ------------------------------------------------------ match reactions */

/**
 * The agent's reactions to computed matches (§11.4, §12.6). Matches are not
 * stored: they are recomputed from the requirement and candidate at query
 * time, and this overlay only records what the agent did with a pair.
 */
export interface MatchStatusRecord {
  requirementId: ID;
  target: MatchTarget;
  status: MatchStatus;
  rejectionReason?: MatchRejectionReason;
  at: ISODateTime;
}

export const matchStatuses: MatchStatusRecord[] = [
  { requirementId: "req-01", target: { kind: "listing", id: "lst-06" }, status: "accepted", at: day(-1, "18:20") },
  { requirementId: "req-01", target: { kind: "listing", id: "lst-17" }, status: "viewed", at: day(-2, "10:00") },
  // Same flat as lst-17, offered by another agency (Property ≠ Listing).
  { requirementId: "req-01", target: { kind: "listing", id: "lst-22" }, status: "duplicate", at: day(-2, "10:02") },
  { requirementId: "req-01", target: { kind: "listing", id: "lst-23" }, status: "negotiation", at: day(-1, "10:00") },
  { requirementId: "req-01", target: { kind: "telegram", id: "tg-07" }, status: "duplicate", at: day(0, "09:00") },
  { requirementId: "req-03", target: { kind: "listing", id: "lst-01" }, status: "deal_in_progress", at: day(-3, "18:30") },
  {
    requirementId: "req-03",
    target: { kind: "listing", id: "lst-12" },
    status: "rejected",
    rejectionReason: "price",
    at: day(-3, "18:10"),
  },
  { requirementId: "req-04", target: { kind: "listing", id: "lst-08" }, status: "viewed", at: day(-1, "11:00") },
  { requirementId: "req-04", target: { kind: "telegram", id: "tg-03" }, status: "contacted", at: day(0, "07:30") },
  {
    requirementId: "req-05",
    target: { kind: "listing", id: "lst-13" },
    status: "rejected",
    rejectionReason: "price",
    at: day(-1, "13:30"),
  },
  { requirementId: "req-06", target: { kind: "listing", id: "lst-29" }, status: "accepted", at: day(-2, "11:00") },
  { requirementId: "req-06", target: { kind: "telegram", id: "tg-19" }, status: "contacted", at: day(-4, "20:00") },
  { requirementId: "req-07", target: { kind: "listing", id: "lst-05" }, status: "deal_in_progress", at: day(-9, "11:30") },
  { requirementId: "req-08", target: { kind: "listing", id: "lst-09" }, status: "viewed", at: day(-5, "12:00") },
  { requirementId: "req-10", target: { kind: "listing", id: "lst-24" }, status: "accepted", at: day(0, "09:10") },
  {
    requirementId: "req-10",
    target: { kind: "telegram", id: "tg-05" },
    status: "rejected",
    rejectionReason: "stale",
    at: day(-2, "19:00"),
  },
  {
    requirementId: "req-16",
    target: { kind: "listing", id: "lst-23" },
    status: "rejected",
    rejectionReason: "condition",
    at: day(-6, "12:00"),
  },
];
