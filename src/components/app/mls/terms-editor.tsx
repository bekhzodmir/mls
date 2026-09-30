"use client";

import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import {
  DEFAULT_LARGER_SHARE,
  splitPresetIds,
  validateTerms,
  type SplitSide,
  type TermsIssue,
} from "@/lib/domain/commission";
import { currencies, type CommissionTerms, type SplitPreset } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import {
  draftInputErrors,
  flipShares,
  largerSide,
  withAmountText,
  withBasisChoice,
  withCurrencyChoice,
  withPayoutChoice,
  withPayoutNoteText,
  withPercentText,
  withPreset,
  withTerms,
  type TermsDraft,
} from "./cooperation-model";
import type { CooperationMessages, TermsLabels } from "./cooperation-labels";
import { ExampleSplit } from "./example-split";
import { inputClasses, textareaClasses } from "@/components/ui/field";

export interface TermsEditorLabels {
  editor: CooperationMessages["editor"];
  issue: CooperationMessages["issue"];
  example: CooperationMessages["example"];
  terms: TermsLabels;
}

const bases: CommissionTerms["basis"][] = ["gross_commission", "fixed_amount"];
const payouts: CommissionTerms["payoutCondition"][] = ["on_deal_closing", "on_act_signed", "custom"];

/**
 * Commission split editor (§7.4, §15.4, §35.6): presets 50/50 · 70/30 · 80/20
 * · custom, an editable percent for each ROLE, basis, currency, payout
 * condition and a note — validated live with `validateTerms`, with an exact
 * example split. The direction of 70/30 and 80/20 is not standardized (§41
 * D2), so both roles are always named and the shares can be swapped.
 *
 * Controlled: the parent owns the draft and decides when it may be sent.
 */
