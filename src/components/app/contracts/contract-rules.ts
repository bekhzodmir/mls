import { firstParam, oneOf } from "@/components/app/crm/filters";
import { addDaysToKey, tashkentInstant, tashkentParts } from "@/components/app/viewings/time";
import type { ContractView, RightHolderView } from "@/lib/data/views";
import {
  canActivate,
  CONTRACT_CLAUSES,
  contractDisplayStatus,
  contractIssues,
  type ContractClause,
  type ContractContext,
  type ContractDisplayStatus,
  type ContractIssue,
} from "@/lib/domain/contracts";
import type { Contract, ContractKind, ID, ISODateTime } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Contract screen logic (§17.5, §35.2 row 8, §38.5) on top of the domain
 * rules in `@/lib/domain/contracts` — display status, issues and the
 * activation check come from there and are never re-derived here. This
 * module adds the URL filters, the §38.5 checklist as rows, which actions a
 * status allows, and the pure demo transitions (renewal draft, termination,
 * sending for signature). Nothing here changes its input.
 */

/* -------------------------------------------------------------- filters */

/** Chip order: what needs action first. `expiring` is derived, never stored. */
export const contractStatusFilters = [
  "expiring",
  "awaiting_signature",
  "draft",
  "active",
  "expired",
  "terminated",
] as const satisfies readonly ContractDisplayStatus[];

export const contractKinds = ["owner_service", "buyer_service", "cooperation"] as const satisfies readonly ContractKind[];

export interface ContractListParams {
  /** Compared with the display status, so a chip always matches the badges below it. */
  status?: ContractDisplayStatus;
  kind?: ContractKind;
  q?: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

/** Unknown values are ignored, not errors. */
export function parseContractListParams(search: SearchParams): ContractListParams {
  const params: ContractListParams = {};
  const status = oneOf(search.status, contractStatusFilters);
  const kind = oneOf(search.kind, contractKinds);
  const q = firstParam(search.q);
  if (status) params.status = status;
  if (kind) params.kind = kind;
  if (q) params.q = q.slice(0, 100);
  return params;
}

/** `/{locale}/app/contracts?status=…&kind=…&q=…`, empty values dropped, stable key order. */
export function contractListHref(locale: string, params: ContractListParams = {}): string {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.kind) search.set("kind", params.kind);
  if (params.q) search.set("q", params.q);
  const query = search.toString();
  return `${appPath(locale, "/contracts")}${query ? `?${query}` : ""}`;
}

/** Contract pages accept the id ("ctr-dr-2026-041") or the document number ("DR-2026-041"). */
export function contractHref(locale: string, idOrNumber: ID): string {
  return appPath(locale, `/contracts/${encodeURIComponent(idOrNumber)}`);
}

/* --------------------------------------------------------------- status */

export function displayStatus(view: Pick<ContractView, "contract">, now: Date): ContractDisplayStatus {
  return contractDisplayStatus(view.contract, now);
}

/**
 * The rules' owner context built from the view's right holders: they read
 * only ids, names and consents. Contacts are not part of the view and the
 * rules never read them, so none is filled in.
 */
export function issueContext(view: Pick<ContractView, "rightHolders">): ContractContext {
  return {
    owners: view.rightHolders.map((holder) => ({
      id: holder.ownerId,
      name: holder.name,
      phone: "",
      confidentiality: "restricted",
      consents: holder.consent ? [holder.consent] : [],
    })),
  };
}

/** Every problem of the contract as it stands (errors and warnings), via `contractIssues`. */
export function issuesOf(view: Pick<ContractView, "contract" | "rightHolders">): ContractIssue[] {
  return contractIssues(view.contract, issueContext(view));
}

/* ------------------------------------------------------------ checklist */

/** §38.5 in the law's order: the seven stored clauses plus service, term and remuneration. */
export const CHECKLIST_ITEMS = [
  "service",
  "certificateDetails",
  "membershipDetails",
  "insuranceDetails",
  "rightsAndObligations",
  "term",
  "remuneration",
  "liability",
  "terminationAndRefund",
  "confidentiality",
] as const satisfies readonly (ContractClause | "service" | "term" | "remuneration")[];

export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number];

const derivedFrom: Record<Exclude<ChecklistItem, ContractClause>, readonly ContractIssue["code"][]> = {
  service: ["service_missing"],
  term: ["period_invalid"],
  remuneration: ["remuneration_incomplete", "remuneration_invalid"],
};

function isClause(item: ChecklistItem): item is ContractClause {
  return (CONTRACT_CLAUSES as readonly string[]).includes(item);
}

/**
 * One row per §38.5 requirement: a stored clause is present when the text
 * has it; service, term and remuneration are present when the domain rules
 * report no issue about them.
 */
export function clauseChecklist(contract: Contract, issues: readonly ContractIssue[]): { item: ChecklistItem; present: boolean }[] {
  return CHECKLIST_ITEMS.map((item) => ({
    item,
    present: isClause(item)
      ? contract.clauses[item]
      : !issues.some((issue) => derivedFrom[item].includes(issue.code)),
  }));
}

/* ---------------------------------------------------------- signatures */

export type SignatureSide = "customer" | "agent";

