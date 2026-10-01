import type { Contract, ContractSignature, ContractStatus, ID, Owner } from "./types";
import { tashkentDateKey } from "./working-days";

/**
 * Service contract rules (§17.5, §38.5; art. 35–37 of ZRU-1163 as summarized
 * there).
 *
 * - The contract fixes the service, certificate / membership / insurance
 *   details, rights and obligations, term, remuneration, liability,
 *   termination and refund, and confidentiality (§17.5, §38.5). A missing
 *   clause is an error, not a hint.
 * - Art. 37: a contract on a property needs the consent of every right
 *   holder; one holder's consent is never the others' (§38.5).
 * - A button press is not a qualified electronic signature unless the method
 *   passed legal review (§38.5): a simple electronic signature is flagged as
 *   a warning so Legal can confirm it, without blocking the work.
 *
 * Checks return every issue at once so the screen can list them together
 * (same pattern as lifecycle guards). Labels live in the UI message
 * namespace, keyed by `code`. Pure: nothing here changes a contract.
 */

/**
 * An active contract that ends within this many Tashkent calendar days reads
 * "expiring" (Flow 8 "Expiring contract → Notification"). The window is a
 * product setting; the master document does not fix it.
 */
export const CONTRACT_EXPIRING_DAYS = 14;

export type ContractDisplayStatus = ContractStatus | "expiring";

export type ContractClause = keyof Contract["clauses"];

/** Display order; `satisfies` makes the compiler insist on every clause, and only those. */
const clauseOrder = {
  certificateDetails: 1,
  membershipDetails: 2,
  insuranceDetails: 3,
  rightsAndObligations: 4,
  liability: 5,
  terminationAndRefund: 6,
  confidentiality: 7,
} satisfies Record<ContractClause, number>;

export const CONTRACT_CLAUSES = Object.keys(clauseOrder) as ContractClause[];

/* ----------------------------------------------------------------- time */

/** "2026-12-01T00:00:00.000Z" or with an offset; `Date.parse` alone also accepts "01.12.2026". */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Epoch milliseconds of an ISO-8601 instant, or undefined when it is not one. */
function instant(iso: string): number | undefined {
  if (!ISO_INSTANT.test(iso)) return undefined;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? undefined : time;
}

