import type { CooperationView, RequirementSummary } from "@/lib/data/views";
import {
  diffTerms,
  presetTerms,
  splitAmount,
  splitPresets,
  validateTerms,
  type SplitResult,
  type SplitSide,
} from "@/lib/domain/commission";
import { toMinor } from "@/lib/domain/money";
import type {
  CommissionTerms,
  CooperationRequest,
  CooperationStatus,
  Currency,
  ID,
  ISODateTime,
  Money,
  Requirement,
  SplitPreset,
} from "@/lib/domain/types";
import { appPath } from "@/lib/routes";
import { firstParam, type SearchParamsRecord } from "./url";

/**
 * Pure helpers for the cooperation workspace (§15.3–15.4, §35.6). Roles are
 * fixed by the domain model: the listing agent (`toAgentId`) is the listing
 * side, the requesting agent (`fromAgentId`) the client side. Every screen
 * names both roles next to the percentages (§41 D2).
 */

/* --------------------------------------------------------------- statuses */

export type CooperationStatusGroup = "open" | "accepted" | "closed";

const OPEN: ReadonlySet<CooperationStatus> = new Set(["draft", "sent", "viewed", "negotiation"]);

export function statusGroup(status: CooperationStatus): CooperationStatusGroup {
  if (status === "accepted") return "accepted";
  return OPEN.has(status) ? "open" : "closed";
}

export function isOpen(status: CooperationStatus): boolean {
  return OPEN.has(status) && status !== "draft";
}

/* ------------------------------------------------------------ list params */

export const directions = ["incoming", "outgoing"] as const;
export type Direction = (typeof directions)[number];
export const statusGroups = ["open", "accepted", "closed"] as const satisfies readonly CooperationStatusGroup[];

export interface CooperationListParams {
  direction?: Direction;
  status?: CooperationStatusGroup;
}

export function parseCooperationParams(params: SearchParamsRecord): CooperationListParams {
  const parsed: CooperationListParams = {};
  const direction = firstParam(params, "direction");
  const status = firstParam(params, "status");
  if (direction === "incoming" || direction === "outgoing") parsed.direction = direction;
  if (status === "open" || status === "accepted" || status === "closed") parsed.status = status;
  return parsed;
}

export function cooperationListHref(locale: string, params: CooperationListParams = {}): string {
  const query = new URLSearchParams();
  if (params.direction) query.set("direction", params.direction);
  if (params.status) query.set("status", params.status);
  const search = query.toString();
  return `${appPath(locale, "/mls/cooperation")}${search ? `?${search}` : ""}`;
}

export function cooperationHref(locale: string, id: ID): string {
  return appPath(locale, `/mls/cooperation/${encodeURIComponent(id)}`);
}

export function newCooperationHref(locale: string, listingId: ID, requirementId?: ID): string {
  const query = new URLSearchParams({ listingId });
  if (requirementId) query.set("requirementId", requirementId);
  return `${appPath(locale, "/mls/cooperation/new")}?${query.toString()}`;
}

/** Requests waiting for the viewer first, then by deadline, then newest proposal. */
export function filterCooperation(views: readonly CooperationView[], params: CooperationListParams): CooperationView[] {
  return views
    .filter(
      (view) =>
        (!params.direction || view.direction === params.direction) &&
        (!params.status || statusGroup(view.request.status) === params.status),
    )
    .sort((a, b) => {
      if (a.awaitingViewer !== b.awaitingViewer) return a.awaitingViewer ? -1 : 1;
      const openA = isOpen(a.request.status);
      const openB = isOpen(b.request.status);
      if (openA !== openB) return openA ? -1 : 1;
      if (openA && openB && a.request.respondBy !== b.request.respondBy) {
        return a.request.respondBy < b.request.respondBy ? -1 : 1;
      }
      return a.latest.proposedAt < b.latest.proposedAt ? 1 : a.latest.proposedAt > b.latest.proposedAt ? -1 : 0;
    });
}

