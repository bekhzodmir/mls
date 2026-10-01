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
import { foldText } from "@/lib/domain/text";
import {
  dealStages,
  type Agent,
  type AppNotification,
  type Client,
  type ConfidenceBand,
  type CooperationRequest,
  type Deal,
  type DistrictId,
  type ID,
  type Lead,
  type Listing,
  type ListingStatus,
  type MatchTarget,
  type Offer,
  type Organization,
  type ParsedField,
  type Property,
  type Requirement,
  type Task,
  type TelegramListing,
  type TelegramSource,
  type Viewing,
} from "@/lib/domain/types";
import { tashkentDateKey } from "@/lib/domain/working-days";
import { seed, VIEWER_AGENT_ID, type MatchStatusRecord } from "./seed";
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

function toOfferView(offer: Offer, at: Date): OfferView | undefined {
  const listing = listingViewById(offer.listingId, at);
  const client = visibleClient(offer.clientId);
  if (!listing || !client) return undefined;
  return {
    offer,
    listing,
    client,
    latest: must(offer.versions[offer.versions.length - 1], `versions of ${offer.id}`),
  };
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

/** Offers on the viewer's clients' behalf, most recent version first. */
export async function listOffers(filter: OfferFilter = {}): Promise<OfferView[]> {
  return copy(
    offerViews(
      now(),
      (offer) =>
        (!filter.listingId || offer.listingId === filter.listingId) &&
        (!filter.clientId || offer.clientId === filter.clientId) &&
        (!filter.dealId || offer.dealId === filter.dealId),
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
