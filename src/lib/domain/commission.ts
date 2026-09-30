import type {
  CommissionTerms,
  CooperationRequest,
  CooperationStatus,
  Currency,
  ID,
  ISODateTime,
  Money,
  SplitPreset,
  TermsVersion,
} from "./types";

/**
 * Commission rule engine for co-broking (§7.4, §15.4, §35.6).
 *
 * - A split is an agreement between two professionals — never a Binor fee
 *   (§41 D10). Nothing here assumes the platform takes a share of the deal.
 * - A bare "70/30" is not enough (§35.6 step 3): terms always carry explicit
 *   roles (listing side vs buyer side), the basis, the currency and the payout
 *   condition.
 * - Every proposal is a new immutable version; accepted terms are never edited
 *   and history is never rewritten (§36.3 "Cooperation Workspace").
 *
 * All operations are pure: they return a new request and an event describing
 * what happened, so callers can persist both and append an audit record.
 */

/* ------------------------------------------------------------- presets */

/**
 * Which side receives the larger share of an asymmetric preset by default.
 *
 * The master document does NOT fix the direction (§41 D2): the public wording
 * reads 70/30 as "more to the side that brought the client" and 80/20 as
 * "the maximum to the owner of the order", while other sources tie the larger
 * share to the owner's (listing) agent or the exclusive holder. Product, Legal
 * and agency representatives must settle it before the cooperation beta
 * (§41.1). Until then we default to the listing side, every preset stays
 * adjustable (`largerShare`), and the UI must always name both roles next to
 * the percentages instead of showing "70/30" alone.
 */
export const DEFAULT_LARGER_SHARE: SplitSide = "listing";

export type SplitSide = "listing" | "buyer";

/** Larger / smaller share of each fixed preset, in percent. */
export const splitPresets: Record<Exclude<SplitPreset, "custom">, readonly [number, number]> = {
  "50/50": [50, 50],
  "70/30": [70, 30],
  "80/20": [80, 20],
};

export const splitPresetIds: readonly SplitPreset[] = ["50/50", "70/30", "80/20", "custom"];

export interface PresetOverrides extends Partial<Omit<CommissionTerms, "preset" | "currency">> {
  /** Flips an asymmetric preset so the buyer side gets the larger share. */
  largerShare?: SplitSide;
}

/**
 * Builds complete, explicit terms from a preset. Defaults: basis = gross
 * commission, payout on deal closing. "custom" starts at 50/50 so the form
 * never opens with an invalid sum. When only one side's percent is
 * overridden, the other side is derived so the pair still sums to 100.
 */
export function presetTerms(
  preset: SplitPreset,
  currency: Currency,
  overrides: PresetOverrides = {},
): CommissionTerms {
  const { largerShare = DEFAULT_LARGER_SHARE, ...fields } = overrides;
  const [larger, smaller] = preset === "custom" ? [50, 50] : splitPresets[preset];
  let listingSidePercent = largerShare === "listing" ? larger : smaller;
  let buyerSidePercent = 100 - listingSidePercent;

  if (fields.listingSidePercent !== undefined && fields.buyerSidePercent === undefined) {
    listingSidePercent = fields.listingSidePercent;
    buyerSidePercent = 100 - fields.listingSidePercent;
  } else if (fields.buyerSidePercent !== undefined && fields.listingSidePercent === undefined) {
    buyerSidePercent = fields.buyerSidePercent;
    listingSidePercent = 100 - fields.buyerSidePercent;
  } else if (fields.listingSidePercent !== undefined && fields.buyerSidePercent !== undefined) {
    listingSidePercent = fields.listingSidePercent;
    buyerSidePercent = fields.buyerSidePercent;
  }

  const terms: CommissionTerms = {
    preset,
    listingSidePercent,
    buyerSidePercent,
    basis: fields.basis ?? "gross_commission",
    currency,
    payoutCondition: fields.payoutCondition ?? "on_deal_closing",
  };
  if (fields.fixedAmount) terms.fixedAmount = fields.fixedAmount;
  if (fields.payoutNote !== undefined) terms.payoutNote = fields.payoutNote;
  return terms;
}

