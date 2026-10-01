import { describe, expect, it } from "vitest";
import { now } from "@/lib/clock";
import { getTodayFeed } from "@/lib/data/repository";
import type { TodayFeed } from "@/lib/data/views";
import { dayPeriod, nextStep, planTodayBlocks, TODAY_BLOCK_ORDER, todayUrgencies } from "./today-plan";

async function feed(): Promise<TodayFeed> {
  return getTodayFeed();
}

function emptyFeed(base: TodayFeed): TodayFeed {
  return {
    ...base,
    overdueTasks: [],
    todayTasks: [],
    todayViewings: [],
    slaLeads: [],
    newMatches: [],
    incomingCooperation: [],
    expiringContracts: [],
    staleListings: [],
    priceDrops: [],
    dealsNeedingAttention: [],
    missedCalls: [],
  };
}

describe("planTodayBlocks", () => {
  it("drops empty blocks and returns an empty plan for a quiet day", async () => {
    expect(planTodayBlocks(emptyFeed(await feed()), now())).toEqual([]);
  });

  it("puts late work first, then today, then soon, then opportunities", async () => {
    const plan = planTodayBlocks(await feed(), now());
    const ranks = plan.map((block) => todayUrgencies.indexOf(block.urgency));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    // Demo day: breached SLA, overdue tasks and a deal with an overdue next step.
    expect(plan.slice(0, 3).map((block) => [block.key, block.urgency])).toEqual([
      ["leads", "overdue"],
      ["overdueTasks", "overdue"],
      ["deals", "overdue"],
    ]);
    expect(plan.at(-1)?.urgency).toBe("later");
  });

  it("keeps the §9.4 order inside one urgency level", async () => {
    const plan = planTodayBlocks(await feed(), now());
    for (const urgency of todayUrgencies) {
      const keys = plan.filter((block) => block.urgency === urgency).map((block) => block.key);
      const order = keys.map((key) => TODAY_BLOCK_ORDER.indexOf(key));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
  });

  it("treats leads that are only due soon as today, not overdue", async () => {
    const base = await feed();
    const dueSoon = base.slaLeads.filter((view) => view.sla.state === "due_soon");
    expect(dueSoon.length).toBeGreaterThan(0);
    const plan = planTodayBlocks({ ...emptyFeed(base), slaLeads: dueSoon }, now());
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ key: "leads", urgency: "today" });
  });

  it("raises a cooperation request answered today to today, and an overdue one to overdue", async () => {
    const base = await feed();
    const incoming = base.incomingCooperation;
    expect(planTodayBlocks({ ...emptyFeed(base), incomingCooperation: incoming }, now())[0].urgency).toBe("today");
    const late = incoming.map((view, index) => (index === 0 ? { ...view, overdue: true } : view));
    expect(planTodayBlocks({ ...emptyFeed(base), incomingCooperation: late }, now())[0].urgency).toBe("overdue");
  });

  it("treats the last working day of the MLS report window as today", async () => {
    const base = await feed();
    const report = base.dealsNeedingAttention.filter((view) => view.mlsReport.state === "due");
    expect(report.length).toBeGreaterThan(0);
    expect(planTodayBlocks({ ...emptyFeed(base), dealsNeedingAttention: report }, now())[0].urgency).toBe("today");
  });

  it("lists deals with an overdue step first, then the MLS report deadline", async () => {
    const base = await feed();
    const deals = planTodayBlocks(base, now()).find((block) => block.key === "deals");
    expect(deals?.key).toBe("deals");
    const ids = deals?.key === "deals" ? deals.items.map((view) => view.deal.id) : [];
    expect(ids.slice(0, 2)).toEqual(["deal-04", "deal-06"]);
    expect(ids).toHaveLength(base.dealsNeedingAttention.length);
  });
});

describe("missed calls block", () => {
  it("lists the viewer's missed calls right after the leads waiting for an answer", async () => {
    const base = await feed();
    expect(base.missedCalls.map((view) => view.call.id)).toEqual(["call-10", "call-01"]);
    expect(base.missedCalls.every((view) => view.call.outcome === "missed")).toBe(true);
    expect(TODAY_BLOCK_ORDER.indexOf("calls")).toBe(TODAY_BLOCK_ORDER.indexOf("leads") + 1);
    const plan = planTodayBlocks({ ...emptyFeed(base), missedCalls: base.missedCalls }, now());
    expect(plan).toEqual([{ key: "calls", urgency: "today", items: base.missedCalls }]);
  });

  it("is overdue once a promised call-back time has passed", async () => {
    const base = await feed();
    const late = base.missedCalls.map((view) =>
      view.call.nextAction
        ? { ...view, call: { ...view.call, nextAction: { ...view.call.nextAction, dueAt: "2026-09-30T05:00:00.000Z" } } }
        : view,
    );
    expect(planTodayBlocks({ ...emptyFeed(base), missedCalls: late }, now())[0]).toMatchObject({
      key: "calls",
      urgency: "overdue",
    });
  });
});

describe("nextStep", () => {
  it("is the first item of the most urgent block", async () => {
    const base = await feed();
    const plan = planTodayBlocks(base, now());
    const step = nextStep(plan, now());
    expect(step?.key).toBe(plan[0].key);
    expect(step?.items).toEqual([plan[0].items[0]]);
  });

  it("picks the next viewing that has not started yet", async () => {
    const base = await feed();
    const viewings = [...base.todayViewings].sort((a, b) => a.viewing.startsAt.localeCompare(b.viewing.startsAt));
    const plan = planTodayBlocks({ ...emptyFeed(base), todayViewings: viewings }, now());
    const step = nextStep(plan, now());
    expect(step?.key).toBe("viewings");
    const first = step?.key === "viewings" ? step.items[0] : undefined;
    expect(new Date(first?.viewing.startsAt ?? 0).getTime()).toBeGreaterThanOrEqual(now().getTime());
  });

  it("is undefined when nothing needs attention", async () => {
    expect(nextStep(planTodayBlocks(emptyFeed(await feed()), now()), now())).toBeUndefined();
  });
});

describe("dayPeriod", () => {
  it("uses the Tashkent wall clock", () => {
    expect(dayPeriod(new Date("2026-09-30T06:00:00.000Z"))).toBe("morning"); // 11:00
    expect(dayPeriod(new Date("2026-09-30T07:00:00.000Z"))).toBe("afternoon"); // 12:00
    expect(dayPeriod(new Date("2026-09-30T13:00:00.000Z"))).toBe("evening"); // 18:00
    expect(dayPeriod(new Date("2026-09-30T18:00:00.000Z"))).toBe("night"); // 23:00
    expect(dayPeriod(new Date("2026-09-29T23:59:00.000Z"))).toBe("night"); // 04:59
    expect(dayPeriod(new Date("2026-09-30T00:00:00.000Z"))).toBe("morning"); // 05:00
  });
});
