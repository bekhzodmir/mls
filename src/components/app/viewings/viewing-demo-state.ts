import type { ISODateTime, Viewing } from "@/lib/domain/types";
import { isOpen } from "./agenda";

/**
 * Local demo state of one viewing (§8.3 flow 9). The repository is
 * read-only, so confirm / reschedule / cancel / outcome change a copy on the
 * page only; the UI says so and offers to undo. The rules are real:
 * - a new time needs both sides to confirm again;
 * - a finished viewing (completed or not) always carries a next step (§14.8);
 * - closed viewings (completed, cancelled, no-show) are not reopened.
 */

export type CancelReason = "client" | "owner" | "unavailable" | "changed" | "other";
export type NoShowWho = "client" | "owner" | "unknown";

export type ViewingDemoNotice =
  | { kind: "confirmed" }
  | { kind: "rescheduled"; startsAt: ISODateTime }
  | { kind: "cancelled"; reason: CancelReason; comment?: string }
  | { kind: "completed" }
  | { kind: "no_show"; who?: NoShowWho };

export interface ViewingDemoState {
  viewing: Viewing;
  /** The record as the repository returned it, for "undo". */
  original: Viewing;
  notice?: ViewingDemoNotice;
}

export type ViewingDemoAction =
  | { type: "confirm"; client: boolean; ownerOrPartner: boolean }
  | { type: "reschedule"; startsAt: ISODateTime; durationMinutes: number }
  | { type: "cancel"; reason: CancelReason; comment?: string }
  | { type: "complete"; nextAction: string; rating?: 1 | 2 | 3 | 4 | 5; text?: string }
  | { type: "no_show"; nextAction: string; who?: NoShowWho }
  | { type: "next_action"; nextAction: string }
  | { type: "undo" };

export function initialViewingDemoState(viewing: Viewing): ViewingDemoState {
  return { viewing: structuredClone(viewing), original: structuredClone(viewing) };
}

export function reduceViewingDemo(state: ViewingDemoState, action: ViewingDemoAction): ViewingDemoState {
  const { viewing } = state;
  switch (action.type) {
    case "confirm": {
      if (!isOpen(viewing)) return state;
      const confirmations = { client: action.client, ownerOrPartner: action.ownerOrPartner };
      const status = confirmations.client && confirmations.ownerOrPartner ? "confirmed" : "scheduled";
      return { ...state, viewing: { ...viewing, confirmations, status }, notice: { kind: "confirmed" } };
    }
    case "reschedule": {
      if (!isOpen(viewing)) return state;
      return {
        ...state,
        viewing: {
          ...viewing,
          startsAt: action.startsAt,
          durationMinutes: action.durationMinutes,
          status: "scheduled",
          // Agreement was for the old time: both sides confirm the new one.
          confirmations: { client: false, ownerOrPartner: false },
        },
        notice: { kind: "rescheduled", startsAt: action.startsAt },
      };
    }
    case "cancel": {
      if (!isOpen(viewing)) return state;
      const comment = action.comment?.trim();
      const notice: ViewingDemoNotice = { kind: "cancelled", reason: action.reason };
      if (comment) notice.comment = comment;
      return { ...state, viewing: { ...viewing, status: "cancelled" }, notice };
    }
    case "complete": {
      const nextAction = action.nextAction.trim();
      if (!isOpen(viewing) || !nextAction) return state;
      const next: Viewing = { ...viewing, status: "completed", nextAction };
      if (action.rating) next.feedback = { rating: action.rating, text: action.text?.trim() ?? "" };
      return { ...state, viewing: next, notice: { kind: "completed" } };
    }
    case "no_show": {
      const nextAction = action.nextAction.trim();
      if (!isOpen(viewing) || !nextAction) return state;
      const notice: ViewingDemoNotice = { kind: "no_show" };
      if (action.who) notice.who = action.who;
      return { ...state, viewing: { ...viewing, status: "no_show", nextAction }, notice };
    }
    case "next_action": {
      const nextAction = action.nextAction.trim();
      if (viewing.status !== "completed" && viewing.status !== "no_show") return state;
      if (!nextAction) return state;
      return { ...state, viewing: { ...viewing, nextAction }, notice: { kind: "completed" } };
    }
    case "undo":
      return { viewing: structuredClone(state.original), original: state.original };
  }
}
