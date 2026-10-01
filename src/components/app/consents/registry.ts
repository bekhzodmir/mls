import { oneOf } from "@/components/app/crm/filters";
import type { ConsentFilter, ConsentRegistryItem } from "@/lib/data/views";
import type { Consent, ConsentPurpose, ID, ISODateTime } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Consent registry logic (§38.6 item 2): the URL filters, links to the
 * subject, who may revoke, what revoking changes, and the local revocation
 * itself. A revoked consent is never deleted — it gains a revocation date
 * and forbids the purpose from then on. Pure data in, data out.
 */

export const consentSubjects = ["client", "owner"] as const satisfies readonly NonNullable<ConsentFilter["subject"]>[];
export const consentPurposes = [
  "contact",
  "share_with_partners",
  "document_processing",
  "marketing",
] as const satisfies readonly ConsentPurpose[];
export const consentStates = ["active", "revoked"] as const satisfies readonly NonNullable<ConsentFilter["state"]>[];

type SearchParams = Record<string, string | string[] | undefined>;

/** `?subject=`, `?purpose=`, `?state=`; unknown values are ignored, not errors. */
export function parseConsentFilters(search: SearchParams): ConsentFilter {
  const filter: ConsentFilter = {};
  const subject = oneOf(search.subject, consentSubjects);
  const purpose = oneOf(search.purpose, consentPurposes);
  const state = oneOf(search.state, consentStates);
  if (subject) filter.subject = subject;
  if (purpose) filter.purpose = purpose;
  if (state) filter.state = state;
  return filter;
}

/** `/{locale}/app/consents?subject=…&purpose=…&state=…`, empty values dropped, stable key order. */
export function consentListHref(locale: string, filter: ConsentFilter = {}): string {
  const search = new URLSearchParams();
  if (filter.subject) search.set("subject", filter.subject);
  if (filter.purpose) search.set("purpose", filter.purpose);
  if (filter.state) search.set("state", filter.state);
  const query = search.toString();
  return `${appPath(locale, "/consents")}${query ? `?${query}` : ""}`;
}

/**
 * Client profile or owner profile of the person who gave the consent, when the
 * viewer may open it. A client profile belongs to its responsible agent only
 * (§19 "Own/assigned"), so a colleague's client has no link; owner profiles
 * are open to the whole agency.
 */
export function subjectHref(
  locale: string,
  item: { subject: Pick<ConsentRegistryItem["subject"], "kind" | "id">; scope: ConsentRegistryItem["scope"] },
): string | undefined {
  const { subject } = item;
  if (subject.kind === "client" && item.scope !== "own") return undefined;
  return appPath(locale, `/${subject.kind === "client" ? "clients" : "owners"}/${encodeURIComponent(subject.id)}`);
}

/** Same rules as the repository filter, for counting chips from one unfiltered list. */
export function matchesConsentFilter(item: ConsentRegistryItem, filter: ConsentFilter): boolean {
  return (
    (!filter.subject || item.subject.kind === filter.subject) &&
    (!filter.purpose || item.consent.purpose === filter.purpose) &&
    (!filter.state || item.state === filter.state)
  );
}

/**
 * Only the responsible agent revokes from here (§19 "Own/assigned"): an
 * agency colleague sees the record but is pointed to its owner.
 */
export function canRevoke(item: Pick<ConsentRegistryItem, "state" | "scope">): boolean {
  return item.state === "active" && item.scope === "own";
}

export type RevokeConsequence = ConsentPurpose | "owner_contracts" | "record_kept";

/**
 * What revoking changes, in the order the confirmation lists it: the
 * purpose's own consequence; for an owner, the art. 37 check of contracts
 * that rely on the consent; and that the record is kept, not deleted.
 */
export function revokeConsequences(item: Pick<ConsentRegistryItem, "subject" | "consent">): RevokeConsequence[] {
  return [item.consent.purpose, ...(item.subject.kind === "owner" ? (["owner_contracts"] as const) : []), "record_kept"];
}

/** The consent with a revocation date; undefined when it is already revoked (a date is never rewritten). */
export function revokeConsent(consent: Consent, at: ISODateTime): Consent | undefined {
  return consent.revokedAt ? undefined : { ...consent, revokedAt: at };
}

/** Counts for the header: active and revoked consents in a list. */
export function consentCounts(items: readonly Pick<ConsentRegistryItem, "state">[]): { active: number; revoked: number } {
  return {
    active: items.filter((item) => item.state === "active").length,
    revoked: items.filter((item) => item.state === "revoked").length,
  };
}

export function consentKey(item: { subject: { id: ID }; consent: { id: ID } }): string {
  return `${item.subject.id}:${item.consent.id}`;
}
