import type { ContractView, ListingView } from "@/lib/data/views";
import { displayedProfessionalStatus } from "@/lib/domain/professional-status";
import type { Agent, ContractKind, ContractStatus, ID, ISODateTime, Organization, VerificationSubject } from "@/lib/domain/types";

/**
 * New realtor request (§17.4, §35.7 steps 1–4, §38.4). The request starts
 * only after the object, the subject, the purpose and the client contract
 * are chosen; the screen then says which information blocks the requester's
 * legal status allows and which documents are needed.
 *
 * Grounded in §38.4: an organization's request reaches the art. 32 list; a
 * real-estate agent only the first two blocks (legal-entity registry and
 * the property-rights registry with related open bases). The exact matrix
 * still has to be fixed against arts. 31–33 and the standard, so the copy
 * says "in this build" and never promises an answer. State integrations are
 * not connected (§38.3: the MVP works without them): a request is recorded
 * as a checklist item, and an unanswered request stays "could not verify".
 */

/** §38.4 information blocks in the order of art. 32. */
export const INFO_BLOCKS = [
  "legal_entities",
  "property_rights",
  "tax",
  "residence",
  "notary",
  "utilities",
  "other",
] as const;
export type InfoBlock = (typeof INFO_BLOCKS)[number];

/** What a request can ask about; property facts first. */
export const REQUEST_SUBJECTS = [
  "ownership",
  "cadastre",
  "shared_construction",
  "encumbrance",
  "utility_debts",
  "tax_debts",
  "registered_residents",
  "legal_entity",
] as const;
export type RequestSubject = (typeof REQUEST_SUBJECTS)[number];

export const SUBJECT_BLOCK: Readonly<Record<RequestSubject, InfoBlock>> = {
  ownership: "property_rights",
  cadastre: "property_rights",
  shared_construction: "property_rights",
  encumbrance: "notary",
  utility_debts: "utilities",
  tax_debts: "tax",
  registered_residents: "residence",
  legal_entity: "legal_entities",
};

/** Request subjects that are also checked facts in the queue (for `?subject=` prefill). */
export const FACT_SUBJECTS: Readonly<Partial<Record<VerificationSubject, RequestSubject>>> = {
  ownership: "ownership",
  cadastre: "cadastre",
  encumbrance: "encumbrance",
  utility_debts: "utility_debts",
};

export const REQUEST_PURPOSES = ["listing_preparation", "buyer_due_diligence", "deal_preparation"] as const;
export type RequestPurpose = (typeof REQUEST_PURPOSES)[number];

/* ------------------------------------------------------------ standing */

/**
 * Who sends the request (§38.2): the realtor organization the agent works
 * in, a real-estate agent in their own name (narrower rights), or nobody —
 * a professional outside an organization whose status is not that of a
 * real-estate agent cannot send it from Binor.
 */
export type RequesterStanding = "realtor_organization" | "real_estate_agent" | "none";

export function requesterStanding(
  agent: Pick<Agent, "professionalStatus" | "verifications">,
  organization: Organization | undefined,
): RequesterStanding {
  if (displayedProfessionalStatus(agent) === "real_estate_agent") return "real_estate_agent";
  return organization ? "realtor_organization" : "none";
}

export type BlockAccess = "allowed" | "conditional" | "not_allowed";

export type BlockReason =
  /** Art. 32: a real-estate agent gets the first two blocks only. */
  | "agent_limit"
  /** Nobody to send the request on behalf of. */
  | "no_standing"
  /** Highly sensitive personal data: purpose limitation and separate rights. */
  | "sensitive"
  /** The category of access and its legal basis must be checked first; not in this build. */
  | "category_check";

export interface BlockVerdict {
  access: BlockAccess;
  reason?: BlockReason;
}

const AGENT_BLOCKS: readonly InfoBlock[] = ["legal_entities", "property_rights"];

export function blockAccess(standing: RequesterStanding, block: InfoBlock): BlockVerdict {
  if (standing === "none") return { access: "not_allowed", reason: "no_standing" };
  if (standing === "real_estate_agent") {
    return AGENT_BLOCKS.includes(block) ? { access: "allowed" } : { access: "not_allowed", reason: "agent_limit" };
  }
  if (block === "other") return { access: "not_allowed", reason: "category_check" };
  if (block === "residence") return { access: "conditional", reason: "sensitive" };
  return { access: "allowed" };
}

/* ----------------------------------------------------------- documents */

export type RequiredDocument =
  | "service_contract"
  | "customer_authority"
  | "right_holder_consents"
  | "object_identifier"
  | "company_identifier"
  | "subject_consent";

/** §38.4: the request is tied to a customer, a service and an object; attachments prove the basis. */
export function requiredDocuments(block: InfoBlock): RequiredDocument[] {
  const documents: RequiredDocument[] = ["service_contract", "customer_authority"];
  if (block === "legal_entities") documents.push("company_identifier");
  else documents.push("object_identifier", "right_holder_consents");
  if (block === "residence") documents.push("subject_consent");
  return documents;
}

