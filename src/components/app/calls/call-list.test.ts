import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { listCalls } from "@/lib/data/repository";
import type { CallView } from "@/lib/data/views";
import type { Call } from "@/lib/domain/types";
import {
  callFilterKeys,
  callKind,
  callsHref,
  durationParts,
  groupCallsByDay,
  nextActionState,
  parseCallFilter,
  recordingExplanation,
  subjectHref,
  toRepositoryFilter,
  transcriptLines,
} from "./call-list";

const at = now(); // Wednesday 30 September 2026, 11:00 Tashkent

function call(overrides: Partial<Call> = {}): Call {
  return {
    id: "c-1",
    direction: "inbound",
    outcome: "answered",
    phone: "+998901112233",
    agentId: "agent-01",
    startedAt: "2026-09-30T04:00:00.000Z",
    durationSeconds: 60,
    recording: { consent: "not_requested", available: false },
    ...overrides,
  };
}

function view(overrides: Partial<Call> = {}, linked = true): CallView {
  const result: CallView = {
    call: call(overrides),
    agent: { id: "agent-01" } as CallView["agent"],
    phoneMatches: [],
    unknownNumber: !linked,
  };
  if (linked) result.linked = { kind: "client", id: "cl-01", name: "Санжар" };
  return result;
}

describe("call filters", () => {
  it("reads known `?filter=` values and ignores everything else", () => {
    expect(parseCallFilter({ filter: "missed" })).toBe("missed");
    expect(parseCallFilter({ filter: ["unknown", "missed"] })).toBe("unknown");
    expect(parseCallFilter({ filter: " outbound " })).toBe("outbound");
    expect(parseCallFilter({ filter: "bogus" })).toBeUndefined();
    expect(parseCallFilter({})).toBeUndefined();
  });

  it("builds list links with the filter only when one is chosen", () => {
    expect(callsHref("ru")).toBe("/ru/app/calls");
    expect(callsHref("uz", "missed")).toBe("/uz/app/calls?filter=missed");
  });

  it("maps every chip onto the repository filter with the expected calls", async () => {
    const all = await listCalls();
    const ids = async (key: (typeof callFilterKeys)[number]) =>
      (await listCalls(toRepositoryFilter(key))).map((item) => item.call.id).sort();
    expect(await ids("missed")).toEqual(["call-01", "call-10"]);
    expect(await ids("unknown")).toEqual(["call-02", "call-03", "call-10"]);
    expect(await ids("inbound")).toEqual(
      all.filter((item) => item.call.direction === "inbound").map((item) => item.call.id).sort(),
    );
    expect(await ids("outbound")).toEqual(
      all.filter((item) => item.call.direction === "outbound").map((item) => item.call.id).sort(),
    );
    expect(toRepositoryFilter(undefined)).toEqual({});
  });

  it("links people to their profiles, owners included", () => {
    expect(subjectHref("ru", { kind: "lead", id: "lead-02" })).toBe("/ru/app/leads/lead-02");
    expect(subjectHref("ru", { kind: "client", id: "cl-01" })).toBe("/ru/app/clients/cl-01");
    expect(subjectHref("uz", { kind: "owner", id: "owner-06" })).toBe("/uz/app/owners/owner-06");
  });
});

describe("call kind and duration", () => {
  it("names answered calls by direction and the rest by outcome", () => {
    expect(callKind({ direction: "inbound", outcome: "answered" })).toBe("inbound");
    expect(callKind({ direction: "outbound", outcome: "answered" })).toBe("outbound");
    expect(callKind({ direction: "inbound", outcome: "missed" })).toBe("missed");
    expect(callKind({ direction: "outbound", outcome: "no_answer" })).toBe("no_answer");
    expect(callKind({ direction: "outbound", outcome: "busy" })).toBe("busy");
  });

  it("splits seconds into minutes and the rest", () => {
    expect(durationParts(214)).toEqual({ minutes: 3, seconds: 34 });
    expect(durationParts(59)).toEqual({ minutes: 0, seconds: 59 });
    expect(durationParts(0)).toEqual({ minutes: 0, seconds: 0 });
    expect(durationParts(-5)).toEqual({ minutes: 0, seconds: 0 });
  });
});

