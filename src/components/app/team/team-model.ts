import type { LeadView, TeamMemberMetrics, TeamMemberView } from "@/lib/data/views";
import type { AgentAvailability, ID, ISODateTime } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";
import { withDemoRole, type DemoRole } from "./demo-role";

/**
 * Pure helpers for the team screens (§36.5, §33.2 "панель исключений и
 * действий"): availability as the routing sees it, capacity left today and
 * the exceptions a lead acts on — instead of report charts.
 */

/* ---------------------------------------------------------------- links */

export function teamHref(locale: string, demoRole?: DemoRole): string {
  return withDemoRole(appPath(locale, "/team"), demoRole);
}

export function memberHref(locale: string, agentId: ID, demoRole?: DemoRole): string {
  return withDemoRole(appPath(locale, `/team/${encodeURIComponent(agentId)}`), demoRole);
}

export function routingHref(locale: string, demoRole?: DemoRole, hash?: string): string {
  return withDemoRole(`${appPath(locale, "/team/routing")}${hash ? `#${hash}` : ""}`, demoRole);
}

/* --------------------------------------------------------- availability */

/**
 * - `away` — away with a return date still ahead, or none / an unreadable one
 *   (the routing keeps such an agent away too);
 * - `away_ended` — the return date has passed but nobody updated the status:
 *   routing already counts the agent as available, the screen flags the stale
 *   status instead of hiding it (§36.6 Stale).
 */
export type AvailabilityState =
  | { kind: "available" }
  | { kind: "busy" }
  | { kind: "away"; until?: ISODateTime }
  | { kind: "away_ended"; until: ISODateTime };

export function availabilityState(
  availability: Pick<AgentAvailability, "status" | "awayUntil">,
  now: Date,
): AvailabilityState {
  if (availability.status !== "away") return { kind: availability.status };
  const until = availability.awayUntil;
  if (!until) return { kind: "away" };
  const at = Date.parse(until);
  if (Number.isNaN(at)) return { kind: "away" };
  return at > now.getTime() ? { kind: "away", until } : { kind: "away_ended", until };
}

/* ------------------------------------------------------------- capacity */

export interface CapacityState {
  used: number;
  capacity: number;
  left: number;
  /** `over`: today's limit is reached, routing skips the member; `near`: one lead left. */
  level: "over" | "near" | "ok";
}

export function capacityState(member: Pick<TeamMemberView, "availability" | "metrics">): CapacityState {
  const capacity = member.availability.dailyLeadCapacity;
  const used = member.metrics.newLeadsToday;
  const left = Math.max(0, capacity - used);
  const level = used >= capacity ? "over" : left === 1 && capacity > 1 ? "near" : "ok";
  return { used, capacity, left, level };
}

/* -------------------------------------------------------------- metrics */

/** Display order of the member metrics (§36.5, §25.2). */
export const METRIC_KEYS = [
  "newLeadsToday",
  "openLeads",
  "slaBreaches",
  "activeClients",
  "activeListings",
  "viewingsThisWeek",
  "dealsInProgress",
] as const satisfies readonly (keyof TeamMemberMetrics)[];

/* ----------------------------------------------------------- exceptions */

export type TeamException =
  | { kind: "sla_breach"; agentId: ID; count: number; away: boolean }
  | { kind: "unassigned"; count: number; breached: number; nextDueAt?: ISODateTime }
  | { kind: "over_capacity"; agentId: ID; used: number; capacity: number }
  | { kind: "away"; agentId: ID; until?: ISODateTime; openLeads?: number }
  | { kind: "away_ended"; agentId: ID; until: ISODateTime }
  | { kind: "near_capacity"; agentId: ID; used: number; capacity: number };

const EXCEPTION_ORDER: Record<TeamException["kind"], number> = {
  sla_breach: 0,
  unassigned: 1,
  over_capacity: 2,
  away: 3,
  away_ended: 4,
  near_capacity: 5,
};

/**
 * What needs a decision now, most urgent first: missed first responses,
 * leads nobody owns, members at their daily limit, absences the routing works
 * around. Metric-based items appear only for members whose reports the actor
 * may see (`canSeeMetrics`); availability is shown for everyone.
 */
export function teamExceptions(input: {
  members: readonly TeamMemberView[];
  unassigned: readonly LeadView[];
  now: Date;
  canSeeMetrics: (member: TeamMemberView) => boolean;
}): TeamException[] {
  const items: TeamException[] = [];
  for (const member of input.members) {
    const agentId = member.agent.id;
    const metrics = input.canSeeMetrics(member);
    const availability = availabilityState(member.availability, input.now);
    if (metrics && member.metrics.slaBreaches > 0) {
      items.push({ kind: "sla_breach", agentId, count: member.metrics.slaBreaches, away: availability.kind === "away" });
    }
    if (metrics) {
      const capacity = capacityState(member);
      if (capacity.level === "over") items.push({ kind: "over_capacity", agentId, used: capacity.used, capacity: capacity.capacity });
      if (capacity.level === "near") items.push({ kind: "near_capacity", agentId, used: capacity.used, capacity: capacity.capacity });
    }
    if (availability.kind === "away") {
      const item: TeamException = { kind: "away", agentId };
      if (availability.until) item.until = availability.until;
      if (metrics) item.openLeads = member.metrics.openLeads;
      items.push(item);
    } else if (availability.kind === "away_ended") {
      items.push({ kind: "away_ended", agentId, until: availability.until });
    }
  }
  const open = input.unassigned.filter((view) => view.sla.state !== "closed");
  if (open.length > 0) {
    const item: TeamException = {
      kind: "unassigned",
      count: open.length,
      breached: open.filter((view) => view.sla.state === "breached").length,
    };
    const next = open
      .filter((view) => view.sla.state !== "responded")
      .map((view) => view.sla.dueAt)
      .sort()[0];
    if (next) item.nextDueAt = next;
    items.push(item);
  }
  // Stable: members keep the team order (lead first) within one kind.
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => EXCEPTION_ORDER[a.item.kind] - EXCEPTION_ORDER[b.item.kind] || a.index - b.index)
    .map(({ item }) => item);
}
