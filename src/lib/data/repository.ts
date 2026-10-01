import { now } from "@/lib/clock";
import { acceptedTerms, awaitingResponseFrom, isParty, latestVersion } from "@/lib/domain/commission";
import { computeFreshness, needsAttention } from "@/lib/domain/freshness";
import { districts as districtNames } from "@/lib/domain/geo";
import { mlsReportState } from "@/lib/domain/lifecycle";
import {
  candidateFromListing,
  candidateFromTelegram,
  defaultMatchingConfig,
  findMatches,
  reverseMatch,
  type MatchCandidate,
  type RankedMatch,
} from "@/lib/domain/matching";
import { toMinor } from "@/lib/domain/money";
import { normalizeUzPhone } from "@/lib/domain/phone";
import { foldText } from "@/lib/domain/text";
import {
  dealStages,
  type Agent,
  type AgentAvailability,
  type AppNotification,
  type AuditEvent,
  type Call,
  type Client,
  type Communication,
  type ConfidenceBand,
  type Consent,
  type Contract,
  type ContractStatus,
  type CooperationRequest,
  type Deal,
  type DealDocument,
  type DistrictId,
  type ID,
  type Lead,
  type Listing,
  type ListingStatus,
  type MatchTarget,
  type Offer,
  type Organization,
  type Owner,
  type ParsedField,
  type Property,
  type Requirement,
  type RoutingRule,
  type Task,
  type TelegramListing,
  type TelegramSource,
  type VerificationItem,
  type VerificationStatus,
  type Viewing,
} from "@/lib/domain/types";
import { tashkentDateKey } from "@/lib/domain/working-days";
import { seed, VIEWER_AGENT_ID, type MatchStatusRecord } from "./seed";
import {
  SYSTEM_ACTOR_ID,
  type AgentWorkload,
  type AuditEventView,
  type AuditFilter,
  type AuditScope,
  type AuditTargetLink,
  type CallDetailView,
  type CallFilter,
  type CallView,
  type CommunicationFilter,
  type CommunicationView,
  type ConsentFilter,
  type ConsentRegistryItem,
  type ContractDetailView,
  type ContractFilter,
  type ContractPartyView,
  type ContractView,
  type CooperationStats,
  type MyTeamView,
  type OwnerDetailView,
  type OwnerFilter,
  type OwnerListItem,
  type OwnerRecordView,
  type PartnerAgent,
  type PartnerCooperationView,
  type PartnerDetailView,
  type PartnerFilter,
  type PartnerListItem,
  type PartnerListingView,
  type PartnerOrganization,
  type RecordScope,
  type RightHolderView,
  type RoutingContextView,
  type SubjectRef,
  type TeamMemberDetailView,
  type TeamMemberMetrics,
  type TeamMemberView,
  type VerificationQueueFilter,
  type VerificationQueueItem,
  type VerificationResult,
  type VerificationTarget,
} from "./views";
import type {
  ClientDetailView,
  ClientFilter,
  ClientListItem,
  CooperationFilter,
  CooperationView,
  DealDetailView,
  DealView,
  ExpiringContractView,
  LeadFilter,
  LeadSla,
  LeadView,
  ListingAccess,
  ListingDetailView,
  ListingFilter,
  ListingView,
  MatchFeedFilter,
  MatchOptions,
  MatchSummary,
  MatchView,
  NotificationFilter,
  OfferFilter,
  OfferView,
  PriceDropView,
  PropertyView,
  RequirementFilter,
  RequirementSummary,
  RequirementView,
  ReverseMatchView,
  SearchResults,
  TaskFilter,
  TaskState,
  TaskView,
  TelegramFilter,
  TelegramListingDetailView,
  TelegramListingView,
  TodayFeed,
  ViewerView,
  ViewingFilter,
  ViewingView,
} from "./views";

/**
 * Read-only repository over the demo seed — the single data entry point for
 * every workspace screen.
 *
 * - Every function is async so a real backend can replace the seed without
 *   touching callers.
 * - Access control happens here, before data reaches the UI (§36.4): a
 *   partner's restricted listing is invisible, a masked listing carries no
 *   address or owner, partner clients never appear in the viewer's CRM.
 * - Matches are not stored: they are computed at query time from the
 *   requirement and the candidates with the matching engine and the app
 *   clock, then overlaid with the agent's recorded reactions (§12, §34.3).
 * - Results are deterministic (explicit tie-breaks on ids) and are fresh
 *   copies: callers may sort or edit them without touching the seed.
 *
 * No React and no "server-only" import: tests and scripts import it directly.
 */

/* --------------------------------------------------------------- basics */

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const SEARCH_LIMIT = 8;
const SLA_SOON_MINUTES = 60;
const EXPIRING_CONTRACT_DAYS = 14;
const PRICE_DROP_DAYS = 7;
const TODAY_MATCH_LIMIT = 5;
/** Keeps one busy requirement from filling the whole Today block. */
const TODAY_MATCHES_PER_REQUIREMENT = 2;

function indexById<T extends { id: ID }>(items: readonly T[]): Map<ID, T> {
  return new Map(items.map((item) => [item.id, item]));
}

