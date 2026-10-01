/**
 * Canonical Binor domain model (§10, §34 of the master document).
 *
 * Ground rules encoded here:
 * - Property ≠ Listing ≠ Advertisement (§10.1, §34.4). A physical flat is one
 *   Property; each agent's offer on it is a Listing; each external post is an
 *   Advertisement / TelegramListing.
 * - Money is an exact integer amount of minor units plus an ISO currency, with
 *   the original string kept for provenance. No floating-point prices (§34.1).
 * - Time is stored as ISO-8601 UTC strings and displayed in Asia/Tashkent.
 * - A "verified" state always refers to one concrete fact with a source, date
 *   and scope — never a blanket badge (§16.4, §38.2). `unavailable` ≠ verified.
 * - Unknown is a first-class value: parsers and forms never invent data.
 *
 * All enums are string-literal codes; human labels live in
 * `src/i18n/messages/domain.ts` for both RU and UZ.
 */

export type ID = string;
/** ISO-8601 instant in UTC, e.g. "2026-09-28T09:30:00.000Z". */
export type ISODateTime = string;

/* ------------------------------------------------------------------ money */

export const currencies = ["USD", "UZS"] as const;
export type Currency = (typeof currencies)[number];

export interface Money {
  /** Integer number of minor units (cents / tiyin). Always a safe integer. */
  amountMinor: number;
  currency: Currency;
  /** Original text the value was taken from, e.g. "85 000$" or "85 минг". */
  raw?: string;
}

/* ------------------------------------------------------------ geography */

export type CityId = "tashkent" | "tashkent_region";

/** The twelve districts (tumanlar) of Tashkent city. */
export const districtIds = [
  "bektemir",
  "chilanzar",
  "mirabad",
  "mirzo_ulugbek",
  "olmazor",
  "sergeli",
  "shaykhantahur",
  "uchtepa",
  "yakkasaray",
  "yangihayot",
  "yashnabad",
  "yunusabad",
] as const;
export type DistrictId = (typeof districtIds)[number];

export type GeoPrecision = "exact" | "building" | "street" | "district";

export interface GeoPoint {
  lat: number;
  lng: number;
  /** How precisely the point may be shown, driven by confidentiality (§36.4). */
  precision: GeoPrecision;
}

/* --------------------------------------------------------- vocabularies */

export const dealTypes = ["sale", "rent"] as const;
export type DealType = (typeof dealTypes)[number];

export const propertyTypes = ["apartment", "house", "commercial", "land", "room"] as const;
export type PropertyType = (typeof propertyTypes)[number];

export type BuildingKind = "new_building" | "secondary";

export type RenovationState = "shell" | "needs_repair" | "renovated" | "designer";

/** Trust priority of a data source, highest first (§13.3). */
export const sourceKinds = [
  "verified_binor",
  "realtor_confirmed",
  "agency",
  "telegram",
  "external_unconfirmed",
] as const;
export type SourceKind = (typeof sourceKinds)[number];

/** PUBLIC → PROFESSIONAL → RESTRICTED (§16.3). */
export type Confidentiality = "public" | "professional" | "restricted";

export type Language = "ru" | "uz";

/* ------------------------------------------------------------ freshness */

/** §13.4 bands plus the explicit Expired outcome from §34.6. */
export type FreshnessState = "fresh" | "normal" | "aging" | "needs_confirmation" | "expired";

export interface Freshness {
  state: FreshnessState;
  /** 0..1, 1 = confirmed today. */
  score: number;
  /** Whole days since the most recent of published / last confirmed. */
  ageDays: number;
  /** Which timestamp the age was measured from. */
  basis: "last_confirmed" | "published";
}

/* --------------------------------------------------------- verification */

export type VerificationSubject =
  | "ownership"
  | "cadastre"
  | "contract"
  | "owner_consent"
  | "encumbrance"
  | "utility_debts"
  | "agent_identity"
  | "agent_certificate"
  | "org_registry"
  | "insurance";

/** Four outcomes from §11.6; `unavailable` covers a registry that did not answer. */
export type VerificationStatus = "confirmed" | "pending" | "unavailable" | "problem";

/** Distinguishes "со слов собственника" from an official source (§11.6). */
export type VerificationMethod = "owner_statement" | "document_review" | "official_source";

