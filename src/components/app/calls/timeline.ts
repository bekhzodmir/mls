import type { CallView, CommunicationView, SubjectRef } from "@/lib/data/views";
import type { Agent, Call, CommunicationChannel, ID, ISODateTime } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Communication timeline (§36.5, §21.4 screen 61): every touchpoint with one
 * person — channel, direction, time, agent, short result, next step and a
 * link to the original — newest first. Calls and timeline entries are two
 * records of the same conversation, so a call that already has an entry is
 * shown once, through the entry. Pure: the pages pass repository views in.
 */

type SearchParams = Record<string, string | string[] | undefined>;

export const communicationChannels = [
  "phone",
  "telegram",
  "whatsapp",
  "instagram",
  "email",
  "meeting",
] as const satisfies readonly CommunicationChannel[];

export type TimelineSubject = Pick<SubjectRef, "kind" | "id">;

/** Query keys in priority order: one person per timeline. */
const subjectKeys = [
  ["clientId", "client"],
  ["ownerId", "owner"],
  ["leadId", "lead"],
] as const;

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || undefined;
}

export interface TimelineParams {
  subject?: TimelineSubject;
  channel?: CommunicationChannel;
}

/** `?clientId=` wins over `?ownerId=`, which wins over `?leadId=`; unknown channels are ignored. */
export function parseTimelineParams(search: SearchParams): TimelineParams {
  const params: TimelineParams = {};
  for (const [key, kind] of subjectKeys) {
    const id = first(search[key]);
    if (id) {
      params.subject = { kind, id };
      break;
    }
  }
  const channel = first(search.channel);
  if (channel && (communicationChannels as readonly string[]).includes(channel)) {
    params.channel = channel as CommunicationChannel;
  }
  return params;
}

/** `/{locale}/app/calls/timeline?clientId=cl-01&channel=telegram`. */
export function timelineHref(locale: string, subject: TimelineSubject, channel?: CommunicationChannel): string {
  const search = new URLSearchParams();
  search.set(`${subject.kind}Id`, subject.id);
  if (channel) search.set("channel", channel);
  return `${appPath(locale, "/calls/timeline")}?${search}`;
}

/* ---------------------------------------------------------------- merge */

export interface TimelineEntry {
  key: string;
  channel: CommunicationChannel;
  direction: "inbound" | "outbound";
  at: ISODateTime;
  agent: Agent;
  /** The agent's short result; for a bare call, its note or confirmed summary. */
  summary?: string;
  nextStep?: string;
  /** The call behind a phone touchpoint, when the viewer may open it. */
  call?: Call;
  originalUrl?: string;
}

function fromCommunication(view: CommunicationView): TimelineEntry {
  const { communication } = view;
  const entry: TimelineEntry = {
    key: communication.id,
    channel: communication.channel,
    direction: communication.direction,
    at: communication.at,
    agent: view.agent,
    summary: communication.summary,
  };
  if (communication.nextStep) entry.nextStep = communication.nextStep;
  if (view.call) entry.call = view.call;
  if (communication.originalUrl) entry.originalUrl = communication.originalUrl;
  return entry;
}

/**
 * A call without a timeline entry. Its result is the agent's note or a
 * summary the agent confirmed — an unconfirmed AI draft is not a record
 * (§14.7), so it never stands in for one.
 */
function fromCall(view: CallView): TimelineEntry {
  const { call } = view;
  const entry: TimelineEntry = {
    key: call.id,
    channel: "phone",
    direction: call.direction,
    at: call.startedAt,
    agent: view.agent,
    call,
  };
  const summary = call.summary?.status === "confirmed" ? call.summary.text : call.note;
  if (summary) entry.summary = summary;
  if (call.nextAction?.text) entry.nextStep = call.nextAction.text;
  return entry;
}

/**
 * Entries plus calls that have no entry of their own, newest first, then
 * filtered by channel (calls count as `phone`). Ties keep a stable order.
 */
export function mergeTimeline(
  communications: readonly CommunicationView[],
  calls: readonly CallView[],
  channel?: CommunicationChannel,
): TimelineEntry[] {
  const covered = new Set<ID>();
  for (const view of communications) {
    const callId = view.call?.id ?? view.communication.callId;
    if (callId) covered.add(callId);
  }
  return [
    ...communications.map(fromCommunication),
    ...calls.filter((view) => !covered.has(view.call.id)).map(fromCall),
  ]
    .filter((entry) => !channel || entry.channel === channel)
    .sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key));
}

/** Entries per channel, for the filter chips. */
export function channelCounts(entries: readonly TimelineEntry[]): Partial<Record<CommunicationChannel, number>> {
  const counts: Partial<Record<CommunicationChannel, number>> = {};
  for (const entry of entries) counts[entry.channel] = (counts[entry.channel] ?? 0) + 1;
  return counts;
}

/** Calls attached to the person (repository views carry the attached record as `linked`). */
export function callsOf(calls: readonly CallView[], subject: TimelineSubject): CallView[] {
  return calls.filter((view) => view.linked?.kind === subject.kind && view.linked.id === subject.id);
}

/**
 * Silence is not confirmation (§36.6 "Stale"): after this many days without
 * any touchpoint the timeline asks the agent to get back in touch.
 */
export const STALE_AFTER_DAYS = 30;

/** The latest touchpoint when it is older than `STALE_AFTER_DAYS`, otherwise undefined. */
export function staleSince(entries: readonly TimelineEntry[], now: Date): ISODateTime | undefined {
  const latest = entries.reduce<ISODateTime | undefined>(
    (max, entry) => (max === undefined || entry.at > max ? entry.at : max),
    undefined,
  );
  if (!latest) return undefined;
  return now.getTime() - Date.parse(latest) > STALE_AFTER_DAYS * 86_400_000 ? latest : undefined;
}