/* ---------------------------------------------------------- validation */

export type TermsIssueCode =
  /** listingSidePercent + buyerSidePercent ≠ 100. */
  | "percent_sum"
  /** A side has a negative share. */
  | "negative_percent"
  /** More than two decimals: splits are exact to 0.01 %. */
  | "percent_precision"
  /** A named preset whose numbers differ from it (either direction is fine). */
  | "preset_mismatch"
  /** basis = fixed_amount without an amount. */
  | "fixed_amount_missing"
  /** Fixed amount in another currency than the terms. */
  | "fixed_amount_currency"
  /** Fixed amount of zero or less. */
  | "fixed_amount_not_positive"
  /** A fixed amount stored next to a gross-commission basis is ambiguous. */
  | "fixed_amount_unused"
  /** payoutCondition = custom needs the condition spelled out. */
  | "custom_payout_note_missing";

export interface TermsIssue {
  code: TermsIssueCode;
  /** The form field the issue belongs to, so the UI can place the message. */
  field: keyof CommissionTerms;
}

/** Percent values are compared and split in basis points (1/100 of a percent). */
function toBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

function hasAtMostTwoDecimals(percent: number): boolean {
  return Number.isFinite(percent) && Math.abs(percent * 100 - toBasisPoints(percent)) < 1e-6;
}

/** Returns every problem at once so the form can show them together; [] = valid. */
export function validateTerms(terms: CommissionTerms): TermsIssue[] {
  const issues: TermsIssue[] = [];
  const { listingSidePercent: listing, buyerSidePercent: buyer } = terms;

  if (listing < 0) issues.push({ code: "negative_percent", field: "listingSidePercent" });
  if (buyer < 0) issues.push({ code: "negative_percent", field: "buyerSidePercent" });
  if (!hasAtMostTwoDecimals(listing)) issues.push({ code: "percent_precision", field: "listingSidePercent" });
  if (!hasAtMostTwoDecimals(buyer)) issues.push({ code: "percent_precision", field: "buyerSidePercent" });
  if (toBasisPoints(listing) + toBasisPoints(buyer) !== 10_000) {
    issues.push({ code: "percent_sum", field: "buyerSidePercent" });
  }
  if (terms.preset !== "custom") {
    const [larger, smaller] = splitPresets[terms.preset];
    const fits =
      (listing === larger && buyer === smaller) || (listing === smaller && buyer === larger);
    if (!fits) issues.push({ code: "preset_mismatch", field: "preset" });
  }

  if (terms.basis === "fixed_amount") {
    if (!terms.fixedAmount) {
      issues.push({ code: "fixed_amount_missing", field: "fixedAmount" });
    } else {
      if (terms.fixedAmount.currency !== terms.currency) {
        issues.push({ code: "fixed_amount_currency", field: "fixedAmount" });
      }
      if (terms.fixedAmount.amountMinor <= 0) {
        issues.push({ code: "fixed_amount_not_positive", field: "fixedAmount" });
      }
    }
  } else if (terms.fixedAmount) {
    issues.push({ code: "fixed_amount_unused", field: "fixedAmount" });
  }

  if (terms.payoutCondition === "custom" && !terms.payoutNote?.trim()) {
    issues.push({ code: "custom_payout_note_missing", field: "payoutNote" });
  }
  return issues;
}

/* ------------------------------------------------------------ splitting */

export interface SplitResult {
  listingSide: Money;
  buyerSide: Money;
}

/**
 * Splits the basis between the two sides exactly, in minor units, so that
 * `listingSide + buyerSide === basis` always holds.
 *
 * - basis = gross_commission → splits `gross`;
 *   basis = fixed_amount → splits `terms.fixedAmount` (`gross` is ignored).
 * - Rounding: each side's exact share is rounded to the nearest minor unit;
 *   on an exact half (at most one cent / tiyin) the extra unit goes to the
 *   listing side, and the buyer side receives the rest.
 * - Integer maths is done in BigInt so large UZS amounts never lose precision.
 *
 * Throws on invalid terms or a currency mismatch — call `validateTerms` first;
 * this never converts currencies silently.
 */
