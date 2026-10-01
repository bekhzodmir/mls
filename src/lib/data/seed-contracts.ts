import { money } from "@/lib/domain/money";
import type {
  Contract,
  ContractRemuneration,
  ContractSignature,
  ContractStatus,
  ID,
  ISODateTime,
  Listing,
  SignatureMethod,
} from "@/lib/domain/types";
import { listings, properties } from "./seed-inventory";
import { agents, owners } from "./seed-people";
import { day } from "./seed-time";

/**
 * Demo service contracts (§17.5, §38.5) — all fictional.
 *
 * - Every listing that carries a `contractId` has exactly one Contract whose
 *   `number` equals it, whose `endsAt` equals `listing.contractExpiresAt` and
 *   whose customer is the property's owner (owner_service).
 * - Contract ids are derived from the number: "DR-2026-041" → "ctr-dr-2026-041".
 * - Statuses: most are active; DR-2026-041 / -052 / -055 end within 14 days;
 *   DR-2026-019 has expired; DR-2026-061 (draft listing lst-35) awaits
 *   signature because the co-owner's consent is missing (art. 37);
 *   DR-2026-062 is a renewal draft for lst-06; DRB-2026-003 (buyer) and
 *   TM-2026-074 (partner) were terminated with a reason.
 * - DR-2026-043 lacks the insurance clause; DR-2026-052 was signed with a
 *   simple electronic signature — the UI must not present it as qualified.
 * - Buyer contracts (DRB-…) are with the viewer's clients; CO-2026-004 is the
 *   co-broking agreement behind the accepted request coop-01 (deal-06).
 */

/* -------------------------------------------------------------- helpers */

const FULL_CLAUSES: Contract["clauses"] = {
  certificateDetails: true,
  membershipDetails: true,
  insuranceDetails: true,
  rightsAndObligations: true,
  liability: true,
  terminationAndRefund: true,
  confidentiality: true,
};

