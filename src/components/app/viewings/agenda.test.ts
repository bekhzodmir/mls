import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { listListings, listViewings } from "@/lib/data/repository";
import type { ViewingView } from "@/lib/data/views";
import {
  canRecordOutcome,
  filterViewings,
  findOverlaps,
  groupByDay,
  needingAttention,
  newViewingHref,
  parseViewingListParams,
  rangeBounds,
  slotsOverlap,
  viewingAttention,
  viewingListHref,
} from "./agenda";
import {
  checkNewViewing,
  checkSlot,
  isSchedulable,
  sortListingOptions,
  toExistingSlot,
  toListingOption,
  type ExistingSlot,
} from "./new-viewing";
import { addDaysToKey, dayDistance, dayStartIso, tashkentInstant, tashkentParts } from "./time";

// Demo "now": Wednesday 30 September 2026, 11:00 in Tashkent (06:00 UTC).
const NOW = now();

describe("Tashkent time helpers", () => {
  it("converts wall-clock inputs to UTC and back", () => {
    expect(tashkentInstant("2026-10-01", "10:30")).toBe("2026-10-01T05:30:00.000Z");
    expect(tashkentInstant("2026-10-01", "00:00")).toBe("2026-09-30T19:00:00.000Z");
    expect(tashkentParts("2026-09-30T19:00:00.000Z")).toEqual({ date: "2026-10-01", time: "00:00" });
    expect(tashkentParts(NOW)).toEqual({ date: "2026-09-30", time: "11:00" });
  });

  it("rejects empty, malformed and impossible input instead of guessing", () => {
    expect(tashkentInstant("", "10:00")).toBeUndefined();
    expect(tashkentInstant("2026-10-01", "")).toBeUndefined();
    expect(tashkentInstant("2026-02-30", "10:00")).toBeUndefined();
    expect(tashkentInstant("2026-10-01", "24:00")).toBeUndefined();
    expect(tashkentInstant("01.10.2026", "10:00")).toBeUndefined();
  });

  it("does calendar arithmetic on date keys", () => {
    expect(addDaysToKey("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayStartIso("2026-09-30")).toBe("2026-09-29T19:00:00.000Z");
    expect(() => addDaysToKey("30.09.2026", 1)).toThrow(RangeError);
  });

  it("counts day distance on Tashkent dates, not UTC dates", () => {
    // 23:30 Tashkent on the 30th is still the 30th although it is 18:30 UTC.
    expect(dayDistance(NOW, "2026-09-30T18:30:00.000Z")).toBe(0);
    expect(dayDistance(NOW, "2026-09-30T19:00:00.000Z")).toBe(1);
    expect(dayDistance(NOW, "2026-09-29T10:00:00.000Z")).toBe(-1);
  });
});

describe("list params", () => {
  it("parses known values and falls back to defaults", () => {
    expect(parseViewingListParams({})).toEqual({ range: "upcoming" });
    expect(parseViewingListParams({ range: "past", status: "completed" })).toEqual({ range: "past", status: "completed" });
    expect(parseViewingListParams({ range: ["week", "all"], status: "bogus" })).toEqual({ range: "week" });
    expect(parseViewingListParams({ range: "tomorrow" })).toEqual({ range: "upcoming" });
  });

  it("keeps defaults out of the URL", () => {
    expect(viewingListHref("ru")).toBe("/ru/app/viewings");
    expect(viewingListHref("uz", { range: "upcoming", status: "scheduled" })).toBe("/uz/app/viewings?status=scheduled");
    expect(viewingListHref("ru", { range: "past" })).toBe("/ru/app/viewings?range=past");
    expect(newViewingHref("ru", { clientId: "cl-02", listingId: "lst-01" })).toBe(
      "/ru/app/viewings/new?clientId=cl-02&listingId=lst-01",
    );
    expect(newViewingHref("uz")).toBe("/uz/app/viewings/new");
  });
});

describe("agenda over the demo data", () => {
  it("splits the calendar into upcoming and past without gaps", async () => {
    const all = await listViewings();
    const upcoming = filterViewings(all, { range: "upcoming" }, NOW);
    const past = filterViewings(all, { range: "past" }, NOW);
    expect(upcoming.length + past.length).toBe(all.length);
    expect(upcoming.map((view) => view.viewing.id)).toEqual(["vw-01", "vw-02", "vw-03", "vw-04", "vw-05", "vw-06"]);
    // Past reads newest first.
    expect(past[0].viewing.id).toBe("vw-07");
    expect(rangeBounds("today", NOW)).toEqual({
      fromIso: "2026-09-29T19:00:00.000Z",
      toIso: "2026-09-30T19:00:00.000Z",
    });
  });

  it("filters by range and status and groups by Tashkent day", async () => {
    const all = await listViewings();
    expect(filterViewings(all, { range: "today" }, NOW).map((view) => view.viewing.id)).toEqual(["vw-01", "vw-02"]);
    expect(filterViewings(all, { range: "all", status: "cancelled" }, NOW).map((view) => view.viewing.id)).toEqual([
      "vw-10",
    ]);
    const days = groupByDay(filterViewings(all, { range: "week" }, NOW), NOW);
    expect(days.map((day) => [day.key, day.relative, day.views.length])).toEqual([
      ["2026-09-30", "today", 2],
      ["2026-10-01", "tomorrow", 2],
      ["2026-10-02", undefined, 1],
      ["2026-10-03", undefined, 1],
    ]);
    const past = groupByDay(filterViewings(all, { range: "past" }, NOW), NOW);
    expect(past[0].key).toBe("2026-09-27");
    expect(past.every((day) => day.relative !== "today")).toBe(true);
  });

  it("reports the seeded schedule conflict on both viewings", async () => {
    const all = await listViewings();
    const byId = new Map(all.map((view) => [view.viewing.id, view]));
    const slots = all.map((view) => view.viewing);
    const vw03 = byId.get("vw-03")!.viewing;
    const vw04 = byId.get("vw-04")!.viewing;
    expect(findOverlaps(vw03, slots).map((slot) => slot.id)).toEqual(["vw-04"]);
    expect(findOverlaps(vw04, slots).map((slot) => slot.id)).toEqual(["vw-03"]);
    // The repository agrees.
    expect(byId.get("vw-03")!.conflictsWith).toEqual(["vw-04"]);
  });

  it("flags nothing in the tidy demo data but catches missing next steps and outcomes", async () => {
    const all = await listViewings();
    expect(needingAttention(all, NOW)).toEqual([]);
    const completed = all.find((view) => view.viewing.id === "vw-07")!;
    const withoutNext: ViewingView = { ...completed, viewing: { ...completed.viewing, nextAction: "  " } };
    expect(viewingAttention(withoutNext.viewing, NOW)).toBe("next_step_missing");
    const forgotten = { ...completed.viewing, status: "confirmed" as const, nextAction: undefined };
    expect(viewingAttention(forgotten, NOW)).toBe("outcome_missing");
    expect(needingAttention([...all, withoutNext], NOW)).toHaveLength(1);
  });

  it("offers the outcome form from the viewing day on", async () => {
    const all = await listViewings();
    const get = (id: string) => all.find((view) => view.viewing.id === id)!.viewing;
    expect(canRecordOutcome(get("vw-01"), NOW)).toBe(true); // today 14:00
    expect(canRecordOutcome(get("vw-03"), NOW)).toBe(false); // tomorrow
    expect(canRecordOutcome(get("vw-07"), NOW)).toBe(false); // already completed
  });
});

describe("overlap rules", () => {
  const base = { startsAt: "2026-10-01T05:00:00.000Z", durationMinutes: 60 };

  it("treats slots as half-open intervals", () => {
    expect(slotsOverlap(base, { startsAt: "2026-10-01T06:00:00.000Z", durationMinutes: 30 })).toBe(false);
    expect(slotsOverlap(base, { startsAt: "2026-10-01T05:59:00.000Z", durationMinutes: 30 })).toBe(true);
    expect(slotsOverlap(base, { startsAt: "2026-10-01T04:30:00.000Z", durationMinutes: 30 })).toBe(false);
  });

  it("ignores cancelled and missed viewings and the viewing itself", () => {
    const others = [
      { id: "a", ...base, status: "cancelled" as const },
      { id: "b", ...base, status: "no_show" as const },
      { id: "c", ...base, status: "scheduled" as const },
    ];
    expect(findOverlaps({ id: "c", ...base }, others)).toEqual([]);
    expect(findOverlaps({ id: "x", ...base }, others).map((slot) => slot.id)).toEqual(["c"]);
    expect(findOverlaps({ id: "x", ...base, status: "cancelled" }, others)).toEqual([]);
  });
});

describe("new viewing validation", () => {
  const slots: ExistingSlot[] = [
    toExistingSlot(
      { id: "vw-03", startsAt: "2026-10-01T05:00:00.000Z", durationMinutes: 60, status: "scheduled" },
      "Санжар Ибрагимов",
      "2-комн. квартира · Чиланзар",
    ),
  ];
  const context = { slots, clientIds: ["cl-01"], listingIds: ["lst-01"] };
  const valid = {
    clientId: "cl-01",
    listingId: "lst-01",
    date: "2026-10-01",
    time: "12:00",
    durationMinutes: 60,
    overlapAcknowledged: false,
  };

  it("accepts a free future slot", () => {
    expect(checkNewViewing(valid, NOW, context)).toEqual({
      errors: [],
      overlaps: [],
      startsAt: "2026-10-01T07:00:00.000Z",
    });
  });

  it("names every problem in form order", () => {
    const check = checkNewViewing({ ...valid, clientId: "", listingId: "lst-99", date: "", time: "" }, NOW, context);
    expect(check.errors).toEqual(["client", "listing", "date", "time"]);
    expect(checkNewViewing({ ...valid, date: "2026-09-30", time: "10:00" }, NOW, context).errors).toEqual(["past"]);
  });

  it("requires an explicit acknowledgement of an overlap", () => {
    const clash = { ...valid, time: "10:30" };
    const check = checkNewViewing(clash, NOW, context);
    expect(check.errors).toEqual(["overlap"]);
    expect(check.overlaps.map((slot) => slot.id)).toEqual(["vw-03"]);
    expect(checkNewViewing({ ...clash, overlapAcknowledged: true }, NOW, context).errors).toEqual([]);
  });

  it("does not report a rescheduled viewing against its own old time", () => {
    const check = checkSlot({ date: "2026-10-01", time: "10:15", durationMinutes: 60, selfId: "vw-03" }, NOW, slots);
    expect(check).toEqual({ startsAt: "2026-10-01T05:15:00.000Z", errors: [], overlaps: [] });
  });

  it("builds privacy-safe listing options, own listings first", async () => {
    const views = await listListings();
    const options = sortListingOptions(
      views.filter(isSchedulable).map((view) => toListingOption("ru", view)),
      "ru",
    );
    expect(options.length).toBeGreaterThan(0);
    const groups = options.map((option) => option.group);
    expect(groups.indexOf("owner")).toBe(0);
    expect(groups.lastIndexOf("owner")).toBeLessThan(groups.indexOf("partner"));
    // Expired and closed listings are not offered.
    expect(options.some((option) => option.id === "lst-07")).toBe(false);
    expect(options.some((option) => option.id === "lst-15")).toBe(false);
    for (const option of options) {
      const view = views.find((item) => item.listing.id === option.id)!;
      if (view.property.address) expect(option.label).not.toContain(view.property.address);
    }
  });
});