export function TermsEditor({
  locale,
  labels,
  draft,
  onChange,
  viewerSide,
  idPrefix,
}: {
  locale: Locale;
  labels: TermsEditorLabels;
  draft: TermsDraft;
  onChange: (draft: TermsDraft) => void;
  viewerSide?: SplitSide;
  idPrefix: string;
}) {
  const e = labels.editor;
  const { role, preset: presetLabel, basis: basisLabel, payout: payoutLabel } = labels.terms;
  const terms = draft.terms;
  const inputErrors = draftInputErrors(draft);
  const issues = validateTerms(terms);
  const larger = largerSide(terms);
  const id = (key: string) => `${idPrefix}-${key}`;
  const you = (side: SplitSide) => (viewerSide === side ? ` (${role.you})` : "");

  const issuesFor = (...fields: (keyof CommissionTerms)[]) => issues.filter((issue) => fields.includes(issue.field));
  const percentIssues = issuesFor("listingSidePercent", "buyerSidePercent");
  const amountIssues = inputErrors.includes("amountText") ? [] : issuesFor("fixedAmount");
  const noteIssues = issuesFor("payoutNote");
  const presetIssues = issuesFor("preset");

  function choosePreset(preset: SplitPreset) {
    onChange(withTerms(draft, withPreset(terms, preset, larger ?? DEFAULT_LARGER_SHARE)));
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1 text-caption font-medium text-fg-muted">{e.preset}</legend>
        <div className="flex flex-wrap gap-2">
          {splitPresetIds.map((preset) => (
            <label key={preset}>
              <input
                type="radio"
                name={id("preset")}
                value={preset}
                checked={terms.preset === preset}
                onChange={() => choosePreset(preset)}
                className="peer sr-only"
              />
              <span className="inline-flex h-11 cursor-pointer items-center rounded-full border border-border bg-surface px-4 text-small font-medium text-fg transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:bg-surface-muted peer-checked:hover:bg-primary-hover">
                {presetLabel[preset]}
              </span>
            </label>
          ))}
        </div>
        <IssueList issues={presetIssues} labels={labels.issue} id={id("preset-issues")} />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <PercentField
          id={id("listing")}
          label={`${e.listingPercent}${you("listing")}`}
          hint={role.listingHint}
          value={draft.listingText}
          invalid={
            inputErrors.includes("listingText") || percentIssues.some((issue) => issue.field === "listingSidePercent")
          }
          inputError={inputErrors.includes("listingText") ? e.percentInvalid : undefined}
          onChange={(text) => onChange(withPercentText(draft, "listing", text))}
        />
        <PercentField
          id={id("buyer")}
          label={`${e.buyerPercent}${you("buyer")}`}
          hint={role.buyerHint}
          value={draft.buyerText}
          invalid={
            inputErrors.includes("buyerText") || percentIssues.some((issue) => issue.field === "buyerSidePercent")
          }
          inputError={inputErrors.includes("buyerText") ? e.percentInvalid : undefined}
          onChange={(text) => onChange(withPercentText(draft, "buyer", text))}
        />
      </div>
      <IssueList issues={percentIssues} labels={labels.issue} id={id("percent-issues")} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-small text-fg">
          {larger ? `${e.direction}: ${larger === "listing" ? role.listing : role.buyer}` : null}
          {larger ? " · " : null}
          <span className="tabular">
            {format(e.sum, { n: Math.round((terms.listingSidePercent + terms.buyerSidePercent) * 100) / 100 })}
          </span>
        </p>
        {larger ? (
          <Button variant="ghost" onClick={() => onChange(withTerms(draft, flipShares(terms)))}>
            <ArrowLeftRight aria-hidden className="size-4" />
            {e.flip}
          </Button>
        ) : null}
      </div>
      <p className="text-caption text-fg-muted">{e.directionNote}</p>

      <fieldset>
        <legend className="mb-1 text-caption font-medium text-fg-muted">{e.basis}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {bases.map((basis) => (
            <label
              key={basis}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-small text-fg",
                terms.basis === basis ? "border-primary bg-primary-soft/40" : "border-border hover:bg-surface-muted",
              )}
            >
              <input
                type="radio"
                name={id("basis")}
                value={basis}
                checked={terms.basis === basis}
                onChange={() => onChange(withBasisChoice(draft, basis))}
                className="size-4 accent-[var(--primary)]"
              />
              {basisLabel[basis]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {terms.basis === "fixed_amount" ? (
          <div className="space-y-1">
            <label htmlFor={id("amount")} className="block text-caption font-medium text-fg-muted">
              {e.fixedAmount} ({terms.currency})
            </label>
            <input
              id={id("amount")}
              inputMode="decimal"
              autoComplete="off"
              value={draft.amountText}
              onChange={(event) => onChange(withAmountText(draft, event.target.value))}
              aria-invalid={inputErrors.includes("amountText") || amountIssues.length > 0 ? true : undefined}
              aria-describedby={id("amount-issues")}
              className={cn(inputClasses, "tabular")}
            />
            <div id={id("amount-issues")}>
              {inputErrors.includes("amountText") ? (
                <p className="text-caption text-danger-fg">{e.amountInvalid}</p>
              ) : null}
              <IssueList issues={amountIssues} labels={labels.issue} />
            </div>
          </div>
        ) : null}
        <div className="space-y-1">
          <label htmlFor={id("currency")} className="block text-caption font-medium text-fg-muted">
            {e.currency}
          </label>
          <select
            id={id("currency")}
            value={terms.currency}
            onChange={(event) => onChange(withCurrencyChoice(draft, event.target.value as CommissionTerms["currency"]))}
            className={inputClasses}
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={id("payout")} className="block text-caption font-medium text-fg-muted">
            {e.payout}
          </label>
          <select
            id={id("payout")}
            value={terms.payoutCondition}
            onChange={(event) =>
              onChange(withPayoutChoice(draft, event.target.value as CommissionTerms["payoutCondition"]))
            }
            className={inputClasses}
          >
            {payouts.map((payout) => (
              <option key={payout} value={payout}>
                {payoutLabel[payout]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {terms.payoutCondition === "custom" ? (
        <div className="space-y-1">
          <label htmlFor={id("payout-note")} className="block text-caption font-medium text-fg-muted">
            {e.payoutNote}
          </label>
          <textarea
            id={id("payout-note")}
            rows={2}
            value={draft.payoutNoteText}
            placeholder={e.payoutNotePlaceholder}
            onChange={(event) => onChange(withPayoutNoteText(draft, event.target.value))}
            aria-invalid={noteIssues.length > 0 ? true : undefined}
            aria-describedby={id("payout-note-issues")}
            className="w-full rounded-md border border-border bg-surface p-3 text-small text-fg focus-visible:border-primary aria-invalid:border-danger-border"
          />
          <IssueList issues={noteIssues} labels={labels.issue} id={id("payout-note-issues")} />
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor={id("note")} className="block text-caption font-medium text-fg-muted">
          {e.note}
        </label>
        <textarea
          id={id("note")}
          rows={2}
          value={draft.note}
          placeholder={e.notePlaceholder}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
          className={textareaClasses}
        />
      </div>

      <ExampleSplit locale={locale} terms={terms} labels={labels.example} termsLabels={labels.terms} />
      <p className="text-caption text-fg-muted">{labels.terms.terms.notBinorFee}</p>
    </div>
  );
}

function PercentField({
  id,
  label,
  hint,
  value,
  invalid,
  inputError,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  invalid: boolean;
  inputError?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-caption font-medium text-fg-muted">
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={`${id}-hint`}
        className={cn(inputClasses, "text-body font-semibold tabular")}
      />
      <p id={`${id}-hint`} className={cn("text-caption", inputError ? "text-danger-fg" : "text-fg-muted")}>
        {inputError ?? hint}
      </p>
    </div>
  );
}

function IssueList({
  issues,
  labels,
  id,
}: {
  issues: TermsIssue[];
  labels: CooperationMessages["issue"];
  id?: string;
}) {
  if (issues.length === 0) return id ? <div id={id} /> : null;
  return (
    <ul id={id} className="space-y-0.5">
      {[...new Set(issues.map((issue) => issue.code))].map((code) => (
        <li key={code} className="text-caption text-danger-fg">
          {labels[code]}
        </li>
      ))}
    </ul>
  );
}
