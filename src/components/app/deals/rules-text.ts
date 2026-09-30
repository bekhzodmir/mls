import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import deals from "@/i18n/messages/deals";
import domain from "@/i18n/messages/domain";
import type { TermsIssueCode } from "@/lib/domain/commission";
import type { Prerequisite, PrerequisiteCode } from "@/lib/domain/lifecycle";
import { dealStages, type AuditEvent, type DealStage } from "@/lib/domain/types";

/**
 * Human text for the rule-engine codes the Deal Workspace shows: unmet
 * prerequisites (§36.3 "показывает конкретное условие"), commission term
 * issues, checklist items and audit actions. Codes stay machine-readable in
 * the domain layer; every sentence lives in the deals namespace (RU/UZ).
 * An unknown code never crashes the page — it is shown as the raw code.
 */

function has<T extends object>(record: T, key: string): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function param(p: Prerequisite, key: string): string {
  const value = p.params?.[key];
  return value === undefined ? "" : String(value);
}

export function stageLabel(locale: Locale, stage: string): string {
  const labels = domain[locale].dealStage;
  return has(labels, stage) ? labels[stage] : stage;
}

function documentTypeLabel(locale: Locale, type: string): string {
  const labels = domain[locale].documentType;
  return has(labels, type) ? labels[type] : type;
}

function subjectLabel(locale: Locale, subject: string): string {
  const labels = domain[locale].verificationSubject;
  return has(labels, subject) ? labels[subject] : subject;
}

/**
 * Status params mix document states ("missing", "uploaded"…), verification
 * outcomes ("pending", "unavailable"…) and "none" (no record at all).
 */
function statusLabel(locale: Locale, status: string): string {
  const own = deals[locale].consentStatus;
  if (has(own, status)) return own[status];
  const verification = domain[locale].verificationStatus;
  return has(verification, status) ? verification[status].toLocaleLowerCase(locale) : status;
}

export function checklistLabel(locale: Locale, labelKey: string): string {
  const t = deals[locale].checklist;
  return has(t.items, labelKey) ? t.items[labelKey] : t.unknownItem;
}

export function termsIssueText(locale: Locale, code: TermsIssueCode | string): string {
  const labels = deals[locale].termsIssue;
  return has(labels, code) ? labels[code] : code;
}

/** One sentence per unmet condition, with its parameters filled in. */
export function describePrerequisite(locale: Locale, p: Prerequisite): string {
  const t = deals[locale].prerequisite;
  switch (p.code) {
    case "transition_not_allowed": {
      const next = param(p, "next");
      return next ? format(t.transition_not_allowed, { next: stageLabel(locale, next) }) : t.transition_not_allowed_end;
    }
    case "document_missing":
    case "document_rejected":
    case "document_unverified":
      return format(t[p.code], { type: documentTypeLabel(locale, param(p, "type")) });
    case "owner_consent_missing":
      return format(t.owner_consent_missing, { status: statusLabel(locale, param(p, "status") || "none") });
    case "verification_missing":
      return format(t.verification_missing, {
        subject: subjectLabel(locale, param(p, "subject")),
        status: statusLabel(locale, param(p, "status") || "none"),
      });
    case "verification_problem":
      return format(t.verification_problem, { subject: subjectLabel(locale, param(p, "subject")) });
    case "checklist_required_open":
      return format(t.checklist_required_open, { item: checklistLabel(locale, param(p, "labelKey")) });
    case "commission_terms_invalid":
      return format(t.commission_terms_invalid, { issue: termsIssueText(locale, param(p, "issue")) });
    case "mls_report_pending": {
      const due = param(p, "dueAt");
      return format(t.mls_report_pending, { due: due ? formatDateTime(locale, due) : domain[locale].unknown });
    }
    case "contract_expired": {
      const at = param(p, "expiredAt");
      return format(t.contract_expired, { date: at ? formatDateTime(locale, at) : domain[locale].unknown });
    }
    default:
      return has(t, p.code) ? t[p.code] : p.code;
  }
}

/** Workspace sections, used as anchors (`#deal-<section>`) for "go to the fix". */
export type DealSection =
  | "stage"
  | "property"
  | "financials"
  | "checklist"
  | "documents"
  | "verification"
  | "commission"
  | "act";

const sectionOf: Record<PrerequisiteCode, DealSection> = {
  transition_not_allowed: "stage",
  viewing_not_completed: "property",
  offer_missing: "financials",
  agreed_price_missing: "financials",
  document_missing: "documents",
  document_rejected: "documents",
  document_unverified: "documents",
  owner_consent_missing: "documents",
  verification_missing: "verification",
  verification_problem: "verification",
  no_verification_problem: "verification",
  checklist_required_open: "checklist",
  act_not_signed: "act",
  commission_terms_missing: "commission",
  commission_terms_invalid: "commission",
  mls_report_pending: "act",
  payout_not_recorded: "commission",
  contract_missing: "property",
  contract_expired: "property",
  price_missing: "property",
  not_expired_yet: "property",
};

export function prerequisiteSection(code: PrerequisiteCode): DealSection {
  return sectionOf[code];
}

export function sectionId(section: DealSection): string {
  return `deal-${section}`;
}

/* ---------------------------------------------------------------- audit */

export function auditActionText(locale: Locale, action: string): string {
  const t = deals[locale].audit;
  return has(t.actions, action) ? t.actions[action] : format(t.unknownAction, { code: action });
}

const STAGE_CHANGE = /^\s*([a-z_]+)\s*(?:→|->)\s*([a-z_]+)\s*$/;

/**
 * Audit reasons are stored verbatim in the source language. A recorded stage
 * change ("viewing → offer") is the one machine-written form: it is shown
 * with the localized stage names ("Просмотр → Предложение").
 */
export function auditReasonText(locale: Locale, reason: string): string {
  const match = STAGE_CHANGE.exec(reason);
  if (!match) return reason;
  const [, from, to] = match;
  const known = (stage: string): stage is DealStage => (dealStages as readonly string[]).includes(stage);
  if (!known(from) || !known(to)) return reason;
  return `${stageLabel(locale, from)} → ${stageLabel(locale, to)}`;
}

export function auditTargetText(locale: Locale, target: AuditEvent["target"]): string {
  const t = deals[locale].audit;
  const kind = has(t.kinds, target.kind) ? t.kinds[target.kind] : t.unknownKind;
  return format(t.target, { kind, id: target.id });
}