function dayNumber(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * Tashkent calendar days from today to the contract's end date: 0 = ends
 * today, 1 = tomorrow, negative = ended that many days ago. Throws a
 * RangeError when `endsAt` is not an ISO-8601 instant.
 */
export function daysUntilEnd(contract: Pick<Contract, "endsAt">, now: Date): number {
  if (instant(contract.endsAt) === undefined) throw new RangeError(`Not an ISO-8601 instant: "${contract.endsAt}"`);
  return dayNumber(tashkentDateKey(contract.endsAt)) - dayNumber(tashkentDateKey(now));
}

/**
 * Status to show. Only an active contract changes with time: past `endsAt`
 * it reads "expired" (nobody has to flip it by hand), and within
 * CONTRACT_EXPIRING_DAYS calendar days of the end it reads "expiring".
 * Every other status is shown as stored. An unreadable end date leaves the
 * stored status (and `contractIssues` reports `period_invalid`).
 */
export function contractDisplayStatus(contract: Contract, now: Date): ContractDisplayStatus {
  if (contract.status !== "active") return contract.status;
  const end = instant(contract.endsAt);
  if (end === undefined) return contract.status;
  if (end <= now.getTime()) return "expired";
  return daysUntilEnd(contract, now) <= CONTRACT_EXPIRING_DAYS ? "expiring" : "active";
}

/* --------------------------------------------------------------- issues */

/**
 * Machine-readable problem with a contract.
 *
 * Codes and params (severity "error" unless noted):
 * - `period_invalid` — `endsAt` is not after `startsAt`, or a date is unreadable.
 * - `service_missing` — no description of the service (вид услуги).
 * - `clause_missing` {clause} — a required clause is absent (one per clause).
 * - `remuneration_incomplete` {field} — percent kind without `percent`,
 *   fixed kind without `amount`, or empty `paymentTerms`.
 * - `remuneration_invalid` {field} — percent outside (0, 100], or a fixed
 *   amount that is not a positive whole number of minor units.
 * - `right_holders_missing` — a property (owner_service) contract lists no
 *   right holder at all, so nobody's consent is on record (art. 37).
 * - `right_holder_consent_missing` {ownerId, ownerName?} — one per right
 *   holder whose consent is missing (art. 37).
 * - `right_holder_consent_revoked` {ownerId, consentId, ownerName?} — the
 *   linked consent was revoked (checked when `owners` are supplied).
 * - `right_holder_consent_unlinked` {ownerId, ownerName?} — warning: marked
 *   confirmed without a link to the consent record; §38.5 asks for separate
 *   proof of each consent.
 * - `signature_missing` {party: "customer" | "agent"} — an active contract
 *   (or one being activated) lacks that side's signature.
 * - `signature_method_unverified` {party} — warning: a simple electronic
 *   signature counts only once Legal confirms the method (§38.5).
 * - `status_not_activatable` {status} — `canActivate` only: just drafts and
 *   contracts awaiting signature can become active.
 * - `period_ended` {endsAt} — `canActivate` only: the term is already over.
 */
export type ContractIssueCode =
  | "period_invalid"
  | "service_missing"
  | "clause_missing"
  | "remuneration_incomplete"
  | "remuneration_invalid"
  | "right_holders_missing"
  | "right_holder_consent_missing"
  | "right_holder_consent_revoked"
  | "right_holder_consent_unlinked"
  | "signature_missing"
  | "signature_method_unverified"
  | "status_not_activatable"
  | "period_ended";

export interface ContractIssue {
  code: ContractIssueCode;
  severity: "error" | "warning";
  params?: Record<string, string | number>;
}

export interface ContractContext {
  /**
   * Owners referenced by `rightHolderConsents`, used to name each right
   * holder and to see whether a linked consent was revoked. Optional: without
   * it the checks still run on the contract alone.
   */
  owners?: readonly Owner[];
}

interface RuleContext {
  owners: ReadonlyMap<ID, Owner>;
  /** Check as if the contract were active (signatures required). */
  asActive: boolean;
}

type ContractRule = (contract: Contract, context: RuleContext) => ContractIssue[];

const error = (code: ContractIssueCode, params?: ContractIssue["params"]): ContractIssue =>
  params ? { code, severity: "error", params } : { code, severity: "error" };

const warning = (code: ContractIssueCode, params?: ContractIssue["params"]): ContractIssue =>
  params ? { code, severity: "warning", params } : { code, severity: "warning" };

const validPeriod: ContractRule = (contract) => {
  const start = instant(contract.startsAt);
  const end = instant(contract.endsAt);
  return start === undefined || end === undefined || end <= start ? [error("period_invalid")] : [];
};

const serviceDescribed: ContractRule = (contract) => (contract.service.trim() ? [] : [error("service_missing")]);

const clausesPresent: ContractRule = (contract) =>
  CONTRACT_CLAUSES.filter((clause) => !contract.clauses[clause]).map((clause) => error("clause_missing", { clause }));

const remunerationComplete: ContractRule = ({ remuneration }) => {
  const issues: ContractIssue[] = [];
  if (remuneration.kind === "percent") {
    const { percent } = remuneration;
    if (percent === undefined) issues.push(error("remuneration_incomplete", { field: "percent" }));
    else if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      issues.push(error("remuneration_invalid", { field: "percent" }));
    }
  } else {
    const { amount } = remuneration;
    if (!amount) issues.push(error("remuneration_incomplete", { field: "amount" }));
    else if (!Number.isSafeInteger(amount.amountMinor) || amount.amountMinor <= 0) {
      issues.push(error("remuneration_invalid", { field: "amount" }));
    }
  }
  if (!remuneration.paymentTerms.trim()) issues.push(error("remuneration_incomplete", { field: "paymentTerms" }));
  return issues;
};