export interface VerificationItem {
  id: ID;
  subject: VerificationSubject;
  status: VerificationStatus;
  method: VerificationMethod;
  /** Free-text source label, e.g. registry name or document title. */
  source: string;
  checkedAt?: ISODateTime;
  expiresAt?: ISODateTime;
  performedById?: ID;
  note?: string;
}

/* ---------------------------------------------------------------- people */

export type UserRole =
  | "individual_realtor"
  | "agency_agent"
  | "team_lead"
  | "agency_owner"
  | "agency_admin"
  | "compliance"
  | "binor_admin";

/**
 * Legal participant type under ZRU-1163 (§38.2). A "real_estate_agent" is a
 * distinct status with narrower rights than a certified realtor.
 */
export type ProfessionalStatus = "certified_realtor" | "real_estate_agent" | "unconfirmed";

export interface Organization {
  id: ID;
  name: string;
  /** Registry inclusion as a separate checkable fact, never inferred from the name. */
  registry?: VerificationItem;
  insurance?: VerificationItem;
  branchName?: string;
}

export interface Agent {
  id: ID;
  name: string;
  phone: string;
  telegramUsername?: string;
  organizationId?: ID;
  role: UserRole;
  professionalStatus: ProfessionalStatus;
  verifications: VerificationItem[];
  territory: DistrictId[];
  languages: Language[];
  /** Short initials-based avatar is generated in UI; no photos in demo data. */
}

/* ------------------------------------------------------------------ CRM */

export const leadSources = [
  "phone",
  "telegram",
  "whatsapp",
  "instagram",
  "website",
  "referral",
  "advertising",
  "portal",
  "mls",
  "manual",
  "unknown",
] as const;
export type LeadSource = (typeof leadSources)[number];

export type LeadStatus = "new" | "assigned" | "contacted" | "qualified" | "converted" | "lost";

export interface Lead {
  id: ID;
  source: LeadSource;
  receivedAt: ISODateTime;
  name?: string;
  phone?: string;
  telegramUsername?: string;
  /** Original message/transcript, kept verbatim. */
  message: string;
  language: Language;
  status: LeadStatus;
  assignedAgentId?: ID;
  /** First-response deadline computed from org SLA settings. */
  slaDueAt: ISODateTime;
  firstResponseAt?: ISODateTime;
  /** Suggested existing client when phone/Telegram/name look alike (§14.1). */
  duplicateCandidateClientId?: ID;
  lostReason?: string;
  nextAction?: string;
}

export type ClientStatus =
  | "new"
  | "contacted"
  | "selection"
  | "viewing"
  | "negotiation"
  | "deal"
  | "deferred"
  | "lost";

export type RelatedPartyRole = "spouse" | "family" | "co_owner" | "proxy" | "company_rep";

export interface RelatedParty {
  id: ID;
  name: string;
  role: RelatedPartyRole;
  phone?: string;
}

export type ConsentPurpose = "contact" | "share_with_partners" | "document_processing" | "marketing";

export interface Consent {
  id: ID;
  purpose: ConsentPurpose;
  channel: "written" | "electronic" | "verbal_recorded";
  grantedAt: ISODateTime;
  revokedAt?: ISODateTime;
  textVersion: string;
}

export interface Client {
  id: ID;
  name: string;
  phones: string[];
  telegramUsername?: string;
  language: Language;
  status: ClientStatus;
  responsibleAgentId: ID;
  source: LeadSource;
  leadId?: ID;
  household: RelatedParty[];
  consents: Consent[];
  createdAt: ISODateTime;
  lastContactAt?: ISODateTime;
  /** Remembered preferences with provenance (§14.5); editable by the agent. */
  memory: { id: ID; text: string; source: string; at: ISODateTime }[];
  nextAction?: { text: string; dueAt?: ISODateTime };
}

export interface Range<T> {
  min?: T;
  max?: T;
}

/** Criteria the user can mark as must-have (hard) instead of preference (soft). */
export type RequirementCriterion =
  | "location"
  | "price"
  | "property_type"
  | "rooms"
  | "area"
  | "floor"
  | "building_kind"
  | "renovation";

export type RequirementStatus = "active" | "paused" | "closed";