/** The request the viewer already has on a listing (open or accepted), to avoid competing requests (§15.5). */
export function activeRequestFor(views: readonly CooperationView[], listingId: ID): CooperationView | undefined {
  return views.find(
    (view) =>
      view.request.listingId === listingId && (isOpen(view.request.status) || view.request.status === "accepted"),
  );
}

/* ------------------------------------------------------------------ roles */

/** Which side of the split an agent is on in this request. */
export function sideOf(
  request: Pick<CooperationRequest, "fromAgentId" | "toAgentId">,
  agentId: ID,
): SplitSide | undefined {
  if (agentId === request.toAgentId) return "listing";
  if (agentId === request.fromAgentId) return "buyer";
  return undefined;
}

/* --------------------------------------------------------------- deadline */

export type DeadlineState = { kind: "open"; msLeft: number } | { kind: "overdue"; msLate: number } | { kind: "closed" };

/** Only open requests have a running deadline; accepted or closed ones do not. */
export function deadlineState(request: Pick<CooperationRequest, "respondBy" | "status">, now: Date): DeadlineState {
  if (!isOpen(request.status)) return { kind: "closed" };
  const ms = new Date(request.respondBy).getTime() - now.getTime();
  return ms > 0 ? { kind: "open", msLeft: ms } : { kind: "overdue", msLate: -ms };
}

export function responseDeadline(now: Date, hours: number): ISODateTime {
  return new Date(now.getTime() + hours * 3_600_000).toISOString();
}

export const deadlineChoices = [24, 48, 72] as const;

/* ------------------------------------------------------------------ terms */

/** The preset whose numbers these percents form (in either direction), else "custom". */
export function presetFor(listingPercent: number, buyerPercent: number): SplitPreset {
  for (const [preset, [larger, smaller]] of Object.entries(splitPresets) as [
    Exclude<SplitPreset, "custom">,
    readonly [number, number],
  ][]) {
    if (
      (listingPercent === larger && buyerPercent === smaller) ||
      (listingPercent === smaller && buyerPercent === larger)
    ) {
      return preset;
    }
  }
  return "custom";
}

/** The side holding the larger share, or undefined for an even split. */
export function largerSide(
  terms: Pick<CommissionTerms, "listingSidePercent" | "buyerSidePercent">,
): SplitSide | undefined {
  if (terms.listingSidePercent === terms.buyerSidePercent) return undefined;
  return terms.listingSidePercent > terms.buyerSidePercent ? "listing" : "buyer";
}

/**
 * Switches the preset and keeps everything else (basis, amount, payout).
 * "custom" keeps the current percents so the agent edits from where they are.
 */
export function withPreset(terms: CommissionTerms, preset: SplitPreset, largerShare: SplitSide): CommissionTerms {
  if (preset === "custom") return { ...terms, preset };
  const base = presetTerms(preset, terms.currency, { largerShare });
  return { ...terms, preset, listingSidePercent: base.listingSidePercent, buyerSidePercent: base.buyerSidePercent };
}

/** Sets one side's percent, derives the other, and names the matching preset. */
export function withPercent(terms: CommissionTerms, side: SplitSide, percent: number): CommissionTerms {
  const other = Math.round((100 - percent) * 100) / 100;
  const listingSidePercent = side === "listing" ? percent : other;
  const buyerSidePercent = side === "buyer" ? percent : other;
  return { ...terms, listingSidePercent, buyerSidePercent, preset: presetFor(listingSidePercent, buyerSidePercent) };
}

/** Swaps the two shares (e.g. 70/30 → 30/70), keeping the preset name. */
export function flipShares(terms: CommissionTerms): CommissionTerms {
  return { ...terms, listingSidePercent: terms.buyerSidePercent, buyerSidePercent: terms.listingSidePercent };
}

/** The fixed amount follows the terms' currency, so the pair never mismatches silently. */
export function withCurrency(terms: CommissionTerms, currency: Currency): CommissionTerms {
  const next: CommissionTerms = { ...terms, currency };
  if (terms.fixedAmount) next.fixedAmount = { amountMinor: terms.fixedAmount.amountMinor, currency };
  return next;
}