/** Art. 37: every right holder separately; one consent never covers the others. */
const rightHolderConsents: ContractRule = (contract, { owners }) => {
  if (contract.kind === "owner_service" && contract.rightHolderConsents.length === 0) {
    return [error("right_holders_missing")];
  }
  return contract.rightHolderConsents.flatMap((entry): ContractIssue[] => {
    const owner = owners.get(entry.ownerId);
    const who: Record<string, string> = { ownerId: entry.ownerId };
    if (owner) who.ownerName = owner.name;
    if (entry.status === "missing") return [error("right_holder_consent_missing", who)];
    if (!entry.consentId) return [warning("right_holder_consent_unlinked", who)];
    const consent = owner?.consents.find((item) => item.id === entry.consentId);
    if (consent?.revokedAt) return [error("right_holder_consent_revoked", { ...who, consentId: entry.consentId })];
    return [];
  });
};

/** The customer's side; in a cooperation contract the customer is the partner agent. */
function signsForCustomer(contract: Contract, signature: ContractSignature): boolean {
  return signature.party === "customer" || (contract.kind === "cooperation" && signature.party === "partner");
}

/** The professional's side: the agent, or the head of the realtor organization (art. 36). */
function signsForAgent(signature: ContractSignature): boolean {
  return signature.party === "agent" || signature.party === "organization_head";
}

const signaturesPresent: ContractRule = (contract, { asActive }) => {
  if (!asActive) return [];
  const issues: ContractIssue[] = [];
  if (!contract.signatures.some((signature) => signsForCustomer(contract, signature))) {
    issues.push(error("signature_missing", { party: "customer" }));
  }
  if (!contract.signatures.some(signsForAgent)) issues.push(error("signature_missing", { party: "agent" }));
  return issues;
};

const signatureMethods: ContractRule = (contract) =>
  contract.signatures
    .filter((signature) => signature.method === "simple_electronic")
    .map((signature) => warning("signature_method_unverified", { party: signature.party }));

/** Every rule, in the order issues are listed. */
export const contractRules: readonly ContractRule[] = [
  validPeriod,
  serviceDescribed,
  clausesPresent,
  remunerationComplete,
  rightHolderConsents,
  signaturesPresent,
  signatureMethods,
];

function evaluate(contract: Contract, context: ContractContext, asActive: boolean): ContractIssue[] {
  const owners = new Map((context.owners ?? []).map((owner) => [owner.id, owner] as const));
  return contractRules.flatMap((rule) => rule(contract, { owners, asActive }));
}

/**
 * Every problem with a contract as it stands, errors and warnings together.
 * Signatures are required only once the contract is active; use
 * `canActivate` to check a draft before signing it off.
 */
export function contractIssues(contract: Contract, context: ContractContext = {}): ContractIssue[] {
  return evaluate(contract, context, contract.status === "active");
}

export type ActivationCheck =
  | { ok: true; warnings: ContractIssue[] }
  | { ok: false; issues: ContractIssue[]; warnings: ContractIssue[] };

/** Contract statuses that may move to "active". */
const ACTIVATABLE: ReadonlySet<ContractStatus> = new Set<ContractStatus>(["draft", "awaiting_signature"]);

/**
 * Can this contract become active now? A contract with a missing clause,
 * missing right-holder consent, missing signatures or an ended term cannot.
 * Warnings (e.g. a simple electronic signature) do not block, but come back
 * so the confirmation step can show them.
 */
export function canActivate(contract: Contract, now: Date, context: ContractContext = {}): ActivationCheck {
  const all = evaluate(contract, context, true);
  const errors: ContractIssue[] = [];
  if (!ACTIVATABLE.has(contract.status)) errors.push(error("status_not_activatable", { status: contract.status }));
  errors.push(...all.filter((issue) => issue.severity === "error"));
  const end = instant(contract.endsAt);
  if (end !== undefined && end <= now.getTime()) errors.push(error("period_ended", { endsAt: contract.endsAt }));
  const warnings = all.filter((issue) => issue.severity === "warning");
  return errors.length === 0 ? { ok: true, warnings } : { ok: false, issues: errors, warnings };
}
