import { now as clockNow } from "@/lib/clock";
import { validateTerms } from "./commission";
import {
  dealStages,
  type CooperationStatus,
  type Deal,
  type DealDocument,
  type DealStage,
  type ISODateTime,
  type Listing,
  type ListingStatus,
  type Offer,
  type OfferStatus,
  type VerificationSubject,
  type Viewing,
} from "./types";
import { mlsReportDeadline, workingDaysLeft, type CalendarInput } from "./working-days";

/**
 * Lifecycle guards (§11, §36.3, §39.3 "Transition rules, required fields").
 *
 * A transition either succeeds or names every unmet prerequisite, so the UI
 * can say exactly what is missing ("Переход с missing prerequisite показывает
 * конкретное условие, доступную альтернативу и аудит", §36.3) instead of a
 * disabled button. Rules live in declarative tables below; adjust them there.
 *
 * Guards are pure and never change data. Recording the transition, its actor
 * and reason in the audit log is the caller's job.
 */

/**
 * Machine-readable unmet condition. Labels belong to the UI message
 * namespace of the screen that renders them (RU/UZ), keyed by `code`.
 *
 * Codes and params:
 * - `transition_not_allowed` {from, to, next?} — not an allowed step; `next`
 *   names the step that is available instead.
 * - `viewing_not_completed` — no completed viewing of this listing with this client.
 * - `offer_missing` — no open or countered offer on record.
 * - `agreed_price_missing` — the agreed price is not recorded.
 * - `document_missing` {type} — a required document is absent or still "missing".
 * - `document_rejected` {type} — a required document was rejected; upload a new one.
 * - `document_unverified` {type} — uploaded but not verified yet.
 * - `owner_consent_missing` {status} — the owner's consent is not confirmed
 *   (art. 37: no service contract without the rights holders' consent, §38.5).
 * - `verification_missing` {subject, status} — a required fact is not confirmed;
 *   `unavailable` never counts as confirmed (§16.4).
 * - `verification_problem` {subject} — a check found a problem.
 * - `no_verification_problem` — "verification failed" needs a recorded problem.
 * - `checklist_required_open` {labelKey} — a required checklist item is not done.
 * - `act_not_signed` — the completion act has no signing date.
 * - `commission_terms_missing` — a co-broking deal without agreed terms.
 * - `commission_terms_invalid` {issue} — stored terms fail validation.
 * - `mls_report_pending` {dueAt, workingDaysLeft} — act details not yet entered
 *   into the MLS (3 working days, §17.5, §38.5).
 * - `payout_not_recorded` — accrued ≠ paid (§35.2 row 11).
 * - `contract_missing` — the listing has no service contract.
 * - `contract_expired` {expiredAt} — the service contract has expired.
 * - `price_missing` — the listing has no positive price.
 * - `not_expired_yet` {expiresAt?} — "expired" needs a passed expiry date.
 */
export type PrerequisiteCode =
  | "transition_not_allowed"
  | "viewing_not_completed"
  | "offer_missing"
  | "agreed_price_missing"
  | "document_missing"
  | "document_rejected"
  | "document_unverified"
  | "owner_consent_missing"
  | "verification_missing"
  | "verification_problem"
  | "no_verification_problem"
  | "checklist_required_open"
  | "act_not_signed"
  | "commission_terms_missing"
  | "commission_terms_invalid"
  | "mls_report_pending"
  | "payout_not_recorded"
  | "contract_missing"
  | "contract_expired"
  | "price_missing"
  | "not_expired_yet";

export interface Prerequisite {
  code: PrerequisiteCode;
  params?: Record<string, string | number>;
}

export type TransitionCheck = { ok: true } | { ok: false; missing: Prerequisite[] };

