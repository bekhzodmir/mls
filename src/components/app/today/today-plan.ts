import { nextActionState } from "@/components/app/calls/call-list";
import { DISPLAY_TIME_ZONE } from "@/i18n/config";
import { tashkentDateKey } from "@/lib/domain/working-days";
import type {
  CallView,
  CooperationView,
  DealView,
  ExpiringContractView,
  LeadView,
  ListingView,
  MatchView,
  PriceDropView,
  TaskView,
  TodayFeed,
  ViewingView,
} from "@/lib/data/views";

/**
 * Orders the Today workspace (§9.4, §22.1, §36.2): what is already late comes
 * first, then what must happen today, then what is coming, then
 * opportunities. Inside one urgency level the order of §9.4 is kept, so the
 * screen stays predictable from day to day. Pure: no React, no clock access.
 */

export type TodayBlockKey =
  | "leads"
  | "calls"
  | "overdueTasks"
  | "viewings"
  | "todayTasks"
  | "contracts"
  | "matches"
  | "cooperation"
  | "stale"
  | "priceDrops"
  | "deals";

/** Most urgent first. */
export const todayUrgencies = ["overdue", "today", "soon", "later"] as const;
export type TodayUrgency = (typeof todayUrgencies)[number];

/**
 * §9.4 priority: clients waiting for an answer (new leads, then missed
 * calls), viewings today, expiring contracts, new matches, cooperation
 * requests, stale objects, price drops, deals and missing documents. Tasks
 * (§36.2) sit next to the SLA queue.
 */
export const TODAY_BLOCK_ORDER: readonly TodayBlockKey[] = [
  "leads",
  "calls",
  "overdueTasks",
  "viewings",
  "todayTasks",
  "contracts",
  "matches",
  "cooperation",
  "stale",
  "priceDrops",
  "deals",
];

/** A contract ending within this many days is a today-level problem. */
export const CONTRACT_TODAY_DAYS = 1;

export type TodayBlock =
  | { key: "leads"; urgency: TodayUrgency; items: LeadView[] }
  | { key: "calls"; urgency: TodayUrgency; items: CallView[] }
  | { key: "overdueTasks"; urgency: TodayUrgency; items: TaskView[] }
  | { key: "viewings"; urgency: TodayUrgency; items: ViewingView[] }
  | { key: "todayTasks"; urgency: TodayUrgency; items: TaskView[] }
  | { key: "contracts"; urgency: TodayUrgency; items: ExpiringContractView[] }
  | { key: "matches"; urgency: TodayUrgency; items: MatchView[] }
  | { key: "cooperation"; urgency: TodayUrgency; items: CooperationView[] }
  | { key: "stale"; urgency: TodayUrgency; items: ListingView[] }
  | { key: "priceDrops"; urgency: TodayUrgency; items: PriceDropView[] }
  | { key: "deals"; urgency: TodayUrgency; items: DealView[] };

function leadsUrgency(items: LeadView[]): TodayUrgency {
  return items.some((view) => view.sla.state === "breached") ? "overdue" : "today";
}

/** A missed call is someone waiting today; a call-back promised for earlier is already late. */
function callsUrgency(items: CallView[], now: Date): TodayUrgency {
  return items.some((view) => nextActionState(view, now) === "overdue") ? "overdue" : "today";
}

function cooperationUrgency(items: CooperationView[], now: Date): TodayUrgency {
  if (items.some((view) => view.overdue)) return "overdue";
  const today = tashkentDateKey(now);
  return items.some((view) => tashkentDateKey(view.request.respondBy) === today) ? "today" : "soon";
}

function dealsUrgency(items: DealView[]): TodayUrgency {
  if (items.some((view) => view.nextActionOverdue || view.mlsReport.state === "overdue")) return "overdue";
  // The MLS report is a legal deadline (§17.5): the last working day counts as today.
  const reportDue = items.some((view) => view.mlsReport.state === "due" && view.mlsReport.workingDaysLeft <= 1);
  return reportDue ? "today" : "soon";
}

/** Late work, then the legal MLS deadline, then missing documents; the repository order breaks ties. */
function dealSeverity(view: DealView): number {
  if (view.nextActionOverdue || view.mlsReport.state === "overdue") return 0;
  if (view.mlsReport.state === "due") return 1;
  return 2;
}

function contractsUrgency(items: ExpiringContractView[]): TodayUrgency {
  return items.some((item) => item.daysLeft <= CONTRACT_TODAY_DAYS) ? "today" : "soon";
}

/** Non-empty blocks, most urgent first; §9.4 order breaks ties. */
export function planTodayBlocks(feed: TodayFeed, now: Date): TodayBlock[] {
  const candidates: TodayBlock[] = [
    { key: "leads", urgency: leadsUrgency(feed.slaLeads), items: feed.slaLeads },
    { key: "calls", urgency: callsUrgency(feed.missedCalls, now), items: feed.missedCalls },
    { key: "overdueTasks", urgency: "overdue", items: feed.overdueTasks },
    { key: "viewings", urgency: "today", items: feed.todayViewings },
    { key: "todayTasks", urgency: "today", items: feed.todayTasks },
    { key: "contracts", urgency: contractsUrgency(feed.expiringContracts), items: feed.expiringContracts },
    { key: "matches", urgency: "later", items: feed.newMatches },
    { key: "cooperation", urgency: cooperationUrgency(feed.incomingCooperation, now), items: feed.incomingCooperation },
    { key: "stale", urgency: "soon", items: feed.staleListings },
    { key: "priceDrops", urgency: "later", items: feed.priceDrops },
    {
      key: "deals",
      urgency: dealsUrgency(feed.dealsNeedingAttention),
      // Array.prototype.sort is stable, so equal severities keep the repository order.
      items: [...feed.dealsNeedingAttention].sort((a, b) => dealSeverity(a) - dealSeverity(b)),
    },
  ];
  const rank = (block: TodayBlock) =>
    todayUrgencies.indexOf(block.urgency) * TODAY_BLOCK_ORDER.length + TODAY_BLOCK_ORDER.indexOf(block.key);
  return candidates.filter((block) => block.items.length > 0).sort((a, b) => rank(a) - rank(b));
}

/**
 * The one thing to open first (§22.1 primary action): the first item of the
 * most urgent block. For viewings that is the next one not yet started.
 */
export function nextStep(blocks: readonly TodayBlock[], now: Date): TodayBlock | undefined {
  const top = blocks[0];
  if (!top) return undefined;
  if (top.key === "viewings") {
    const upcoming = top.items.find((view) => new Date(view.viewing.startsAt).getTime() >= now.getTime());
    return { ...top, items: [upcoming ?? top.items[0]] };
  }
  return { ...top, items: top.items.slice(0, 1) } as TodayBlock;
}

export type DayPeriod = "morning" | "afternoon" | "evening" | "night";

/** Greeting period by the Tashkent wall clock, whatever the server time zone. */
export function dayPeriod(now: Date): DayPeriod {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: DISPLAY_TIME_ZONE }).format(now),
  );
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night";
}