/** "DR-2026-041" → "ctr-dr-2026-041". */
export function contractIdFor(number: string): ID {
  return `ctr-${number.toLowerCase()}`;
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Contract seed is inconsistent: missing ${what}`);
  return value;
}

const listingById = new Map(listings.map((item) => [item.id, item]));
const propertyById = new Map(properties.map((item) => [item.id, item]));
const ownerById = new Map(owners.map((item) => [item.id, item]));
const agentById = new Map(agents.map((item) => [item.id, item]));

/** The template line a contract was generated from (§39.3), by organization and date. */
function templateFor(listing: Listing, signedAt: ISODateTime): string {
  const prefix =
    listing.organizationId === "org-01"
      ? "owner-service"
      : listing.organizationId === "org-02"
        ? "namuna-owner-service"
        : listing.organizationId === "org-03"
          ? "makon-owner-service"
          : "individual-owner-service";
  // Demo Realty switched to the August template on 1 August (60 days before the demo "now").
  return `${prefix}@${signedAt < day(-60, "00:00") ? "2026-05" : "2026-08"}`;
}

function defaultRemuneration(listing: Listing): ContractRemuneration {
  if (listing.dealType === "rent") {
    return {
      kind: "percent",
      percent: 50,
      paymentTerms: "50% месячной арендной платы, в день подписания договора аренды.",
    };
  }
  return {
    kind: "percent",
    percent: 3,
    paymentTerms: "3% от цены сделки, в день регистрации договора купли-продажи.",
  };
}

function signatures(
  signedAt: ISODateTime,
  customerName: string,
  agentId: ID,
  method: SignatureMethod,
): ContractSignature[] {
  return [
    { party: "customer", signerName: customerName, method, signedAt },
    { party: "agent", signerName: agentId, method, signedAt },
  ];
}

interface ListingContractSpec {
  listingId: ID;
  status?: ContractStatus;
  remuneration?: ContractRemuneration;
  signatureMethod?: SignatureMethod;
  /** Clauses missing from the text. */
  missingClauses?: (keyof Contract["clauses"])[];
  /** Further right holders (co-owners) next to the customer. */
  coOwners?: Contract["rightHolderConsents"];
  /** Customer consent state when it is not simply "confirmed". */
  customerConsent?: "confirmed" | "missing";
  /** Signatures are left out (draft / awaiting signature). */
  unsigned?: boolean;
  terminatedAt?: ISODateTime;
  terminationReason?: string;
}

/**
 * Owner service contract of one listing: number, end date, customer, agent
 * and organization all come from the listing so they can never drift apart.
 * Signed on the day the contract was checked (or published, for partners).
 */
function listingContract(spec: ListingContractSpec): Contract {
  const listing = must(listingById.get(spec.listingId), `listing ${spec.listingId}`);
  const number = must(listing.contractId, `contract number of ${listing.id}`);
  const endsAt = must(listing.contractExpiresAt, `contract end of ${listing.id}`);
  const property = must(propertyById.get(listing.propertyId), `property ${listing.propertyId}`);
  const ownerId = must(property.ownerId, `owner of ${property.id}`);
  const owner = must(ownerById.get(ownerId), `owner ${ownerId}`);
  const signedAt =
    listing.verifications.find((item) => item.subject === "contract")?.checkedAt ?? listing.publishedAt;
  const ownerConsent = owner.consents.find((consent) => consent.purpose === "share_with_partners");
  const customerStatus = spec.customerConsent ?? "confirmed";
  const customerEntry: Contract["rightHolderConsents"][number] = { ownerId, status: customerStatus };
  if (customerStatus === "confirmed" && ownerConsent) customerEntry.consentId = ownerConsent.id;

  const clauses = { ...FULL_CLAUSES };
  for (const clause of spec.missingClauses ?? []) clauses[clause] = false;

  const contract: Contract = {
    id: contractIdFor(number),
    number,
    kind: "owner_service",
    status: spec.status ?? "active",
    templateVersion: templateFor(listing, signedAt),
    service:
      listing.dealType === "sale"
        ? "Поиск покупателя и сопровождение продажи объекта"
        : "Поиск арендатора и сопровождение сдачи объекта в аренду",
    customer: { kind: "owner", id: ownerId },
    agentId: listing.agentId,
    listingId: listing.id,
    startsAt: signedAt,
    endsAt,
    remuneration: spec.remuneration ?? defaultRemuneration(listing),
    clauses,
    rightHolderConsents: [customerEntry, ...(spec.coOwners ?? [])],
    signatures: spec.unsigned
      ? []
      : signatures(signedAt, owner.name, listing.agentId, spec.signatureMethod ?? "paper"),
    createdAt: signedAt,
  };
  if (listing.organizationId) contract.organizationId = listing.organizationId;
  if (spec.terminatedAt) contract.terminatedAt = spec.terminatedAt;
  if (spec.terminationReason) contract.terminationReason = spec.terminationReason;
  return contract;
}

interface BuyerContractSpec {
  number: string;
  clientId: ID;
  clientName: string;
  requirementId: ID;
  dealId?: ID;
  signedAt: ISODateTime;
  endsAt: ISODateTime;
  remuneration: ContractRemuneration;
  status?: ContractStatus;
  terminatedAt?: ISODateTime;
  terminationReason?: string;
}

/** Buyer/tenant service contract between the viewer and their client. */
function buyerContract(spec: BuyerContractSpec): Contract {
  const contract: Contract = {
    id: contractIdFor(spec.number),
    number: spec.number,
    kind: "buyer_service",
    status: spec.status ?? "active",
    templateVersion: `buyer-service@${spec.signedAt < day(-60, "00:00") ? "2026-05" : "2026-08"}`,
    service: "Подбор объекта, организация просмотров и сопровождение сделки покупателя",
    customer: { kind: "client", id: spec.clientId },
    agentId: "agent-01",
    organizationId: "org-01",
    requirementId: spec.requirementId,
    startsAt: spec.signedAt,
    endsAt: spec.endsAt,
    remuneration: spec.remuneration,
    clauses: { ...FULL_CLAUSES },
    // A buyer contract is not a contract on a property: no right holders (art. 37).
    rightHolderConsents: [],
    signatures: signatures(spec.signedAt, spec.clientName, "agent-01", "paper"),
    createdAt: spec.signedAt,
  };
  if (spec.dealId) contract.dealId = spec.dealId;
  if (spec.terminatedAt) contract.terminatedAt = spec.terminatedAt;
  if (spec.terminationReason) contract.terminationReason = spec.terminationReason;
  return contract;
}

const usd = (amount: number) => money(amount, "USD");

/* ---------------------------------------------------------- contracts */

/** Owner service contracts, one per listing with a contract number. */
const ownerServiceContracts: Contract[] = [
  // ---- The viewer's listings ------------------------------------------
  listingContract({ listingId: "lst-01" }), // ends in 10 days
  listingContract({ listingId: "lst-02" }),
  listingContract({ listingId: "lst-03" }),
  listingContract({
    listingId: "lst-04", // ends in 13 days
    // Signed remotely with a button press: valid as a simple e-signature only,
    // never shown as a qualified one (§38.5).
    signatureMethod: "simple_electronic",
  }),
  listingContract({
    listingId: "lst-05",
    remuneration: {
      kind: "fixed",
      amount: usd(5_000),
      paymentTerms: "Фиксированное вознаграждение: 50% при получении задатка, 50% после регистрации сделки.",
    },
  }),
  listingContract({ listingId: "lst-06" }), // ends in 5 days; renewal draft DR-2026-062 below
  listingContract({ listingId: "lst-07", status: "expired" }),
  listingContract({
    listingId: "lst-08",
    // The insurance details are missing from this older contract text (§38.5).
    missingClauses: ["insuranceDetails"],
  }),
  listingContract({ listingId: "lst-09" }),
  listingContract({
    listingId: "lst-35",
    status: "awaiting_signature",
    unsigned: true,
    // The co-owner (spouse) has not consented: the contract cannot be signed (art. 37).
    coOwners: [{ ownerId: "owner-34", status: "missing" }],
  }),

  // ---- Colleagues at Demo Realty --------------------------------------
  listingContract({ listingId: "lst-10" }),
  listingContract({ listingId: "lst-11" }),
  listingContract({ listingId: "lst-12" }),
  listingContract({ listingId: "lst-13" }),
  listingContract({
    listingId: "lst-14",
    remuneration: {
      kind: "fixed",
      amount: usd(1_400),
      paymentTerms: "Одна месячная аренда, в день подписания договора аренды.",
    },
  }),
  listingContract({ listingId: "lst-24" }),
  listingContract({ listingId: "lst-34" }),

  // ---- Partners (never visible to the viewer) -------------------------
  listingContract({ listingId: "lst-15" }),
  listingContract({ listingId: "lst-16" }),
  listingContract({ listingId: "lst-17" }),
  listingContract({ listingId: "lst-18" }),
  listingContract({ listingId: "lst-19" }),
  listingContract({ listingId: "lst-20" }),
  listingContract({ listingId: "lst-21" }),
  listingContract({ listingId: "lst-30" }),
  listingContract({ listingId: "lst-22" }),
  listingContract({ listingId: "lst-23" }),
  listingContract({ listingId: "lst-25" }),
  listingContract({
    listingId: "lst-26",
    status: "terminated",
    terminatedAt: day(-8, "12:00"),
    terminationReason: "Собственник снял объект с продажи; расторжение по соглашению сторон.",
  }),
  listingContract({ listingId: "lst-27" }),
  listingContract({ listingId: "lst-28" }),
  listingContract({ listingId: "lst-29" }),
  listingContract({ listingId: "lst-32" }),
  listingContract({ listingId: "lst-31" }),
  listingContract({ listingId: "lst-33" }),
];

/** Renewal of lst-06's contract (DR-2026-055 ends in 5 days), prepared after the owner's call. */
const renewalDraft: Contract = (() => {
  const base = listingContract({ listingId: "lst-06" });
  const owner = must(ownerById.get("owner-06"), "owner-06");
  return {
    ...base,
    id: contractIdFor("DR-2026-062"),
    number: "DR-2026-062",
    status: "draft",
    templateVersion: "owner-service@2026-08",
    startsAt: day(6, "00:00"),
    endsAt: day(96, "23:59"),
    rightHolderConsents: [
      { ownerId: owner.id, status: "confirmed", consentId: must(owner.consents[0], "owner-06 consent").id },
    ],
    signatures: [],
    createdAt: day(0, "09:45"),
  };
})();

const buyerServiceContracts: Contract[] = [
  buyerContract({
    number: "DRB-2026-003",
    clientId: "cl-11",
    clientName: "Madina Ergasheva",
    requirementId: "req-12",
    signedAt: day(-58, "10:00"),
    endsAt: day(32, "23:59"),
    remuneration: { kind: "percent", percent: 1, paymentTerms: "1% от цены покупки, при регистрации сделки." },
    status: "terminated",
    terminatedAt: day(-20, "14:00"),
    terminationReason:
      "Расторгнут по просьбе клиентки: квартира куплена без агентства, согласие на связь отозвано.",
  }),
  buyerContract({
    number: "DRB-2026-009",
    clientId: "cl-07",
    clientName: "Nodira Usmonova",
    requirementId: "req-08",
    dealId: "deal-03",
    signedAt: day(-18, "12:30"),
    endsAt: day(72, "23:59"),
    remuneration: {
      kind: "percent",
      percent: 1.5,
      paymentTerms: "1,5% от цены покупки, после выдачи ипотечного кредита и регистрации сделки.",
    },
  }),
  buyerContract({
    number: "DRB-2026-010",
    clientId: "cl-08",
    clientName: "Анвар Рашидов",
    requirementId: "req-09",
    dealId: "deal-04",
    signedAt: day(-14, "10:00"),
    endsAt: day(76, "23:59"),
    remuneration: {
      kind: "fixed",
      amount: usd(2_000),
      paymentTerms: "Фиксированно $2 000: в день подписания договора купли-продажи у нотариуса.",
    },
  }),
  buyerContract({
    number: "DRB-2026-011",
    clientId: "cl-06",
    clientName: "Дмитрий Пак",
    requirementId: "req-07",
    dealId: "deal-02",
    signedAt: day(-9, "11:30"),
    endsAt: day(81, "23:59"),
    remuneration: {
      kind: "fixed",
      amount: usd(3_000),
      paymentTerms: "Фиксированно $3 000: 30% при задатке, 70% после регистрации сделки.",
    },
  }),
  buyerContract({
    number: "DRB-2026-013",
    clientId: "cl-14",
    clientName: "Виктория Ким",
    requirementId: "req-16",
    dealId: "deal-05",
    signedAt: day(-4, "13:00"),
    endsAt: day(86, "23:59"),
    remuneration: { kind: "percent", percent: 1, paymentTerms: "1% от цены покупки, после подписания акта." },
  }),
  buyerContract({
    number: "DRB-2026-014",
    clientId: "cl-02",
    clientName: "Гульнара Сафарова",
    requirementId: "req-03",
    dealId: "deal-01",
    signedAt: day(-3, "18:30"),
    endsAt: day(87, "23:59"),
    remuneration: { kind: "percent", percent: 1, paymentTerms: "1% от цены покупки, при регистрации сделки." },
  }),
  buyerContract({
    number: "DRB-2026-015",
    clientId: "cl-01",
    clientName: "Санжар Ибрагимов",
    requirementId: "req-01",
    signedAt: day(-29, "12:00"),
    endsAt: day(61, "23:59"),
    remuneration: {
      kind: "fixed",
      amount: usd(1_500),
      paymentTerms: "Фиксированно $1 500, в день регистрации договора купли-продажи.",
    },
  }),
];

/**
 * Co-broking agreements between the viewer and a partner (§15.4): the split
 * is between two professionals, never a Binor fee. Linked to the request by
 * listing and partner (and through deal-06 for coop-01).
 */
const cooperationContracts: Contract[] = [
  {
    id: contractIdFor("CO-2026-004"),
    number: "CO-2026-004",
    kind: "cooperation",
    status: "active",
    templateVersion: "cooperation@2026-07",
    service: "Совместное сопровождение сделки: сторона покупателя (Demo Realty) и сторона собственника",
    customer: { kind: "agent", id: "agent-04" },
    agentId: "agent-01",
    organizationId: "org-01",
    listingId: "lst-15",
    requirementId: "req-13",
    dealId: "deal-06",
    startsAt: day(-38, "10:00"),
    endsAt: day(52, "23:59"),
    remuneration: {
      kind: "fixed",
      amount: usd(984),
      paymentTerms:
        "Доля стороны покупателя — 40% валовой комиссии ($984 из $2 460) после подписания акта, по версии 3 условий запроса coop-01.",
    },
    clauses: { ...FULL_CLAUSES },
    rightHolderConsents: [],
    signatures: [
      { party: "agent", signerName: "agent-01", method: "qualified_electronic", signedAt: day(-38, "10:00") },
      { party: "partner", signerName: "agent-04", method: "qualified_electronic", signedAt: day(-38, "10:00") },
    ],
    createdAt: day(-38, "10:00"),
  },
  {
    id: contractIdFor("CO-2026-005"),
    number: "CO-2026-005",
    kind: "cooperation",
    status: "awaiting_signature",
    templateVersion: "cooperation@2026-07",
    service: "Совместный показ и сопровождение: сторона покупателя (Demo Realty) и сторона собственника",
    customer: { kind: "agent", id: "agent-08" },
    agentId: "agent-01",
    organizationId: "org-01",
    listingId: "lst-29",
    requirementId: "req-06",
    startsAt: day(-2, "11:00"),
    endsAt: day(88, "23:59"),
    remuneration: {
      kind: "percent",
      percent: 1.5,
      paymentTerms: "Каждой стороне 50% валовой комиссии (по 1,5% от цены) при закрытии сделки, по версии 1 запроса coop-07.",
    },
    clauses: { ...FULL_CLAUSES },
    rightHolderConsents: [],
    signatures: [
      { party: "agent", signerName: "agent-01", method: "qualified_electronic", signedAt: day(-2, "11:30") },
    ],
    createdAt: day(-2, "11:00"),
  },
];

export const contracts: Contract[] = [
  ...ownerServiceContracts,
  renewalDraft,
  ...buyerServiceContracts,
  ...cooperationContracts,
];

// Fail fast on a typo in the specs above (the seed tests check the rest).
for (const contract of contracts) must(agentById.get(contract.agentId), `agent ${contract.agentId}`);