function check(missing: Prerequisite[]): TransitionCheck {
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

function notAllowed(from: string, to: string, next?: string): TransitionCheck {
  const params: Record<string, string> = { from, to };
  if (next) params.next = next;
  return { ok: false, missing: [{ code: "transition_not_allowed", params }] };
}

/* ----------------------------------------------------------------- deal */

/**
 * Optional facts that live outside the Deal record. A rule that needs one of
 * them is evaluated only when the caller passes it — without the data the
 * rule cannot be checked, and we would rather not block (or claim) on a guess.
 */
export interface DealContext {
  viewings?: Viewing[];
  offers?: Offer[];
  listing?: Listing;
  /** Official holiday calendar for MLS deadlines (see working-days.ts). */
  calendar?: CalendarInput;
}

type DealRule = (deal: Deal, now: Date, context: DealContext) => Prerequisite[];

/** A document counts as present once uploaded; `verified` is stronger. */
function documentState(deal: Deal, type: DealDocument["type"]): DealDocument["status"] {
  const docs = deal.documents.filter((doc) => doc.type === type);
  if (docs.some((doc) => doc.status === "verified")) return "verified";
  if (docs.some((doc) => doc.status === "uploaded")) return "uploaded";
  if (docs.some((doc) => doc.status === "rejected")) return "rejected";
  return "missing";
}

function requireDocuments(
  types: DealDocument["type"][],
  level: "uploaded" | "verified" = "uploaded",
): DealRule {
  return (deal) =>
    types.flatMap((type): Prerequisite[] => {
      const state = documentState(deal, type);
      if (state === "missing") return [{ code: "document_missing", params: { type } }];
      if (state === "rejected") return [{ code: "document_rejected", params: { type } }];
      if (level === "verified" && state !== "verified") {
        return [{ code: "document_unverified", params: { type } }];
      }
      return [];
    });
}

const completedViewing: DealRule = (deal, _now, { viewings }) => {
  if (!viewings) return [];
  const done = viewings.some(
    (viewing) =>
      viewing.listingId === deal.listingId &&
      viewing.clientId === deal.clientId &&
      viewing.status === "completed",
  );
  return done ? [] : [{ code: "viewing_not_completed" }];
};

const offerOnRecord: DealRule = (deal, _now, { offers }) => {
  if (!offers) return [];
  const open = offers.some(
    (offer) =>
      offer.listingId === deal.listingId &&
      offer.clientId === deal.clientId &&
      (offer.status === "open" || offer.status === "countered" || offer.status === "accepted"),
  );
  return open ? [] : [{ code: "offer_missing" }];
};

const agreedPrice: DealRule = (deal) =>
  deal.agreedPrice && deal.agreedPrice.amountMinor > 0 ? [] : [{ code: "agreed_price_missing" }];

/** §38.5 art. 37: consent is its own proof, separate from the contract. */
const ownerConsentDocument: DealRule = (deal) => {
  const state = documentState(deal, "owner_consent");
  return state === "uploaded" || state === "verified"
    ? []
    : [{ code: "owner_consent_missing", params: { status: state } }];
};

const requiredChecklistDone: DealRule = (deal) =>
  deal.checklist
    .filter((item) => item.required && !item.doneAt)
    .map((item) => ({ code: "checklist_required_open", params: { labelKey: item.labelKey } }));

const noListingVerificationProblem: DealRule = (_deal, _now, { listing }) =>
  (listing?.verifications ?? [])
    .filter((item) => item.status === "problem")
    .map((item) => ({ code: "verification_problem", params: { subject: item.subject } }));

const actSigned: DealRule = (deal) => (deal.actSignedAt ? [] : [{ code: "act_not_signed" }]);

/** Co-broking deals (through a cooperation request) need agreed, valid terms. */
const commissionTerms: DealRule = (deal) => {
  if (!deal.cooperationId) return [];
  if (!deal.commission) return [{ code: "commission_terms_missing" }];
  return validateTerms(deal.commission.terms).map((issue) => ({
    code: "commission_terms_invalid",
    params: { issue: issue.code },
  }));
};

/** A deal done through the MLS reports act details within 3 working days. */
const mlsReported: DealRule = (deal, now, { calendar }) => {
  if (!deal.cooperationId || deal.mlsReportedAt) return [];
  if (!deal.actSignedAt) return [{ code: "act_not_signed" }];
  const dueAt = mlsReportDeadline(deal.actSignedAt, calendar);
  return [
    {
      code: "mls_report_pending",
      params: { dueAt, workingDaysLeft: workingDaysLeft(dueAt, now, calendar) },
    },
  ];
};

const payoutRecorded: DealRule = (deal) =>
  deal.commission?.payoutRecordedAt ? [] : [{ code: "payout_not_recorded" }];

/**
 * Entry rules per deal stage (§11.7, §35.7). A stage's rules must hold to
 * move INTO it from the previous stage.
 */
export const dealStageRules: Record<DealStage, readonly DealRule[]> = {
  qualification: [],
  // Scheduling a viewing needs only the client and listing, which every deal has.
  viewing: [],
  // An offer follows a completed viewing (checked when viewings are supplied).
  offer: [completedViewing],
  // Negotiation needs an offer on the table (checked when offers are supplied).
  negotiation: [offerOnRecord],
  // Going under contract fixes the price both sides agreed to.
  under_contract: [agreedPrice],
  // Verification works on the service contract and the rights holders' consent.
  verification: [requireDocuments(["service_contract"]), ownerConsentDocument],
  // Closing (signing the sale): the checklist is complete, title documents
  // are verified and no check on the listing reported a problem.
  closing: [
    requiredChecklistDone,
    requireDocuments(["service_contract"]),
    requireDocuments(["ownership_certificate", "cadastre_extract"], "verified"),
    ownerConsentDocument,
    noListingVerificationProblem,
  ],
  // The act stage follows a signed sale agreement; the act is signed here.
  act: [requireDocuments(["sale_agreement"])],
  // Commission is calculated once the act is signed and on file.
  commission: [actSigned, requireDocuments(["completion_act"]), commissionTerms],
  // Archive only with the MLS report filed (if via MLS) and the payout recorded.
  archived: [mlsReported, payoutRecorded],
};

export function nextDealStage(stage: DealStage): DealStage | undefined {
  const index = dealStages.indexOf(stage);
  return index >= 0 ? dealStages[index + 1] : undefined;
}

/**
 * Deals move forward one stage at a time; skipping or going back is refused
 * with the allowed next stage as the alternative. A deal that falls through
 * is not modelled as a stage yet.
 */
export function canAdvanceDeal(
  deal: Deal,
  to: DealStage,
  now: Date,
  context: DealContext = {},
): TransitionCheck {
  const next = nextDealStage(deal.stage);
  if (to !== next) return notAllowed(deal.stage, to, next);
  return check(dealStageRules[to].flatMap((rule) => rule(deal, now, context)));
}

export type MlsReportState =
  | { state: "not_required" }
  | { state: "awaiting_act" }
  | { state: "reported"; reportedAt: ISODateTime }
  | { state: "due" | "overdue"; dueAt: ISODateTime; workingDaysLeft: number };

/**
 * Where a deal stands against the 3-working-day MLS reporting window, for
 * reminders and the overdue queue (§38.5). Only deals made through the MLS
 * (with a cooperation record) are subject to it.
 */
export function mlsReportState(deal: Deal, now: Date, calendar?: CalendarInput): MlsReportState {
  if (!deal.cooperationId) return { state: "not_required" };
  if (deal.mlsReportedAt) return { state: "reported", reportedAt: deal.mlsReportedAt };
  if (!deal.actSignedAt) return { state: "awaiting_act" };
  const dueAt = mlsReportDeadline(deal.actSignedAt, calendar);
  const left = workingDaysLeft(dueAt, now, calendar);
  const overdue = now.getTime() > new Date(dueAt).getTime();
  return { state: overdue ? "overdue" : "due", dueAt, workingDaysLeft: left };
}

/* -------------------------------------------------------------- listing */

/**
 * Allowed listing moves (§11.1). The main path runs Draft → … → Archived;
 * side outcomes (expired, withdrawn, suspended, verification failed,
 * disputed) have explicit ways back or out. History is never deleted.
 */
export const listingTransitions: Record<ListingStatus, readonly ListingStatus[]> = {
  draft: ["contract_signed", "withdrawn"],
  contract_signed: ["verification_pending", "withdrawn", "expired"],
  verification_pending: ["verified", "verification_failed", "withdrawn", "expired"],
  verified: ["active_mls", "withdrawn", "suspended", "expired"],
  active_mls: ["offer", "suspended", "withdrawn", "expired", "disputed"],
  // An offer that falls through returns the listing to the MLS.
  offer: ["under_contract", "active_mls", "suspended", "withdrawn", "disputed"],
  under_contract: ["closed", "active_mls", "disputed"],
  closed: ["archived"],
  archived: [],
  // Renewal needs a new service contract, so it re-enters at contract_signed.
  expired: ["contract_signed", "archived"],
  withdrawn: ["archived"],
  suspended: ["active_mls", "withdrawn", "archived"],
  // New documents restart verification.
  verification_failed: ["verification_pending", "withdrawn", "archived"],
  // The dispute's resolution is recorded by the dispute workflow, not here.
  disputed: ["active_mls", "suspended", "withdrawn"],
};

function verification(listing: Listing, subject: VerificationSubject) {
  return listing.verifications.find((item) => item.subject === subject);
}

type ListingRule = (listing: Listing, now: Date) => Prerequisite[];

const hasContract: ListingRule = (listing, now) => {
  if (!listing.contractId) return [{ code: "contract_missing" }];
  if (listing.contractExpiresAt && new Date(listing.contractExpiresAt).getTime() <= now.getTime()) {
    return [{ code: "contract_expired", params: { expiredAt: listing.contractExpiresAt } }];
  }
  return [];
};

const ownerConsentConfirmed: ListingRule = (listing) => {
  const status = verification(listing, "owner_consent")?.status;
  return status === "confirmed" ? [] : [{ code: "owner_consent_missing", params: { status: status ?? "none" } }];
};

const ownershipConfirmed: ListingRule = (listing) => {
  const status = verification(listing, "ownership")?.status;
  return status === "confirmed"
    ? []
    : [{ code: "verification_missing", params: { subject: "ownership", status: status ?? "none" } }];
};

const noVerificationProblem: ListingRule = (listing) =>
  listing.verifications
    .filter((item) => item.status === "problem")
    .map((item) => ({ code: "verification_problem", params: { subject: item.subject } }));

const hasProblem: ListingRule = (listing) =>
  listing.verifications.some((item) => item.status === "problem") ? [] : [{ code: "no_verification_problem" }];

const hasPrice: ListingRule = (listing) => (listing.price.amountMinor > 0 ? [] : [{ code: "price_missing" }]);

const expiryPassed: ListingRule = (listing, now) => {
  const dates = [listing.expiresAt, listing.contractExpiresAt].filter((d): d is string => Boolean(d));
  if (dates.some((d) => new Date(d).getTime() <= now.getTime())) return [];
  const params: Record<string, string> = {};
  if (dates.length > 0) params.expiresAt = dates.sort()[0];
  return [{ code: "not_expired_yet", params }];
};

/** Entry rules per listing status; statuses without rules need only the map. */
export const listingStatusRules: Partial<Record<ListingStatus, readonly ListingRule[]>> = {
  contract_signed: [hasContract],
  verification_pending: [hasContract],
  // "Verified" means ownership and consent are confirmed and nothing is wrong.
  verified: [ownershipConfirmed, ownerConsentConfirmed, noVerificationProblem],
  verification_failed: [hasProblem],
  // Publishing to the MLS re-checks consent, problems, contract and price.
  active_mls: [ownerConsentConfirmed, noVerificationProblem, hasContract, hasPrice],
  expired: [expiryPassed],
};

/**
 * Checks one listing move. `now` defaults to the app clock (frozen in demo
 * mode) and only matters for contract / publication expiry.
 */
export function canTransitionListing(
  listing: Listing,
  to: ListingStatus,
  now: Date = clockNow(),
): TransitionCheck {
  const allowed = listingTransitions[listing.status];
  if (!allowed.includes(to)) return notAllowed(listing.status, to, allowed[0]);
  return check((listingStatusRules[to] ?? []).flatMap((rule) => rule(listing, now)));
}

/* --------------------------------------------------- cooperation & offer */

/**
 * Cooperation request statuses (§11.5, §15.3). Viewing/offer/deal progress is
 * tracked on those records, not here. A new proposal while negotiating keeps
 * the status (negotiation → negotiation). Accepted terms can only be disputed.
 */
export const cooperationTransitions: Record<CooperationStatus, readonly CooperationStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["viewed", "negotiation", "accepted", "declined", "expired", "cancelled"],
  viewed: ["negotiation", "accepted", "declined", "expired", "cancelled"],
  negotiation: ["negotiation", "accepted", "declined", "expired", "cancelled"],
  accepted: ["disputed"],
  declined: [],
  expired: [],
  cancelled: [],
  // Binor records the parties' resolution; it does not arbitrate (§35.6 step 8).
  disputed: ["accepted", "cancelled"],
};

/**
 * Offer statuses (§35.2 row 10): each counter is a new version and keeps the
 * status "countered"; acceptance is final and explicit.
 */
export const offerTransitions: Record<OfferStatus, readonly OfferStatus[]> = {
  open: ["countered", "accepted", "declined", "expired", "withdrawn"],
  countered: ["countered", "accepted", "declined", "expired", "withdrawn"],
  accepted: [],
  declined: [],
  expired: [],
  withdrawn: [],
};

export function canTransitionCooperation(from: CooperationStatus, to: CooperationStatus): TransitionCheck {
  const allowed = cooperationTransitions[from];
  return allowed.includes(to) ? { ok: true } : notAllowed(from, to, allowed[0]);
}

export function canTransitionOffer(from: OfferStatus, to: OfferStatus): TransitionCheck {
  const allowed = offerTransitions[from];
  return allowed.includes(to) ? { ok: true } : notAllowed(from, to, allowed[0]);
}
