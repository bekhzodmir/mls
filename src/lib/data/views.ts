import type { MatchSort, RankedMatch } from "@/lib/domain/matching";
import type { MlsReportState } from "@/lib/domain/lifecycle";
import type {
  Agent,
  AgentAvailability,
  AppNotification,
  AuditEvent,
  AvailabilityStatus,
  Call,
  Client,
  ClientStatus,
  CommunicationChannel,
  Communication,
  ConfidenceBand,
  Consent,
  ConsentPurpose,
  Contract,
  ContractKind,
  ContractStatus,
  CooperationRequest,
  Currency,
  Deal,
  DealStage,
  DealType,
  DistrictId,
  Freshness,
  FreshnessState,
  ID,
  ISODateTime,
  Lead,
  LeadStatus,
  Listing,
  ListingStatus,
  MatchReason,
  MatchRejectionReason,
  MatchStatus,
  Money,
  NotificationCategory,
  Offer,
  OfferStatus,
  OfferVersion,
  Organization,
  Owner,
  Property,
  PropertyType,
  Range,
  Requirement,
  RequirementCriterion,
  RequirementStatus,
  RoutingRule,
  SourceKind,
  Task,
  Team,
  TelegramListing,
  TelegramListingStatus,
  TelegramSource,
  TermsVersion,
  VerificationItem,
  VerificationStatus,
  VerificationSubject,
  Viewing,
  ViewingStatus,
  DuplicateSignal,
} from "@/lib/domain/types";

/**
 * Read models returned by `src/lib/data/repository.ts`. Screens render these
 * instead of joining raw seed records themselves, so access rules (§16.3,
 * §18.2, §36.4) are applied once, before data reaches the UI.
 *
 * Every view is a plain serializable object (safe to pass from a Server
 * Component to a Client Component) and a fresh copy per call.
 */

/* ---------------------------------------------------------------- codes */

/**
 * Checklist `labelKey` values used by seeded deals. The deals message
 * namespace must provide a label for each (RU and UZ).
 */
export const CHECKLIST_LABEL_KEYS = [
  "checklist.service_contract",
  "checklist.owner_consent",
  "checklist.ownership_check",
  "checklist.encumbrance_check",
  "checklist.final_price",
  "checklist.act_signed",
  "checklist.mls_report",
] as const;
export type ChecklistLabelKey = (typeof CHECKLIST_LABEL_KEYS)[number];