describe("grouping by Tashkent day", () => {
  it("puts newest days first and today's missed calls on top of today", async () => {
    const days = groupCallsByDay(await listCalls(), at);
    expect(days.map((day) => day.relative)).toEqual(["today", "yesterday", undefined]);
    const today = days[0].views.map((item) => item.call.id);
    // Missed first (newest first among them), then the rest newest first.
    expect(today.slice(0, 2)).toEqual(["call-10", "call-01"]);
    expect(today.slice(2)).toEqual(["call-12", "call-02", "call-09", "call-06", "call-03", "call-11", "call-04"]);
    expect(days[1].views.map((item) => item.call.id)).toEqual(["call-05", "call-07", "call-08", "call-13"]);
  });

  it("splits days at Tashkent midnight, not UTC", () => {
    // 23:30 and 00:30 Tashkent on consecutive dates are both 18:30/19:30 UTC of one UTC day.
    const late = view({ id: "late", startedAt: "2026-09-28T18:30:00.000Z" });
    const early = view({ id: "early", startedAt: "2026-09-28T19:30:00.000Z" });
    const days = groupCallsByDay([late, early], at);
    expect(days.map((day) => day.key)).toEqual(["2026-09-29", "2026-09-28"]);
    expect(days[0].relative).toBe("yesterday");
  });

  it("returns no groups for no calls", () => {
    expect(groupCallsByDay([], at)).toEqual([]);
  });
});

describe("next action state", () => {
  it("flags overdue, today and planned next actions", () => {
    expect(nextActionState(view({ nextAction: { text: "Позвонить", dueAt: "2026-09-30T05:30:00.000Z" } }), at)).toBe(
      "overdue",
    );
    expect(nextActionState(view({ nextAction: { text: "Позвонить", dueAt: "2026-09-30T13:00:00.000Z" } }), at)).toBe(
      "today",
    );
    expect(nextActionState(view({ nextAction: { text: "Позвонить", dueAt: "2026-10-01T07:00:00.000Z" } }), at)).toBe(
      "planned",
    );
    expect(nextActionState(view({ nextAction: { text: "Позвонить" } }), at)).toBe("planned");
  });

  it("requires a next action after a call without a conversation or from an unattached number", () => {
    expect(nextActionState(view({ outcome: "missed", durationSeconds: 0 }), at)).toBe("missing");
    expect(nextActionState(view({}, false), at)).toBe("missing");
    expect(nextActionState(view({ nextAction: { text: "   " } }), at)).toBe("none");
    expect(nextActionState(view(), at)).toBe("none");
  });
});

describe("recording explanation", () => {
  it("explains a missing transcript by consent, and calls without a conversation first", () => {
    const granted = { consent: "granted", available: true } as const;
    expect(recordingExplanation({ outcome: "answered", recording: granted })).toBe("granted");
    expect(recordingExplanation({ outcome: "answered", recording: { ...granted, available: false } })).toBe(
      "grantedUnavailable",
    );
    expect(recordingExplanation({ outcome: "answered", recording: { consent: "refused", available: false } })).toBe(
      "refusedClient",
    );
    expect(
      recordingExplanation({ outcome: "answered", recording: { consent: "refused", available: false } }, "owner"),
    ).toBe("refusedOwner");
    expect(
      recordingExplanation({ outcome: "answered", recording: { consent: "not_requested", available: false } }),
    ).toBe("notRequested");
    expect(recordingExplanation({ outcome: "missed", recording: { consent: "not_requested", available: false } })).toBe(
      "noConversation",
    );
  });
});

describe("transcript lines", () => {
  it("splits speakers from their words and keeps lines without a speaker", () => {
    expect(transcriptLines("Агент: Здравствуйте.\n\nMijoz: Ha, mayli.\n(пауза)")).toEqual([
      { speaker: "Агент", text: "Здравствуйте." },
      { speaker: "Mijoz", text: "Ha, mayli." },
      { text: "(пауза)" },
    ]);
  });

  it("does not take a time or a long phrase for a speaker", () => {
    expect(transcriptLines("Перезвоните после шести вечера, днём я на работе: 18:00")).toEqual([
      { text: "Перезвоните после шести вечера, днём я на работе: 18:00" },
    ]);
    expect(transcriptLines("Встреча в 10:")).toEqual([{ text: "Встреча в 10:" }]);
  });
});
