import type { MatchSort, RankedMatch } from "@/lib/domain/matching";
import type { MlsReportState } from "@/lib/domain/lifecycle";
import type {
  Agent,
  AppNotification,
  Client,
  ClientStatus,
  ConfidenceBand,
  CooperationRequest,
  Currency,
  Deal,
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
  OfferVersion,
  Organization,
  Owner,
  Property,
  PropertyType,
  Range,
  Requirement,
  RequirementCriterion,
  RequirementStatus,
  SourceKind,
  Task,
  TelegramListing,
  TelegramListingStatus,
  TelegramSource,
  TermsVersion,
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
 * Owner contacts (RESTRICTED, §34.2) are returned only for `owner` and
 * `agency`; the full address also for `partner_shared`.
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
  /** Present only for `owner` / `agency` access. */
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
}

export interface OfferFilter {
  listingId?: ID;
  clientId?: ID;
  dealId?: ID;
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
  offers: OfferView[];
  viewings: ViewingView[];
  cooperation?: CooperationView;
  tasks: TaskView[];
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
