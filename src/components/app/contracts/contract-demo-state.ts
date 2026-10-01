import type { ContractContext, ContractIssue } from "@/lib/domain/contracts";
import type { Contract, ISODateTime } from "@/lib/domain/types";
import { renewalDraft, sendCheck, terminateContract, type SignatureSide } from "./contract-rules";

/**
 * Local demo state of the contract workspace. The repository is read-only,
 * so "renew", "terminate" and "send for signature" change a copy held on
 * the page — and the screen says nothing reached the server or the parties.
 * The rules are the real ones (`contract-rules.ts` over the domain checks):
 * a contract with a right holder's consent missing cannot go out for
 * signature (art. 37), and termination needs a reason.
 */

export interface ContractDemoState {
  /** The contract as loaded; "reset" returns to it. */
  initial: Contract;
  contract: Contract;
  /** A renewal draft created on this page. */
  renewal?: Contract;
  /** What blocked the last "send for signature" attempt. */
  blocked?: ContractIssue[];
  notice?: ContractDemoNotice;
}

export type ContractDemoNotice =
  | { kind: "renewed"; startsAt: ISODateTime; endsAt: ISODateTime }
  | { kind: "terminated"; reason: string }
  | { kind: "sent"; parties: SignatureSide[] };

export type ContractDemoAction =
  | { type: "renew" }
  | { type: "terminate"; reason: string }
  | { type: "send" }
  | { type: "reset" };

export interface ContractDemoContext {
  /** The frozen app clock, as ISO — the same instant on server and client. */
  nowIso: ISODateTime;
  rules: ContractContext;
}

export function initialContractDemoState(contract: Contract): ContractDemoState {
  return { initial: structuredClone(contract), contract: structuredClone(contract) };
}

export function reduceContractDemo(
  state: ContractDemoState,
  action: ContractDemoAction,
  context: ContractDemoContext,
): ContractDemoState {
  const now = new Date(context.nowIso);
  switch (action.type) {
    case "renew": {
      if (state.renewal) return state;
      const renewal = renewalDraft(state.contract, now);
      return {
        ...state,
        renewal,
        blocked: undefined,
        notice: { kind: "renewed", startsAt: renewal.startsAt, endsAt: renewal.endsAt },
      };
    }

    case "terminate": {
      const terminated = terminateContract(state.contract, action.reason, context.nowIso);
      if (!terminated) return state;
      return {
        ...state,
        contract: terminated,
        blocked: undefined,
        notice: { kind: "terminated", reason: terminated.terminationReason ?? action.reason.trim() },
      };
    }

    case "send": {
      if (state.contract.status !== "draft" && state.contract.status !== "awaiting_signature") return state;
      const check = sendCheck(state.contract, now, context.rules);
      if (!check.ok) return { ...state, blocked: check.issues, notice: undefined };
      return {
        ...state,
        contract: { ...state.contract, status: "awaiting_signature" },
        blocked: undefined,
        notice: { kind: "sent", parties: check.parties },
      };
    }

    case "reset":
      return initialContractDemoState(state.initial);
  }
}