export function withBasis(
  terms: CommissionTerms,
  basis: CommissionTerms["basis"],
  fixedAmount?: Money,
): CommissionTerms {
  const next: CommissionTerms = { ...terms, basis };
  if (basis === "gross_commission") delete next.fixedAmount;
  else if (fixedAmount) next.fixedAmount = fixedAmount;
  return next;
}

export function withPayout(
  terms: CommissionTerms,
  payoutCondition: CommissionTerms["payoutCondition"],
  payoutNote?: string,
): CommissionTerms {
  const next: CommissionTerms = { ...terms, payoutCondition };
  if (payoutNote !== undefined && payoutNote.trim()) next.payoutNote = payoutNote;
  else delete next.payoutNote;
  return next;
}

/** "50", "50,5", " 70 " → number in 0..100; anything else → undefined. */
export function parsePercent(input: string): number | undefined {
  const normalized = input.trim().replace(",", ".");
  if (!/^\d{1,3}(?:\.\d+)?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return value >= 0 && value <= 100 ? value : undefined;
}

/** Major-unit text → Money; undefined for anything that is not a plain positive decimal. */
export function parseMoneyInput(input: string, currency: Currency): Money | undefined {
  const normalized = input.replace(/[\s ]/g, "").replace(",", ".");
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  try {
    const amountMinor = toMinor(normalized);
    return amountMinor > 0 ? { amountMinor, currency } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A neutral example of a gross commission for the split preview. It is a
 * calculator input labelled as an example — never presented as deal data.
 */
export function sampleGross(currency: Currency): Money {
  return currency === "USD" ? { amountMinor: 200_000, currency } : { amountMinor: 2_500_000_000, currency };
}

/** The example split, or undefined while the terms are invalid (never throws). */
export function exampleSplit(terms: CommissionTerms, gross?: Money): SplitResult | undefined {
  if (validateTerms(terms).length > 0) return undefined;
  if (terms.basis === "gross_commission" && (!gross || gross.currency !== terms.currency)) return undefined;
  try {
    return splitAmount(terms, gross);
  } catch {
    return undefined;
  }
}

/** Fields that changed in version `index` compared with the one before; [] for the first. */
export function changedFields(request: Pick<CooperationRequest, "versions">, index: number): (keyof CommissionTerms)[] {
  if (index <= 0 || index >= request.versions.length) return [];
  return diffTerms(request.versions[index - 1].terms, request.versions[index].terms);
}

/* ---------------------------------------------------------------- drafts */

/** A new request before its first proposal; `proposeTerms` turns it into "sent" (§11.5). */
export function draftRequest(input: {
  id: ID;
  listingId: ID;
  requirementId?: ID;
  fromAgentId: ID;
  toAgentId: ID;
  respondBy: ISODateTime;
  createdAt: ISODateTime;
}): CooperationRequest {
  const request: CooperationRequest = {
    id: input.id,
    listingId: input.listingId,
    fromAgentId: input.fromAgentId,
    toAgentId: input.toAgentId,
    status: "draft",
    versions: [],
    respondBy: input.respondBy,
    disclosure: "masked",
    createdAt: input.createdAt,
  };
  if (input.requirementId) request.requirementId = input.requirementId;
  return request;
}

/**
 * What a partner may see of one of the viewer's requirements before any
 * agreement (§16.3, §18.2): criteria only — no client name, phone, notes or
 * the agent's original sentence.
 */
export function partnerViewOf(requirement: Requirement): RequirementSummary {
  return {
    id: requirement.id,
    dealType: requirement.dealType,
    propertyTypes: [...requirement.propertyTypes],
    districts: [...requirement.districts],
    rooms: { ...requirement.rooms },
    area: { ...requirement.area },
    budget: { ...requirement.budget },
    hardCriteria: [...requirement.hardCriteria],
    disclosed: false,
  };
}

/* ---------------------------------------------------------- editor draft */

/**
 * What the terms editor holds: the terms plus the raw text of fields the
 * agent types, so "62," or an empty amount can be shown and explained
 * instead of being silently coerced.
 */
export interface TermsDraft {
  terms: CommissionTerms;
  listingText: string;
  buyerText: string;
  amountText: string;
  payoutNoteText: string;
  note: string;
}

export type DraftInputError = "listingText" | "buyerText" | "amountText";

function percentString(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function amountString(value: Money | undefined): string {
  if (!value) return "";
  const major = value.amountMinor / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

export function draftFromTerms(terms: CommissionTerms, note = ""): TermsDraft {
  return {
    terms: { ...terms },
    listingText: percentString(terms.listingSidePercent),
    buyerText: percentString(terms.buyerSidePercent),
    amountText: amountString(terms.fixedAmount),
    payoutNoteText: terms.payoutNote ?? "",
    note,
  };
}

/** Re-derives the percent texts after a change made through buttons (preset, flip). */
export function withTerms(draft: TermsDraft, terms: CommissionTerms): TermsDraft {
  return {
    ...draft,
    terms,
    listingText: percentString(terms.listingSidePercent),
    buyerText: percentString(terms.buyerSidePercent),
  };
}

/** Typing into one side's percent: the other side follows while the text is a valid percent. */
export function withPercentText(draft: TermsDraft, side: SplitSide, text: string): TermsDraft {
  const key = side === "listing" ? "listingText" : "buyerText";
  const value = parsePercent(text);
  if (value === undefined) return { ...draft, [key]: text };
  const terms = withPercent(draft.terms, side, value);
  return {
    ...draft,
    terms,
    listingText: side === "listing" ? text : percentString(terms.listingSidePercent),
    buyerText: side === "buyer" ? text : percentString(terms.buyerSidePercent),
  };
}

export function withAmountText(draft: TermsDraft, text: string): TermsDraft {
  const amount = parseMoneyInput(text, draft.terms.currency);
  const terms: CommissionTerms = { ...draft.terms };
  if (amount) terms.fixedAmount = amount;
  else delete terms.fixedAmount;
  return { ...draft, terms, amountText: text };
}

export function withBasisChoice(draft: TermsDraft, basis: CommissionTerms["basis"]): TermsDraft {
  const amount = basis === "fixed_amount" ? parseMoneyInput(draft.amountText, draft.terms.currency) : undefined;
  return { ...draft, terms: withBasis(draft.terms, basis, amount) };
}

export function withCurrencyChoice(draft: TermsDraft, currency: Currency): TermsDraft {
  const terms = withCurrency(draft.terms, currency);
  if (terms.basis === "fixed_amount") {
    const amount = parseMoneyInput(draft.amountText, currency);
    if (amount) terms.fixedAmount = amount;
  }
  return { ...draft, terms };
}

export function withPayoutChoice(draft: TermsDraft, payout: CommissionTerms["payoutCondition"]): TermsDraft {
  return {
    ...draft,
    terms: withPayout(draft.terms, payout, payout === "custom" ? draft.payoutNoteText : undefined),
  };
}

export function withPayoutNoteText(draft: TermsDraft, text: string): TermsDraft {
  return { ...draft, payoutNoteText: text, terms: withPayout(draft.terms, draft.terms.payoutCondition, text) };
}

/** Raw text that does not parse; the terms keep their last valid value meanwhile. */
export function draftInputErrors(draft: TermsDraft): DraftInputError[] {
  const errors: DraftInputError[] = [];
  if (parsePercent(draft.listingText) === undefined) errors.push("listingText");
  if (parsePercent(draft.buyerText) === undefined) errors.push("buyerText");
  if (draft.terms.basis === "fixed_amount" && draft.amountText.trim() !== "" && !draft.terms.fixedAmount) {
    errors.push("amountText");
  }
  return errors;
}

/** Ready to propose: every typed field parses and the terms pass `validateTerms`. */
export function draftReady(draft: TermsDraft): boolean {
  return draftInputErrors(draft).length === 0 && validateTerms(draft.terms).length === 0;
}