/** Sides still to sign, as `canActivate` sees them (a partner signs for the customer side of a co-broking agreement). */
export function missingSignatures(contract: Contract, now: Date, context: ContractContext = {}): SignatureSide[] {
  const check = canActivate(contract, now, context);
  if (check.ok) return [];
  return check.issues
    .filter((issue) => issue.code === "signature_missing")
    .map((issue) => issue.params?.party)
    .filter((party): party is SignatureSide => party === "customer" || party === "agent");
}

export type SendCheck =
  | { ok: true; parties: SignatureSide[]; warnings: ContractIssue[] }
  | { ok: false; issues: ContractIssue[] };

/**
 * May the contract go out for signature? Everything `canActivate` requires
 * except the signatures themselves — those are what sending asks for. A
 * missing clause or a right holder without consent blocks it (art. 37).
 */
export function sendCheck(contract: Contract, now: Date, context: ContractContext = {}): SendCheck {
  const check = canActivate(contract, now, context);
  if (check.ok) return { ok: true, parties: [], warnings: check.warnings };
  const blocking = check.issues.filter((issue) => issue.code !== "signature_missing");
  if (blocking.length > 0) return { ok: false, issues: blocking };
  return { ok: true, parties: missingSignatures(contract, now, context), warnings: check.warnings };
}

/* -------------------------------------------------------------- actions */

export type ContractAction = "send" | "renew" | "terminate";

/** What the responsible agent may do with a contract in this status (display status, so an ended one is "expired"). */
export function availableActions(contract: Contract, now: Date): ContractAction[] {
  switch (contractDisplayStatus(contract, now)) {
    case "draft":
      return ["send"];
    case "awaiting_signature":
      return ["send", "terminate"];
    case "active":
    case "expiring":
      return ["renew", "terminate"];
    case "expired":
      return ["renew"];
    case "terminated":
      return [];
  }
}

/**
 * A renewal already prepared among the related contracts: a newer draft or
 * one awaiting signature of the same kind. A second draft is not created.
 */
export function existingRenewal<T extends Pick<ContractView, "contract">>(contract: Contract, related: readonly T[]): T | undefined {
  return related.find(
    (other) =>
      other.contract.id !== contract.id &&
      other.contract.kind === contract.kind &&
      (other.contract.status === "draft" || other.contract.status === "awaiting_signature") &&
      other.contract.startsAt >= contract.startsAt,
  );
}

const DAY_MS = 86_400_000;

/**
 * Draft renewal: starts the Tashkent day after the current end (today when
 * the term is already over) and runs as many calendar days as the current
 * term. Text, remuneration and right-holder consents are carried over;
 * signatures are not. It has no number until it is saved (`number` is
 * empty) — the screen says so instead of inventing one.
 */
export function renewalDraft(contract: Contract, now: Date): Contract {
  const ended = Date.parse(contract.endsAt) <= now.getTime();
  const startKey = ended ? tashkentParts(now).date : addDaysToKey(tashkentParts(contract.endsAt).date, 1);
  const termDays = Math.max(1, Math.round((Date.parse(contract.endsAt) - Date.parse(contract.startsAt)) / DAY_MS));
  const endKey = addDaysToKey(startKey, termDays - 1);
  const copy = structuredClone(contract);
  delete copy.terminatedAt;
  delete copy.terminationReason;
  return {
    ...copy,
    id: `${contract.id}--renewal`,
    number: "",
    status: "draft",
    startsAt: tashkentInstant(startKey, "00:00") ?? contract.endsAt,
    endsAt: tashkentInstant(endKey, "23:59") ?? contract.endsAt,
    signatures: [],
    createdAt: now.toISOString(),
  };
}

/** Termination with a reason; only an active contract (not yet ended) or one awaiting signature. */
export function terminateContract(contract: Contract, reason: string, at: ISODateTime): Contract | undefined {
  const text = reason.trim();
  if (!text || !availableActions(contract, new Date(at)).includes("terminate")) return undefined;
  return { ...structuredClone(contract), status: "terminated", terminatedAt: at, terminationReason: text };
}

/* ------------------------------------------------------------ templates */

/**
 * A newer template version of the same line in use in the organization
 * ("owner-service@2026-08" for a contract on "owner-service@2026-05"),
 * derived from the visible contracts — a stale-text hint for renewals.
 */
export function newerTemplate(contract: Pick<Contract, "templateVersion">, all: readonly Pick<Contract, "templateVersion">[]): string | undefined {
  const [line, version] = contract.templateVersion.split("@");
  if (!line || !version) return undefined;
  let newest: string | undefined;
  for (const other of all) {
    const [otherLine, otherVersion] = other.templateVersion.split("@");
    if (otherLine === line && otherVersion && otherVersion > version && (!newest || otherVersion > newest)) {
      newest = otherVersion;
    }
  }
  return newest ? `${line}@${newest}` : undefined;
}

/* -------------------------------------------------------- right holders */

/** Consent confirmed and its record not revoked. */
export function holderConsentValid(holder: Pick<RightHolderView, "status" | "consent">): boolean {
  return holder.status === "confirmed" && !holder.consent?.revokedAt;
}
