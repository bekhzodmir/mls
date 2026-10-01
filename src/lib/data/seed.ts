import { orgAuditLog } from "./seed-audit";
import { calls, communications } from "./seed-comms";
import { contracts } from "./seed-contracts";
import { leads, clients, requirements } from "./seed-crm";
import { listings, properties } from "./seed-inventory";
import { agents, organizations, owners, VIEWER_AGENT_ID } from "./seed-people";
import { agentAvailability, roundRobinCursors, routingRules, teams } from "./seed-team";
import { telegramListings, telegramSources } from "./seed-telegram";
import {
  cooperationRequests,
  deals,
  matchStatuses,
  notifications,
  offers,
  tasks,
  viewings,
} from "./seed-work";

/**
 * The complete demo dataset (clearly fictional; see the seed-*.ts files).
 *
 * The object graph is deep-frozen at load time so no code path can mutate
 * shared demo data between requests; the repository returns copies. Replace
 * this module with real data sources — the repository's async signatures
 * already fit a backend.
 */

export { VIEWER_AGENT_ID };
export type { MatchStatusRecord } from "./seed-work";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

export const seed = deepFreeze({
  organizations,
  agents,
  owners,
  properties,
  listings,
  leads,
  clients,
  requirements,
  telegramSources,
  telegramListings,
  cooperationRequests,
  viewings,
  offers,
  deals,
  tasks,
  notifications,
  matchStatuses,
  contracts,
  calls,
  communications,
  teams,
  agentAvailability,
  routingRules,
  roundRobinCursors,
  /** Demo Realty's organization journal; deal histories stay on each deal. */
  orgAuditLog,
});

export type Seed = typeof seed;