export function splitAmount(terms: CommissionTerms, gross?: Money): SplitResult {
  const issues = validateTerms(terms);
  if (issues.length > 0) {
    throw new RangeError(`Invalid commission terms: ${issues.map((issue) => issue.code).join(", ")}`);
  }
  const base = terms.basis === "fixed_amount" ? terms.fixedAmount : gross;
  if (!base) throw new TypeError("A gross commission amount is required for this basis");
  if (base.currency !== terms.currency) {
    throw new TypeError(`Currency mismatch: ${base.currency} vs ${terms.currency}`);
  }
  if (!Number.isSafeInteger(base.amountMinor) || base.amountMinor < 0) {
    throw new RangeError(`Commission basis must be a non-negative safe integer: ${base.amountMinor}`);
  }

  const amount = BigInt(base.amountMinor);
  const listingBp = BigInt(toBasisPoints(terms.listingSidePercent));
  // floor((amount × bp + 5000) / 10000): nearest minor unit, half → listing side.
  const listingMinor = (amount * listingBp + BigInt(5_000)) / BigInt(10_000);
  const buyerMinor = amount - listingMinor;
  return {
    listingSide: { amountMinor: Number(listingMinor), currency: base.currency },
    buyerSide: { amountMinor: Number(buyerMinor), currency: base.currency },
  };
}

/* -------------------------------------------------------------- diffing */

/** Field order used for diffs and version comparison in the UI. */
export const termsFields: readonly (keyof CommissionTerms)[] = [
  "preset",
  "listingSidePercent",
  "buyerSidePercent",
  "basis",
  "fixedAmount",
  "currency",
  "payoutCondition",
  "payoutNote",
];

function sameMoney(a?: Money, b?: Money): boolean {
  if (!a || !b) return a === b;
  // `raw` is provenance, not part of the agreement.
  return a.amountMinor === b.amountMinor && a.currency === b.currency;
}

/** Fields whose value differs between two versions, in `termsFields` order. */
export function diffTerms(a: CommissionTerms, b: CommissionTerms): (keyof CommissionTerms)[] {
  return termsFields.filter((field) => {
    if (field === "fixedAmount") return !sameMoney(a.fixedAmount, b.fixedAmount);
    // An empty note and no note mean the same thing.
    if (field === "payoutNote") return (a.payoutNote?.trim() ?? "") !== (b.payoutNote?.trim() ?? "");
    return a[field] !== b[field];
  });
}

/* ---------------------------------------------------------- negotiation */

export type CooperationError =
  /** The request is still a draft that was never sent. */
  | "not_sent"
  /** Terms were accepted; a new agreement needs a new request. */
  | "terms_locked"
  /** Declined, expired, cancelled or disputed. */
  | "request_closed"
  /** The actor is neither the requesting nor the listing agent. */
  | "not_a_party"
  /** Only the counterparty of the latest proposal may accept or decline it. */
  | "own_proposal"
  /** Only the requesting agent can send or withdraw a draft. */
  | "not_initiator"
  /** The proposed or accepted terms fail `validateTerms` (see `issues`). */
  | "invalid_terms"
  /** A counter-proposal identical to the latest version. */
  | "no_changes"
  /** There is no proposal to act on yet. */
  | "version_not_found"
  /** A newer proposal replaced the version being accepted. */
  | "not_latest_version"
  /** The action is not allowed in the current status (e.g. viewing twice). */
  | "invalid_status"
  /** `atIso` is not a valid ISO-8601 instant. */
  | "invalid_time";

/** What happened, for the caller's audit log and notifications (§17.6, §39.3). */
export interface CooperationEvent {
  action:
    | "terms_proposed"
    | "request_viewed"
    | "terms_accepted"
    | "request_declined"
    | "request_cancelled"
    | "request_expired";
  requestId: ID;
  /** Absent for `request_expired`, which is a system event. */
  actorId?: ID;
  at: ISODateTime;
  version?: number;
  /** Fields changed compared with the previous version (proposals only). */
  changed?: (keyof CommissionTerms)[];
  reason?: string;
}

