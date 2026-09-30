"use client";

import { useId, useState } from "react";
import { Calculator } from "lucide-react";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatMoney } from "@/lib/domain/money";
import type { CommissionTerms, Currency } from "@/lib/domain/types";
import { exampleSplit, parseMoneyInput, sampleGross } from "./cooperation-model";
import type { CooperationMessages, TermsLabels } from "./cooperation-labels";

function sampleText(currency: Currency): string {
  return String(sampleGross(currency).amountMinor / 100);
}

/**
 * "Пример расчёта" (§35.6 step 3): the exact split of an example gross
 * commission — or of the fixed amount — using `splitAmount`, so the agent
 * sees money, not just percentages. The input is labelled as an example,
 * never as deal data.
 */
export function ExampleSplit({
  locale,
  terms,
  labels,
  termsLabels,
}: {
  locale: Locale;
  terms: CommissionTerms;
  labels: CooperationMessages["example"];
  termsLabels: TermsLabels;
}) {
  const id = useId();
  const [samples, setSamples] = useState<Record<Currency, string>>({
    USD: sampleText("USD"),
    UZS: sampleText("UZS"),
  });
  const fixed = terms.basis === "fixed_amount";
  const text = samples[terms.currency];
  const gross = fixed ? undefined : parseMoneyInput(text, terms.currency);
  const split = exampleSplit(terms, gross);

  return (
    <section aria-labelledby={`${id}-title`} className="space-y-2 rounded-md border border-border bg-surface-muted p-3">
      <h3 id={`${id}-title`} className="flex items-center gap-2 text-small font-semibold text-fg">
        <Calculator aria-hidden className="size-4 text-fg-muted" />
        {labels.title}
      </h3>
      {fixed ? (
        <p className="text-caption text-fg-muted">{labels.fixedHint}</p>
      ) : (
        <div className="space-y-1">
          <label htmlFor={`${id}-sample`} className="text-caption font-medium text-fg-muted">
            {labels.sample} ({terms.currency})
          </label>
          <input
            id={`${id}-sample`}
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(event) => setSamples((current) => ({ ...current, [terms.currency]: event.target.value }))}
            aria-describedby={`${id}-hint`}
            aria-invalid={gross ? undefined : true}
            className="h-11 w-full max-w-60 rounded-md border border-border bg-surface px-3 text-small tabular text-fg focus-visible:border-primary"
          />
          <p id={`${id}-hint`} className="text-caption text-fg-muted">
            {gross ? labels.sampleHint : labels.invalid}
          </p>
        </div>
      )}
      {split ? (
        <dl className="grid grid-cols-2 gap-2">
          <div>
            <dt className="text-caption text-fg-muted">{format(labels.gets, { role: termsLabels.role.listing })}</dt>
            <dd className="text-body font-semibold tabular text-fg">{formatMoney(locale, split.listingSide)}</dd>
          </div>
          <div>
            <dt className="text-caption text-fg-muted">{format(labels.gets, { role: termsLabels.role.buyer })}</dt>
            <dd className="text-body font-semibold tabular text-fg">{formatMoney(locale, split.buyerSide)}</dd>
          </div>
        </dl>
      ) : fixed || gross ? (
        <p className="text-caption text-fg-muted">{labels.unavailable}</p>
      ) : null}
    </section>
  );
}