const organizationsById = indexById(seed.organizations);
const agentsById = indexById(seed.agents);
const ownersById = indexById(seed.owners);
const propertiesById = indexById(seed.properties);
const listingsById = indexById(seed.listings);
const leadsById = indexById(seed.leads);
const clientsById = indexById(seed.clients);
const requirementsById = indexById(seed.requirements);
const sourcesById = indexById(seed.telegramSources);
const postsById = indexById(seed.telegramListings);
const cooperationById = indexById(seed.cooperationRequests);
const viewingsById = indexById(seed.viewings);
const offersById = indexById(seed.offers);
const dealsById = indexById(seed.deals);
const contractsById = indexById(seed.contracts);
const contractsByNumber = new Map(seed.contracts.map((contract) => [contract.number, contract]));
const callsById = indexById(seed.calls);
const availabilityByAgent = new Map(seed.agentAvailability.map((entry) => [entry.agentId, entry]));

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Demo data is inconsistent: missing ${what}`);
  return value;
}

const viewer: Agent = must(agentsById.get(VIEWER_AGENT_ID), `viewer ${VIEWER_AGENT_ID}`);

/** Results leave the repository as independent copies of the frozen seed. */
function copy<T>(value: T): T {
  return structuredClone(value);
}

function byIdAsc(a: { id: ID }, b: { id: ID }): number {
  return a.id.localeCompare(b.id);
}

function isoDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

function isoAsc(a: string, b: string): number {
  return -isoDesc(a, b);
}

function isBefore(iso: string, at: Date): boolean {
  return new Date(iso).getTime() < at.getTime();
}

/* ---------------------------------------------------------------- scope */

function isViewerClient(client: Client): boolean {
  return client.responsibleAgentId === viewer.id;
}

function viewerRequirements(): Requirement[] {
  return seed.requirements.filter((requirement) => requirement.agentId === viewer.id);
}

function viewerActiveRequirements(): Requirement[] {
  return viewerRequirements().filter((requirement) => requirement.status === "active");
}

function visibleClient(id: ID): Client | undefined {
  const client = clientsById.get(id);
  return client && isViewerClient(client) ? client : undefined;
}

/* ----------------------------------------------------------- listings */

/**
 * Not published to partners (§11.1): a listing reaches the MLS at "Active MLS".
 * Before that — draft, contract, verification — and once archived it is seen
 * only inside the owning organization, whatever the confidentiality.
 */
const NOT_PUBLISHED_TO_PARTNERS = new Set<ListingStatus>([
  "draft",
  "contract_signed",
  "verification_pending",
  "verified",
  "verification_failed",
  "archived",
]);

/** Listings that no longer need confirmations, contracts or price alerts. */
const FINISHED = new Set<ListingStatus>(["closed", "archived", "withdrawn"]);

function computeAccess(listing: Listing): ListingAccess | undefined {
  if (listing.agentId === viewer.id) return "owner";
  if (viewer.organizationId && listing.organizationId === viewer.organizationId) return "agency";
  if (listing.confidentiality === "restricted" || NOT_PUBLISHED_TO_PARTNERS.has(listing.status)) return undefined;
  const shared = seed.cooperationRequests.some(
    (request) =>
      request.listingId === listing.id &&
      request.status === "accepted" &&
      request.disclosure === "contacts_shared" &&
      isParty(request, viewer.id),
  );
  return shared ? "partner_shared" : "partner_masked";
}

// Access depends only on the records, not on time: compute it once.
const accessByListing = new Map(seed.listings.map((listing) => [listing.id, computeAccess(listing)]));

function accessOf(listing: Listing): ListingAccess | undefined {
  return accessByListing.get(listing.id);
}

function seesRestricted(access: ListingAccess): boolean {
  return access === "owner" || access === "agency";
}

/**
 * Sensitive owner data — the owner, the contract, the cadastral number (§19):
 * the listing's own agent, and agency management ("Approved" / "All audited").
 * Other agents and team leads need a permission the demo has no grant for.
 */
function seesOwnerData(access: ListingAccess): boolean {
  return (
    access === "owner" ||
    (access === "agency" && (viewer.role === "agency_owner" || viewer.role === "agency_admin"))
  );
}

function visibleListings(): Listing[] {
  return seed.listings.filter((listing) => accessOf(listing) !== undefined);
}

function propertyView(property: Property, access: ListingAccess): PropertyView {
  const view: PropertyView = { ...property };
  if (seesOwnerData(access)) return view;
  delete view.cadastralNumber;
  delete view.ownerId;
  if (access === "partner_masked") {
    delete view.address;
    if (property.geo) {
      // About a kilometre: enough for a district map, not for a doorstep.
      view.geo = {
        lat: Math.round(property.geo.lat * 100) / 100,
        lng: Math.round(property.geo.lng * 100) / 100,
        precision: "district",
      };
    }
  }
  return view;
}

function toListingView(listing: Listing, at: Date): ListingView | undefined {
  const access = accessOf(listing);
  if (!access) return undefined;
  const property = must(propertiesById.get(listing.propertyId), `property ${listing.propertyId}`);
  const view: ListingView = {
    listing,
    property: propertyView(property, access),
    agent: must(agentsById.get(listing.agentId), `agent ${listing.agentId}`),
    freshness: computeFreshness(listing, at),
    access,
    ownerData: seesOwnerData(access),
    otherListingsOnProperty: visibleListings().filter(
      (other) => other.propertyId === listing.propertyId && other.id !== listing.id,
    ).length,
  };
  const organization = listing.organizationId ? organizationsById.get(listing.organizationId) : undefined;
  if (organization) view.organization = organization;
  return view;
}

function listingViewById(id: ID, at: Date): ListingView | undefined {
  const listing = listingsById.get(id);
  return listing ? toListingView(listing, at) : undefined;
}

function sortListingViews(views: ListingView[]): ListingView[] {
  return views.sort((a, b) => isoDesc(a.listing.updatedAt, b.listing.updatedAt) || byIdAsc(a.listing, b.listing));
}

function listingCandidate(listing: Listing): MatchCandidate {
  return candidateFromListing(listing, must(propertiesById.get(listing.propertyId), `property ${listing.propertyId}`));
}

/* ------------------------------------------------------------- telegram */

function confident<T>(field: ParsedField<T>): T | undefined {
  return field.confidence >= defaultMatchingConfig.minParseConfidence ? field.value : undefined;
}

function toTelegramView(post: TelegramListing, at: Date): TelegramListingView {
  return {
    post,
    source: must(sourcesById.get(post.sourceId), `telegram source ${post.sourceId}`),
    freshness: computeFreshness(post, at),
  };
}

/* ------------------------------------------------------------- matching */

interface CandidatePool {
  candidates: MatchCandidate[];
  listingViews: Map<ID, ListingView>;
  telegramViews: Map<ID, TelegramListingView>;
}

function buildPool(at: Date, includeTelegram: boolean): CandidatePool {
  const listingViews = new Map<ID, ListingView>();
  const telegramViews = new Map<ID, TelegramListingView>();
  const candidates: MatchCandidate[] = [];
  for (const listing of visibleListings()) {
    const view = must(toListingView(listing, at), `listing view ${listing.id}`);
    listingViews.set(listing.id, view);
    candidates.push(listingCandidate(listing));
  }
  if (includeTelegram) {
    for (const post of seed.telegramListings) {
      telegramViews.set(post.id, toTelegramView(post, at));
      candidates.push(candidateFromTelegram(post));
    }
  }
  return { candidates, listingViews, telegramViews };
}

function statusKey(requirementId: ID, target: MatchTarget): string {
  return `${requirementId}|${target.kind}|${target.id}`;
}

const statusByPair = new Map<string, MatchStatusRecord>(
  seed.matchStatuses.map((record) => [statusKey(record.requirementId, record.target), record]),
);

/** `${requirementId}--${targetId}`: target ids are unique across listings and posts. */
export function matchId(requirementId: ID, target: MatchTarget): string {
  return `${requirementId}--${target.id}`;
}

function toMatchView(requirement: Requirement, ranked: RankedMatch, pool: CandidatePool): MatchView {
  const target = ranked.candidate.target;
  const targetView: MatchView["target"] =
    target.kind === "listing"
      ? { kind: "listing", view: must(pool.listingViews.get(target.id), `listing ${target.id}`) }
      : { kind: "telegram", view: must(pool.telegramViews.get(target.id), `telegram post ${target.id}`) };
  const record = statusByPair.get(statusKey(requirement.id, target));
  const view: MatchView = {
    id: matchId(requirement.id, target),
    requirement,
    client: must(clientsById.get(requirement.clientId), `client ${requirement.clientId}`),
    ranked,
    target: targetView,
    status: record?.status ?? "new",
  };
  if (record?.rejectionReason) view.rejectionReason = record.rejectionReason;
  if (record) view.statusAt = record.at;
  return view;
}

/** Matching runs on active requirements only (§12.1); paused and closed ones yield nothing. */
function matchesFor(
  requirement: Requirement,
  pool: CandidatePool,
  at: Date,
  sort: MatchOptions["sort"] = "relevance",
): MatchView[] {
  if (requirement.status !== "active") return [];
  return findMatches(requirement, pool.candidates, at, { sort }).map((ranked) =>
    toMatchView(requirement, ranked, pool),
  );
}

function byScore(a: MatchView, b: MatchView): number {
  return (
    b.ranked.score - a.ranked.score ||
    b.ranked.freshness.score - a.ranked.freshness.score ||
    a.id.localeCompare(b.id)
  );
}

type VisibleBand = Exclude<ConfidenceBand, "hidden">;

function countBands(matches: MatchView[]): Record<VisibleBand, number> & { total: number } {
  const counts = { excellent: 0, good: 0, possible: 0, total: matches.length };
  for (const match of matches) {
    if (match.ranked.band !== "hidden") counts[match.ranked.band] += 1;
  }
  return counts;
}

const SET_ASIDE = new Set<MatchView["status"]>(["rejected", "duplicate", "expired", "cancelled"]);

function summarize(matches: MatchView[]): MatchSummary {
  const { total, ...byBand } = countBands(matches);
  const top = matches
    .filter((match) => !SET_ASIDE.has(match.status))
    .sort(byScore)
    .slice(0, 3);
  return { total, byBand, top };
}

function reverseMatchesFor(candidate: MatchCandidate, at: Date): ReverseMatchView[] {
  return reverseMatch(candidate, viewerActiveRequirements(), at).map((result) => ({
    requirement: result.requirement,
    client: must(clientsById.get(result.requirement.clientId), `client ${result.requirement.clientId}`),
    score: result.score,
    band: result.band,
    reasons: result.reasons,
  }));
}

function feed(at: Date, pool: CandidatePool): MatchView[] {
  return viewerActiveRequirements()
    .flatMap((requirement) => matchesFor(requirement, pool, at))
    .sort(byScore);
}

/* ----------------------------------------------------------------- CRM */

const CLOSED_LEAD = new Set<Lead["status"]>(["converted", "lost"]);

function leadSla(lead: Lead, at: Date): LeadSla {
  const due = new Date(lead.slaDueAt).getTime();
  const minutesLeft = Math.round((due - at.getTime()) / MINUTE_MS);
  if (lead.firstResponseAt) {
    return {
      state: "responded",
      dueAt: lead.slaDueAt,
      minutesLeft,
      respondedLate: new Date(lead.firstResponseAt).getTime() > due,
    };
  }
  if (CLOSED_LEAD.has(lead.status)) return { state: "closed", dueAt: lead.slaDueAt, minutesLeft };
  const state = minutesLeft < 0 ? "breached" : minutesLeft <= SLA_SOON_MINUTES ? "due_soon" : "on_track";
  return { state, dueAt: lead.slaDueAt, minutesLeft };
}

/** The agency inbox: the viewer's leads plus unassigned ones (§14.1, §14.2). */
function visibleLead(lead: Lead): boolean {
  return lead.assignedAgentId === undefined || lead.assignedAgentId === viewer.id;
}

function toLeadView(lead: Lead, at: Date): LeadView {
  const view: LeadView = { lead, sla: leadSla(lead, at) };
  const agent = lead.assignedAgentId ? agentsById.get(lead.assignedAgentId) : undefined;
  if (agent) view.assignedAgent = agent;
  const duplicate = lead.duplicateCandidateClientId ? visibleClient(lead.duplicateCandidateClientId) : undefined;
  if (duplicate) view.duplicateCandidate = duplicate;
  return view;
}

function toClientListItem(client: Client): ClientListItem {
  return {
    client,
    responsibleAgent: must(agentsById.get(client.responsibleAgentId), `agent ${client.responsibleAgentId}`),
    requirements: seed.requirements
      .filter((requirement) => requirement.clientId === client.id)
      .sort((a, b) => isoDesc(a.updatedAt, b.updatedAt) || byIdAsc(a, b)),
  };
}

function toRequirementView(requirement: Requirement, pool: CandidatePool, at: Date): RequirementView {
  return {
    requirement,
    client: must(clientsById.get(requirement.clientId), `client ${requirement.clientId}`),
    agent: must(agentsById.get(requirement.agentId), `agent ${requirement.agentId}`),
    matchCounts: countBands(matchesFor(requirement, pool, at)),
  };
}

/* ---------------------------------------------------------- cooperation */

const OPEN_COOPERATION = new Set<CooperationRequest["status"]>(["sent", "viewed", "negotiation"]);

function requirementSummary(request: CooperationRequest): RequirementSummary | undefined {
  const requirement = request.requirementId ? requirementsById.get(request.requirementId) : undefined;
  if (!requirement) return undefined;
  const disclosed = requirement.agentId === viewer.id || request.disclosure === "contacts_shared";
  const summary: RequirementSummary = {
    id: requirement.id,
    dealType: requirement.dealType,
    propertyTypes: requirement.propertyTypes,
    districts: requirement.districts,
    rooms: requirement.rooms,
    area: requirement.area,
    budget: requirement.budget,
    hardCriteria: requirement.hardCriteria,
    disclosed,
  };
  const client = clientsById.get(requirement.clientId);
  if (disclosed && client) summary.clientName = client.name;
  return summary;
}

function toCooperationView(request: CooperationRequest, at: Date): CooperationView | undefined {
  if (!isParty(request, viewer.id)) return undefined;
  const listing = listingViewById(request.listingId, at);
  if (!listing) return undefined;
  const fromAgent = must(agentsById.get(request.fromAgentId), `agent ${request.fromAgentId}`);
  const toAgent = must(agentsById.get(request.toAgentId), `agent ${request.toAgentId}`);
  const direction = request.toAgentId === viewer.id ? "incoming" : "outgoing";
  const view: CooperationView = {
    request,
    direction,
    listing,
    fromAgent,
    toAgent,
    counterpart: direction === "incoming" ? fromAgent : toAgent,
    latest: must(latestVersion(request), `terms of ${request.id}`),
    awaitingViewer: awaitingResponseFrom(request) === viewer.id,
    overdue: OPEN_COOPERATION.has(request.status) && isBefore(request.respondBy, at),
  };
  const fromOrganization = fromAgent.organizationId ? organizationsById.get(fromAgent.organizationId) : undefined;
  const toOrganization = toAgent.organizationId ? organizationsById.get(toAgent.organizationId) : undefined;
  if (fromOrganization) view.fromOrganization = fromOrganization;
  if (toOrganization) view.toOrganization = toOrganization;
  const requirement = requirementSummary(request);
  if (requirement) view.requirement = requirement;
  const accepted = acceptedTerms(request);
  if (accepted) view.accepted = accepted;
  return view;
}

function cooperationViews(at: Date): CooperationView[] {
  return seed.cooperationRequests
    .map((request) => toCooperationView(request, at))
    .filter((view): view is CooperationView => view !== undefined)
    .sort((a, b) => isoDesc(a.latest.proposedAt, b.latest.proposedAt) || byIdAsc(a.request, b.request));
}

/* ---------------------------------------------------------- transaction */

const INACTIVE_VIEWING = new Set<Viewing["status"]>(["cancelled", "no_show"]);

function viewingInterval(viewing: Viewing): [number, number] {
  const start = new Date(viewing.startsAt).getTime();
  return [start, start + viewing.durationMinutes * MINUTE_MS];
}

function viewerViewings(): Viewing[] {
  return seed.viewings.filter((viewing) => viewing.agentId === viewer.id);
}

function conflictsOf(viewing: Viewing): ID[] {
  if (INACTIVE_VIEWING.has(viewing.status)) return [];
  const [start, end] = viewingInterval(viewing);
  return seed.viewings
    .filter((other) => {
      if (other.id === viewing.id || other.agentId !== viewing.agentId) return false;
      if (INACTIVE_VIEWING.has(other.status)) return false;
      const [otherStart, otherEnd] = viewingInterval(other);
      return otherStart < end && start < otherEnd;
    })
    .map((other) => other.id)
    .sort();
}

function toViewingView(viewing: Viewing, at: Date): ViewingView | undefined {
  const listing = listingViewById(viewing.listingId, at);
  const client = visibleClient(viewing.clientId);
  if (!listing || !client || viewing.agentId !== viewer.id) return undefined;
  const view: ViewingView = {
    viewing,
    listing,
    client,
    agent: must(agentsById.get(viewing.agentId), `agent ${viewing.agentId}`),
    conflictsWith: conflictsOf(viewing),
  };
  const partner = viewing.partnerAgentId ? agentsById.get(viewing.partnerAgentId) : undefined;
  if (partner) view.partner = partner;
  return view;
}

function viewingViews(at: Date, keep: (viewing: Viewing) => boolean = () => true): ViewingView[] {
  return viewerViewings()
    .filter(keep)
    .map((viewing) => toViewingView(viewing, at))
    .filter((view): view is ViewingView => view !== undefined)
    .sort((a, b) => isoAsc(a.viewing.startsAt, b.viewing.startsAt) || byIdAsc(a.viewing, b.viewing));
}

const AWAITING_OFFER = new Set<Offer["status"]>(["open", "countered"]);

function toOfferView(offer: Offer, at: Date): OfferView | undefined {
  const listing = listingViewById(offer.listingId, at);
  const client = visibleClient(offer.clientId);
  if (!listing || !client) return undefined;
  const latest = must(offer.versions[offer.versions.length - 1], `versions of ${offer.id}`);
  const awaiting = AWAITING_OFFER.has(offer.status);
  const view: OfferView = {
    offer,
    listing,
    client,
    latest,
    responseOverdue: Boolean(awaiting && latest.expiresAt && isBefore(latest.expiresAt, at)),
  };
  // Only the viewer's own deals are visible (see `toDealView`).
  const deal = offer.dealId ? dealsById.get(offer.dealId) : undefined;
  if (deal && deal.agentId === viewer.id) view.deal = { id: deal.id, stage: deal.stage };
  if (awaiting) view.awaitingSide = latest.by === "buyer" ? "owner" : "buyer";
  return view;
}

function offerViews(at: Date, keep: (offer: Offer) => boolean = () => true): OfferView[] {
  return seed.offers
    .filter(keep)
    .map((offer) => toOfferView(offer, at))
    .filter((view): view is OfferView => view !== undefined)
    .sort((a, b) => isoDesc(a.latest.at, b.latest.at) || byIdAsc(a.offer, b.offer));
}

const MISSING_DOCUMENT = new Set(["missing", "rejected"]);

function toDealView(deal: Deal, at: Date): DealView | undefined {
  const listing = listingViewById(deal.listingId, at);
  const client = visibleClient(deal.clientId);
  if (!listing || !client || deal.agentId !== viewer.id) return undefined;
  const view: DealView = {
    deal,
    listing,
    client,
    agent: must(agentsById.get(deal.agentId), `agent ${deal.agentId}`),
    missingRequiredDocuments: deal.documents.filter((doc) => MISSING_DOCUMENT.has(doc.status)).length,
    nextActionOverdue: Boolean(deal.nextAction?.dueAt && isBefore(deal.nextAction.dueAt, at)),
    mlsReport: mlsReportState(deal, at),
  };
  const partner = deal.partnerAgentId ? agentsById.get(deal.partnerAgentId) : undefined;
  if (partner) view.partner = partner;
  return view;
}

function dealViews(at: Date): DealView[] {
  return seed.deals
    .map((deal) => toDealView(deal, at))
    .filter((view): view is DealView => view !== undefined)
    .sort(
      (a, b) =>
        dealStages.indexOf(a.deal.stage) - dealStages.indexOf(b.deal.stage) ||
        isoAsc(a.deal.createdAt, b.deal.createdAt) ||
        byIdAsc(a.deal, b.deal),
    );
}

function needsAttentionDeal(view: DealView): boolean {
  return (
    view.missingRequiredDocuments > 0 ||
    view.nextActionOverdue ||
    view.mlsReport.state === "due" ||
    view.mlsReport.state === "overdue"
  );
}

/* ----------------------------------------------------- tasks & signals */

function taskState(task: Task, at: Date): TaskState {
  if (task.status === "done") return "done";
  if (task.status === "snoozed") return "snoozed";
  if (isBefore(task.dueAt, at)) return "overdue";
  return tashkentDateKey(task.dueAt) === tashkentDateKey(at) ? "today" : "upcoming";
}

function relatedName(task: Task): string | undefined {
  const related = task.related;
  if (!related) return undefined;
  switch (related.kind) {
    case "lead":
      return leadsById.get(related.id)?.name;
    case "client":
      return clientsById.get(related.id)?.name;
    case "requirement":
    case "match": {
      // A match id starts with its requirement id: `${requirementId}--${targetId}`.
      const requirementId = related.kind === "match" ? related.id.split("--")[0] : related.id;
      const requirement = requirementsById.get(requirementId);
      return requirement ? clientsById.get(requirement.clientId)?.name : undefined;
    }
    case "deal": {
      const deal = dealsById.get(related.id);
      return deal ? clientsById.get(deal.clientId)?.name : undefined;
    }
    case "viewing": {
      const viewing = viewingsById.get(related.id);
      return viewing ? clientsById.get(viewing.clientId)?.name : undefined;
    }
    default:
      return undefined;
  }
}

function toTaskView(task: Task, at: Date): TaskView {
  const view: TaskView = { task, state: taskState(task, at) };
  const name = relatedName(task);
  if (name) view.relatedName = name;
  return view;
}

function taskViews(at: Date, keep: (task: Task) => boolean = () => true): TaskView[] {
  return seed.tasks
    .filter((task) => task.assigneeId === viewer.id && keep(task))
    .map((task) => toTaskView(task, at))
    .sort((a, b) => isoAsc(a.task.dueAt, b.task.dueAt) || byIdAsc(a.task, b.task));
}

/* --------------------------------------------------------------- search */

/**
 * Smart search (§9.3, §36.4): names, phones (any digit fragment), ids,
 * district names in RU/UZ with spelling variants, massif/landmark and
 * descriptions. Restricted fields (full address, cadastral number) are
 * searchable only for listings the viewer may see them on.
 */
interface SearchDoc {
  text: string;
  phones: string[];
  districts: DistrictId[];
}

interface SearchQuery {
  query: string;
  tokens: string[];
  /** Set when the query looks like a phone number (digits, spaces, + - ( )). */
  digits?: string;
}

function parseQuery(q: string): SearchQuery | undefined {
  const query = q.trim();
  if (!query) return undefined;
  const digits = query.replace(/\D/g, "");
  const parsed: SearchQuery = { query, tokens: foldText(query).split(/[\s,;]+/).filter(Boolean) };
  if (/^[\d\s()+-]+$/.test(query) && digits.length >= 4) parsed.digits = digits;
  return parsed;
}

const districtVariants: Record<DistrictId, string[]> = Object.fromEntries(
  (Object.keys(districtNames) as DistrictId[]).map((id) => [
    id,
    [...new Set([districtNames[id].ru, districtNames[id].uz, ...districtNames[id].variants].map(foldText))],
  ]),
) as Record<DistrictId, string[]>;

/** "чилан" (typing), "чиланзаре" (inflected) and "chilonzor" all name Chilanzar. */
function tokenNamesDistrict(token: string, district: DistrictId): boolean {
  return districtVariants[district].some(
    (variant) =>
      (token.length >= 4 && variant.startsWith(token)) ||
      (token.startsWith(variant) && token.length - variant.length <= 3),
  );
}

function doc(parts: (string | undefined)[], phones: (string | undefined)[], districtIds: DistrictId[]): SearchDoc {
  const districtText = districtIds.flatMap((id) => districtVariants[id]);
  return {
    text: foldText([...parts, ...districtText].filter(Boolean).join("\n")),
    phones: phones.filter((phone): phone is string => Boolean(phone)).map((phone) => phone.replace(/\D/g, "")),
    districts: districtIds,
  };
}

function matchesQuery(target: SearchDoc, query: SearchQuery): boolean {
  if (query.digits) {
    const digits = query.digits;
    return target.phones.some((phone) => phone.includes(digits)) || target.text.includes(digits);
  }
  return query.tokens.every(
    (token) =>
      target.text.includes(token) || target.districts.some((district) => tokenNamesDistrict(token, district)),
  );
}

function listingDoc(view: ListingView): SearchDoc {
  const { listing, property } = view;
  const restricted = seesRestricted(view.access);
  return doc(
    [
      listing.id,
      property.id,
      property.areaName,
      property.landmark,
      listing.description,
      view.agent.name,
      view.organization?.name,
      restricted || view.access === "partner_shared" ? property.address : undefined,
      view.ownerData ? property.cadastralNumber : undefined,
    ],
    [],
    [property.district],
  );
}

function clientDoc(client: Client): SearchDoc {
  return doc(
    [client.id, client.name, client.telegramUsername, ...client.household.map((party) => party.name)],
    [...client.phones, ...client.household.map((party) => party.phone)],
    [],
  );
}

function leadDoc(lead: Lead): SearchDoc {
  return doc([lead.id, lead.name, lead.telegramUsername, lead.message], [lead.phone], []);
}

function telegramDoc(view: TelegramListingView): SearchDoc {
  const district = confident(view.post.parsed.district);
  return doc(
    [view.post.id, view.post.rawText, view.source.title, view.source.handle],
    [view.post.parsed.phone.value],
    district ? [district] : [],
  );
}

function dealDoc(view: DealView): SearchDoc {
  const listing = listingDoc(view.listing);
  const client = clientDoc(view.client);
  return {
    text: [view.deal.id, listing.text, client.text, view.partner ? foldText(view.partner.name) : ""].join("\n"),
    phones: client.phones,
    districts: listing.districts,
  };
}

/* ------------------------------------------------- organization & team */

const viewerOrganizationId = viewer.organizationId;

/** Agents of the viewer's organization (colleagues and the viewer). */
function inViewerOrganization(agentId: ID | undefined): boolean {
  if (!agentId || !viewerOrganizationId) return agentId === viewer.id;
  return agentsById.get(agentId)?.organizationId === viewerOrganizationId;
}

function organizationAgents(): Agent[] {
  return seed.agents.filter((agent) => inViewerOrganization(agent.id)).sort(byIdAsc);
}

const viewerTeam = seed.teams.find(
  (team) => team.organizationId === viewerOrganizationId && team.memberIds.includes(viewer.id),
);
const viewerTeamMemberIds = new Set<ID>(viewerTeam?.memberIds ?? [viewer.id]);

/** Tashkent calendar day number (days since the epoch) of an instant. */
function tashkentDayNumber(value: string | Date): number {
  return Math.round(Date.parse(tashkentDateKey(value)) / DAY_MS);
}

/** Whole Tashkent calendar days from `at` to `iso`: 0 = the same day, negative = before. */
function tashkentDaysUntil(iso: string, at: Date): number {
  return tashkentDayNumber(iso) - tashkentDayNumber(at);
}

/**
 * Contacts with a partner are shared after an accepted cooperation request
 * with `contacts_shared` disclosure between the two (§18.2) — the same rule
 * that turns a listing into `partner_shared`.
 */
function contactsSharedWith(agentId: ID): boolean {
  return seed.cooperationRequests.some(
    (request) =>
      request.status === "accepted" &&
      request.disclosure === "contacts_shared" &&
      isParty(request, viewer.id) &&
      isParty(request, agentId),
  );
}

/* ------------------------------------------------------------ contracts */

/**
 * Contracts belong to the organization that concluded them: the viewer sees
 * Demo Realty's contracts (own and colleagues'), never a partner's.
 */
function isVisibleContract(contract: Contract): boolean {
  return Boolean(viewerOrganizationId) && contract.organizationId === viewerOrganizationId;
}

const visibleContracts = seed.contracts.filter(isVisibleContract);

/** Required clauses in the order the law lists them (§38.5); same order as the domain's `CONTRACT_CLAUSES`. */
const CLAUSE_ORDER: readonly (keyof Contract["clauses"])[] = [
  "certificateDetails",
  "membershipDetails",
  "insuranceDetails",
  "rightsAndObligations",
  "liability",
  "terminationAndRefund",
  "confidentiality",
];

/* --------------------------------------------------------------- owners */

interface OwnerLink {
  ownerId: ID;
  /** The organization's listings on the owner's properties, by id. */
  listings: Listing[];
  /** Visible contracts where the owner is the customer or a right holder, by id. */
  contracts: Contract[];
  propertyIds: ID[];
  scope: RecordScope;
  contactVisible: boolean;
  responsibleAgentId: ID;
  rightHolderOnly: boolean;
}

/**
 * Owners the viewer may know about: owners of the organization's listings and
 * right holders on its contracts. Owner identity is agency-level; contacts
 * (RESTRICTED, §34.2) follow `seesOwnerData` — the listing's own agent or
 * agency management — or the viewer's own contract with the owner.
 * Partner listings never link an owner: a masked listing hides its owner.
 * Access does not depend on time, so links are computed once.
 */
function buildOwnerLinks(): Map<ID, OwnerLink> {
  const draft = new Map<ID, { listings: Listing[]; contracts: Contract[]; properties: Set<ID>; owns: boolean }>();
  const entry = (ownerId: ID) => {
    let found = draft.get(ownerId);
    if (!found) {
      found = { listings: [], contracts: [], properties: new Set(), owns: false };
      draft.set(ownerId, found);
    }
    return found;
  };
  for (const listing of seed.listings) {
    const access = accessOf(listing);
    if (access !== "owner" && access !== "agency") continue;
    const property = must(propertiesById.get(listing.propertyId), `property ${listing.propertyId}`);
    if (!property.ownerId) continue;
    const found = entry(property.ownerId);
    found.listings.push(listing);
    found.properties.add(property.id);
    found.owns = true;
  }
  for (const contract of visibleContracts) {
    const customerOwner = contract.customer.kind === "owner" ? contract.customer.id : undefined;
    const ownerIds = new Set([
      ...(customerOwner ? [customerOwner] : []),
      ...contract.rightHolderConsents.map((holder) => holder.ownerId),
    ]);
    const listing = contract.listingId ? listingsById.get(contract.listingId) : undefined;
    for (const ownerId of ownerIds) {
      const found = entry(ownerId);
      found.contracts.push(contract);
      if (ownerId === customerOwner) found.owns = true;
      if (listing) found.properties.add(listing.propertyId);
    }
  }
  const links = new Map<ID, OwnerLink>();
  for (const [ownerId, found] of draft) {
    const listings = found.listings.sort(byIdAsc);
    const contracts = found.contracts.sort(byIdAsc);
    const own =
      listings.some((listing) => listing.agentId === viewer.id) ||
      contracts.some((contract) => contract.agentId === viewer.id);
    const responsibleAgentId = own
      ? viewer.id
      : (listings[0]?.agentId ?? must(contracts[0], `link of ${ownerId}`).agentId);
    links.set(ownerId, {
      ownerId,
      listings,
      contracts,
      propertyIds: [...found.properties].sort(),
      scope: own ? "own" : "agency",
      contactVisible:
        listings.some((listing) => seesOwnerData(must(accessOf(listing), `access ${listing.id}`))) ||
        contracts.some((contract) => contract.agentId === viewer.id),
      responsibleAgentId,
      rightHolderOnly: !found.owns,
    });
  }
  return links;
}

const ownerLinks = buildOwnerLinks();

function ownerRecordView(owner: Owner, link: OwnerLink): OwnerRecordView {
  const { phone, ...rest } = owner;
  return link.contactVisible ? { ...rest, phone } : rest;
}

/* ---------------------------------------------------- subjects & contacts */

/** A lead, client or owner as a name-only reference, when the viewer may see it. */
function subjectRef(kind: SubjectRef["kind"], id: ID): SubjectRef | undefined {
  switch (kind) {
    case "lead": {
      const lead = leadsById.get(id);
      if (!lead || !visibleLead(lead)) return undefined;
      const ref: SubjectRef = { kind, id };
      if (lead.name) ref.name = lead.name;
      return ref;
    }
    case "client": {
      const client = visibleClient(id);
      return client ? { kind, id, name: client.name } : undefined;
    }
    case "owner": {
      const owner = ownersById.get(id);
      return owner && ownerLinks.has(id) ? { kind, id, name: owner.name } : undefined;
    }
  }
}

function attachedSubject(record: { clientId?: ID; leadId?: ID; ownerId?: ID }): SubjectRef | undefined {
  if (record.clientId) return subjectRef("client", record.clientId);
  if (record.leadId) return subjectRef("lead", record.leadId);
  if (record.ownerId) return subjectRef("owner", record.ownerId);
  return undefined;
}

function partyView(customer: Contract["customer"]): ContractPartyView {
  switch (customer.kind) {
    case "owner": {
      const owner = must(ownersById.get(customer.id), `owner ${customer.id}`);
      const view: ContractPartyView = { kind: "owner", id: owner.id, name: owner.name };
      if (ownerLinks.get(owner.id)?.contactVisible) view.phone = owner.phone;
      else view.contactHidden = "owner_data_permission";
      return view;
    }
    case "client": {
      const client = must(clientsById.get(customer.id), `client ${customer.id}`);
      const view: ContractPartyView = { kind: "client", id: client.id, name: client.name };
      if (visibleClient(client.id) && client.phones[0]) view.phone = client.phones[0];
      else view.contactHidden = "not_responsible";
      return view;
    }
    case "agent": {
      const agent = must(agentsById.get(customer.id), `agent ${customer.id}`);
      const view: ContractPartyView = { kind: "agent", id: agent.id, name: agent.name };
      if (inViewerOrganization(agent.id) || contactsSharedWith(agent.id)) view.phone = agent.phone;
      else view.contactHidden = "no_accepted_cooperation";
      return view;
    }
  }
}

function rightHolderView(contract: Contract, holder: Contract["rightHolderConsents"][number]): RightHolderView {
  const owner = must(ownersById.get(holder.ownerId), `owner ${holder.ownerId}`);
  const view: RightHolderView = {
    ownerId: owner.id,
    name: owner.name,
    status: holder.status,
    isCustomer: contract.customer.kind === "owner" && contract.customer.id === owner.id,
  };
  const consent = holder.consentId ? owner.consents.find((item) => item.id === holder.consentId) : undefined;
  if (consent) view.consent = consent;
  return view;
}

function toContractView(contract: Contract, at: Date): ContractView {
  const daysLeft = tashkentDaysUntil(contract.endsAt, at);
  const view: ContractView = {
    contract,
    scope: contract.agentId === viewer.id ? "own" : "agency",
    customer: partyView(contract.customer),
    agent: must(agentsById.get(contract.agentId), `agent ${contract.agentId}`),
    rightHolders: contract.rightHolderConsents.map((holder) => rightHolderView(contract, holder)),
    expiring: contract.status === "active" && daysLeft >= 0 && daysLeft <= EXPIRING_CONTRACT_DAYS,
    daysLeft,
    missingClauses: CLAUSE_ORDER.filter((clause) => !contract.clauses[clause]),
    missingConsents: contract.rightHolderConsents.filter((holder) => holder.status === "missing").length,
    hasSimpleElectronicSignature: contract.signatures.some((signature) => signature.method === "simple_electronic"),
  };
  const organization = contract.organizationId ? organizationsById.get(contract.organizationId) : undefined;
  if (organization) view.organization = organization;
  const listing = contract.listingId ? listingViewById(contract.listingId, at) : undefined;
  if (listing) view.listing = listing;
  return view;
}

/** Needs action first: expiring, then unsigned, then the rest; earliest end first. */
const CONTRACT_STATUS_RANK: Record<ContractStatus, number> = {
  awaiting_signature: 1,
  draft: 2,
  active: 3,
  expired: 4,
  terminated: 5,
};

function contractRank(view: ContractView): number {
  return view.expiring ? 0 : CONTRACT_STATUS_RANK[view.contract.status];
}

function sortContractViews(views: ContractView[]): ContractView[] {
  return views.sort(
    (a, b) =>
      contractRank(a) - contractRank(b) ||
      isoAsc(a.contract.endsAt, b.contract.endsAt) ||
      byIdAsc(a.contract, b.contract),
  );
}

function contractDoc(view: ContractView): SearchDoc {
  return doc(
    [
      view.contract.id,
      view.contract.number,
      view.contract.service,
      view.customer.name,
      view.agent.name,
      ...view.rightHolders.map((holder) => holder.name),
      view.listing?.listing.id,
      view.listing?.property.areaName,
      view.listing?.property.landmark,
    ],
    [view.customer.phone],
    view.listing ? [view.listing.property.district] : [],
  );
}

/* -------------------------------------------------------- communications */

/**
 * Calls are personal data with a separate recording consent (§36.5): the
 * viewer hears and reads only their own calls. Reviewing colleagues' calls
 * would need a team permission the demo viewer (an agency agent) lacks
 * (§19 "Own/assigned"), so agency calls are not listed at all.
 */
function visibleCall(call: Call): boolean {
  return call.agentId === viewer.id;
}

/** The viewer's own timeline entries about a person they may see. */
function visibleCommunication(item: Communication): boolean {
  return item.agentId === viewer.id && attachedSubject(item) !== undefined;
}

function phoneMatchesOf(phone: string): SubjectRef[] {
  const normalized = normalizeUzPhone(phone);
  if (!normalized) return [];
  const same = (value: string | undefined) => value !== undefined && normalizeUzPhone(value) === normalized;
  const leads = seed.leads
    .filter((lead) => visibleLead(lead) && same(lead.phone))
    .sort(byIdAsc)
    .flatMap((lead) => subjectRef("lead", lead.id) ?? []);
  const clients = seed.clients
    .filter((client) => isViewerClient(client) && client.phones.some(same))
    .sort(byIdAsc)
    .flatMap((client) => subjectRef("client", client.id) ?? []);
  // Only owners whose contact the viewer may see can be recognised by number.
  const owners = seed.owners
    .filter((owner) => ownerLinks.get(owner.id)?.contactVisible && same(owner.phone))
    .sort(byIdAsc)
    .flatMap((owner) => subjectRef("owner", owner.id) ?? []);
  return [...leads, ...clients, ...owners];
}

function toCallView(call: Call, at: Date): CallView {
  const linked = attachedSubject(call);
  const phoneMatches = linked ? [] : phoneMatchesOf(call.phone);
  const view: CallView = {
    call,
    agent: must(agentsById.get(call.agentId), `agent ${call.agentId}`),
    phoneMatches,
    unknownNumber: !linked && phoneMatches.length === 0,
  };
  if (linked) view.linked = linked;
  const listing = call.listingId ? listingViewById(call.listingId, at) : undefined;
  if (listing) view.listing = listing;
  return view;
}

function callViews(at: Date, keep: (call: Call) => boolean = () => true): CallView[] {
  return seed.calls
    .filter((call) => visibleCall(call) && keep(call))
    .sort((a, b) => isoDesc(a.startedAt, b.startedAt) || byIdAsc(a, b))
    .map((call) => toCallView(call, at));
}

function toCommunicationView(item: Communication): CommunicationView {
  const view: CommunicationView = {
    communication: item,
    agent: must(agentsById.get(item.agentId), `agent ${item.agentId}`),
  };
  const subject = attachedSubject(item);
  if (subject) view.subject = subject;
  const call = item.callId ? callsById.get(item.callId) : undefined;
  if (call && visibleCall(call)) view.call = call;
  return view;
}

function communicationViews(keep: (item: Communication) => boolean): CommunicationView[] {
  return seed.communications
    .filter((item) => visibleCommunication(item) && keep(item))
    .sort((a, b) => isoDesc(a.at, b.at) || byIdAsc(a, b))
    .map(toCommunicationView);
}

/** Same person: the same attached record, or the same number when nothing is attached. */
function sameParty(a: { clientId?: ID; leadId?: ID; ownerId?: ID }, b: typeof a): boolean {
  return (
    (a.clientId !== undefined && a.clientId === b.clientId) ||
    (a.leadId !== undefined && a.leadId === b.leadId) ||
    (a.ownerId !== undefined && a.ownerId === b.ownerId)
  );
}

function lastOwnerContact(ownerId: ID): string | undefined {
  const times = [
    ...seed.calls.filter((call) => visibleCall(call) && call.ownerId === ownerId).map((call) => call.startedAt),
    ...seed.communications
      .filter((item) => visibleCommunication(item) && item.ownerId === ownerId)
      .map((item) => item.at),
  ];
  return times.sort(isoDesc)[0];
}

function toOwnerListItem(link: OwnerLink): OwnerListItem {
  const owner = must(ownersById.get(link.ownerId), `owner ${link.ownerId}`);
  const item: OwnerListItem = {
    owner: ownerRecordView(owner, link),
    scope: link.scope,
    contactVisible: link.contactVisible,
    responsibleAgent: must(agentsById.get(link.responsibleAgentId), `agent ${link.responsibleAgentId}`),
    listingIds: link.listings.map((listing) => listing.id),
    propertyIds: link.propertyIds,
    contractIds: link.contracts.map((contract) => contract.id),
    rightHolderOnly: link.rightHolderOnly,
    activeConsents: owner.consents.filter((consent) => !consent.revokedAt).length,
  };
  if (!link.contactVisible) item.contactHidden = "owner_data_permission";
  const lastContactAt = lastOwnerContact(owner.id);
  if (lastContactAt) item.lastContactAt = lastContactAt;
  return item;
}

function ownerDoc(item: OwnerListItem): SearchDoc {
  const properties = item.propertyIds.map((id) => must(propertiesById.get(id), `property ${id}`));
  return doc(
    [
      item.owner.id,
      item.owner.name,
      ...item.listingIds,
      ...item.contractIds.map((id) => contractsById.get(id)?.number),
      ...properties.flatMap((property) => [property.areaName, property.landmark]),
    ],
    [item.owner.phone],
    properties.map((property) => property.district),
  );
}

/* --------------------------------------------------------- verification */

/** Confirmed evidence expiring within this many days needs a new check soon. */
const VERIFICATION_EXPIRING_DAYS = 30;

function resultOnly(item: VerificationItem): VerificationResult {
  const result: VerificationResult = { ...item };
  delete result.source;
  delete result.note;
  delete result.performedById;
  return result;
}

function queueItem(
  item: VerificationItem,
  target: VerificationTarget,
  targetId: ID,
  detailed: boolean,
  scope: VerificationQueueItem["scope"],
  at: Date,
): VerificationQueueItem {
  const msLeft = item.expiresAt ? new Date(item.expiresAt).getTime() - at.getTime() : undefined;
  const confirmed = item.status === "confirmed";
  return {
    key: `${target.kind}:${targetId}:${item.id}`,
    item: detailed ? item : resultOnly(item),
    detailed,
    target,
    scope,
    expiresSoon: confirmed && msLeft !== undefined && msLeft > 0 && msLeft <= VERIFICATION_EXPIRING_DAYS * DAY_MS,
    expired: confirmed && msLeft !== undefined && msLeft <= 0,
  };
}

/** Partner listings the viewer works on: their deals and their cooperation requests. */
function partnerWorkListingIds(): Set<ID> {
  return new Set([
    ...seed.deals.filter((deal) => deal.agentId === viewer.id).map((deal) => deal.listingId),
    ...seed.cooperationRequests.filter((request) => isParty(request, viewer.id)).map((request) => request.listingId),
  ]);
}

function listingQueueItems(listings: Listing[], at: Date): VerificationQueueItem[] {
  return listings.flatMap((listing) => {
    const view = toListingView(listing, at);
    if (!view) return [];
    const scope = view.access === "owner" ? "own" : view.access === "agency" ? "agency" : "partner";
    // The existing result-only rule (§19): source and note go with the right to owner data.
    return listing.verifications.map((item) =>
      queueItem(item, { kind: "listing", view }, listing.id, view.ownerData, scope, at),
    );
  });
}

function verificationQueue(at: Date): VerificationQueueItem[] {
  const workIds = partnerWorkListingIds();
  const listings = seed.listings.filter((listing) => {
    const access = accessOf(listing);
    if (access === "owner" || access === "agency") return true;
    return access !== undefined && workIds.has(listing.id);
  });
  const agentItems = organizationAgents().flatMap((agent) =>
    agent.verifications.map((item) =>
      queueItem(
        item,
        { kind: "agent", agent },
        agent.id,
        agent.id === viewer.id,
        agent.id === viewer.id ? "own" : "agency",
        at,
      ),
    ),
  );
  const organization = viewerOrganizationId ? organizationsById.get(viewerOrganizationId) : undefined;
  const organizationItems = organization
    ? [organization.registry, organization.insurance]
        .filter((item): item is VerificationItem => item !== undefined)
        .map((item) => queueItem(item, { kind: "organization", organization }, organization.id, true, "agency", at))
    : [];
  return [...listingQueueItems(listings, at), ...agentItems, ...organizationItems];
}

const VERIFICATION_RANK: Record<VerificationStatus, number> = {
  problem: 0,
  unavailable: 2,
  pending: 3,
  confirmed: 5,
};

function verificationRank(entry: VerificationQueueItem): number {
  if (entry.expired) return 1;
  if (entry.expiresSoon) return 4;
  return VERIFICATION_RANK[entry.item.status];
}

/* --------------------------------------------------------- team & routing */

function isOpenLead(lead: Lead): boolean {
  return !CLOSED_LEAD.has(lead.status);
}

const INACTIVE_CLIENT = new Set<Client["status"]>(["lost", "deferred"]);
const ACTIVE_LISTING = new Set<ListingStatus>([
  "contract_signed",
  "verification_pending",
  "verified",
  "active_mls",
  "offer",
  "under_contract",
]);

/** Tashkent week (Monday–Sunday) of `at`, as day numbers [from, to). */
function tashkentWeek(at: Date): [number, number] {
  const today = tashkentDayNumber(at);
  // Day 0 of the epoch (1970-01-01) was a Thursday: Monday = 0 after the shift.
  const sinceMonday = (today + 3) % 7;
  return [today - sinceMonday, today - sinceMonday + 7];
}

function memberMetrics(agentId: ID, at: Date): TeamMemberMetrics {
  const today = tashkentDateKey(at);
  const [weekFrom, weekTo] = tashkentWeek(at);
  const leads = seed.leads.filter((lead) => lead.assignedAgentId === agentId);
  return {
    newLeadsToday: leads.filter((lead) => tashkentDateKey(lead.receivedAt) === today).length,
    openLeads: leads.filter(isOpenLead).length,
    slaBreaches: leads.filter((lead) => leadSla(lead, at).state === "breached").length,
    activeClients: seed.clients.filter(
      (client) => client.responsibleAgentId === agentId && !INACTIVE_CLIENT.has(client.status),
    ).length,
    activeListings: seed.listings.filter((listing) => listing.agentId === agentId && ACTIVE_LISTING.has(listing.status))
      .length,
    viewingsThisWeek: seed.viewings.filter((viewing) => {
      if (viewing.agentId !== agentId && viewing.partnerAgentId !== agentId) return false;
      if (INACTIVE_VIEWING.has(viewing.status)) return false;
      const dayNumber = tashkentDayNumber(viewing.startsAt);
      return dayNumber >= weekFrom && dayNumber < weekTo;
    }).length,
    dealsInProgress: seed.deals.filter(
      (deal) => (deal.agentId === agentId || deal.partnerAgentId === agentId) && deal.stage !== "archived",
    ).length,
  };
}

function availabilityOf(agentId: ID): AgentAvailability {
  return must(availabilityByAgent.get(agentId), `availability of ${agentId}`);
}

function toTeamMemberView(agent: Agent, at: Date): TeamMemberView {
  const availability = availabilityOf(agent.id);
  const metrics = memberMetrics(agent.id, at);
  return {
    agent,
    isLead: viewerTeam?.leadAgentId === agent.id,
    isViewer: agent.id === viewer.id,
    availability,
    metrics,
    capacityLeft: Math.max(0, availability.dailyLeadCapacity - metrics.newLeadsToday),
  };
}

function toWorkload(agentId: ID, at: Date): AgentWorkload {
  const availability = availabilityOf(agentId);
  const metrics = memberMetrics(agentId, at);
  const workload: AgentWorkload = {
    agentId,
    status: availability.status,
    assignedToday: metrics.newLeadsToday,
    openLeads: metrics.openLeads,
    capacity: availability.dailyLeadCapacity,
    remaining: Math.max(0, availability.dailyLeadCapacity - metrics.newLeadsToday),
  };
  if (availability.awayUntil) workload.awayUntil = availability.awayUntil;
  return workload;
}

function organizationRules(): RoutingRule[] {
  return seed.routingRules
    .filter((rule) => rule.organizationId === viewerOrganizationId)
    .sort((a, b) => a.priority - b.priority || byIdAsc(a, b));
}

/* ------------------------------------------------------------- partners */

function isPartnerAgent(agent: Agent): boolean {
  return agent.id !== viewer.id && !inViewerOrganization(agent.id);
}

function partnerAgentView(agent: Agent): PartnerAgent {
  const { phone, telegramUsername, verifications, ...rest } = agent;
  const view: PartnerAgent = { ...rest, verifications: verifications.map(resultOnly) };
  if (contactsSharedWith(agent.id)) {
    view.phone = phone;
    if (telegramUsername) view.telegramUsername = telegramUsername;
  }
  return view;
}

function partnerOrganizationView(organization: Organization): PartnerOrganization {
  const { registry, insurance, ...rest } = organization;
  const view: PartnerOrganization = { ...rest };
  if (registry) view.registry = resultOnly(registry);
  if (insurance) view.insurance = resultOnly(insurance);
  return view;
}

function requestsWith(agentId: ID): CooperationRequest[] {
  return seed.cooperationRequests.filter((request) => isParty(request, viewer.id) && isParty(request, agentId));
}

function cooperationStats(agentId: ID): CooperationStats {
  const stats: CooperationStats = { total: 0, accepted: 0, declined: 0, inProgress: 0, other: 0 };
  for (const request of requestsWith(agentId)) {
    stats.total += 1;
    if (request.status === "accepted") stats.accepted += 1;
    else if (request.status === "declined") stats.declined += 1;
    else if (OPEN_COOPERATION.has(request.status)) stats.inProgress += 1;
    else stats.other += 1;
  }
  return stats;
}

function withoutAgent(view: ListingView): PartnerListingView {
  const result: PartnerListingView & Partial<Pick<ListingView, "agent" | "organization">> = { ...view };
  delete result.agent;
  delete result.organization;
  return result;
}

/** A cooperation view inside a partner profile, without the agent and organization objects. */
function withoutAgents(view: CooperationView): PartnerCooperationView {
  const result: Omit<PartnerCooperationView, "listing"> &
    Partial<Pick<CooperationView, "fromAgent" | "toAgent" | "counterpart" | "fromOrganization" | "toOrganization">> & {
      listing: ListingView | PartnerListingView;
    } = { ...view };
  delete result.fromAgent;
  delete result.toAgent;
  delete result.counterpart;
  delete result.fromOrganization;
  delete result.toOrganization;
  return { ...result, listing: withoutAgent(view.listing) };
}

function toPartnerListItem(agent: Agent, at: Date): PartnerListItem {
  const contactsShared = contactsSharedWith(agent.id);
  const item: PartnerListItem = {
    agent: partnerAgentView(agent),
    contactsShared,
    cooperation: cooperationStats(agent.id),
    activeMlsListings: visibleListings().filter(
      (listing) => listing.agentId === agent.id && listing.status === "active_mls",
    ).length,
  };
  const organization = agent.organizationId ? organizationsById.get(agent.organizationId) : undefined;
  if (organization) item.organization = partnerOrganizationView(organization);
  if (!contactsShared) item.contactHidden = "no_accepted_cooperation";
  const interactions = [
    ...requestsWith(agent.id).map((request) => must(latestVersion(request), `terms of ${request.id}`).proposedAt),
    ...seed.deals
      .filter((deal) => deal.agentId === viewer.id && deal.partnerAgentId === agent.id)
      .map((deal) => deal.createdAt),
    ...seed.viewings
      .filter(
        (viewing) =>
          viewing.agentId === viewer.id && viewing.partnerAgentId === agent.id && isBefore(viewing.startsAt, at),
      )
      .map((viewing) => viewing.startsAt),
  ].sort(isoDesc);
  if (interactions[0]) item.lastInteractionAt = interactions[0];
  return item;
}

function partnerDoc(agent: Agent): SearchDoc {
  const organization = agent.organizationId ? organizationsById.get(agent.organizationId) : undefined;
  return doc([agent.id, agent.name, organization?.name], [], agent.territory);
}

/* ---------------------------------------------------------------- audit */

/** Reveals and views of restricted data, exports, permission/role and security events (§38.6, §39.6). */
const SENSITIVE_AUDIT_ACTIONS = new Set<string>([
  "contact_revealed",
  "owner_contact_viewed",
  "restricted_document_viewed",
  "document.viewed",
  "export_requested",
  "permission_granted",
  "permission_revoked",
  "role_changed",
  "login_new_device",
]);

const documentsById = new Map<ID, { document: DealDocument; deal: Deal }>(
  seed.deals.flatMap((deal) => deal.documents.map((document) => [document.id, { document, deal }] as const)),
);

function consentSubject(consentId: ID): { kind: "client"; client: Client } | { kind: "owner"; owner: Owner } | undefined {
  const client = seed.clients.find((item) => item.consents.some((consent) => consent.id === consentId));
  if (client) return { kind: "client", client };
  const owner = seed.owners.find((item) => item.consents.some((consent) => consent.id === consentId));
  return owner ? { kind: "owner", owner } : undefined;
}

/** Agents a target record belongs to (the responsible / listing / deal agent). */
function recordAgents(target: AuditEvent["target"]): ID[] {
  switch (target.kind) {
    case "lead": {
      const agentId = leadsById.get(target.id)?.assignedAgentId;
      return agentId ? [agentId] : [];
    }
    case "client":
      return [clientsById.get(target.id)?.responsibleAgentId].filter((id): id is ID => id !== undefined);
    case "owner": {
      const link = ownerLinks.get(target.id);
      return link ? [...link.listings, ...link.contracts].map((record) => record.agentId) : [];
    }
    case "listing":
      return [listingsById.get(target.id)?.agentId].filter((id): id is ID => id !== undefined);
    case "contract":
      return [contractsById.get(target.id)?.agentId].filter((id): id is ID => id !== undefined);
    case "document": {
      const found = documentsById.get(target.id);
      return found ? [found.deal.agentId] : [];
    }
    case "deal":
      return [dealsById.get(target.id)?.agentId].filter((id): id is ID => id !== undefined);
    case "offer": {
      const offer = offersById.get(target.id);
      const client = offer ? clientsById.get(offer.clientId) : undefined;
      return client ? [client.responsibleAgentId] : [];
    }
    case "agent":
      return [target.id];
    case "consent": {
      const subject = consentSubject(target.id);
      if (subject?.kind === "client") return [subject.client.responsibleAgentId];
      if (subject?.kind === "owner") return recordAgents({ kind: "owner", id: subject.owner.id });
      return [];
    }
    case "cooperation": {
      const request = cooperationById.get(target.id);
      return request ? [request.fromAgentId, request.toAgentId] : [];
    }
    default:
      return [];
  }
}

function listingLabel(listingId: ID): string {
  const listing = listingsById.get(listingId);
  const property = listing ? propertiesById.get(listing.propertyId) : undefined;
  return property?.areaName ? `${property.areaName} (${listingId})` : listingId;
}

/** A list-safe label: names, massifs and numbers only — never a phone, address or document content. */
function auditTarget(target: AuditEvent["target"]): AuditEventView["target"] {
  const base = { kind: target.kind, id: target.id };
  switch (target.kind) {
    case "lead":
      return { ...base, label: leadsById.get(target.id)?.name ?? target.id };
    case "client":
      return { ...base, label: clientsById.get(target.id)?.name ?? target.id };
    case "owner":
      return { ...base, label: ownersById.get(target.id)?.name ?? target.id };
    case "agent":
      return { ...base, label: agentsById.get(target.id)?.name ?? target.id };
    case "listing":
      return { ...base, label: listingLabel(target.id) };
    case "contract":
      return { ...base, label: contractsById.get(target.id)?.number ?? target.id };
    case "document": {
      const found = documentsById.get(target.id);
      return found ? { ...base, label: target.id, documentType: found.document.type } : { ...base, label: target.id };
    }
    case "deal": {
      const deal = dealsById.get(target.id);
      const client = deal ? clientsById.get(deal.clientId) : undefined;
      return { ...base, label: client ? `${client.name} (${target.id})` : target.id };
    }
    case "consent": {
      const subject = consentSubject(target.id);
      const name = subject?.kind === "client" ? subject.client.name : subject?.owner.name;
      return { ...base, label: name ?? target.id };
    }
    case "cooperation": {
      const request = cooperationById.get(target.id);
      return { ...base, label: request ? `${listingLabel(request.listingId)} · ${target.id}` : target.id };
    }
    default:
      return { ...base, label: target.id };
  }
}

/** Where an audit target opens, only when the viewer may open it (same rules as the record's own screen). */
function auditTargetLink(target: AuditEvent["target"]): AuditTargetLink | undefined {
  switch (target.kind) {
    case "contract": {
      const contract = contractsById.get(target.id);
      return contract && isVisibleContract(contract) ? { route: "contract", id: contract.id } : undefined;
    }
    case "owner":
      return ownerLinks.has(target.id) ? { route: "owner", id: target.id } : undefined;
    case "call": {
      const call = callsById.get(target.id);
      return call && visibleCall(call) ? { route: "call", id: call.id } : undefined;
    }
    case "agent": {
      const agent = agentsById.get(target.id);
      if (!agent) return undefined;
      return { route: isPartnerAgent(agent) ? "partner" : "member", id: agent.id };
    }
    case "consent": {
      // The registry lists the organization's clients' consents and those of the owners it knows.
      const subject = consentSubject(target.id);
      if (subject?.kind === "client" && inViewerOrganization(subject.client.responsibleAgentId)) {
        return { route: "consents", subject: "client" };
      }
      if (subject?.kind === "owner" && ownerLinks.has(subject.owner.id)) return { route: "consents", subject: "owner" };
      return undefined;
    }
    default:
      return undefined;
  }
}

function toAuditEventView(event: AuditEvent, log: AuditEventView["log"], dealId?: ID): AuditEventView {
  const system = event.actorId === SYSTEM_ACTOR_ID;
  const target: AuditEventView["target"] = auditTarget(event.target);
  const link = auditTargetLink(event.target);
  if (link) target.link = link;
  const view: AuditEventView = {
    event,
    log,
    system,
    target,
    sensitive: SENSITIVE_AUDIT_ACTIONS.has(event.action),
    scope: auditScope(event),
  };
  const actor = system ? undefined : agentsById.get(event.actorId);
  if (actor) view.actor = actor;
  if (dealId) view.dealId = dealId;
  return view;
}

/* ============================================================ public API */

/* ---------------------------------------------------------------- people */

/** The signed-in demo user and their organization. */
export async function getViewer(): Promise<ViewerView> {
  const view: ViewerView = { agent: viewer };
  const organization = viewer.organizationId ? organizationsById.get(viewer.organizationId) : undefined;
  if (organization) view.organization = organization;
  return copy(view);
}

/** Professional directory: colleagues and MLS partners (work contacts are PROFESSIONAL-level). */
export async function listAgents(): Promise<Agent[]> {
  return copy([...seed.agents].sort(byIdAsc));
}

export async function getAgent(id: ID): Promise<Agent | undefined> {
  return copy(agentsById.get(id));
}

export async function getOrganization(id: ID): Promise<Organization | undefined> {
  return copy(organizationsById.get(id));
}

/* ------------------------------------------------------------------ CRM */

/** Lead inbox, newest first. */
export async function listLeads(filter: LeadFilter = {}): Promise<LeadView[]> {
  const at = now();
  return copy(
    seed.leads
      .filter((lead) => visibleLead(lead) && (!filter.status || lead.status === filter.status))
      .sort((a, b) => isoDesc(a.receivedAt, b.receivedAt) || byIdAsc(a, b))
      .map((lead) => toLeadView(lead, at)),
  );
}

export async function getLead(id: ID): Promise<LeadView | undefined> {
  const lead = leadsById.get(id);
  return lead && visibleLead(lead) ? copy(toLeadView(lead, now())) : undefined;
}

/** The viewer's clients, most recently contacted first. */
export async function listClients(filter: ClientFilter = {}): Promise<ClientListItem[]> {
  const query = filter.q ? parseQuery(filter.q) : undefined;
  return copy(
    seed.clients
      .filter(
        (client) =>
          isViewerClient(client) &&
          (!filter.status || client.status === filter.status) &&
          (!query || matchesQuery(clientDoc(client), query)),
      )
      .sort(
        (a, b) =>
          isoDesc(a.lastContactAt ?? a.createdAt, b.lastContactAt ?? b.createdAt) || byIdAsc(a, b),
      )
      .map(toClientListItem),
  );
}

/** Client profile (§14.3, §22.3) with everything linked to the client. */
export async function getClient(id: ID): Promise<ClientDetailView | undefined> {
  const client = visibleClient(id);
  if (!client) return undefined;
  const at = now();
  const pool = buildPool(at, true);
  const requirements = viewerRequirements()
    .filter((requirement) => requirement.clientId === id)
    .sort((a, b) => isoDesc(a.updatedAt, b.updatedAt) || byIdAsc(a, b));
  const deals = dealViews(at).filter((view) => view.deal.clientId === id);
  const viewings = viewingViews(at, (viewing) => viewing.clientId === id);
  const dealIds = new Set(deals.map((view) => view.deal.id));
  const viewingIds = new Set(viewings.map((view) => view.viewing.id));
  const requirementIds = new Set(requirements.map((requirement) => requirement.id));
  const tasks = taskViews(at, (task) => {
    const related = task.related;
    if (!related) return false;
    return (
      (related.kind === "client" && related.id === id) ||
      (related.kind === "requirement" && requirementIds.has(related.id)) ||
      (related.kind === "match" && requirementIds.has(related.id.split("--")[0])) ||
      (related.kind === "lead" && related.id === client.leadId) ||
      (related.kind === "deal" && dealIds.has(related.id)) ||
      (related.kind === "viewing" && viewingIds.has(related.id))
    );
  });
  const view: ClientDetailView = {
    client,
    responsibleAgent: must(agentsById.get(client.responsibleAgentId), `agent ${client.responsibleAgentId}`),
    requirements: requirements.map((requirement) => toRequirementView(requirement, pool, at)),
    viewings,
    offers: offerViews(at, (offer) => offer.clientId === id),
    deals,
    tasks,
    matches: summarize(requirements.flatMap((requirement) => matchesFor(requirement, pool, at))),
  };
  const lead = client.leadId ? leadsById.get(client.leadId) : undefined;
  if (lead) view.lead = lead;
  return copy(view);
}

export async function listRequirements(filter: RequirementFilter = {}): Promise<RequirementView[]> {
  const at = now();
  const pool = buildPool(at, true);
  return copy(
    viewerRequirements()
      .filter(
        (requirement) =>
          (!filter.clientId || requirement.clientId === filter.clientId) &&
          (!filter.status || requirement.status === filter.status),
      )
      .sort((a, b) => isoDesc(a.updatedAt, b.updatedAt) || byIdAsc(a, b))
      .map((requirement) => toRequirementView(requirement, pool, at)),
  );
}

export async function getRequirement(id: ID): Promise<RequirementView | undefined> {
  const requirement = requirementsById.get(id);
  if (!requirement || requirement.agentId !== viewer.id) return undefined;
  const at = now();
  return copy(toRequirementView(requirement, buildPool(at, true), at));
}

/* ------------------------------------------------------------- listings */

/** Property search (§15.2, §22.5); newest update first. */
export async function listListings(filter: ListingFilter = {}): Promise<ListingView[]> {
  const at = now();
  const scope = filter.scope ?? "all";
  const query = filter.q ? parseQuery(filter.q) : undefined;
  const priceCurrency = filter.currency ?? "USD";
  const priceMaxMinor = filter.priceMax !== undefined ? toMinor(filter.priceMax) : undefined;

  const views = visibleListings()
    .map((listing) => must(toListingView(listing, at), `listing view ${listing.id}`))
    .filter((view) => {
      const { listing, property, access, freshness } = view;
      if (scope === "mine" && access !== "owner") return false;
      if (scope === "agency" && !seesRestricted(access)) return false;
      if (scope === "mls" && (listing.confidentiality === "restricted" || NOT_PUBLISHED_TO_PARTNERS.has(listing.status))) {
        return false;
      }
      if (filter.dealType && listing.dealType !== filter.dealType) return false;
      if (filter.propertyType && property.propertyType !== filter.propertyType) return false;
      if (filter.district && property.district !== filter.district) return false;
      // Unknown room counts never satisfy a room filter (Unknown is a value, not a match).
      if (filter.roomsMin !== undefined && (property.rooms === undefined || property.rooms < filter.roomsMin)) {
        return false;
      }
      if (filter.roomsMax !== undefined && (property.rooms === undefined || property.rooms > filter.roomsMax)) {
        return false;
      }
      if (filter.currency && listing.price.currency !== filter.currency) return false;
      if (priceMaxMinor !== undefined) {
        // Different currencies are not compared silently (§34.1).
        if (listing.price.currency !== priceCurrency || listing.price.amountMinor > priceMaxMinor) return false;
      }
      if (filter.source && listing.source !== filter.source) return false;
      if (filter.freshness && freshness.state !== filter.freshness) return false;
      if (filter.status && listing.status !== filter.status) return false;
      return !query || matchesQuery(listingDoc(view), query);
    });
  return copy(sortListingViews(views));
}

/** Property / listing profile (§22.6); undefined when the listing is not visible to the viewer. */
export async function getListing(id: ID): Promise<ListingDetailView | undefined> {
  const at = now();
  const listing = listingsById.get(id);
  const base = listing ? toListingView(listing, at) : undefined;
  if (!listing || !base) return undefined;
  const property = must(propertiesById.get(listing.propertyId), `property ${listing.propertyId}`);
  const detail: ListingDetailView = {
    ...base,
    otherListings: sortListingViews(
      visibleListings()
        .filter((other) => other.propertyId === listing.propertyId && other.id !== listing.id)
        .map((other) => must(toListingView(other, at), `listing view ${other.id}`)),
    ),
    viewings: viewingViews(at, (viewing) => viewing.listingId === id),
    offers: offerViews(at, (offer) => offer.listingId === id),
    reverseMatches: reverseMatchesFor(listingCandidate(listing), at),
    cooperation: cooperationViews(at).filter((view) => view.request.listingId === id),
  };
  const owner = base.ownerData && property.ownerId ? ownersById.get(property.ownerId) : undefined;
  if (owner) detail.owner = owner;
  return copy(detail);
}

/** "Подходит N вашим клиентам" (§12.5): the viewer's active requirements this listing fits. */
export async function getReverseMatches(listingId: ID): Promise<ReverseMatchView[]> {
  const listing = listingsById.get(listingId);
  if (!listing || !accessOf(listing)) return [];
  return copy(reverseMatchesFor(listingCandidate(listing), now()));
}

/* ------------------------------------------------------------- telegram */

export async function listTelegramSources(): Promise<TelegramSource[]> {
  return copy([...seed.telegramSources].sort(byIdAsc));
}

/** Telegram Radar feed, newest post first. District/deal filters use confident parsed values only. */
export async function listTelegramListings(filter: TelegramFilter = {}): Promise<TelegramListingView[]> {
  const at = now();
  const query = filter.q ? parseQuery(filter.q) : undefined;
  return copy(
    seed.telegramListings
      .filter(
        (post) =>
          (!filter.status || post.status === filter.status) &&
          (!filter.district || confident(post.parsed.district) === filter.district) &&
          (!filter.dealType || confident(post.parsed.dealType) === filter.dealType),
      )
      .map((post) => toTelegramView(post, at))
      .filter((view) => !query || matchesQuery(telegramDoc(view), query))
      .sort((a, b) => isoDesc(a.post.publishedAt, b.post.publishedAt) || byIdAsc(a.post, b.post)),
  );
}

export async function getTelegramListing(id: ID): Promise<TelegramListingDetailView | undefined> {
  const post = postsById.get(id);
  if (!post) return undefined;
  const at = now();
  const detail: TelegramListingDetailView = {
    ...toTelegramView(post, at),
    duplicates: post.duplicateCandidates.flatMap((candidate) => {
      const other = postsById.get(candidate.listingId);
      return other ? [{ view: toTelegramView(other, at), reasons: candidate.reasons }] : [];
    }),
    linkedClients: post.linkedClientIds
      .map((clientId) => visibleClient(clientId))
      .filter((client): client is Client => client !== undefined),
    reverseMatches: reverseMatchesFor(candidateFromTelegram(post), at),
  };
  return copy(detail);
}

/* ------------------------------------------------------------- matching */

/** Matches for one of the viewer's requirements, computed now (§12, §22.7). */
export async function getMatchesForRequirement(
  requirementId: ID,
  options: MatchOptions = {},
): Promise<MatchView[]> {
  const requirement = requirementsById.get(requirementId);
  if (!requirement || requirement.agentId !== viewer.id) return [];
  const at = now();
  const pool = buildPool(at, options.includeTelegram ?? true);
  return copy(matchesFor(requirement, pool, at, options.sort ?? "relevance"));
}

/** One match card by its `matchId`, or undefined when the pair no longer matches. */
export async function getMatch(id: string): Promise<MatchView | undefined> {
  const [requirementId, targetId] = id.split("--");
  if (!requirementId || !targetId) return undefined;
  const matches = await getMatchesForRequirement(requirementId);
  return matches.find((match) => match.id === id);
}

/** All matches across the viewer's active requirements, best first. */
export async function listMatchFeed(filter: MatchFeedFilter = {}): Promise<MatchView[]> {
  const at = now();
  return copy(
    feed(at, buildPool(at, true)).filter(
      (match) => (!filter.band || match.ranked.band === filter.band) && (!filter.status || match.status === filter.status),
    ),
  );
}

/* ---------------------------------------------------------- cooperation */

/** The viewer's co-broking requests (§15.3), most recent proposal first. */
export async function listCooperation(filter: CooperationFilter = {}): Promise<CooperationView[]> {
  return copy(
    cooperationViews(now()).filter((view) => !filter.direction || view.direction === filter.direction),
  );
}

export async function getCooperation(id: ID): Promise<CooperationView | undefined> {
  const request = cooperationById.get(id);
  return request ? copy(toCooperationView(request, now())) : undefined;
}

/* ---------------------------------------------------------- transaction */

/** The viewer's viewings in time order; `fromIso` inclusive, `toIso` exclusive. */
export async function listViewings(filter: ViewingFilter = {}): Promise<ViewingView[]> {
  const from = filter.fromIso ? new Date(filter.fromIso).getTime() : undefined;
  const to = filter.toIso ? new Date(filter.toIso).getTime() : undefined;
  return copy(
    viewingViews(now(), (viewing) => {
      const start = new Date(viewing.startsAt).getTime();
      return (
        (from === undefined || start >= from) &&
        (to === undefined || start < to) &&
        (!filter.status || viewing.status === filter.status)
      );
    }),
  );
}

export async function getViewing(id: ID): Promise<ViewingView | undefined> {
  const viewing = viewingsById.get(id);
  return viewing ? copy(toViewingView(viewing, now())) : undefined;
}

/**
 * Offers on the viewer's clients' behalf, most recent version first. Each
 * view carries the listing, client, deal (id + stage), latest version and
 * whose answer it waits for, so an offers list needs no further calls.
 */
export async function listOffers(filter: OfferFilter = {}): Promise<OfferView[]> {
  return copy(
    offerViews(
      now(),
      (offer) =>
        (!filter.listingId || offer.listingId === filter.listingId) &&
        (!filter.clientId || offer.clientId === filter.clientId) &&
        (!filter.dealId || offer.dealId === filter.dealId) &&
        (!filter.status || offer.status === filter.status),
    ),
  );
}

export async function getOffer(id: ID): Promise<OfferView | undefined> {
  const offer = offersById.get(id);
  return offer ? copy(toOfferView(offer, now())) : undefined;
}

/** The viewer's deals in pipeline order (§11.7). */
export async function listDeals(): Promise<DealView[]> {
  return copy(dealViews(now()));
}

/** Deal workspace (§22.12). */
export async function getDeal(id: ID): Promise<DealDetailView | undefined> {
  const deal = dealsById.get(id);
  const at = now();
  const base = deal ? toDealView(deal, at) : undefined;
  if (!deal || !base) return undefined;
  const cooperationRequest = deal.cooperationId ? cooperationById.get(deal.cooperationId) : undefined;
  const detail: DealDetailView = {
    ...base,
    offers: offerViews(
      at,
      (offer) => offer.dealId === id || (offer.listingId === deal.listingId && offer.clientId === deal.clientId),
    ),
    viewings: viewingViews(
      at,
      (viewing) => viewing.listingId === deal.listingId && viewing.clientId === deal.clientId,
    ),
    tasks: taskViews(at, (task) => task.related?.kind === "deal" && task.related.id === id),
    contracts: sortContractViews(
      visibleContracts.filter((contract) => contract.dealId === id).map((contract) => toContractView(contract, at)),
    ),
  };
  const cooperation = cooperationRequest ? toCooperationView(cooperationRequest, at) : undefined;
  if (cooperation) detail.cooperation = cooperation;
  // `propertyView` already drops ownerId without the right; the check keeps the rule explicit.
  const ownerId = base.listing.ownerData ? base.listing.property.ownerId : undefined;
  const owner = ownerId ? ownersById.get(ownerId) : undefined;
  if (owner) detail.owner = owner;
  return copy(detail);
}

/* ----------------------------------------------------- tasks & signals */

/** The viewer's tasks by due time. */
export async function listTasks(filter: TaskFilter = {}): Promise<TaskView[]> {
  return copy(taskViews(now(), (task) => !filter.status || task.status === filter.status));
}

/** Notification centre grouped by meaning (§36.5), newest first. */
export async function listNotifications(filter: NotificationFilter = {}): Promise<AppNotification[]> {
  return copy(
    seed.notifications
      .filter((notification) => !filter.category || notification.category === filter.category)
      .sort((a, b) => isoDesc(a.at, b.at) || byIdAsc(a, b)),
  );
}

export async function countUnreadNotifications(): Promise<number> {
  return seed.notifications.filter((notification) => !notification.read).length;
}

/* ---------------------------------------------------------------- today */

/** Home / Today workspace (§9.4, §22.1, §36.2): what needs attention now. */
export async function getTodayFeed(): Promise<TodayFeed> {
  const at = now();
  const today = tashkentDateKey(at);
  const pool = buildPool(at, true);
  const tasks = taskViews(at);
  const ownListings = [...pool.listingViews.values()].filter((view) => view.access === "owner");

  const newMatches: MatchView[] = [];
  const perRequirement = new Map<ID, number>();
  for (const match of feed(at, pool)) {
    if (newMatches.length >= TODAY_MATCH_LIMIT) break;
    if (match.status !== "new" || (match.ranked.band !== "excellent" && match.ranked.band !== "good")) continue;
    const taken = perRequirement.get(match.requirement.id) ?? 0;
    if (taken >= TODAY_MATCHES_PER_REQUIREMENT) continue;
    perRequirement.set(match.requirement.id, taken + 1);
    newMatches.push(match);
  }

  const expiringContracts: ExpiringContractView[] = ownListings
    .flatMap((view) => {
      const expiresAt = view.listing.contractExpiresAt;
      if (!expiresAt || FINISHED.has(view.listing.status)) return [];
      const msLeft = new Date(expiresAt).getTime() - at.getTime();
      if (msLeft <= 0 || msLeft > EXPIRING_CONTRACT_DAYS * DAY_MS) return [];
      return [{ view, expiresAt, daysLeft: Math.floor(msLeft / DAY_MS) }];
    })
    .sort((a, b) => isoAsc(a.expiresAt, b.expiresAt) || byIdAsc(a.view.listing, b.view.listing));

  const staleListings = ownListings
    .filter((view) => !FINISHED.has(view.listing.status) && needsAttention(view.freshness))
    .sort((a, b) => b.freshness.ageDays - a.freshness.ageDays || byIdAsc(a.listing, b.listing));

  const priceDrops: PriceDropView[] = [...pool.listingViews.values()]
    .flatMap((view) => {
      const history = view.listing.priceHistory;
      if (history.length < 2 || !listingCandidate(view.listing).active) return [];
      const last = history[history.length - 1];
      const previous = history[history.length - 2];
      const recent = at.getTime() - new Date(last.at).getTime() <= PRICE_DROP_DAYS * DAY_MS;
      const decrease =
        last.price.currency === previous.price.currency && last.price.amountMinor < previous.price.amountMinor;
      if (!recent || !decrease) return [];
      return [
        {
          view,
          previous: previous.price,
          current: last.price,
          changedAt: last.at,
          affectedRequirementsCount: reverseMatchesFor(listingCandidate(view.listing), at).length,
        },
      ];
    })
    .sort((a, b) => isoDesc(a.changedAt, b.changedAt) || byIdAsc(a.view.listing, b.view.listing));

  const feedView: TodayFeed = {
    viewer: { agent: viewer },
    generatedAt: at.toISOString(),
    overdueTasks: tasks.filter((task) => task.state === "overdue"),
    todayTasks: tasks.filter((task) => task.state === "today"),
    todayViewings: viewingViews(
      at,
      (viewing) => !INACTIVE_VIEWING.has(viewing.status) && tashkentDateKey(viewing.startsAt) === today,
    ),
    slaLeads: seed.leads
      .filter(visibleLead)
      .map((lead) => toLeadView(lead, at))
      .filter((view) => view.sla.state === "breached" || view.sla.state === "due_soon")
      .sort((a, b) => isoAsc(a.lead.slaDueAt, b.lead.slaDueAt) || byIdAsc(a.lead, b.lead)),
    newMatches,
    incomingCooperation: cooperationViews(at)
      .filter((view) => view.awaitingViewer)
      .sort((a, b) => isoAsc(a.request.respondBy, b.request.respondBy) || byIdAsc(a.request, b.request)),
    expiringContracts,
    staleListings,
    priceDrops,
    dealsNeedingAttention: dealViews(at)
      .filter(needsAttentionDeal)
      .sort(
        (a, b) =>
          isoAsc(a.deal.nextAction?.dueAt ?? "9999", b.deal.nextAction?.dueAt ?? "9999") ||
          byIdAsc(a.deal, b.deal),
      ),
    missedCalls: callViews(at, (call) => call.outcome === "missed"),
  };
  const organization = viewer.organizationId ? organizationsById.get(viewer.organizationId) : undefined;
  if (organization) feedView.viewer.organization = organization;
  return copy(feedView);
}

/* --------------------------------------------------------------- search */

/** Global smart search (§9.3, §36.4), at most 8 results per group, access rules applied first. */
export async function searchAll(q: string): Promise<SearchResults> {
  const query = parseQuery(q);
  const empty: SearchResults = { query: q.trim(), clients: [], leads: [], listings: [], telegram: [], deals: [] };
  if (!query) return empty;
  const at = now();
  const limit = <T>(items: T[]) => items.slice(0, SEARCH_LIMIT);
  const results: SearchResults = {
    query: query.query,
    clients: limit(
      seed.clients
        .filter((client) => isViewerClient(client) && matchesQuery(clientDoc(client), query))
        .sort(byIdAsc)
        .map(toClientListItem),
    ),
    leads: limit(
      seed.leads
        .filter((lead) => visibleLead(lead) && matchesQuery(leadDoc(lead), query))
        .sort((a, b) => isoDesc(a.receivedAt, b.receivedAt) || byIdAsc(a, b))
        .map((lead) => toLeadView(lead, at)),
    ),
    listings: limit(
      sortListingViews(
        visibleListings()
          .map((listing) => must(toListingView(listing, at), `listing view ${listing.id}`))
          .filter((view) => matchesQuery(listingDoc(view), query)),
      ),
    ),
    telegram: limit(
      seed.telegramListings
        .map((post) => toTelegramView(post, at))
        .filter((view) => matchesQuery(telegramDoc(view), query))
        .sort((a, b) => isoDesc(a.post.publishedAt, b.post.publishedAt) || byIdAsc(a.post, b.post)),
    ),
    deals: limit(dealViews(at).filter((view) => matchesQuery(dealDoc(view), query))),
  };
  return copy(results);
}

/* ------------------------------------------------------------ contracts */

/**
 * Service contracts of the viewer's organization (§17.5, §38.5): the viewer's
 * own and colleagues'; a partner's contracts are never listed. Needs action
 * first: expiring (≤ 14 Tashkent days), awaiting signature, drafts, then
 * active, expired and terminated; earliest end date first within a group.
 */
export async function listContracts(filter: ContractFilter = {}): Promise<ContractView[]> {
  const at = now();
  const query = filter.q ? parseQuery(filter.q) : undefined;
  const views = visibleContracts
    .filter((contract) => !filter.kind || contract.kind === filter.kind)
    .map((contract) => toContractView(contract, at))
    .filter((view) => {
      if (filter.status === "expiring" && !view.expiring) return false;
      if (filter.status && filter.status !== "expiring" && view.contract.status !== filter.status) return false;
      return !query || matchesQuery(contractDoc(view), query);
    });
  return copy(sortContractViews(views));
}

/** One contract with its deal, request and related contracts; undefined for a partner's contract. */
export async function getContract(id: ID): Promise<ContractDetailView | undefined> {
  const contract = contractsById.get(id);
  if (!contract || !isVisibleContract(contract)) return undefined;
  const at = now();
  const detail: ContractDetailView = {
    ...toContractView(contract, at),
    related: sortContractViews(
      visibleContracts
        .filter((other) => other.id !== id && other.listingId !== undefined && other.listingId === contract.listingId)
        .map((other) => toContractView(other, at)),
    ),
  };
  const deal = contract.dealId ? dealsById.get(contract.dealId) : undefined;
  const dealView = deal ? toDealView(deal, at) : undefined;
  if (dealView) detail.deal = dealView;
  const requirement = contract.requirementId ? requirementsById.get(contract.requirementId) : undefined;
  if (requirement && requirement.agentId === viewer.id) detail.requirement = requirement;
  if (contract.kind === "cooperation" && contract.customer.kind === "agent") {
    const partnerId = contract.customer.id;
    const request =
      (deal?.cooperationId ? cooperationById.get(deal.cooperationId) : undefined) ??
      seed.cooperationRequests.find(
        (item) =>
          item.listingId === contract.listingId &&
          item.status === "accepted" &&
          isParty(item, viewer.id) &&
          isParty(item, partnerId),
      );
    const cooperation = request ? toCooperationView(request, at) : undefined;
    if (cooperation) detail.cooperation = cooperation;
  }
  return copy(detail);
}

/** The contract a listing's `contractId` refers to, e.g. "DR-2026-041"; same visibility as `getContract`. */
export async function getContractByNumber(number: string): Promise<ContractDetailView | undefined> {
  const contract = contractsByNumber.get(number);
  return contract ? getContract(contract.id) : undefined;
}

/* ------------------------------------------------------------- consents */

/**
 * Consent registry (§38.6 item 2): every consent of the organization's
 * clients (own and colleagues') and of the owners linked to its listings or
 * contracts, newest event (grant or revocation) first.
 */
export async function listConsents(filter: ConsentFilter = {}): Promise<ConsentRegistryItem[]> {
  const items: ConsentRegistryItem[] = [];
  const add = (
    subject: ConsentRegistryItem["subject"],
    consents: readonly Consent[],
    responsibleAgentId: ID,
    scope: RecordScope,
  ) => {
    for (const consent of consents) {
      items.push({
        subject,
        consent,
        state: consent.revokedAt ? "revoked" : "active",
        responsibleAgent: must(agentsById.get(responsibleAgentId), `agent ${responsibleAgentId}`),
        scope,
      });
    }
  };
  if (filter.subject !== "owner") {
    for (const client of seed.clients) {
      if (!inViewerOrganization(client.responsibleAgentId)) continue;
      add(
        { kind: "client", id: client.id, name: client.name },
        client.consents,
        client.responsibleAgentId,
        client.responsibleAgentId === viewer.id ? "own" : "agency",
      );
    }
  }
  if (filter.subject !== "client") {
    for (const link of ownerLinks.values()) {
      const owner = must(ownersById.get(link.ownerId), `owner ${link.ownerId}`);
      add({ kind: "owner", id: owner.id, name: owner.name }, owner.consents, link.responsibleAgentId, link.scope);
    }
  }
  const lastEvent = (item: ConsentRegistryItem) => item.consent.revokedAt ?? item.consent.grantedAt;
  return copy(
    items
      .filter(
        (item) =>
          (!filter.purpose || item.consent.purpose === filter.purpose) &&
          (!filter.state || item.state === filter.state),
      )
      .sort((a, b) => isoDesc(lastEvent(a), lastEvent(b)) || a.consent.id.localeCompare(b.consent.id)),
  );
}

/* --------------------------------------------------------------- owners */

/**
 * Owner CRM (§14.6): owners of the organization's listings and right holders
 * on its contracts — the viewer's own first, then by name. Contacts only
 * where `contactVisible` (§34.2); search matches a phone only then.
 */
export async function listOwners(filter: OwnerFilter = {}): Promise<OwnerListItem[]> {
  const query = filter.q ? parseQuery(filter.q) : undefined;
  return copy(
    [...ownerLinks.values()]
      .map(toOwnerListItem)
      .filter((item) => !query || matchesQuery(ownerDoc(item), query))
      .sort(
        (a, b) =>
          (a.scope === "own" ? 0 : 1) - (b.scope === "own" ? 0 : 1) ||
          a.owner.name.localeCompare(b.owner.name, "ru") ||
          a.owner.id.localeCompare(b.owner.id),
      ),
  );
}

/** Owner profile with properties, listings, contracts, consents, timeline, calls and checks. */
export async function getOwner(id: ID): Promise<OwnerDetailView | undefined> {
  const link = ownerLinks.get(id);
  if (!link) return undefined;
  const at = now();
  const properties = link.propertyIds.flatMap((propertyId) => {
    const property = must(propertiesById.get(propertyId), `property ${propertyId}`);
    // Mask the property as strictly as the viewer's best access to it requires.
    const accesses = seed.listings
      .filter((listing) => listing.propertyId === propertyId)
      .map((listing) => accessOf(listing))
      .filter((access): access is ListingAccess => access === "owner" || access === "agency");
    const access = accesses.includes("owner") ? "owner" : accesses[0];
    return access ? [propertyView(property, access)] : [];
  });
  const detail: OwnerDetailView = {
    ...toOwnerListItem(link),
    properties,
    listings: sortListingViews(
      link.listings.map((listing) => must(toListingView(listing, at), `listing view ${listing.id}`)),
    ),
    contracts: sortContractViews(link.contracts.map((contract) => toContractView(contract, at))),
    communications: communicationViews((item) => item.ownerId === id),
    calls: callViews(at, (call) => call.ownerId === id),
    verification: listingQueueItems(link.listings, at).sort(
      (a, b) => verificationRank(a) - verificationRank(b) || a.key.localeCompare(b.key),
    ),
  };
  return copy(detail);
}

/* -------------------------------------------------------- communications */

/**
 * The viewer's own calls, newest first (§14.7). Colleagues' calls are not
 * listed: recordings and transcripts are personal data under a separate
 * consent, and team call review needs a permission the viewer lacks.
 */
export async function listCalls(filter: CallFilter = {}): Promise<CallView[]> {
  return copy(
    callViews(
      now(),
      (call) =>
        (!filter.direction || call.direction === filter.direction) &&
        (!filter.outcome || call.outcome === filter.outcome) &&
        (!filter.linked || (attachedSubject(call) !== undefined) === (filter.linked === "linked")),
    ),
  );
}

/** One of the viewer's calls with the party's other touchpoints; undefined for a colleague's call. */
export async function getCall(id: ID): Promise<CallDetailView | undefined> {
  const call = callsById.get(id);
  if (!call || !visibleCall(call)) return undefined;
  const at = now();
  const base = toCallView(call, at);
  const normalized = normalizeUzPhone(call.phone);
  const detail: CallDetailView = {
    ...base,
    communications: base.linked
      ? communicationViews((item) => item.callId !== id && sameParty(item, call))
      : [],
    otherCalls: callViews(
      at,
      (other) =>
        other.id !== id &&
        (base.linked
          ? sameParty(other, call)
          : attachedSubject(other) === undefined && normalizeUzPhone(other.phone) === normalized),
    ),
  };
  const lead = call.leadId ? leadsById.get(call.leadId) : undefined;
  if (lead && visibleLead(lead)) detail.lead = toLeadView(lead, at);
  const client = call.clientId ? visibleClient(call.clientId) : undefined;
  if (client) detail.client = client;
  const link = call.ownerId ? ownerLinks.get(call.ownerId) : undefined;
  if (link) detail.owner = toOwnerListItem(link);
  return copy(detail);
}

/**
 * Timeline entries (§36.5) — channel, time, result, next step — newest
 * first. Only the viewer's own touchpoints with people they may see, for the
 * same reason as calls.
 */
export async function listCommunications(filter: CommunicationFilter = {}): Promise<CommunicationView[]> {
  return copy(
    communicationViews(
      (item) =>
        (!filter.clientId || item.clientId === filter.clientId) &&
        (!filter.ownerId || item.ownerId === filter.ownerId) &&
        (!filter.leadId || item.leadId === filter.leadId) &&
        (!filter.channel || item.channel === filter.channel),
    ),
  );
}

/* --------------------------------------------------------- verification */

/**
 * Verification center: every checked fact on the organization's listings,
 * its agents and the organization itself, plus partner listings the viewer
 * works on (deals, cooperation) — those as result only. Needs attention
 * first: problem, expired evidence, registry unavailable, pending, expiring
 * within 30 days, confirmed.
 */
export async function listVerificationQueue(filter: VerificationQueueFilter = {}): Promise<VerificationQueueItem[]> {
  return copy(
    verificationQueue(now())
      .filter(
        (entry) =>
          (!filter.status || entry.item.status === filter.status) &&
          (!filter.subject || entry.item.subject === filter.subject) &&
          (!filter.target || entry.target.kind === filter.target),
      )
      .sort(
        (a, b) =>
          verificationRank(a) - verificationRank(b) ||
          isoAsc(a.item.expiresAt ?? "9999", b.item.expiresAt ?? "9999") ||
          isoDesc(a.item.checkedAt ?? "", b.item.checkedAt ?? "") ||
          a.key.localeCompare(b.key),
      ),
  );
}

/* --------------------------------------------------------- team & routing */

/**
 * The viewer's team with per-member workload computed from the records
 * (§36.5). Metrics are counts only: they do not open colleagues' leads or
 * clients to the viewer. Undefined when the viewer is in no team.
 */
export async function getMyTeam(): Promise<MyTeamView | undefined> {
  if (!viewerTeam) return undefined;
  const at = now();
  const lead = must(agentsById.get(viewerTeam.leadAgentId), `agent ${viewerTeam.leadAgentId}`);
  const members = viewerTeam.memberIds
    .map((agentId) => toTeamMemberView(must(agentsById.get(agentId), `agent ${agentId}`), at))
    .sort(
      (a, b) =>
        Number(b.isLead) - Number(a.isLead) || a.agent.name.localeCompare(b.agent.name, "ru") || byIdAsc(a.agent, b.agent),
    );
  const totals: TeamMemberMetrics = {
    newLeadsToday: 0,
    openLeads: 0,
    slaBreaches: 0,
    activeClients: 0,
    activeListings: 0,
    viewingsThisWeek: 0,
    dealsInProgress: 0,
  };
  for (const member of members) {
    for (const key of Object.keys(totals) as (keyof TeamMemberMetrics)[]) totals[key] += member.metrics[key];
  }
  const view: MyTeamView = { team: viewerTeam, lead, members, totals };
  const organization = organizationsById.get(viewerTeam.organizationId);
  if (organization) view.organization = organization;
  return copy(view);
}

/** A colleague (or the viewer) in the viewer's organization; undefined for partners. */
export async function getTeamMember(agentId: ID): Promise<TeamMemberDetailView | undefined> {
  const agent = agentsById.get(agentId);
  if (!agent || !inViewerOrganization(agent.id)) return undefined;
  const at = now();
  const detail: TeamMemberDetailView = {
    ...toTeamMemberView(agent, at),
    listings: sortListingViews(
      seed.listings
        .filter((listing) => listing.agentId === agent.id && ACTIVE_LISTING.has(listing.status))
        .flatMap((listing) => toListingView(listing, at) ?? []),
    ),
    routingRules: organizationRules().filter((rule) => rule.agentIds.includes(agent.id)),
  };
  // `isLead` and `team` speak about the viewer's team only.
  if (viewerTeam?.memberIds.includes(agent.id)) detail.team = viewerTeam;
  return copy(detail);
}

/**
 * Inputs for the lead-routing simulator (§14.2, §36.5): the organization's
 * rules by priority, its agents with availability and today's workload, and
 * the open leads nobody is assigned to.
 */
export async function getRoutingContext(): Promise<RoutingContextView> {
  const at = now();
  const agents = organizationAgents();
  const workload = agents.map((agent) => toWorkload(agent.id, at));
  const context: RoutingContextView = {
    generatedAt: at.toISOString(),
    rules: organizationRules(),
    agents,
    availability: agents.map((agent) => availabilityOf(agent.id)),
    workloadToday: Object.fromEntries(workload.map((entry) => [entry.agentId, entry.assignedToday])),
    roundRobinCursor: Object.fromEntries(
      organizationRules()
        .filter((rule) => rule.strategy === "round_robin")
        .map((rule) => [rule.id, seed.roundRobinCursors[rule.id] ?? 0]),
    ),
    workload,
    unassignedLeads: seed.leads
      .filter((lead) => lead.assignedAgentId === undefined && isOpenLead(lead))
      .map((lead) => toLeadView(lead, at))
      .sort((a, b) => isoAsc(a.lead.slaDueAt, b.lead.slaDueAt) || byIdAsc(a.lead, b.lead)),
  };
  const organization = viewerOrganizationId ? organizationsById.get(viewerOrganizationId) : undefined;
  if (organization) context.organization = organization;
  return copy(context);
}

/* ------------------------------------------------------------- partners */

/**
 * Professional partners (§5.6, §15): agents outside the viewer's
 * organization with cooperation history and Active MLS listings, most
 * recent interaction first. Phone and Telegram only after an accepted
 * cooperation with shared contacts; verification is result only.
 */
export async function listPartners(filter: PartnerFilter = {}): Promise<PartnerListItem[]> {
  const at = now();
  const query = filter.q ? parseQuery(filter.q) : undefined;
  return copy(
    seed.agents
      .filter((agent) => isPartnerAgent(agent) && (!query || matchesQuery(partnerDoc(agent), query)))
      .map((agent) => toPartnerListItem(agent, at))
      .sort(
        (a, b) =>
          isoDesc(a.lastInteractionAt ?? "", b.lastInteractionAt ?? "") ||
          a.agent.name.localeCompare(b.agent.name, "ru") ||
          byIdAsc(a.agent, b.agent),
      ),
  );
}

/** A partner's profile: their visible listings (masked as usual) and the history with the viewer. */
export async function getPartner(agentId: ID): Promise<PartnerDetailView | undefined> {
  const agent = agentsById.get(agentId);
  if (!agent || !isPartnerAgent(agent)) return undefined;
  const at = now();
  const cooperationHistory = cooperationViews(at)
    .filter((view) => view.counterpart.id === agentId)
    .map(withoutAgents);
  const detail: PartnerDetailView = {
    ...toPartnerListItem(agent, at),
    listings: sortListingViews(
      visibleListings()
        .filter((listing) => listing.agentId === agentId)
        .map((listing) => must(toListingView(listing, at), `listing view ${listing.id}`)),
    ).map(withoutAgent),
    cooperationHistory,
    deals: seed.deals
      .filter((deal) => deal.agentId === viewer.id && deal.partnerAgentId === agentId)
      .sort((a, b) => isoDesc(a.createdAt, b.createdAt) || byIdAsc(a, b))
      .map((deal) => ({ id: deal.id, stage: deal.stage, listingId: deal.listingId, createdAt: deal.createdAt })),
  };
  return copy(detail);
}

/* ---------------------------------------------------------------- audit */

/**
 * Where an audit event sits relative to the viewer (§19 audit levels):
 * `own` when the viewer acted or the record is theirs, `team` when a member
 * of the viewer's team acted or owns the record, `agency` otherwise. The
 * audit screen applies the permission matrix with it.
 */
export function auditScope(event: AuditEvent): AuditScope {
  if (event.actorId === viewer.id) return "own";
  const owners = recordAgents(event.target);
  if (owners.includes(viewer.id)) return "own";
  if (viewerTeamMemberIds.has(event.actorId) || owners.some((id) => viewerTeamMemberIds.has(id))) return "team";
  return "agency";
}

/**
 * The organization journal merged with the deal histories of the
 * organization's deals, newest first. Not filtered by role: the audit
 * screen decides what the viewer may open using `scope` (see `auditScope`).
 */
export async function listAuditEvents(filter: AuditFilter = {}): Promise<AuditEventView[]> {
  const events: AuditEventView[] = [
    ...seed.orgAuditLog.map((event) => toAuditEventView(event, "organization")),
    ...seed.deals
      .filter((deal) => inViewerOrganization(deal.agentId))
      .flatMap((deal) => deal.audit.map((event) => toAuditEventView(event, "deal", deal.id))),
  ];
  return copy(
    events
      .filter(
        (view) =>
          (!filter.actorId || view.event.actorId === filter.actorId) &&
          (!filter.action || view.event.action === filter.action) &&
          (!filter.targetKind || view.event.target.kind === filter.targetKind) &&
          (!filter.sensitiveOnly || view.sensitive),
      )
      .sort((a, b) => isoDesc(a.event.at, b.event.at) || b.event.id.localeCompare(a.event.id)),
  );
}
