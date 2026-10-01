import { crmHref, oneOf } from "@/components/app/crm/filters";
import type { VerificationQueueItem, VerificationTargetKind } from "@/lib/data/views";
import { daysUntilEnd } from "@/lib/domain/contracts";
import type { ID, ISODateTime, VerificationSubject } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Verification Center queue (§16.1, §16.4, §21.4 #41). The repository already
 * orders the queue by need of attention; this module names the display
 * buckets, counts them and builds the filter URLs. Every item falls into
 * exactly one bucket, so the summary adds up to the total.
 *
 * - `expired` / `expiring` are confirmed facts whose evidence has run out or
 *   runs out within 30 days: still one checked fact, but it needs a new check.
 * - `unavailable` is a registry that did not answer. It is never counted with
 *   `confirmed` (§16.4 "source unavailable ≠ verified", §38.2).
 */

export const QUEUE_BUCKETS = ["problem", "expired", "unavailable", "pending", "expiring", "confirmed"] as const;
export type QueueBucket = (typeof QUEUE_BUCKETS)[number];

/** Buckets where the agent has something to do now (pending waits for an answer). */
export const ATTENTION_BUCKETS: readonly QueueBucket[] = ["problem", "expired", "unavailable", "expiring"];

/** Subject chips, property facts first, then the professional's and the organization's facts. */
export const QUEUE_SUBJECTS = [
  "ownership",
  "cadastre",
  "encumbrance",
  "utility_debts",
  "contract",
  "owner_consent",
  "agent_identity",
  "agent_certificate",
  "org_registry",
  "insurance",
] as const satisfies readonly VerificationSubject[];

export const QUEUE_TARGETS = ["listing", "agent", "organization"] as const satisfies readonly VerificationTargetKind[];

export interface QueueFilter {
  status?: QueueBucket;
  subject?: VerificationSubject;
  target?: VerificationTargetKind;
}

type Param = string | string[] | undefined;

/** `?status=&subject=&target=`; unknown values are ignored, not errors. */
export function parseQueueFilter(params: Record<string, Param>): QueueFilter {
  const filter: QueueFilter = {};
  const status = oneOf(params.status, QUEUE_BUCKETS);
  const subject = oneOf(params.subject, QUEUE_SUBJECTS);
  const target = oneOf(params.target, QUEUE_TARGETS);
  if (status) filter.status = status;
  if (subject) filter.subject = subject;
  if (target) filter.target = target;
  return filter;
}

type BucketInput = Pick<VerificationQueueItem, "item" | "expired" | "expiresSoon">;

export function bucketOf(entry: BucketInput): QueueBucket {
  // The repository sets `expired` / `expiresSoon` on confirmed facts only.
  if (entry.expired) return "expired";
  if (entry.expiresSoon) return "expiring";
  return entry.item.status;
}

/** Whether the entry passes the filter; `ignore` leaves one dimension out (for chip counts). */
export function matchesQueueFilter(
  entry: VerificationQueueItem,
  filter: QueueFilter,
  ignore?: keyof QueueFilter,
): boolean {
  if (ignore !== "status" && filter.status && bucketOf(entry) !== filter.status) return false;
  if (ignore !== "subject" && filter.subject && entry.item.subject !== filter.subject) return false;
  if (ignore !== "target" && filter.target && entry.target.kind !== filter.target) return false;
  return true;
}

export function countBuckets(entries: readonly BucketInput[]): Record<QueueBucket, number> {
  const counts = Object.fromEntries(QUEUE_BUCKETS.map((bucket) => [bucket, 0])) as Record<QueueBucket, number>;
  for (const entry of entries) counts[bucketOf(entry)] += 1;
  return counts;
}

export function attentionCount(counts: Record<QueueBucket, number>): number {
  return ATTENTION_BUCKETS.reduce((sum, bucket) => sum + counts[bucket], 0);
}

/** `/{locale}/app/verification?…` with the filter in a stable order. */
export function queueHref(locale: string, filter: QueueFilter = {}): string {
  return crmHref(locale, "/verification", { status: filter.status, subject: filter.subject, target: filter.target });
}

/** The new-request form, optionally prefilled with the object and the subject. */
export function requestHref(locale: string, prefill: { listingId?: ID; subject?: VerificationSubject } = {}): string {
  return crmHref(locale, "/verification/request", { listingId: prefill.listingId, subject: prefill.subject });
}

/**
 * Where the checked object lives: a listing's profile; the viewer's own
 * facts and the organization's are on the profile page (More); a
 * colleague's facts are on their team card.
 */
export function targetHref(locale: string, target: VerificationQueueItem["target"], viewerId: ID): string {
  switch (target.kind) {
    case "listing":
      return appPath(locale, `/properties/${encodeURIComponent(target.view.listing.id)}`);
    case "agent":
      return target.agent.id === viewerId
        ? appPath(locale, "/more#more-facts")
        : appPath(locale, `/team/${encodeURIComponent(target.agent.id)}`);
    case "organization":
      return appPath(locale, "/more#more-facts");
  }
}

/**
 * A new check can be prepared from the queue for the viewer's own listing
 * when the current answer is a problem, missing (registry did not answer) or
 * out of date. Colleagues' and partners' facts are re-checked by their agent.
 */
export function canRequestAgain(entry: VerificationQueueItem): boolean {
  if (entry.target.kind !== "listing" || entry.scope !== "own") return false;
  return (["problem", "expired", "unavailable", "expiring"] as QueueBucket[]).includes(bucketOf(entry));
}

export type ExpiryInfo =
  | { kind: "none" }
  | { kind: "expired"; at: ISODateTime; daysAgo: number }
  | { kind: "expiring"; at: ISODateTime; daysLeft: number }
  | { kind: "valid"; at: ISODateTime };

/**
 * How the evidence's validity reads today, in Tashkent calendar days. The
 * expired / expiring decision is the repository's (`expired`, `expiresSoon`);
 * this only adds the day count for the text.
 */
export function expiryInfo(entry: Pick<VerificationQueueItem, "item" | "expired" | "expiresSoon">, at: Date): ExpiryInfo {
  const expiresAt = entry.item.expiresAt;
  if (!expiresAt) return { kind: "none" };
  const days = daysUntilEnd({ endsAt: expiresAt }, at);
  if (entry.expired) return { kind: "expired", at: expiresAt, daysAgo: Math.max(0, -days) };
  if (entry.expiresSoon) return { kind: "expiring", at: expiresAt, daysLeft: Math.max(0, days) };
  return { kind: "valid", at: expiresAt };
}