export type CooperationResult =
  | { ok: true; value: CooperationRequest; event: CooperationEvent }
  | { ok: false; error: CooperationError; issues?: TermsIssue[] };

/** Statuses in which a proposal is waiting for an answer. */
const OPEN_STATUSES: ReadonlySet<CooperationStatus> = new Set(["sent", "viewed", "negotiation"]);

export function latestVersion(request: CooperationRequest): TermsVersion | undefined {
  return request.versions[request.versions.length - 1];
}

/** The terms both sides agreed to, or undefined while nothing is accepted. */
export function acceptedTerms(request: CooperationRequest): TermsVersion | undefined {
  if (request.acceptedVersion === undefined) return undefined;
  return request.versions.find((version) => version.version === request.acceptedVersion);
}

export function isParty(request: CooperationRequest, agentId: ID): boolean {
  return agentId === request.fromAgentId || agentId === request.toAgentId;
}

/** The agent who has to answer the latest proposal, if any answer is pending. */
export function awaitingResponseFrom(request: CooperationRequest): ID | undefined {
  const latest = latestVersion(request);
  if (!latest || !OPEN_STATUSES.has(request.status)) return undefined;
  return latest.proposedById === request.fromAgentId ? request.toAgentId : request.fromAgentId;
}

function closedError(status: CooperationStatus): CooperationError | undefined {
  if (status === "draft") return "not_sent";
  if (status === "accepted") return "terms_locked";
  if (!OPEN_STATUSES.has(status)) return "request_closed";
  return undefined;
}

function isValidInstant(iso: string): boolean {
  return !Number.isNaN(Date.parse(iso));
}

/**
 * Appends a new terms version (version = last + 1). The first proposal sends
 * the request (draft → sent); later ones move it to negotiation. Earlier
 * versions are kept untouched; contacts stay masked until acceptance.
 */
export function proposeTerms(
  request: CooperationRequest,
  terms: CommissionTerms,
  byAgentId: ID,
  atIso: ISODateTime,
  note?: string,
): CooperationResult {
  if (!isValidInstant(atIso)) return { ok: false, error: "invalid_time" };
  if (request.status !== "draft") {
    const closed = closedError(request.status);
    if (closed) return { ok: false, error: closed };
  }
  if (!isParty(request, byAgentId)) return { ok: false, error: "not_a_party" };
  // A draft is sent by the agent who asks to cooperate.
  if (request.status === "draft" && byAgentId !== request.fromAgentId) {
    return { ok: false, error: "not_initiator" };
  }
  const issues = validateTerms(terms);
  if (issues.length > 0) return { ok: false, error: "invalid_terms", issues };

  const latest = latestVersion(request);
  const changed = latest ? diffTerms(latest.terms, terms) : [...termsFields];
  if (latest && request.status !== "draft" && changed.length === 0) {
    return { ok: false, error: "no_changes" };
  }

  const version: TermsVersion = {
    version: (latest?.version ?? 0) + 1,
    terms: { ...terms },
    proposedById: byAgentId,
    proposedAt: atIso,
  };
  const trimmedNote = note?.trim();
  if (trimmedNote) version.note = trimmedNote;

  const status: CooperationStatus = request.status === "draft" ? "sent" : "negotiation";
  return {
    ok: true,
    value: { ...request, status, versions: [...request.versions, version] },
    event: {
      action: "terms_proposed",
      requestId: request.id,
      actorId: byAgentId,
      at: atIso,
      version: version.version,
      changed,
    },
  };
}

/** The counterparty opened the request: sent → viewed (§15.3). */
export function markViewed(
  request: CooperationRequest,
  byAgentId: ID,
  atIso: ISODateTime,
): CooperationResult {
  if (!isValidInstant(atIso)) return { ok: false, error: "invalid_time" };
  if (!isParty(request, byAgentId)) return { ok: false, error: "not_a_party" };
  if (request.status !== "sent") return { ok: false, error: "invalid_status" };
  if (awaitingResponseFrom(request) !== byAgentId) return { ok: false, error: "own_proposal" };
  return {
    ok: true,
    value: { ...request, status: "viewed" },
    event: { action: "request_viewed", requestId: request.id, actorId: byAgentId, at: atIso },
  };
}