/**
 * - `ready` — on file in Binor (an active contract, every right holder's consent, a cadastral number);
 * - `missing` — known to be absent: the request cannot be based on it;
 * - `manual` — Binor does not track it: the agent checks the paper.
 */
export type DocumentState = "ready" | "missing" | "manual";

export interface DocumentContext {
  contract?: Pick<RequestContract, "status" | "missingConsents">;
  /** The listing's cadastral number is on file (undefined = no listing chosen). */
  cadastralKnown?: boolean;
}

export function documentState(document: RequiredDocument, context: DocumentContext): DocumentState {
  switch (document) {
    case "service_contract":
      return context.contract?.status === "active" ? "ready" : "missing";
    case "right_holder_consents":
      if (!context.contract) return "missing";
      return context.contract.missingConsents === 0 ? "ready" : "missing";
    case "object_identifier":
      return context.cadastralKnown ? "ready" : "manual";
    case "customer_authority":
    case "company_identifier":
    case "subject_consent":
      return "manual";
  }
}

/* --------------------------------------------------------------- form */

/** A listing the viewer may base a request on (their own), serializable for the client form. */
export interface RequestListing {
  id: ID;
  label: string;
  contractNumber?: string;
  cadastralKnown: boolean;
}

/** A contract option, serializable for the client form. */
export interface RequestContract {
  id: ID;
  number: string;
  kind: ContractKind;
  status: ContractStatus;
  customerName: string;
  listingId?: ID;
  endsAt: ISODateTime;
  missingConsents: number;
}

export function requestListing(view: ListingView, label: string): RequestListing {
  const option: RequestListing = { id: view.listing.id, label, cadastralKnown: Boolean(view.property.cadastralNumber) };
  if (view.listing.contractId) option.contractNumber = view.listing.contractId;
  return option;
}

export function requestContract(view: ContractView): RequestContract {
  const option: RequestContract = {
    id: view.contract.id,
    number: view.contract.number,
    kind: view.contract.kind,
    status: view.contract.status,
    customerName: view.customer.name,
    endsAt: view.contract.endsAt,
    missingConsents: view.missingConsents,
  };
  if (view.contract.listingId) option.listingId = view.contract.listingId;
  return option;
}

/**
 * Contracts for the chosen object first — the one the listing names, then
 * others on the same listing — then contracts without an object (buyer
 * service). Contracts on other objects cannot be the basis and are left out.
 */
export function contractsForListing(
  contracts: readonly RequestContract[],
  listing: RequestListing | undefined,
): RequestContract[] {
  const rank = (contract: RequestContract) =>
    listing && contract.number === listing.contractNumber ? 0 : contract.listingId ? 1 : 2;
  return contracts
    .filter((contract) => !contract.listingId || contract.listingId === listing?.id)
    .sort((a, b) => rank(a) - rank(b) || a.number.localeCompare(b.number));
}

export interface RequestDraft {
  listingId?: ID;
  subject?: RequestSubject;
  purpose?: RequestPurpose;
  contractId?: ID;
}

export type RequestField = keyof RequestDraft;

export type RequestError =
  | "listing_required"
  | "subject_required"
  | "purpose_required"
  | "contract_required"
  | "subject_not_allowed"
  | "contract_other_object"
  | "contract_not_active"
  | "consents_missing";

/**
 * Field errors in form order. A contract that is not active, or that lacks a
 * right holder's consent (art. 37, §38.5), cannot be the basis of a request.
 */
export function validateRequest(
  draft: RequestDraft,
  standing: RequesterStanding,
  listings: readonly RequestListing[],
  contracts: readonly RequestContract[],
): { field: RequestField; error: RequestError }[] {
  const errors: { field: RequestField; error: RequestError }[] = [];
  const listing = listings.find((item) => item.id === draft.listingId);
  if (!listing) errors.push({ field: "listingId", error: "listing_required" });
  if (!draft.subject) errors.push({ field: "subject", error: "subject_required" });
  else if (blockAccess(standing, SUBJECT_BLOCK[draft.subject]).access === "not_allowed")
    errors.push({ field: "subject", error: "subject_not_allowed" });
  if (!draft.purpose) errors.push({ field: "purpose", error: "purpose_required" });
  const contract = contracts.find((item) => item.id === draft.contractId);
  if (!contract) errors.push({ field: "contractId", error: "contract_required" });
  else if (contract.listingId && listing && contract.listingId !== listing.id)
    errors.push({ field: "contractId", error: "contract_other_object" });
  else if (contract.status !== "active") errors.push({ field: "contractId", error: "contract_not_active" });
  else if (contract.missingConsents > 0) errors.push({ field: "contractId", error: "consents_missing" });
  return errors;
}
