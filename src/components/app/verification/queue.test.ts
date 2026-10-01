import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { listVerificationQueue } from "@/lib/data/repository";
import type { VerificationQueueItem } from "@/lib/data/views";
import {
  attentionCount,
  bucketOf,
  canRequestAgain,
  countBuckets,
  expiryInfo,
  matchesQueueFilter,
  parseQueueFilter,
  QUEUE_BUCKETS,
  queueHref,
  requestHref,
  targetHref,
} from "./queue";

const at = now();

function entry(overrides: Partial<VerificationQueueItem> & { item?: Partial<VerificationQueueItem["item"]> }) {
  const base = {
    key: "listing:lst-x:ver-x",
    item: { id: "ver-x", subject: "ownership", status: "confirmed", method: "official_source" },
    detailed: true,
    target: { kind: "organization", organization: { id: "org-x", name: "Demo" } },
    scope: "own",
    expiresSoon: false,
    expired: false,
  } as VerificationQueueItem;
  return { ...base, ...overrides, item: { ...base.item, ...overrides.item } } as VerificationQueueItem;
}

describe("bucketOf", () => {
  it("puts every fact into exactly one bucket, expiry before the stored status", () => {
    expect(bucketOf(entry({ item: { status: "problem" } }))).toBe("problem");
    expect(bucketOf(entry({ item: { status: "unavailable" } }))).toBe("unavailable");
    expect(bucketOf(entry({ item: { status: "pending" } }))).toBe("pending");
    expect(bucketOf(entry({}))).toBe("confirmed");
    expect(bucketOf(entry({ expired: true }))).toBe("expired");
    expect(bucketOf(entry({ expiresSoon: true }))).toBe("expiring");
  });
});

describe("the seeded queue", () => {
  it("adds up: the summary partitions the whole queue", async () => {
    const queue = await listVerificationQueue();
    const counts = countBuckets(queue);
    expect(QUEUE_BUCKETS.reduce((sum, bucket) => sum + counts[bucket], 0)).toBe(queue.length);
    expect(counts.unavailable).toBeGreaterThan(0);
    expect(counts.expiring).toBeGreaterThan(0);
    expect(attentionCount(counts)).toBe(counts.problem + counts.expired + counts.unavailable + counts.expiring);
  });

  it("never counts a registry that did not answer as confirmed", async () => {
    const queue = await listVerificationQueue();
    for (const item of queue.filter((entry) => entry.item.status === "unavailable")) {
      expect(bucketOf(item)).toBe("unavailable");
      expect(matchesQueueFilter(item, { status: "confirmed" })).toBe(false);
    }
  });

  it("keeps result-only facts without source, note and performer (§19)", async () => {
    const queue = await listVerificationQueue();
    const resultOnly = queue.filter((entry) => !entry.detailed);
    expect(resultOnly.length).toBeGreaterThan(0);
    for (const item of resultOnly) {
      expect(item.item.source).toBeUndefined();
      expect(item.item.note).toBeUndefined();
      expect(item.item.performedById).toBeUndefined();
    }
  });

  it("offers a new check only on the viewer's own listing that needs one", async () => {
    const queue = await listVerificationQueue();
    const encumbrance = queue.find((item) => item.key === "listing:lst-03:ver-lst-03-encumbrance");
    expect(encumbrance && canRequestAgain(encumbrance)).toBe(true);
    for (const item of queue.filter(canRequestAgain)) {
      expect(item.target.kind).toBe("listing");
      expect(item.scope).toBe("own");
      expect(["problem", "expired", "unavailable", "expiring"]).toContain(bucketOf(item));
    }
  });
});

describe("filters", () => {
  it("reads known values from the URL and ignores the rest", () => {
    expect(parseQueueFilter({ status: "expiring", subject: "ownership", target: "listing" })).toEqual({
      status: "expiring",
      subject: "ownership",
      target: "listing",
    });
    expect(parseQueueFilter({ status: "verified", subject: ["cadastre", "x"], target: "partner" })).toEqual({
      subject: "cadastre",
    });
  });

  it("ignores one dimension for chip counts", () => {
    const item = entry({ item: { status: "pending", subject: "cadastre" } });
    expect(matchesQueueFilter(item, { status: "confirmed", subject: "cadastre" })).toBe(false);
    expect(matchesQueueFilter(item, { status: "confirmed", subject: "cadastre" }, "status")).toBe(true);
    expect(matchesQueueFilter(item, { target: "listing" })).toBe(false);
  });

  it("builds stable URLs", () => {
    expect(queueHref("ru", { target: "agent", status: "pending" })).toBe("/ru/app/verification?status=pending&target=agent");
    expect(queueHref("uz")).toBe("/uz/app/verification");
    expect(requestHref("ru", { listingId: "lst-03", subject: "encumbrance" })).toBe(
      "/ru/app/verification/request?listingId=lst-03&subject=encumbrance",
    );
  });
});

describe("targetHref", () => {
  it("links a listing to its profile, the viewer's and the organization's facts to the profile page", () => {
    const agent = { id: "agent-01" } as never;
    expect(targetHref("ru", { kind: "agent", agent }, "agent-01")).toBe("/ru/app/more#more-facts");
    expect(targetHref("ru", { kind: "agent", agent: { id: "agent-03" } as never }, "agent-01")).toBe("/ru/app/team/agent-03");
    expect(targetHref("uz", { kind: "organization", organization: { id: "org-01", name: "Demo" } }, "agent-01")).toBe(
      "/uz/app/more#more-facts",
    );
  });
});

describe("expiryInfo", () => {
  it("counts Tashkent calendar days around the repository's decision", () => {
    expect(expiryInfo(entry({}), at)).toEqual({ kind: "none" });
    expect(expiryInfo(entry({ expiresSoon: true, item: { expiresAt: "2026-10-10T18:59:00.000Z" } }), at)).toEqual({
      kind: "expiring",
      at: "2026-10-10T18:59:00.000Z",
      daysLeft: 10,
    });
    expect(expiryInfo(entry({ expired: true, item: { expiresAt: "2026-09-27T10:00:00.000Z" } }), at)).toEqual({
      kind: "expired",
      at: "2026-09-27T10:00:00.000Z",
      daysAgo: 3,
    });
    expect(expiryInfo(entry({ item: { expiresAt: "2027-09-09T07:00:00.000Z" } }), at).kind).toBe("valid");
  });
});
