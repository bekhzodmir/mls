import { normalizeUzPhone } from "@/lib/domain/phone";
import { foldText } from "@/lib/domain/text";
import type { Client, ClientStatus, ID, ISODateTime } from "@/lib/domain/types";

/**
 * Duplicate hints for leads and new clients (§14.1, §35.3 step 3). Signals
 * are the normalized phone, the Telegram username and a shared name token.
 * A hint is only a suggestion: the agent chooses Link, Merge or Create
 * separately — nothing is merged automatically (§34.5). A shared family
 * phone does not prove it is the same person, so the reasons are shown.
 */

export type DuplicateReason = "phone" | "telegram" | "name";

/** What a duplicate check may know about an existing client (serializable). */
export interface ContactCard {
  id: ID;
  name: string;
  phones: string[];
  telegramUsername?: string;
  status: ClientStatus;
  /** Set when the client revoked the contact consent and has no active one. */
  contactRevokedAt?: ISODateTime;
}

export interface DuplicateHit {
  client: ContactCard;
  reasons: DuplicateReason[];
}

/** Latest revocation of a "contact" consent when no contact consent is active. */
export function contactRevokedAt(client: Pick<Client, "consents">): ISODateTime | undefined {
  const contact = client.consents.filter((consent) => consent.purpose === "contact");
  if (contact.length === 0 || contact.some((consent) => !consent.revokedAt)) return undefined;
  return contact
    .map((consent) => consent.revokedAt as string)
    .sort()
    .at(-1);
}

export function contactCard(client: Client): ContactCard {
  const card: ContactCard = { id: client.id, name: client.name, phones: client.phones, status: client.status };
  if (client.telegramUsername) card.telegramUsername = client.telegramUsername;
  const revoked = contactRevokedAt(client);
  if (revoked) card.contactRevokedAt = revoked;
  return card;
}

const TELEGRAM_RE = /^[a-z0-9_]{5,32}$/;

/** "@Sanjar_Demo" → "sanjar_demo"; undefined when empty or not a valid username. */
export function normalizeTelegram(raw: string | undefined): string | undefined {
  const value = raw?.trim().replace(/^@/, "").toLowerCase();
  return value && TELEGRAM_RE.test(value) ? value : undefined;
}

export type PhoneState = "empty" | "incomplete" | "invalid" | "valid";

/**
 * Live validation state for the +998 phone field: "incomplete" while the
 * agent is still typing, "invalid" only when the digits cannot become a
 * Uzbek number.
 */
export function phoneStatus(raw: string): { state: PhoneState; e164?: string } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return { state: "empty" };
  const e164 = normalizeUzPhone(raw);
  if (e164) return { state: "valid", e164 };
  const national = digits.startsWith("998") ? digits.slice(3) : digits.startsWith("8") ? digits.slice(1) : digits;
  const tooShort = digits.startsWith("998") ? digits.length < 12 : national.length < 9;
  if (tooShort && !national.startsWith("0")) return { state: "incomplete" };
  return { state: "invalid" };
}

function nameTokens(name: string): Set<string> {
  return new Set(
    foldText(name)
      .split(/[^\p{L}\p{N}']+/u)
      .filter((token) => token.length >= 3),
  );
}

/** A shared word of three letters or more («Гульнара Сафарова» ~ «Гульнара»). */
export function namesLookAlike(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const left = nameTokens(a);
  for (const token of nameTokens(b)) if (left.has(token)) return true;
  return false;
}

export interface ContactProbe {
  name?: string;
  phones: string[];
  telegramUsername?: string;
}

/** Why `probe` looks like `card`, in a stable order; empty when it does not. */
export function duplicateReasons(
  probe: ContactProbe,
  card: Pick<ContactCard, "name" | "phones" | "telegramUsername">,
): DuplicateReason[] {
  const reasons: DuplicateReason[] = [];
  const own = new Set(card.phones.map((phone) => normalizeUzPhone(phone)).filter(Boolean));
  if (probe.phones.some((phone) => own.has(normalizeUzPhone(phone)))) reasons.push("phone");
  const telegram = normalizeTelegram(probe.telegramUsername);
  if (telegram && telegram === normalizeTelegram(card.telegramUsername)) reasons.push("telegram");
  if (namesLookAlike(probe.name, card.name)) reasons.push("name");
  return reasons;
}

/**
 * Existing clients that share a phone or Telegram with the probe. A name on
 * its own is too weak to raise a warning (namesakes are common) and only
 * strengthens a contact match.
 */
export function findDuplicateClients(probe: ContactProbe, clients: readonly ContactCard[]): DuplicateHit[] {
  return clients
    .map((client) => ({ client, reasons: duplicateReasons(probe, client) }))
    .filter((hit) => hit.reasons.includes("phone") || hit.reasons.includes("telegram"))
    .sort((a, b) => b.reasons.length - a.reasons.length || a.client.id.localeCompare(b.client.id));
}
