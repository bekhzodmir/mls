import type { CallFilter, CallView, SubjectRef } from "@/lib/data/views";
import { dayDistance } from "@/components/app/viewings/time";
import type { Call, ID, ISODateTime } from "@/lib/domain/types";
import { tashkentDateKey, type DateKey } from "@/lib/domain/working-days";
import { appPath } from "@/lib/routes";

/**
 * Call log logic (§14.7, §21.4 screen 58): the `?filter=` chips, what kind
 * of call a record is, Tashkent-day grouping with missed calls on top of
 * today, and the state of the next action. Pure and deterministic — `now` is
 * always passed in (the app clock in pages).
 */

type SearchParams = Record<string, string | string[] | undefined>;

/** `?filter=` values; no value (or an unknown one) means every call. */
export const callFilterKeys = ["missed", "unknown", "inbound", "outbound"] as const;
export type CallFilterKey = (typeof callFilterKeys)[number];

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || undefined;
}

export function parseCallFilter(search: SearchParams): CallFilterKey | undefined {
  const value = first(search.filter);
  return value !== undefined && (callFilterKeys as readonly string[]).includes(value)
    ? (value as CallFilterKey)
    : undefined;
}

/** The repository filter behind a chip: "unknown numbers" are calls attached to nothing. */
export function toRepositoryFilter(key: CallFilterKey | undefined): CallFilter {
  switch (key) {
    case "missed":
      return { outcome: "missed" };
    case "unknown":
      return { linked: "unknown" };
    case "inbound":
      return { direction: "inbound" };
    case "outbound":
      return { direction: "outbound" };
    case undefined:
      return {};
  }
}

/** `/{locale}/app/calls` or `…/calls?filter=missed`. */
export function callsHref(locale: string, key?: CallFilterKey): string {
  return `${appPath(locale, "/calls")}${key ? `?filter=${key}` : ""}`;
}

export function callHref(locale: string, id: ID): string {
  return appPath(locale, `/calls/${encodeURIComponent(id)}`);
}

/** Lead, client or owner profile; owner profiles live under `/owners`. */
export function subjectHref(locale: string, ref: Pick<SubjectRef, "kind" | "id">): string {
  const base = ref.kind === "lead" ? "/leads" : ref.kind === "client" ? "/clients" : "/owners";
  return appPath(locale, `${base}/${encodeURIComponent(ref.id)}`);
}

/* ---------------------------------------------------------------- kinds */

/** One label per call: direction for answered calls, the outcome otherwise. */
export type CallKind = "inbound" | "outbound" | "missed" | "no_answer" | "busy";

export function callKind(call: Pick<Call, "direction" | "outcome">): CallKind {
  return call.outcome === "answered" ? call.direction : call.outcome;
}

/** Nobody talked: missed, not answered or busy. */
export function noConversation(call: Pick<Call, "outcome">): boolean {
  return call.outcome !== "answered";
}

/**
 * Why a call has (or has no) recording and transcript (§36.5): nothing is
 * recorded without separate consent, and a call without a conversation has
 * nothing to record. A refusal names who refused.
 */
export type RecordingExplanation =
  | "granted"
  | "grantedUnavailable"
  | "refusedClient"
  | "refusedOwner"
  | "notRequested"
  | "noConversation";

export function recordingExplanation(
  call: Pick<Call, "outcome" | "recording">,
  party?: SubjectRef["kind"],
): RecordingExplanation {
  if (noConversation(call)) return "noConversation";
  switch (call.recording.consent) {
    case "granted":
      return call.recording.available ? "granted" : "grantedUnavailable";
    case "refused":
      return party === "owner" ? "refusedOwner" : "refusedClient";
    case "not_requested":
      return "notRequested";
  }
}

/** Whole minutes and the remaining seconds of a call. */
export function durationParts(seconds: number): { minutes: number; seconds: number } {
  const total = Math.max(0, Math.round(seconds));
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

/* ------------------------------------------------------------- grouping */

export type RelativeDay = "today" | "yesterday";

export interface CallDay {
  /** Tashkent date, "YYYY-MM-DD". */
  key: DateKey;
  relative?: RelativeDay;
  /** Any instant on that day, for date formatting. */
  anchorIso: ISODateTime;
  views: CallView[];
}

/**
 * Groups calls by their Tashkent date, newest day first and newest call
 * first within a day. Today's missed calls go to the top of today: a missed
 * inbound call is a person waiting for an answer (§14.7).
 */
export function groupCallsByDay(views: readonly CallView[], now: Date): CallDay[] {
  const sorted = [...views].sort(
    (a, b) => b.call.startedAt.localeCompare(a.call.startedAt) || a.call.id.localeCompare(b.call.id),
  );
  const days: CallDay[] = [];
  for (const view of sorted) {
    const key = tashkentDateKey(view.call.startedAt);
    let group = days.find((day) => day.key === key);
    if (!group) {
      const distance = dayDistance(now, view.call.startedAt);
      group = { key, anchorIso: view.call.startedAt, views: [] };
      if (distance === 0) group.relative = "today";
      else if (distance === -1) group.relative = "yesterday";
      days.push(group);
    }
    group.views.push(view);
  }
  for (const day of days) {
    if (day.relative !== "today") continue;
    const missed = day.views.filter((view) => view.call.outcome === "missed");
    day.views = [...missed, ...day.views.filter((view) => view.call.outcome !== "missed")];
  }
  return days;
}

/* ---------------------------------------------------------- next action */

/**
 * - `overdue`: the due time has passed;
 * - `today`: due later today (Tashkent);
 * - `planned`: due on a later day, or without a due time;
 * - `missing`: no next action on a call that needs one — nobody talked, or
 *   the number is attached to nothing (§14.7: an unknown call must not get lost);
 * - `none`: no next action, and none is required by the call itself.
 */
export type NextActionState = "overdue" | "today" | "planned" | "missing" | "none";

export function nextActionState(view: Pick<CallView, "call" | "linked">, now: Date): NextActionState {
  const { call } = view;
  const next = call.nextAction;
  if (!next?.text.trim()) return noConversation(call) || !view.linked ? "missing" : "none";
  if (!next.dueAt) return "planned";
  if (Date.parse(next.dueAt) < now.getTime()) return "overdue";
  return tashkentDateKey(next.dueAt) === tashkentDateKey(now) ? "today" : "planned";
}

/* ------------------------------------------------------------ transcript */

export interface TranscriptLine {
  /** "Агент", "Клиент", "Mijoz" — kept verbatim from the transcript. */
  speaker?: string;
  text: string;
}

const SPEAKER_RE = /^([^:\n]{1,24}):\s*(.*)$/;

/** Splits a transcript into turns; a line without a "Speaker:" prefix keeps its text only. */
export function transcriptLines(transcript: string): TranscriptLine[] {
  return transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = SPEAKER_RE.exec(line);
      return match && match[2] ? { speaker: match[1].trim(), text: match[2] } : { text: line };
    });
}
