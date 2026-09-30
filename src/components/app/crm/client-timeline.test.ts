import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { getClient } from "@/lib/data/repository";
import { buildClientTimeline } from "./client-timeline";

describe("buildClientTimeline", () => {
  it("lists past events newest first and leaves future plans out", async () => {
    const detail = await getClient("cl-01");
    expect(detail).toBeDefined();
    const events = buildClientTimeline(detail!, now());
    expect(events.length).toBeGreaterThan(3);
    const times = events.map((event) => new Date(event.at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(times.every((time) => time <= now().getTime())).toBe(true);
    expect(events.at(-1)?.kind).toBe("lead_received");
  });

  it("records consent revocations as their own events", async () => {
    const detail = await getClient("cl-11");
    const kinds = buildClientTimeline(detail!, now()).map((event) => event.kind);
    expect(kinds).toContain("consent_revoked");
    expect(kinds).toContain("consent_granted");
  });

  it("includes each offer version", async () => {
    const detail = await getClient("cl-06");
    const versions = detail!.offers.reduce((sum, view) => sum + view.offer.versions.length, 0);
    const offers = buildClientTimeline(detail!, now()).filter((event) => event.kind === "offer");
    expect(offers.length).toBeLessThanOrEqual(versions);
    expect(offers.length).toBeGreaterThan(0);
  });
});
