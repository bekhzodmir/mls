import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { getCall, listCalls, listCommunications } from "@/lib/data/repository";
import {
  STALE_AFTER_DAYS,
  callsOf,
  channelCounts,
  mergeTimeline,
  parseTimelineParams,
  staleSince,
  timelineHref,
  type TimelineEntry,
} from "./timeline";

const at = now();

describe("timeline params", () => {
  it("takes one person, client first, and a known channel", () => {
    expect(parseTimelineParams({ clientId: "cl-01" })).toEqual({ subject: { kind: "client", id: "cl-01" } });
    expect(parseTimelineParams({ leadId: "lead-05", ownerId: "owner-06" })).toEqual({
      subject: { kind: "owner", id: "owner-06" },
    });
    expect(parseTimelineParams({ leadId: ["lead-05", "lead-02"], channel: "phone" })).toEqual({
      subject: { kind: "lead", id: "lead-05" },
      channel: "phone",
    });
    expect(parseTimelineParams({ clientId: "  ", channel: "fax" })).toEqual({});
  });

  it("builds links with the subject key and an optional channel", () => {
    expect(timelineHref("ru", { kind: "client", id: "cl-01" })).toBe("/ru/app/calls/timeline?clientId=cl-01");
    expect(timelineHref("uz", { kind: "owner", id: "owner-08" }, "whatsapp")).toBe(
      "/uz/app/calls/timeline?ownerId=owner-08&channel=whatsapp",
    );
  });
});

describe("merging calls and timeline entries", () => {
  it("shows a call once, through its timeline entry, newest first", async () => {
    const communications = await listCommunications({ clientId: "cl-01" });
    const calls = callsOf(await listCalls(), { kind: "client", id: "cl-01" });
    expect(calls.map((view) => view.call.id)).toEqual(["call-05"]);
    const entries = mergeTimeline(communications, calls);
    expect(entries.map((entry) => entry.key)).toEqual(["comm-03", "comm-02", "comm-01"]);
    expect(entries[0].call?.id).toBe("call-05");
    expect(entries[2].originalUrl).toBe("https://t.me/sanjar_demo");
  });

  it("adds calls that have no entry, with the note or a confirmed summary — never a draft", async () => {
    const draft = await getCall("call-02");
    const confirmed = await getCall("call-05");
    const noted = await getCall("call-03");
    const entries = mergeTimeline([], [draft!, confirmed!, noted!]);
    expect(entries.map((entry) => entry.key)).toEqual(["call-02", "call-03", "call-05"]);
    const byKey = Object.fromEntries(entries.map((entry) => [entry.key, entry]));
    expect(byKey["call-02"].summary).toBeUndefined();
    expect(byKey["call-02"].nextStep).toBe("Создать лид и отправить подборку после 18:00");
    expect(byKey["call-05"].summary).toBe(confirmed!.call.summary!.text);
    expect(byKey["call-03"].summary).toBe(noted!.call.note);
    expect(entries.every((entry) => entry.channel === "phone")).toBe(true);
  });

  it("filters by channel, counting calls as phone", async () => {
    const communications = await listCommunications({ ownerId: "owner-08" });
    const calls = callsOf(await listCalls(), { kind: "owner", id: "owner-08" });
    const all = mergeTimeline(communications, calls);
    expect(channelCounts(all)).toEqual({ phone: 1, whatsapp: 1 });
    expect(mergeTimeline(communications, calls, "whatsapp").map((entry) => entry.key)).toEqual(["comm-26"]);
    expect(mergeTimeline(communications, calls, "telegram")).toEqual([]);
  });

  it("keeps a colleague's touchpoints out", async () => {
    expect(await listCommunications({ ownerId: "owner-12" })).toEqual([]);
    expect(callsOf(await listCalls(), { kind: "owner", id: "owner-12" })).toEqual([]);
  });
});

describe("stale timeline", () => {
  const entry = (at: string): TimelineEntry => ({
    key: at,
    channel: "phone",
    direction: "outbound",
    at,
    agent: { id: "agent-01" } as TimelineEntry["agent"],
  });

  it("reports the latest touchpoint only when it is older than the threshold", () => {
    const old = new Date(at.getTime() - (STALE_AFTER_DAYS + 1) * 86_400_000).toISOString();
    const recent = new Date(at.getTime() - 86_400_000).toISOString();
    expect(staleSince([entry(old)], at)).toBe(old);
    expect(staleSince([entry(old), entry(recent)], at)).toBeUndefined();
    expect(staleSince([], at)).toBeUndefined();
  });

  it("flags an owner nobody has talked to for weeks", async () => {
    const entries = mergeTimeline(await listCommunications({ ownerId: "owner-01" }), []);
    expect(staleSince(entries, at)).toBe(entries[0].at);
  });
});