/** `AuditEvent.action` codes used by seeded deals (labels belong to the deals namespace). */
export const AUDIT_ACTIONS = [
  "deal.created",
  "deal.stage_changed",
  "document.uploaded",
  "document.viewed",
  "offer.accepted",
  "offer.version_added",
  "cooperation.accepted",
  "verification.requested",
  "act.signed",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * `AuditEvent.action` codes of the organization journal (§17.6, §36.5,
 * §38.6 item 7, §39.6). Separate from the deal codes above; the audit screen
 * labels both sets. The log is append-only: nothing is edited or removed.
 */
export const ORG_AUDIT_ACTIONS = [
  "contact_revealed",
  "owner_contact_viewed",
  "restricted_document_viewed",
  "export_requested",
  "permission_granted",
  "permission_revoked",
  "role_changed",
  "responsible_changed",
  "listing_status_changed",
  "contract_signed",
  "consent_revoked",
  "cooperation_accepted",
  "lead_assigned",
  "records_merged",
  "merge_undone",
  "verification_requested",
  "login_new_device",
] as const;
export type OrgAuditAction = (typeof ORG_AUDIT_ACTIONS)[number];

/** `AuditEvent.target.kind` values used by the organization journal. */
export const ORG_AUDIT_TARGET_KINDS = [
  "lead",
  "client",
  "owner",
  "listing",
  "contract",
  "document",
  "agent",
  "consent",
  "cooperation",
  "deal",
  "export",
  "session",
] as const;
export type OrgAuditTargetKind = (typeof ORG_AUDIT_TARGET_KINDS)[number];

/** `AuditEvent.actorId` of automatic actions (expiry, scheduled jobs): not a person. */
export const SYSTEM_ACTOR_ID = "system";

/* ---------------------------------------------------------------- people */

export interface ViewerView {
  agent: Agent;
  organization?: Organization;
}

/* ------------------------------------------------------------- listings */

/**
 * How the viewer relates to a listing:
 * - `owner` — the viewer's own listing;
 * - `agency` — a colleague's listing in the viewer's organization;
 * - `partner_shared` — another party's listing where a cooperation request
 *   with the viewer was accepted and contacts are shared (§18.2);
 * - `partner_masked` — another party's MLS listing before any agreement:
 *   the full address, cadastral number and owner stay hidden.
 *
 * The full address is returned for `owner`, `agency` and `partner_shared`.
 * Owner contacts, the contract and the cadastral number (RESTRICTED, §34.2)
 * need more: see `ListingView.ownerData`.
 */
export type ListingAccess = "owner" | "agency" | "partner_shared" | "partner_masked";

/**
 * A Property as the viewer may see it. Restricted fields are removed — not
 * blanked or faked — when access does not allow them: `address`,
 * `cadastralNumber` and `ownerId` are then undefined and the point is
 * coarsened to district precision (§16.3, §36.4).
 */
export type PropertyView = Omit<Property, "address"> & { address?: string };

export interface ListingView {
  listing: Listing;
  property: PropertyView;
  agent: Agent;
  organization?: Organization;
  freshness: Freshness;
  access: ListingAccess;
  /**
   * Whether the viewer may see sensitive owner data — owner, contract,
   * cadastral number (§19): their own listing, or agency management for a
   * colleague's. Other colleagues see the listing without it.
   */
  ownerData: boolean;
  /** Other listings on the same physical property that the viewer can see (Property ≠ Listing). */
  otherListingsOnProperty: number;
}

export interface ListingFilter {
  /**
   * - `mine`: the viewer's own listings (any status);
   * - `agency`: the viewer's organization, including restricted ones;
   * - `mls`: listings shared to the MLS by anyone (not restricted, not draft or archived);
   * - `all` (default): everything the viewer may see.
   */
  scope?: "mine" | "agency" | "mls" | "all";
  dealType?: DealType;
  propertyType?: PropertyType;
  district?: DistrictId;
  roomsMin?: number;
  roomsMax?: number;
  /**
   * Maximum price in major units of `currency` (USD when omitted). Listings
   * priced in the other currency are excluded rather than silently converted.
   */
  priceMax?: number;
  currency?: Currency;
  source?: SourceKind;
  freshness?: FreshnessState;
  status?: ListingStatus;
  /** Free text: same rules as `searchAll`. */
  q?: string;
}

/** A requirement that a listing or post fits (reverse matching, §12.5). */
export interface ReverseMatchView {
  requirement: Requirement;
  client: Client;
  score: number;
  band: ConfidenceBand;
  reasons: MatchReason[];
}

export interface ListingDetailView extends ListingView {
  /** Present only when `ownerData` allows it. */
  owner?: Owner;
  otherListings: ListingView[];
  viewings: ViewingView[];
  offers: OfferView[];
  /** The viewer's active requirements this listing fits, best first. */
  reverseMatches: ReverseMatchView[];
  cooperation: CooperationView[];
}

export interface ExpiringContractView {
  view: ListingView;
  expiresAt: ISODateTime;
  /** Whole days left, rounded down; 0 = expires today. */
  daysLeft: number;
}

export interface PriceDropView {
  view: ListingView;
  previous: Money;
  current: Money;
  changedAt: ISODateTime;
  /** How many of the viewer's active requirements the listing fits now. */
  affectedRequirementsCount: number;
}

/* ------------------------------------------------------------- telegram */

export interface TelegramListingView {
  post: TelegramListing;
  source: TelegramSource;
  freshness: Freshness;
}

export interface TelegramListingDetailView extends TelegramListingView {
  /** Suggested duplicates with their signals; merging is a human decision (§13.5). */
  duplicates: { view: TelegramListingView; reasons: DuplicateSignal[] }[];
  linkedClients: Client[];
  reverseMatches: ReverseMatchView[];
}

export interface TelegramFilter {
  status?: TelegramListingStatus;
  district?: DistrictId;
  dealType?: DealType;
  q?: string;
}

/* ------------------------------------------------------------- matching */

export type MatchTargetView =
  | { kind: "listing"; view: ListingView }
  | { kind: "telegram"; view: TelegramListingView };

export interface MatchView {
  /** Stable id `${requirementId}--${targetId}`, usable in URLs. */
  id: string;
  requirement: Requirement;
  client: Client;
  /** Score, band, per-criterion reasons and freshness — explain with reasons, not the score (§12.4). */
  ranked: RankedMatch;
  target: MatchTargetView;
  /** The agent's reaction; "new" when nothing was recorded. */
  status: MatchStatus;
  rejectionReason?: MatchRejectionReason;
  statusAt?: ISODateTime;
}

export interface MatchOptions {
  sort?: MatchSort;
  /** Include parsed Telegram posts (default true). */
  includeTelegram?: boolean;
}

export interface MatchFeedFilter {
  band?: ConfidenceBand;
  status?: MatchStatus;
}

export interface MatchSummary {
  total: number;
  byBand: Record<Exclude<ConfidenceBand, "hidden">, number>;
  /** Best three that were not rejected or marked duplicate. */
  top: MatchView[];
}

/* ------------------------------------------------------------------ CRM */

export type LeadSlaState =
  /** No first response and the deadline passed. */
  | "breached"
  /** No first response, deadline within 60 minutes. */
  | "due_soon"
  | "on_track"
  /** First response recorded (see `respondedLate`). */
  | "responded"
  /** Converted or lost without a recorded response. */
  | "closed";

export interface LeadSla {
  state: LeadSlaState;
  dueAt: ISODateTime;
  /** Minutes to the deadline; negative once breached. */
  minutesLeft: number;
  respondedLate?: boolean;
}

export interface LeadView {
  lead: Lead;
  assignedAgent?: Agent;
  /** "Похоже, этот человек уже есть в CRM" (§14.1) — a suggestion, never an automatic merge. */
  duplicateCandidate?: Client;
  sla: LeadSla;
}

export interface LeadFilter {
  status?: LeadStatus;
}

export interface ClientListItem {
  client: Client;
  responsibleAgent: Agent;
  requirements: Requirement[];
}

export interface ClientFilter {
  status?: ClientStatus;
  q?: string;
}

export interface RequirementView {
  requirement: Requirement;
  client: Client;
  agent: Agent;
  /** Visible matches right now (all zero for paused/closed requirements). */
  matchCounts: MatchSummary["byBand"] & { total: number };
}

export interface RequirementFilter {
  clientId?: ID;
  status?: RequirementStatus;
}

export interface ClientDetailView {
  client: Client;
  responsibleAgent: Agent;
  lead?: Lead;
  requirements: RequirementView[];
  viewings: ViewingView[];
  offers: OfferView[];
  deals: DealView[];
  tasks: TaskView[];
  /** Across the client's active requirements. */
  matches: MatchSummary;
}

/* ---------------------------------------------------------- cooperation */

/**
 * The buyer request behind a cooperation request, within the allowed
 * disclosure (§15.3, §18.2): criteria are always shared, the client's name
 * only when the viewer owns the requirement or contacts were shared.
 */
export interface RequirementSummary {
  id: ID;
  dealType: DealType;
  propertyTypes: PropertyType[];
  districts: DistrictId[];
  rooms: Range<number>;
  area: Range<number>;
  budget: Requirement["budget"];
  hardCriteria: RequirementCriterion[];
  disclosed: boolean;
  clientName?: string;
}

export interface CooperationView {
  request: CooperationRequest;
  /** Incoming = the viewer is the listing agent being asked. */
  direction: "incoming" | "outgoing";
  listing: ListingView;
  fromAgent: Agent;
  toAgent: Agent;
  fromOrganization?: Organization;
  toOrganization?: Organization;
  /** The other professional. */
  counterpart: Agent;
  requirement?: RequirementSummary;
  latest: TermsVersion;
  accepted?: TermsVersion;
  /** The latest proposal waits for the viewer's answer. */
  awaitingViewer: boolean;
  /** The response deadline passed. */
  overdue: boolean;
}

export interface CooperationFilter {
  direction?: "incoming" | "outgoing";
}

/* ---------------------------------------------------------- transaction */

export interface ViewingView {
  viewing: Viewing;
  listing: ListingView;
  client: Client;
  agent: Agent;
  partner?: Agent;
  /** Other non-cancelled viewings of the same agent that overlap in time (§36.3). */
  conflictsWith: ID[];
}

export interface ViewingFilter {
  /** Inclusive lower bound on `startsAt`. */
  fromIso?: ISODateTime;
  /** Exclusive upper bound on `startsAt`. */
  toIso?: ISODateTime;
  status?: ViewingStatus;
}

export interface OfferView {
  offer: Offer;
  listing: ListingView;
  client: Client;
  latest: OfferVersion;
  /** The deal the offer belongs to, when the viewer runs it (`offer.dealId` is the raw link). */
  deal?: { id: ID; stage: DealStage };
  /**
   * Whose answer the latest version waits for while the offer is open or
   * countered: the other side of `latest.by`. Undefined once decided.
   */
  awaitingSide?: "buyer" | "owner";
  /** The latest version's response deadline passed while still awaiting an answer. */
  responseOverdue: boolean;
}

export interface OfferFilter {
  listingId?: ID;
  clientId?: ID;
  dealId?: ID;
  status?: OfferStatus;
}

export interface DealView {
  deal: Deal;
  listing: ListingView;
  client: Client;
  agent: Agent;
  partner?: Agent;
  /** Listed deal documents still missing or rejected. */
  missingRequiredDocuments: number;
  nextActionOverdue: boolean;
  /** 3-working-day MLS reporting window for deals made through the MLS (§17.5). */
  mlsReport: MlsReportState;
}

export interface DealDetailView extends DealView {
  /** The property's owner, only when the listing's `ownerData` allows it (RESTRICTED, §34.2). */
  owner?: Owner;
  offers: OfferView[];
  viewings: ViewingView[];
  cooperation?: CooperationView;
  tasks: TaskView[];
  /**
   * The organization's contracts concluded for this deal (`contract.dealId`):
   * the client's service contract and a co-broking agreement, in contract-list
   * order. A partner's contracts are never included.
   */
  contracts: ContractView[];
}

/* ----------------------------------------------------- tasks & signals */

export type TaskState = "overdue" | "today" | "upcoming" | "done" | "snoozed";

export interface TaskView {
  task: Task;
  state: TaskState;
  /** Person the task is about (lead / client / deal / viewing), if any. */
  relatedName?: string;
}

export interface TaskFilter {
  status?: Task["status"];
}

export interface NotificationFilter {
  category?: NotificationCategory;
}

export type NotificationView = AppNotification;

/* ---------------------------------------------------------------- today */

/** Home / Today workspace blocks in priority order (§9.4, §22.1, §36.2). */
export interface TodayFeed {
  viewer: ViewerView;
  generatedAt: ISODateTime;
  overdueTasks: TaskView[];
  todayTasks: TaskView[];
  todayViewings: ViewingView[];
  /** SLA breached or due within 60 minutes. */
  slaLeads: LeadView[];
  /** Top 5 new excellent/good matches. */
  newMatches: MatchView[];
  /** Sent / viewed / negotiation requests waiting for the viewer. */
  incomingCooperation: CooperationView[];
  /** The viewer's contracts ending within 14 days. */
  expiringContracts: ExpiringContractView[];
  /** The viewer's listings that need confirmation or expired. */
  staleListings: ListingView[];
  /** Price decreases in the last 7 days. */
  priceDrops: PriceDropView[];
  /** Missing documents, overdue next action or MLS report due. */
  dealsNeedingAttention: DealView[];
  /** The viewer's own missed calls, newest first: someone is waiting for a call back (§14.7). */
  missedCalls: CallView[];
}

/* --------------------------------------------------------------- search */

export interface SearchResults {
  query: string;
  clients: ClientListItem[];
  leads: LeadView[];
  listings: ListingView[];
  telegram: TelegramListingView[];
  deals: DealView[];
}

/* ---------------------------------------------------- shared access bits */

/**
 * Why a contact (phone, Telegram) is not in a view. Views omit the value —
 * never blank or fake it — and say why, so the UI can explain the missing
 * permission and the next step (§19).
 */
export type ContactHiddenReason =
  /** Owner contacts are RESTRICTED (§34.2): the listing's own agent or agency management. */
  | "owner_data_permission"
  /** A partner's contacts open after an accepted cooperation with shared contacts (§18.2). */
  | "no_accepted_cooperation"
  /** Another agent's client or lead (§19 "Own/assigned"). */
  | "not_responsible";

/** Where a record sits relative to the viewer (§19 levels). */
export type RecordScope = "own" | "agency";

/** A person a call, communication, contract or consent is about, by name only. */
export interface SubjectRef {
  kind: "lead" | "client" | "owner";
  id: ID;
  /** Leads may have no name: Unknown is a value, never invented. */
  name?: string;
}

/**
 * A verification fact as the viewer may see it. "Result only" (§19
 * "Verification: Result only") drops `source`, `note` and `performedById`:
 * a source can name a contract and a note an ownership problem.
 */
export type VerificationResult = Omit<VerificationItem, "source" | "note" | "performedById"> &
  Partial<Pick<VerificationItem, "source" | "note" | "performedById">>;

/* ------------------------------------------------------------ contracts */

export interface ContractFilter {
  /** `expiring` = active and ending within 14 Tashkent calendar days (today included). */
  status?: ContractStatus | "expiring";
  kind?: ContractKind;
  /** Number, customer name, service, massif/landmark of the listing. */
  q?: string;
}

/** The contract's customer: an owner, a buyer/tenant client or a partner agent. */
export interface ContractPartyView {
  kind: "owner" | "client" | "agent";
  id: ID;
  name: string;
  /** Present only when the viewer may see this party's contact. */
  phone?: string;
  contactHidden?: ContactHiddenReason;
}

/** One right holder of the property (art. 37): consent of one is not consent of the others. */
export interface RightHolderView {
  ownerId: ID;
  name: string;
  status: "confirmed" | "missing";
  /** The consent record behind a confirmed entry, when it is on file. */
  consent?: Consent;
  /** The contract's customer (vs. a co-owner or another right holder). */
  isCustomer: boolean;
}

export interface ContractView {
  contract: Contract;
  /** `own` = the viewer is the contract's agent; `agency` = a colleague's. */
  scope: RecordScope;
  customer: ContractPartyView;
  agent: Agent;
  organization?: Organization;
  /** The listing the contract serves, as the viewer may see it. */
  listing?: ListingView;
  rightHolders: RightHolderView[];
  /** Active and ending within 14 Tashkent calendar days (today included). */
  expiring: boolean;
  /** Tashkent calendar days from today to `endsAt`: 0 = ends today, negative = ended. */
  daysLeft: number;
  /**
   * Required clauses the text lacks (§38.5), in `CONTRACT_CLAUSES` order from
   * `@/lib/domain/contracts`; empty when complete.
   */
  missingClauses: (keyof Contract["clauses"])[];
  /** Right holders whose consent is missing (art. 37). */
  missingConsents: number;
  /**
   * Some signature is a simple electronic one: the UI must not present it as
   * a qualified e-signature (§38.5) and shows the legal warning.
   */
  hasSimpleElectronicSignature: boolean;
}

export interface ContractDetailView extends ContractView {
  deal?: DealView;
  requirement?: Requirement;
  /** The co-broking request behind a cooperation contract (matched by listing and partner). */
  cooperation?: CooperationView;
  /** Other visible contracts on the same listing (e.g. a renewal draft), newest first. */
  related: ContractView[];
}

/* ------------------------------------------------------------- consents */

export interface ConsentFilter {
  subject?: "client" | "owner";
  purpose?: ConsentPurpose;
  state?: "active" | "revoked";
}

/** One row of the consent registry (§38.6 item 2): text version, channel, timestamp, revocation. */
export interface ConsentRegistryItem {
  subject: { kind: "client" | "owner"; id: ID; name: string };
  consent: Consent;
  state: "active" | "revoked";
  /** The client's responsible agent, or the agent of the owner's listing/contract. */
  responsibleAgent: Agent;
  scope: RecordScope;
}

/* --------------------------------------------------------------- owners */

export interface OwnerFilter {
  /** Name, property massif/landmark, listing id; phone digits only where the contact is visible. */
  q?: string;
}

/** An owner record without the phone unless the viewer may see it (§34.2). */
export type OwnerRecordView = Omit<Owner, "phone"> & { phone?: string };

export interface OwnerListItem {
  owner: OwnerRecordView;
  /** `own` = linked to the viewer's own listing or contract. */
  scope: RecordScope;
  contactVisible: boolean;
  contactHidden?: "owner_data_permission";
  responsibleAgent: Agent;
  /** The viewer's organization's listings on the owner's properties. */
  listingIds: ID[];
  propertyIds: ID[];
  /** Visible contracts where the owner is the customer or a right holder. */
  contractIds: ID[];
  /** Linked only as a co-owner / right holder on a contract, not as a property's owner. */
  rightHolderOnly: boolean;
  activeConsents: number;
  /** Latest of the viewer's own calls and communications with the owner. */
  lastContactAt?: ISODateTime;
}

export interface OwnerDetailView extends OwnerListItem {
  properties: PropertyView[];
  listings: ListingView[];
  contracts: ContractView[];
  /** The viewer's own timeline with the owner, newest first. */
  communications: CommunicationView[];
  /** The viewer's own calls with the owner, newest first. */
  calls: CallView[];
  /** Facts checked on the owner's listings. */
  verification: VerificationQueueItem[];
}

/* -------------------------------------------------------- communications */

export interface CallFilter {
  direction?: Call["direction"];
  outcome?: Call["outcome"];
  /** `linked` = attached to a lead, client or owner; `unknown` = attached to nothing. */
  linked?: "linked" | "unknown";
}

export interface CallView {
  call: Call;
  agent: Agent;
  /** The lead, client or owner the call is attached to. */
  linked?: SubjectRef;
  /**
   * For an unattached call: visible records with the same number. A
   * suggestion only — never an automatic link (§14.1).
   */
  phoneMatches: SubjectRef[];
  /** Attached to nothing and matching nothing: offer "create lead" (§14.7). */
  unknownNumber: boolean;
  listing?: ListingView;
}

export interface CallDetailView extends CallView {
  lead?: LeadView;
  client?: Client;
  owner?: OwnerListItem;
  /** The party's communications other than this call, newest first. */
  communications: CommunicationView[];
  /** The viewer's other calls with the same party, newest first. */
  otherCalls: CallView[];
}

export interface CommunicationFilter {
  clientId?: ID;
  ownerId?: ID;
  leadId?: ID;
  channel?: CommunicationChannel;
}

export interface CommunicationView {
  communication: Communication;
  agent: Agent;
  subject?: SubjectRef;
  /** The call behind a `phone` touchpoint. */
  call?: Call;
}

/* --------------------------------------------------------- verification */

export type VerificationTargetKind = "listing" | "agent" | "organization";

export interface VerificationQueueFilter {
  status?: VerificationStatus;
  subject?: VerificationSubject;
  target?: VerificationTargetKind;
}

export type VerificationTarget =
  | { kind: "listing"; view: ListingView }
  | { kind: "agent"; agent: Agent }
  | { kind: "organization"; organization: Organization };

export interface VerificationQueueItem {
  /** Stable key `${target kind}:${target id}:${item id}`. */
  key: string;
  /** Full fact when `detailed`, otherwise the result only (§19). */
  item: VerificationResult;
  /**
   * Source and note are included: the viewer's own listing (or one they may
   * see owner data on), their own profile or their organization.
   */
  detailed: boolean;
  target: VerificationTarget;
  /** `partner` = a partner's listing the viewer works on (deal or cooperation). */
  scope: RecordScope | "partner";
  /** Confirmed, and the evidence expires within 30 days. */
  expiresSoon: boolean;
  /** Confirmed once, but the evidence has expired: needs a new check. */
  expired: boolean;
}

/* --------------------------------------------------------- team & routing */

export interface TeamMemberMetrics {
  /** Leads received today (Tashkent) and assigned to the member. */
  newLeadsToday: number;
  /** Assigned leads not converted or lost. */
  openLeads: number;
  /** Open leads past the first-response deadline. */
  slaBreaches: number;
  /** Clients in work (not lost or deferred). */
  activeClients: number;
  /** Listings between contract and closing (not draft, finished or expired). */
  activeListings: number;
  /** Viewings this Tashkent week (Mon–Sun) as agent or partner, not cancelled. */
  viewingsThisWeek: number;
  /** Deals as agent or listing-side partner, not archived. */
  dealsInProgress: number;
}

export interface TeamMemberView {
  agent: Agent;
  isLead: boolean;
  isViewer: boolean;
  availability: AgentAvailability;
  metrics: TeamMemberMetrics;
  /** Daily lead capacity minus leads assigned today, never below 0. */
  capacityLeft: number;
}

export interface MyTeamView {
  team: Team;
  organization?: Organization;
  lead: Agent;
  /** Lead first, then members by name. */
  members: TeamMemberView[];
  /**
   * Sum of the members' metrics. A viewing or deal shared by two members
   * counts for each of them, so totals can exceed the distinct records.
   */
  totals: TeamMemberMetrics;
}

export interface TeamMemberDetailView extends TeamMemberView {
  team?: Team;
  /** The member's active listings, as the viewer may see them. */
  listings: ListingView[];
  /** Routing rules that can assign leads to the member, by priority. */
  routingRules: RoutingRule[];
}

export interface AgentWorkload {
  agentId: ID;
  status: AvailabilityStatus;
  awayUntil?: ISODateTime;
  assignedToday: number;
  openLeads: number;
  capacity: number;
  /** `capacity - assignedToday`, never below 0. */
  remaining: number;
}

/**
 * Inputs for the routing simulator (§14.2, §36.5). `rules`, `availability`
 * and `workloadToday` have the shapes `routeLead` in `@/lib/domain/routing`
 * expects, so `{ rules, availability, workloadToday, now }` is its context.
 */
export interface RoutingContextView {
  generatedAt: ISODateTime;
  organization?: Organization;
  /** Active and inactive rules, lowest priority number first. */
  rules: RoutingRule[];
  /** The organization's agents by id. */
  agents: Agent[];
  /** One entry per agent in `agents`, same order. */
  availability: AgentAvailability[];
  /** New leads assigned today (Tashkent) per agent id. */
  workloadToday: Record<ID, number>;
  /**
   * Per round-robin rule: the index in `agentIds` of the agent who took the
   * rule's last lead, as recorded; 0 when nothing is recorded. Passed to
   * `routeLead`, so the simulator continues the real rotation.
   */
  roundRobinCursor: Record<ID, number>;
  /** Per-agent status, capacity and today's load for display, same order as `agents`. */
  workload: AgentWorkload[];
  /** Open leads nobody is assigned to, earliest SLA deadline first. */
  unassignedLeads: LeadView[];
}

/* ------------------------------------------------------------- partners */

/**
 * A professional outside the viewer's organization (§5.6, §15). Phone and
 * Telegram are present only after an accepted cooperation with shared
 * contacts; verification facts are result only.
 */
export type PartnerAgent = Omit<Agent, "phone" | "telegramUsername" | "verifications"> & {
  phone?: string;
  telegramUsername?: string;
  verifications: VerificationResult[];
};

export type PartnerOrganization = Omit<Organization, "registry" | "insurance"> & {
  registry?: VerificationResult;
  insurance?: VerificationResult;
};

export interface CooperationStats {
  total: number;
  accepted: number;
  declined: number;
  /** Sent, viewed or in negotiation. */
  inProgress: number;
  /** Expired, cancelled, disputed or draft. */
  other: number;
}

export interface PartnerFilter {
  /** Name, organization, territory (district names in RU/UZ). */
  q?: string;
}

export interface PartnerListItem {
  agent: PartnerAgent;
  organization?: PartnerOrganization;
  /** An accepted cooperation with shared contacts exists between the viewer and the partner. */
  contactsShared: boolean;
  contactHidden?: "no_accepted_cooperation";
  /** Requests between the viewer and this partner, either direction. */
  cooperation: CooperationStats;
  /** The partner's Active MLS listings the viewer can see. */
  activeMlsListings: number;
  /** Latest proposal, deal or past viewing involving both. */
  lastInteractionAt?: ISODateTime;
}

/** A listing inside a partner view: the partner is the page's subject, so the agent objects are left out. */
export type PartnerListingView = Omit<ListingView, "agent" | "organization">;

export type PartnerCooperationView = Omit<
  CooperationView,
  "fromAgent" | "toAgent" | "counterpart" | "fromOrganization" | "toOrganization" | "listing"
> & { listing: PartnerListingView };

export interface PartnerDetailView extends PartnerListItem {
  /** The partner's listings visible to the viewer (masked per the usual rules), newest first. */
  listings: PartnerListingView[];
  /** Cooperation requests with the viewer, most recent proposal first. */
  cooperationHistory: PartnerCooperationView[];
  /** The viewer's deals with the partner on the other side. */
  deals: { id: ID; stage: DealStage; listingId: ID; createdAt: ISODateTime }[];
}

/* ---------------------------------------------------------------- audit */

/**
 * An event relative to the viewer, for the §19 audit levels:
 * - `own` — the viewer acted, or the event concerns the viewer's own record;
 * - `team` — a member of the viewer's team acted or owns the record;
 * - `agency` — anything else in the organization journal.
 */
export type AuditScope = "own" | "team" | "agency";

export interface AuditFilter {
  actorId?: ID;
  action?: AuditAction | OrgAuditAction;
  targetKind?: string;
  /** Reveals, views of restricted data, exports, permission/role and security events. */
  sensitiveOnly?: boolean;
}

export interface AuditEventView {
  event: AuditEvent;
  /** The organization journal or a deal's own history. */
  log: "organization" | "deal";
  /** For deal-history events. */
  dealId?: ID;
  /** Undefined for automatic actions (`system`). */
  actor?: Agent;
  system: boolean;
  /**
   * A label safe to show in a list: names and massifs, never a phone, full
   * address, cadastral number or document content. In the data's language.
   */
  target: {
    kind: string;
    id: ID;
    label: string;
    documentType?: Deal["documents"][number]["type"];
    /** Where the record opens, present only when the viewer may open it. */
    link?: AuditTargetLink;
  };
  sensitive: boolean;
  scope: AuditScope;
}

/**
 * The screen an audit target opens on: the record's own page, or — for a
 * consent, which has no page of its own — the consent registry filtered to
 * its subject. An agent is a `member` (the viewer's organization, team
 * screens) or a `partner` (anyone outside it).
 */
export type AuditTargetLink =
  | { route: "contract" | "owner" | "call" | "member" | "partner"; id: ID }
  | { route: "consents"; subject: "client" | "owner" };