/**
 * Accepts the latest version. Only the counterparty of that proposal may do
 * it, and only for the exact version they saw — a newer counter-proposal
 * makes an older version unacceptable. Acceptance shares contacts (§18.2
 * privacy by stage) and locks the terms.
 */
export function acceptTerms(
  request: CooperationRequest,
  version: number,
  byAgentId: ID,
  atIso: ISODateTime,
): CooperationResult {
  if (!isValidInstant(atIso)) return { ok: false, error: "invalid_time" };
  const closed = closedError(request.status);
  if (closed) return { ok: false, error: closed };
  if (!isParty(request, byAgentId)) return { ok: false, error: "not_a_party" };

  const latest = latestVersion(request);
  if (!latest || !request.versions.some((v) => v.version === version)) {
    return { ok: false, error: "version_not_found" };
  }
  if (latest.version !== version) return { ok: false, error: "not_latest_version" };
  if (latest.proposedById === byAgentId) return { ok: false, error: "own_proposal" };
  const issues = validateTerms(latest.terms);
  if (issues.length > 0) return { ok: false, error: "invalid_terms", issues };

  return {
    ok: true,
    value: { ...request, status: "accepted", acceptedVersion: version, disclosure: "contacts_shared" },
    event: { action: "terms_accepted", requestId: request.id, actorId: byAgentId, at: atIso, version },
  };
}

/** The counterparty of the latest proposal refuses to cooperate. History is kept. */
export function declineRequest(
  request: CooperationRequest,
  byAgentId: ID,
  atIso: ISODateTime,
  reason?: string,
): CooperationResult {
  if (!isValidInstant(atIso)) return { ok: false, error: "invalid_time" };
  const closed = closedError(request.status);
  if (closed) return { ok: false, error: closed };
  if (!isParty(request, byAgentId)) return { ok: false, error: "not_a_party" };
  if (awaitingResponseFrom(request) !== byAgentId) return { ok: false, error: "own_proposal" };
  const event: CooperationEvent = {
    action: "request_declined",
    requestId: request.id,
    actorId: byAgentId,
    at: atIso,
    version: latestVersion(request)?.version,
  };
  if (reason?.trim()) event.reason = reason.trim();
  return { ok: true, value: { ...request, status: "declined" }, event };
}

/**
 * Withdraws the request before anything is accepted: a draft only by the
 * requesting agent, an open negotiation by either party (so nobody is stuck
 * waiting for the other side's answer). History is kept.
 */
export function cancelRequest(
  request: CooperationRequest,
  byAgentId: ID,
  atIso: ISODateTime,
  reason?: string,
): CooperationResult {
  if (!isValidInstant(atIso)) return { ok: false, error: "invalid_time" };
  if (request.status !== "draft") {
    const closed = closedError(request.status);
    if (closed) return { ok: false, error: closed };
  }
  if (!isParty(request, byAgentId)) return { ok: false, error: "not_a_party" };
  if (request.status === "draft" && byAgentId !== request.fromAgentId) {
    return { ok: false, error: "not_initiator" };
  }
  const event: CooperationEvent = {
    action: "request_cancelled",
    requestId: request.id,
    actorId: byAgentId,
    at: atIso,
  };
  if (reason?.trim()) event.reason = reason.trim();
  return { ok: true, value: { ...request, status: "cancelled" }, event };
}

/**
 * Marks an unanswered request expired once `respondBy` has passed. Meant for
 * the scheduler and for rendering; returns `undefined` when nothing changes.
 * Expiry never deletes versions.
 */
export function expireIfOverdue(
  request: CooperationRequest,
  now: Date,
): { value: CooperationRequest; event: CooperationEvent } | undefined {
  if (!OPEN_STATUSES.has(request.status)) return undefined;
  if (new Date(request.respondBy).getTime() > now.getTime()) return undefined;
  return {
    value: { ...request, status: "expired" },
    event: { action: "request_expired", requestId: request.id, at: now.toISOString() },
  };
}
