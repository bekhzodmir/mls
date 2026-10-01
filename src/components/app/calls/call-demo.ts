import type { CallSummary, ISODateTime } from "@/lib/domain/types";
import type { DateKey } from "@/lib/domain/working-days";

/**
 * Local demo state of one call (§14.7, §36.5). The repository is read-only,
 * so confirming, correcting or rejecting the AI summary and marking the call
 * handled change a copy on the page only; the UI says so and offers to undo.
 * The rules are real:
 * - an AI summary is a draft until a person confirms it — a correction is
 *   the agent's own text and counts as confirmed by them;
 * - a rejected draft never becomes the call's result;
 * - a handled call carries a next action, or an explicit reason why not.
 */

/* --------------------------------------------------------- AI summary */

export interface SummaryDemoState {
  status: "draft" | "confirmed" | "rejected";
  text: string;
  /** Edited by a person before confirming. */
  corrected: boolean;
  confirmedAt?: ISODateTime;
  /** Name of whoever confirmed, as shown in the UI. */
  confirmedBy?: string;
  notice?: "confirmed" | "corrected" | "rejected";
  /** The summary as the repository returned it, for "undo". */
  original: CallSummary;
  originalConfirmedBy?: string;
}

export type SummaryDemoAction =
  | { type: "confirm"; at: ISODateTime; by: string }
  | { type: "correct"; text: string; at: ISODateTime; by: string }
  | { type: "reject" }
  | { type: "undo" };

export function initialSummaryState(summary: CallSummary, confirmedBy?: string): SummaryDemoState {
  const state: SummaryDemoState = {
    status: summary.status,
    text: summary.text,
    corrected: false,
    original: structuredClone(summary),
  };
  if (summary.status === "confirmed") {
    if (summary.confirmedAt) state.confirmedAt = summary.confirmedAt;
    if (confirmedBy) state.confirmedBy = confirmedBy;
  }
  if (confirmedBy) state.originalConfirmedBy = confirmedBy;
  return state;
}

export function reduceSummary(state: SummaryDemoState, action: SummaryDemoAction): SummaryDemoState {
  switch (action.type) {
    case "confirm":
      if (state.status !== "draft") return state;
      return { ...state, status: "confirmed", confirmedAt: action.at, confirmedBy: action.by, notice: "confirmed" };
    case "correct": {
      const text = action.text.trim();
      if (!text || state.status === "rejected") return state;
      return {
        ...state,
        status: "confirmed",
        text,
        corrected: true,
        confirmedAt: action.at,
        confirmedBy: action.by,
        notice: "corrected",
      };
    }
    case "reject":
      if (state.status !== "draft") return state;
      return { ...state, status: "rejected", notice: "rejected" };
    case "undo":
      return initialSummaryState(state.original, state.originalConfirmedBy);
  }
}

/* ------------------------------------------------------- mark handled */

export const noNextStepReasons = ["resolved", "wrong_number", "spam", "duplicate", "other"] as const;
export type NoNextStepReason = (typeof noNextStepReasons)[number];

export interface HandledInput {
  mode: "next" | "none";
  text: string;
  /** "YYYY-MM-DD", Tashkent; optional. */
  date: string;
  /** "HH:MM", Tashkent; optional, needs a date. */
  time: string;
  reason: NoNextStepReason | "";
  comment: string;
}

export type HandledErrors = Partial<Record<"text" | "date" | "time" | "reason" | "comment", true>>;

/**
 * Marking a call handled needs a next action, or an explicit "no next step"
 * reason (§14.7, §14.8). A due date, when given, is today or later; "other"
 * needs a comment.
 */
export function validateHandled(input: HandledInput, today: DateKey): HandledErrors {
  const errors: HandledErrors = {};
  if (input.mode === "next") {
    if (!input.text.trim()) errors.text = true;
    if (input.date && input.date < today) errors.date = true;
    if (input.time && !input.date) errors.time = true;
  } else {
    if (!input.reason) errors.reason = true;
    if (input.reason === "other" && !input.comment.trim()) errors.comment = true;
  }
  return errors;
}

export function hasErrors(errors: HandledErrors): boolean {
  return Object.keys(errors).length > 0;
}
