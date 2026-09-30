import { splitAmount, validateTerms, type SplitResult, type TermsIssue } from "@/lib/domain/commission";
import type { CommissionTerms, Deal, ISODateTime, Money } from "@/lib/domain/types";
import { stageIndex } from "./pipeline";

/**
 * Read model of a deal's commission split (§15.4, §35.2 row 11, §41 D10):
 * the split between two realtors — never a Binor fee — with the money
 * amounts computed exactly by `splitAmount`, and accrual kept apart from
 * payment. Accrued is never shown as paid; payment exists only once a
 * payout date is recorded.
 */

/**
 * - `accrued`: the payout condition is met (act signed / deal closed);
 * - `not_accrued`: not yet;
 * - `manual`: a custom condition the system cannot evaluate.
 */
export type AccrualState = "accrued" | "not_accrued" | "manual";

export interface CommissionSummary {
  terms: CommissionTerms;
  /** Validation issues; the split is not computed while there are any. */
  issues: TermsIssue[];
  /** What is split: the gross commission or the fixed amount. Undefined = not recorded. */
  base?: Money;
  split?: SplitResult;
  accrual: AccrualState;
  paidAt?: ISODateTime;
}

function accrualOf(deal: Pick<Deal, "stage" | "actSignedAt">, terms: CommissionTerms): AccrualState {
  switch (terms.payoutCondition) {
    case "on_act_signed":
      return deal.actSignedAt ? "accrued" : "not_accrued";
    case "on_deal_closing":
      // Closing is done once the deal has moved past the closing stage.
      return stageIndex(deal.stage) > stageIndex("closing") ? "accrued" : "not_accrued";
    case "custom":
      return "manual";
  }
}

export function summarizeCommission(
  deal: Pick<Deal, "stage" | "actSignedAt" | "commission">,
): CommissionSummary | undefined {
  const commission = deal.commission;
  if (!commission) return undefined;
  const { terms } = commission;
  const issues = validateTerms(terms);
  const summary: CommissionSummary = { terms, issues, accrual: accrualOf(deal, terms) };
  const base = terms.basis === "fixed_amount" ? terms.fixedAmount : commission.gross;
  if (base) summary.base = base;
  if (issues.length === 0 && base && base.currency === terms.currency) {
    try {
      summary.split = splitAmount(terms, commission.gross);
    } catch {
      // A malformed record shows the terms without amounts rather than failing the page.
    }
  }
  if (commission.payoutRecordedAt) summary.paidAt = commission.payoutRecordedAt;
  return summary;
}
