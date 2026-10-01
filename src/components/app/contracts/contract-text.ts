import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import contracts from "@/i18n/messages/contracts";
import type { ContractClause, ContractDisplayStatus, ContractIssue } from "@/lib/domain/contracts";
import type { ContractSignature, ContractStatus, ID } from "@/lib/domain/types";

/**
 * Words for the contract rule codes and statuses (RU/UZ). Every
 * `ContractIssueCode` of `@/lib/domain/contracts` has a sentence here, keyed
 * by code, with its params filled in; an unknown right holder is named by
 * id rather than guessed.
 */

export function statusLabel(locale: Locale, status: ContractDisplayStatus): string {
  return contracts[locale].status[status];
}

/**
 * The time part of a status: «Истекает через 5 дней», «Осталось 40 дней»,
 * «Истёк 3 дня назад». Drafts, contracts awaiting signature and terminated
 * ones have none.
 */
export function daysText(locale: Locale, status: ContractDisplayStatus, daysLeft: number): string | undefined {
  const t = contracts[locale].days;
  switch (status) {
    case "expiring":
      return daysLeft <= 0 ? t.today : format(plural(locale, daysLeft, t.left), { n: daysLeft });
    case "active":
      return format(plural(locale, daysLeft, t.activeLeft), { n: daysLeft });
    case "expired": {
      const ago = Math.abs(daysLeft);
      return daysLeft >= 0 ? t.endedToday : format(plural(locale, ago, t.ago), { n: ago });
    }
    default:
      return undefined;
  }
}

/** «3%», «1,5%» — the locale's decimal comma. */
export function percentText(locale: Locale, percent: number): string {
  return format(contracts[locale].remuneration.percentValue, {
    percent: formatNumber(locale, percent, { maximumFractionDigits: 2 }),
  });
}

export function clauseLabel(locale: Locale, clause: ContractClause): string {
  return contracts[locale].clauses.items[clause];
}

/** Agent signatures store the agent id; a customer's, their display name. */
export function signerName(signature: Pick<ContractSignature, "signerName">, agentNames: Record<ID, string>): string {
  return agentNames[signature.signerName] ?? signature.signerName;
}

function param(issue: ContractIssue, key: string): string | undefined {
  const value = issue.params?.[key];
  return value === undefined ? undefined : String(value);
}

function holderName(locale: Locale, issue: ContractIssue, names: Record<ID, string>): string {
  const id = param(issue, "ownerId") ?? "";
  return param(issue, "ownerName") ?? names[id] ?? format(contracts[locale].issue.unknownHolder, { id });
}

type Field = "percent" | "amount" | "paymentTerms";

function field(issue: ContractIssue): Field {
  const value = param(issue, "field");
  return value === "percent" || value === "amount" ? value : "paymentTerms";
}

/** One sentence per issue, in the order the rules returned them. */
export function issueText(locale: Locale, issue: ContractIssue, holderNames: Record<ID, string> = {}): string {
  const t = contracts[locale];
  switch (issue.code) {
    case "period_invalid":
      return t.issue.period_invalid;
    case "service_missing":
      return t.issue.service_missing;
    case "clause_missing": {
      const clause = param(issue, "clause") as ContractClause | undefined;
      const label = clause && clause in t.clauses.items ? clauseLabel(locale, clause) : (clause ?? "");
      return format(t.issue.clause_missing, { clause: label });
    }
    case "remuneration_incomplete":
      return t.issue.remuneration_incomplete[field(issue)];
    case "remuneration_invalid":
      return t.issue.remuneration_invalid[field(issue)];
    case "right_holders_missing":
      return t.issue.right_holders_missing;
    case "right_holder_consent_missing":
      return format(t.issue.right_holder_consent_missing, { name: holderName(locale, issue, holderNames) });
    case "right_holder_consent_revoked":
      return format(t.issue.right_holder_consent_revoked, { name: holderName(locale, issue, holderNames) });
    case "right_holder_consent_unlinked":
      return format(t.issue.right_holder_consent_unlinked, { name: holderName(locale, issue, holderNames) });
    case "signature_missing":
      return param(issue, "party") === "customer" ? t.issue.signature_missing.customer : t.issue.signature_missing.agent;
    case "signature_method_unverified": {
      const party = param(issue, "party") as ContractSignature["party"] | undefined;
      return format(t.issue.signature_method_unverified, {
        party: party && party in t.signatures.party ? t.signatures.party[party] : (party ?? ""),
      });
    }
    case "status_not_activatable": {
      const status = param(issue, "status") as ContractStatus | undefined;
      return format(t.issue.status_not_activatable, {
        status: status && status in t.status ? t.status[status] : (status ?? ""),
      });
    }
    case "period_ended": {
      const endsAt = param(issue, "endsAt");
      return format(t.issue.period_ended, { date: endsAt ? formatDate(locale, endsAt) : "" });
    }
  }
}