export interface Requirement {
  id: ID;
  clientId: ID;
  agentId: ID;
  organizationId?: ID;
  dealType: DealType;
  propertyTypes: PropertyType[];
  city: CityId;
  /** Empty = anywhere in the city. */
  districts: DistrictId[];
  rooms: Range<number>;
  area: Range<number>;
  budget: Range<Money> & { currency: Currency };
  floor?: { notFirst?: boolean; notLast?: boolean; min?: number; max?: number };
  buildingKind?: BuildingKind;
  renovation?: RenovationState[];
  mortgage?: boolean;
  /** Free-form must-haves, e.g. "парковка", "рядом метро". */
  extras: string[];
  /** Criteria the agent confirmed as hard constraints (§35.4 step 3). */
  hardCriteria: RequirementCriterion[];
  /** The agent's original sentence, stored verbatim (§14.4, §34.3). */
  naturalLanguageInput?: string;
  status: RequirementStatus;
  version: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ------------------------------------------------------------ inventory */

export interface Owner {
  id: ID;
  name: string;
  phone: string;
  /** Owner contact is RESTRICTED: shown only with rights/consent (§34.2). */
  confidentiality: Confidentiality;
  consents: Consent[];
}

/** A physical property, independent of who is selling it. */
export interface Property {
  id: ID;
  propertyType: PropertyType;
  city: CityId;
  district: DistrictId;
  /** Massif / mahalla / residential complex name, e.g. "Ц-5", "ЖК Tashkent City". */
  areaName?: string;
  /** Full address is RESTRICTED; `landmark` is safe to show publicly. */
  address: string;
  landmark?: string;
  geo?: GeoPoint;
  rooms?: number;
  /** Square metres. */
  areaTotal?: number;
  floor?: number;
  floorsTotal?: number;
  buildingKind?: BuildingKind;
  renovation?: RenovationState;
  yearBuilt?: number;
  cadastralNumber?: string;
  ownerId?: ID;
  createdAt: ISODateTime;
}

/** Listing lifecycle (§11.1) including the side outcomes. */
export type ListingStatus =
  | "draft"
  | "contract_signed"
  | "verification_pending"
  | "verified"
  | "active_mls"
  | "offer"
  | "under_contract"
  | "closed"
  | "archived"
  | "expired"
  | "withdrawn"
  | "suspended"
  | "verification_failed"
  | "disputed";

export interface PriceChange {
  price: Money;
  at: ISODateTime;
  byAgentId: ID;
}

/** One party's commercial offer on a Property. */
export interface Listing {
  id: ID;
  propertyId: ID;
  agentId: ID;
  organizationId?: ID;
  dealType: DealType;
  price: Money;
  /** Oldest first; the last entry equals `price`. */
  priceHistory: PriceChange[];
  status: ListingStatus;
  confidentiality: Confidentiality;
  source: SourceKind;
  exclusive: boolean;
  cooperation?: CommissionTerms;
  contractId?: ID;
  contractExpiresAt?: ISODateTime;
  verifications: VerificationItem[];
  description: string;
  photoCount: number;
  publishedAt: ISODateTime;
  lastConfirmedAt?: ISODateTime;
  expiresAt?: ISODateTime;
  updatedAt: ISODateTime;
}

/* ------------------------------------------------------------- telegram */

export interface TelegramSource {
  id: ID;
  title: string;
  /** Public channel handle without "@". */
  handle: string;
  status: "enabled" | "paused";
  lastCheckedAt: ISODateTime;
}

export interface ParsedField<T> {
  /** `undefined` means the parser could not determine it: shown as Unknown. */
  value?: T;
  /** 0..1 parser confidence for this single field. */
  confidence: number;
  /** Raw text span the value was extracted from (evidence). */
  evidence?: string;
}

/** "Продаю / Сдаю" offers an object; "Куплю / Сниму / ijaraga olaman" asks for one. */
export type PostIntent = "offer" | "demand";

export interface ParsedListingFields {
  /**
   * Set only when the post asks for an object: a buyer's or tenant's request
   * is demand, never supply, and is not matched against requirements (§10.1).
   */
  intent?: ParsedField<PostIntent>;
  dealType: ParsedField<DealType>;
  propertyType: ParsedField<PropertyType>;
  district: ParsedField<DistrictId>;
  rooms: ParsedField<number>;
  areaTotal: ParsedField<number>;
  floor: ParsedField<number>;
  floorsTotal: ParsedField<number>;
  price: ParsedField<Money>;
  phone: ParsedField<string>;
}

export type TelegramListingStatus = "new" | "saved" | "hidden" | "converted" | "reported_stale";

/** A discovered publication — never automatically a verified Property (§34.2). */
export interface TelegramListing {
  id: ID;
  sourceId: ID;
  messageId: number;
  /** Canonical https://t.me/<handle>/<messageId> link. */
  sourceUrl: string;
  rawText: string;
  mediaCount: number;
  publishedAt: ISODateTime;
  receivedAt: ISODateTime;
  parsed: ParsedListingFields;
  parserVersion: string;
  /** Suggested duplicates with reasons; merge is always a human decision. */
  duplicateCandidates: {
    listingId: ID;
    reasons: DuplicateSignal[];
    /** Attributes known on both sides that disagree, e.g. a different floor (§34.5). */
    conflicts?: DedupConflict[];
    /** Dedup engine score 0..100, kept for ordering and audit; never shown without the reasons. */
    score?: number;
  }[];
  status: TelegramListingStatus;
  linkedClientIds: ID[];
}

export type DuplicateSignal =
  | "same_phone"
  | "same_district"
  | "same_rooms"
  | "similar_area"
  | "similar_price"
  | "same_floor"
  | "similar_text"
  | "same_media";

/** Attributes known on both records that disagree, reported next to the signals (§34.5). */
export type DedupConflict = "deal_type" | "district" | "rooms" | "area" | "floor";

/* ------------------------------------------------------------- matching */

export type MatchCriterion =
  | "location"
  | "price"
  | "property_type"
  | "rooms"
  | "area"
  | "floor"
  | "extras";

export type ReasonOutcome = "match" | "partial" | "mismatch" | "unknown";

/**
 * Machine-readable explanation of one criterion. The UI turns it into text
 * such as "На $8 000 дороже бюджета" (§12.4) — never a bare score.
 */
export interface MatchReason {
  criterion: MatchCriterion;
  outcome: ReasonOutcome;
  /** 0..1 credit awarded for this criterion. */
  credit: number;
  /** Weight in percent points (§12.3). */
  weight: number;
  /** False when the requirement does not constrain this criterion at all. */
  requested: boolean;
  detail?:
    | { kind: "price_over"; by: Money; converted?: { from: Currency; to: Currency } }
    | { kind: "price_under"; by: Money; converted?: { from: Currency; to: Currency } }
    | { kind: "price_within" }
    | { kind: "price_converted"; from: Currency; to: Currency }
    | { kind: "district_exact"; district: DistrictId }
    | { kind: "district_adjacent"; district: DistrictId }
    | { kind: "district_other"; district: DistrictId }
    | { kind: "rooms_off_by"; delta: number }
    | { kind: "area_off_by"; deltaSqm: number }
    | { kind: "floor_first" }
    | { kind: "floor_last" }
    | { kind: "floor_out_of_range"; floor: number }
    | { kind: "building_kind_mismatch"; expected: BuildingKind; actual: BuildingKind }
    | { kind: "renovation_mismatch"; actual: RenovationState }
    /** `renovationUnknown`: a renovation was requested and the candidate does not state it. */
    | { kind: "extras"; matched: string[]; missing: string[]; renovationUnknown?: true }
    | { kind: "missing_data" };
}

export type HardFilterFailure =
  | "deal_type"
  | "city"
  | "property_type"
  | "budget_out_of_range"
  | "inactive_source"
  | "hard_criterion";

export type ConfidenceBand = "excellent" | "good" | "possible" | "hidden";

export type MatchStatus =
  | "new"
  | "notified"
  | "viewed"
  | "contacted"
  | "negotiation"
  | "accepted"
  | "deal_in_progress"
  | "won"
  | "rejected"
  | "expired"
  | "duplicate"
  | "cancelled";

export type MatchRejectionReason = "price" | "location" | "condition" | "stale" | "other";

export type MatchTarget = { kind: "listing"; id: ID } | { kind: "telegram"; id: ID };

export interface Match {
  id: ID;
  requirementId: ID;
  target: MatchTarget;
  /** 0..100 integer, reproducible from inputs. */
  score: number;
  band: ConfidenceBand;
  reasons: MatchReason[];
  freshness: Freshness;
  source: SourceKind;
  status: MatchStatus;
  rejectionReason?: MatchRejectionReason;
  /** Input versions so a change can invalidate the match (§34.3). */
  requirementVersion: number;
  createdAt: ISODateTime;
  notifiedAt?: ISODateTime;
  viewedAt?: ISODateTime;
}

/* ---------------------------------------------------------- cooperation */

export type SplitPreset = "50/50" | "70/30" | "80/20" | "custom";

/**
 * Commission split between two professionals — not a Binor fee (§7.4, §41 D10).
 * A bare "70/30" is not enough (§35.6): roles, basis, currency, payout
 * condition and deadline are explicit.
 */
export interface CommissionTerms {
  preset: SplitPreset;
  /** Percent of the basis going to the listing side (owner's agent). */
  listingSidePercent: number;
  /** Percent going to the buyer/tenant side (client's agent). Sums to 100. */
  buyerSidePercent: number;
  basis: "gross_commission" | "fixed_amount";
  /** Required when basis is fixed_amount. */
  fixedAmount?: Money;
  currency: Currency;
  payoutCondition: "on_deal_closing" | "on_act_signed" | "custom";
  payoutNote?: string;
}

export type CooperationStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "negotiation"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled"
  | "disputed";

export interface TermsVersion {
  version: number;
  terms: CommissionTerms;
  proposedById: ID;
  proposedAt: ISODateTime;
  note?: string;
}

/**
 * How the requesting agent takes part (§35.6 step 2): leading the client
 * personally, or referring the client to another agent. Both are the client
 * side in the commission split.
 */
export type CooperationInitiatorRole = "buyer_agent" | "referral_partner";

export interface CooperationRequest {
  id: ID;
  listingId: ID;
  requirementId?: ID;
  /** The agent who asks to cooperate (usually the buyer's agent). */
  fromAgentId: ID;
  /** The requesting agent's role; absent on records that never stated it (unknown). */
  initiatorRole?: CooperationInitiatorRole;
  /** The listing agent. */
  toAgentId: ID;
  status: CooperationStatus;
  /** Every proposal is a new version; history is never rewritten. */
  versions: TermsVersion[];
  acceptedVersion?: number;
  respondBy: ISODateTime;
  /** What the partner can currently see (§18.2 privacy by stage). */
  disclosure: "masked" | "contacts_shared";
  createdAt: ISODateTime;
}

/* ---------------------------------------------------------- transaction */

export type ViewingStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface Viewing {
  id: ID;
  listingId: ID;
  clientId: ID;
  agentId: ID;
  partnerAgentId?: ID;
  startsAt: ISODateTime;
  durationMinutes: number;
  status: ViewingStatus;
  confirmations: { client: boolean; ownerOrPartner: boolean };
  feedback?: { rating: 1 | 2 | 3 | 4 | 5; text: string };
  /** Mandatory after a completed viewing (§14.8). */
  nextAction?: string;
}

export type OfferStatus = "open" | "countered" | "accepted" | "declined" | "expired" | "withdrawn";

export interface OfferVersion {
  version: number;
  amount: Money;
  by: "buyer" | "owner";
  at: ISODateTime;
  expiresAt?: ISODateTime;
  note?: string;
}

export interface Offer {
  id: ID;
  listingId: ID;
  clientId: ID;
  dealId?: ID;
  status: OfferStatus;
  versions: OfferVersion[];
}

/** Deal lifecycle (§11.7). */
export const dealStages = [
  "qualification",
  "viewing",
  "offer",
  "negotiation",
  "under_contract",
  "verification",
  "closing",
  "act",
  "commission",
  "archived",
] as const;
export type DealStage = (typeof dealStages)[number];

export type DocumentSensitivity = "normal" | "restricted";

export interface DealDocument {
  id: ID;
  type:
    | "service_contract"
    | "owner_consent"
    | "ownership_certificate"
    | "cadastre_extract"
    | "passport_copy"
    | "sale_agreement"
    | "completion_act"
    | "other";
  status: "missing" | "uploaded" | "verified" | "rejected";
  sensitivity: DocumentSensitivity;
  uploadedAt?: ISODateTime;
}

export interface ChecklistItem {
  id: ID;
  /** Key into the deals message namespace. */
  labelKey: string;
  required: boolean;
  doneAt?: ISODateTime;
  doneById?: ID;
}

export interface AuditEvent {
  id: ID;
  at: ISODateTime;
  actorId: ID;
  action: string;
  target: { kind: string; id: ID };
  reason?: string;
}

export interface Deal {
  id: ID;
  listingId: ID;
  clientId: ID;
  agentId: ID;
  partnerAgentId?: ID;
  cooperationId?: ID;
  stage: DealStage;
  agreedPrice?: Money;
  checklist: ChecklistItem[];
  documents: DealDocument[];
  commission?: {
    terms: CommissionTerms;
    gross?: Money;
    /** Accrued ≠ paid (§35.2 row 11). */
    payoutRecordedAt?: ISODateTime;
  };
  /** Act details must reach the MLS within 3 working days (§17.5, §38.5). */
  actSignedAt?: ISODateTime;
  mlsReportedAt?: ISODateTime;
  nextAction?: { text: string; dueAt?: ISODateTime };
  audit: AuditEvent[];
  createdAt: ISODateTime;
}

/* ------------------------------------------------------ tasks & signals */

/** What a task or notification points at; `match` ids are `${requirementId}--${targetId}`. */
export type EntityRef =
  | { kind: "lead"; id: ID }
  | { kind: "client"; id: ID }
  | { kind: "requirement"; id: ID }
  | { kind: "match"; id: ID }
  | { kind: "listing"; id: ID }
  | { kind: "deal"; id: ID }
  | { kind: "viewing"; id: ID }
  | { kind: "cooperation"; id: ID }
  | { kind: "telegram"; id: ID };

export interface Task {
  id: ID;
  title: string;
  dueAt: ISODateTime;
  assigneeId: ID;
  status: "open" | "done" | "snoozed";
  priority: "high" | "normal";
  related?: EntityRef;
}

/** Grouped by meaning, not by source (§36.5). */
export type NotificationCategory = "action" | "clients" | "matches" | "deals" | "system";

export type NotificationKind =
  | "new_match"
  | "price_drop"
  | "cooperation_request"
  | "cooperation_answered"
  | "viewing_confirmed"
  | "deal_stage_changed"
  | "task_overdue"
  | "contract_expiring"
  | "listing_stale"
  | "sla_breach"
  | "security";

export interface AppNotification {
  id: ID;
  category: NotificationCategory;
  kind: NotificationKind;
  at: ISODateTime;
  read: boolean;
  related?: EntityRef;
  /** Short context line in the source data language; UI adds the localized title. */
  context: string;
}

/* ------------------------------------------------------------ contracts */

/**
 * Service contract (§17.5, §38.5). `number` is the document reference that a
 * Listing carries in `contractId`. The UI never treats a button press as a
 * qualified electronic signature (§38.5): the signature method is explicit.
 */
export type ContractKind = "owner_service" | "buyer_service" | "cooperation";

/** `expiring` is derived from `endsAt`, never stored. */
export type ContractStatus = "draft" | "awaiting_signature" | "active" | "expired" | "terminated";

export type SignatureMethod = "paper" | "simple_electronic" | "qualified_electronic";

export interface ContractSignature {
  party: "customer" | "agent" | "organization_head" | "partner";
  /** Person who signed: an agent id, or the customer's display name. */
  signerName: string;
  method: SignatureMethod;
  signedAt: ISODateTime;
}

export interface ContractRemuneration {
  kind: "percent" | "fixed";
  /** Percent of the deal price when kind is "percent". */
  percent?: number;
  amount?: Money;
  /** When and how the fee is paid, as agreed in the contract text. */
  paymentTerms: string;
}

export interface Contract {
  id: ID;
  /** Human document number, e.g. "DR-2026-057"; equals Listing.contractId. */
  number: string;
  kind: ContractKind;
  status: ContractStatus;
  /** Template version the text was generated from (§39.3). */
  templateVersion: string;
  /** Description of the service (вид услуги). */
  service: string;
  customer: { kind: "owner"; id: ID } | { kind: "client"; id: ID } | { kind: "agent"; id: ID };
  agentId: ID;
  organizationId?: ID;
  listingId?: ID;
  requirementId?: ID;
  dealId?: ID;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  remuneration: ContractRemuneration;
  /** Clauses the law requires (§38.5); `false` = missing from this contract. */
  clauses: {
    certificateDetails: boolean;
    membershipDetails: boolean;
    insuranceDetails: boolean;
    rightsAndObligations: boolean;
    liability: boolean;
    terminationAndRefund: boolean;
    confidentiality: boolean;
  };
  /**
   * Art. 37: a property contract needs consent from every right holder.
   * One entry per right holder; consent of one is not consent of the others.
   */
  rightHolderConsents: { ownerId: ID; status: "confirmed" | "missing"; consentId?: ID }[];
  signatures: ContractSignature[];
  terminatedAt?: ISODateTime;
  terminationReason?: string;
  createdAt: ISODateTime;
}

/* ------------------------------------------------------- communications */

export type CommunicationChannel = "phone" | "telegram" | "whatsapp" | "instagram" | "email" | "meeting";

/** Recording needs separate consent and a legal basis (§36.5). */
export type RecordingConsent = "granted" | "refused" | "not_requested";

export interface CallSummary {
  /** AI output is an assistant draft until a person confirms it (§14.7). */
  status: "draft" | "confirmed";
  text: string;
  /** Requirement-like phrase extracted from the call, if any (verbatim). */
  extractedRequest?: string;
  generatedAt: ISODateTime;
  confirmedAt?: ISODateTime;
  confirmedById?: ID;
}

export interface Call {
  id: ID;
  direction: "inbound" | "outbound";
  /** Missed inbound calls have durationSeconds 0 and outcome "missed". */
  outcome: "answered" | "missed" | "no_answer" | "busy";
  /** Number as dialled or shown by the operator, kept verbatim. */
  phone: string;
  agentId: ID;
  startedAt: ISODateTime;
  durationSeconds: number;
  leadId?: ID;
  clientId?: ID;
  ownerId?: ID;
  listingId?: ID;
  recording: { consent: RecordingConsent; available: boolean };
  /** Transcript exists only when recording consent was granted. */
  transcript?: string;
  summary?: CallSummary;
  /** Agent's own note, not AI. */
  note?: string;
  nextAction?: { text: string; dueAt?: ISODateTime };
}

/** One touchpoint on a client/owner timeline (§36.5): channel, time, result, next step. */
export interface Communication {
  id: ID;
  channel: CommunicationChannel;
  direction: "inbound" | "outbound";
  at: ISODateTime;
  agentId: ID;
  clientId?: ID;
  ownerId?: ID;
  leadId?: ID;
  callId?: ID;
  summary: string;
  nextStep?: string;
  /** Link to the original message when the channel allows it. */
  originalUrl?: string;
}

/* ------------------------------------------------------- teams & routing */

export interface Team {
  id: ID;
  organizationId: ID;
  name: string;
  branchName?: string;
  leadAgentId: ID;
  memberIds: ID[];
}

export type AvailabilityStatus = "available" | "busy" | "away";

export interface AgentAvailability {
  agentId: ID;
  status: AvailabilityStatus;
  awayUntil?: ISODateTime;
  /** New leads the agent can take per day (capacity, §36.5). */
  dailyLeadCapacity: number;
  specializations: PropertyType[];
}

/** How a matching rule picks the agent (§14.2). */
export type RoutingStrategy = "manual" | "round_robin" | "least_loaded" | "fixed_agent";

export interface RoutingRule {
  id: ID;
  organizationId: ID;
  name: string;
  /** Lower number = evaluated first. */
  priority: number;
  active: boolean;
  /** Every listed dimension must match; an omitted dimension matches anything. */
  when: {
    sources?: LeadSource[];
    languages?: Language[];
    districts?: DistrictId[];
    dealTypes?: DealType[];
    propertyTypes?: PropertyType[];
  };
  strategy: RoutingStrategy;
  /** Candidate agents; `fixed_agent` uses the first one. */
  agentIds: ID[];
}
