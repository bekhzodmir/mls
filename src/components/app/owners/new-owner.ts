import { namesLookAlike, phoneStatus } from "@/components/app/crm/duplicates";
import { normalizeUzPhone } from "@/lib/domain/phone";
import type { Consent, ConsentPurpose, ID } from "@/lib/domain/types";

/**
 * New owner (§20.3, §21.4 #26, §8.3 Flow 3 "Owner → Property → Duplicate
 * Check → … → Consent"). The phone is normalized to +998 and compared with
 * the people the viewer already has — owners whose contact is visible and
 * the viewer's clients — BEFORE saving. A match is only a suggestion: the
 * agent opens the existing card or says it is a different person (a shared
 * family phone proves nothing, §34.5). Consent is recorded per purpose with
 * its channel and text version, and only after the agent confirms it was
 * actually obtained; that box is never pre-checked.
 */

/** Version of the consent text the demo form shows (the seeded consents use it too). */
export const OWNER_CONSENT_TEXT_VERSION = "owner-consent-v1-demo";

export const OWNER_CONSENT_PURPOSES = [
  "contact",
  "share_with_partners",
  "document_processing",
  "marketing",
] as const satisfies readonly ConsentPurpose[];

export const CONSENT_CHANNELS = ["written", "electronic", "verbal_recorded"] as const satisfies readonly Consent["channel"][];

/** Someone the duplicate check may compare with (serializable for the client form). */
export interface PersonCard {
  kind: "owner" | "client";
  id: ID;
  name: string;
  /** Visible numbers only, as stored. */
  phones: string[];
}

export interface PhoneHit {
  person: PersonCard;
  /** The names share a word too: a stronger hint, still not proof. */
  sameName: boolean;
}

export function personKey(person: Pick<PersonCard, "kind" | "id">): string {
  return `${person.kind}:${person.id}`;
}

/** People with the same normalized phone; owners first, then clients, by id. */
export function findPhoneDuplicates(
  phone: string,
  name: string,
  people: readonly PersonCard[],
): PhoneHit[] {
  const e164 = normalizeUzPhone(phone);
  if (!e164) return [];
  return people
    .filter((person) => person.phones.some((value) => normalizeUzPhone(value) === e164))
    .map((person) => ({ person, sameName: namesLookAlike(name, person.name) }))
    .sort(
      (a, b) =>
        (a.person.kind === "owner" ? 0 : 1) - (b.person.kind === "owner" ? 0 : 1) ||
        a.person.id.localeCompare(b.person.id),
    );
}

export interface NewOwnerDraft {
  name: string;
  phone: string;
  purposes: ConsentPurpose[];
  channel?: Consent["channel"];
  /** The agent's explicit statement that the consent was actually obtained. */
  consentObtained: boolean;
  /** `personKey`s the agent marked "a different person". */
  differentFrom: string[];
}

export type NewOwnerField = "name" | "phone" | "duplicates" | "channel" | "consentObtained";

export type NewOwnerError =
  | "name_required"
  | "phone_required"
  | "phone_invalid"
  | "duplicate_unresolved"
  | "channel_required"
  | "consent_not_confirmed";

/** Errors in form order; consent fields are checked only when a purpose is chosen. */
export function validateNewOwner(
  draft: NewOwnerDraft,
  hits: readonly PhoneHit[],
): { field: NewOwnerField; error: NewOwnerError }[] {
  const errors: { field: NewOwnerField; error: NewOwnerError }[] = [];
  if (!draft.name.trim()) errors.push({ field: "name", error: "name_required" });
  const phone = phoneStatus(draft.phone).state;
  if (phone === "empty") errors.push({ field: "phone", error: "phone_required" });
  else if (phone !== "valid") errors.push({ field: "phone", error: "phone_invalid" });
  if (hits.some((hit) => !draft.differentFrom.includes(personKey(hit.person))))
    errors.push({ field: "duplicates", error: "duplicate_unresolved" });
  if (draft.purposes.length > 0) {
    if (!draft.channel) errors.push({ field: "channel", error: "channel_required" });
    if (!draft.consentObtained) errors.push({ field: "consentObtained", error: "consent_not_confirmed" });
  }
  return errors;
}
