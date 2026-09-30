import type { ClientDetailView } from "@/lib/data/views";
import type {
  ConsentPurpose,
  DealStage,
  ID,
  ISODateTime,
  LeadSource,
  Money,
  OfferVersion,
  ViewingStatus,
} from "@/lib/domain/types";

/**
 * Client timeline (§14.3, §22.3): what already happened with the client,
 * newest first, assembled from the records the profile already has. Future
 * plans (a viewing tomorrow) are not history and stay in their own sections.
 */
export type TimelineEvent =
  | { kind: "lead_received"; at: ISODateTime; source: LeadSource; leadId: ID }
  | { kind: "created"; at: ISODateTime }
  | { kind: "requirement_created"; at: ISODateTime; requirementId: ID }
  | { kind: "requirement_updated"; at: ISODateTime; requirementId: ID; version: number }
  | { kind: "viewing"; at: ISODateTime; status: ViewingStatus; listingId: ID }
  | { kind: "offer"; at: ISODateTime; amount: Money; by: OfferVersion["by"]; listingId: ID }
  | { kind: "deal"; at: ISODateTime; stage: DealStage; dealId: ID }
  | { kind: "consent_granted" | "consent_revoked"; at: ISODateTime; purpose: ConsentPurpose }
  | { kind: "memory"; at: ISODateTime; text: string }
  | { kind: "last_contact"; at: ISODateTime };

export type TimelineKind = TimelineEvent["kind"];

/** Tie-break for events at the same instant: causes before effects when read newest-first. */
const order: TimelineKind[] = [
  "last_contact",
  "deal",
  "offer",
  "viewing",
  "memory",
  "consent_revoked",
  "consent_granted",
  "requirement_updated",
  "requirement_created",
  "created",
  "lead_received",
];

export function buildClientTimeline(detail: ClientDetailView, at: Date): TimelineEvent[] {
  const { client } = detail;
  const events: TimelineEvent[] = [];
  if (detail.lead) {
    events.push({
      kind: "lead_received",
      at: detail.lead.receivedAt,
      source: detail.lead.source,
      leadId: detail.lead.id,
    });
  }
  events.push({ kind: "created", at: client.createdAt });
  for (const { requirement } of detail.requirements) {
    events.push({ kind: "requirement_created", at: requirement.createdAt, requirementId: requirement.id });
    if (requirement.version > 1 && requirement.updatedAt !== requirement.createdAt) {
      events.push({
        kind: "requirement_updated",
        at: requirement.updatedAt,
        requirementId: requirement.id,
        version: requirement.version,
      });
    }
  }
  for (const { viewing } of detail.viewings) {
    events.push({ kind: "viewing", at: viewing.startsAt, status: viewing.status, listingId: viewing.listingId });
  }
  for (const { offer } of detail.offers) {
    for (const version of offer.versions) {
      events.push({
        kind: "offer",
        at: version.at,
        amount: version.amount,
        by: version.by,
        listingId: offer.listingId,
      });
    }
  }
  for (const { deal } of detail.deals) {
    events.push({ kind: "deal", at: deal.createdAt, stage: deal.stage, dealId: deal.id });
  }
  for (const consent of client.consents) {
    events.push({ kind: "consent_granted", at: consent.grantedAt, purpose: consent.purpose });
    if (consent.revokedAt) events.push({ kind: "consent_revoked", at: consent.revokedAt, purpose: consent.purpose });
  }
  for (const item of client.memory) events.push({ kind: "memory", at: item.at, text: item.text });
  if (client.lastContactAt) events.push({ kind: "last_contact", at: client.lastContactAt });

  const limit = at.getTime();
  return events
    .filter((event) => new Date(event.at).getTime() <= limit)
    .sort((a, b) => {
      const diff = new Date(b.at).getTime() - new Date(a.at).getTime();
      return diff !== 0 ? diff : order.indexOf(a.kind) - order.indexOf(b.kind);
    });
}
