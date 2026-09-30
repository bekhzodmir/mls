"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CircleCheck, ListChecks, Plus, Save, Search, Sparkles, TriangleAlert, UserPlus, X } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { intlLocale, type Locale } from "@/i18n/config";
import { format, plural } from "@/i18n/define-messages";
import domain from "@/i18n/messages/domain";
import editor from "@/i18n/messages/requirement-editor";
import { now } from "@/lib/clock";
import { cn } from "@/lib/cn";
import { districtName, districts as districtNames } from "@/lib/domain/geo";
import { findMatches } from "@/lib/domain/matching";
import { parseRequirementText } from "@/lib/domain/requirement-parser";
import {
  dealTypes,
  districtIds,
  propertyTypes,
  type BuildingKind,
  type Currency,
  type DealType,
  type RenovationState,
  type RequirementCriterion,
} from "@/lib/domain/types";
import { appHref, appPath } from "@/lib/routes";
import type { EditorCandidate } from "./editor-candidates";
import {
  CheckboxRow,
  FieldError,
  FieldHint,
  FieldLabel,
  SegmentedRadio,
  ToggleChip,
  inputClasses,
  textareaClasses,
} from "./form-controls";
import {
  CriterionHeader,
  HardSoftToggle,
  ParsedRow,
  RangeInputs,
  ResetButton,
  ResultItem,
  amountPreview,
  parsedValueText,
  type ParsedRowState,
} from "./requirement-editor-parts";
import {
  buildDraft,
  countResults,
  draftKeys,
  filledCriteria,
  formKeysOf,
  formValuesFromDraft,
  isAutoApplied,
  mergeFormValues,
  missingCriteria,
  parseAmount,
  suggestedCurrency,
  valuesFromDraftField,
  withDealType,
  type DraftKey,
  type FormKey,
  type RequirementFormValues,
} from "./requirement-form";
import { requirementSummary } from "./requirement-summary";

const RESULTS_SHOWN = 12;
const renovationStates: RenovationState[] = ["shell", "needs_repair", "renovated", "designer"];

export interface EditorOption {
  id: string;
  name: string;
}

export interface ActiveRequirementHint {
  id: string;
  summary: string;
}

/**
 * Requirement Editor (§14.4, §22.4, §35.4 steps 1–4, §36.3).
 *
 * The agent writes one sentence; `parseRequirementText` turns it into a
 * draft with confidence and evidence; confident values prefill the form and
 * weaker ones wait for "Apply". Every field stays editable, and a field the
 * agent touched is no longer overwritten by the sentence. Each criterion can
 * be a must-have or a preference. The pure matching engine runs on the
 * server-provided candidates on every change, so «Показать N вариантов»
 * reflects the current draft (§15.2). The currency is never guessed: the
 * search stays blocked until the agent picks it. Saving is demo-only.
 */
export function RequirementEditor({
  locale,
  candidates,
  initialText,
  agentId,
  organizationId,
  client,
  clientOptions,
  lead,
  activeRequirements,
}: {
  locale: Locale;
  candidates: EditorCandidate[];
  initialText: string;
  agentId: string;
  organizationId?: string;
  /** Preselected client from `?clientId=`. */
  client?: EditorOption;
  /** The viewer's clients for the "who is this for" select. */
  clientOptions: EditorOption[];
  lead?: { id: string; name?: string };
  /** Active requirements per client id, to warn before creating a second one. */
  activeRequirements: Record<string, ActiveRequirementHint>;
}) {
  const t = editor[locale];
  const d = domain[locale];
  const id = useId();
  const fieldsRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);

  const [text, setText] = useState(initialText);
  const deferredText = useDeferredValue(text);
  const draft = useMemo(() => parseRequirementText(deferredText), [deferredText]);
  const parsed = useMemo(() => formValuesFromDraft(draft), [draft]);
  const [overrides, setOverrides] = useState<Partial<RequirementFormValues>>({});
  const values = mergeFormValues(parsed, overrides);
  const [hard, setHard] = useState<RequirementCriterion[]>([]);
  const [includeTelegram, setIncludeTelegram] = useState(true);
  const [clientId, setClientId] = useState(client?.id ?? "");
  const [showResults, setShowResults] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "attempted" | "saved">("idle");
  const [extraDraft, setExtraDraft] = useState("");
  const [triedSearch, setTriedSearch] = useState(false);

  const at = now();
  const build = buildDraft(values, hard, {
    id: "draft",
    clientId: clientId || "draft",
    agentId,
    organizationId,
    text,
    nowIso: at.toISOString(),
  });
  const filled = filledCriteria(values);
  const missing = missingCriteria(values);
  const suggested = suggestedCurrency(draft);

  const byTarget = useMemo(() => new Map(candidates.map((item) => [item.candidate.target.id, item])), [candidates]);
  const pool = useMemo(
    () =>
      candidates
        .filter((item) => includeTelegram || item.candidate.target.kind === "listing")
        .map((item) => item.candidate),
    [candidates, includeTelegram],
  );
  const matches = build.base && build.dealType ? findMatches(withDealType(build.base, build.dealType), pool, at) : [];
  const counts = countResults(matches);
  const perDealType =
    build.base && !build.dealType
      ? Object.fromEntries(
          dealTypes.map((deal) => [deal, countResults(findMatches(withDealType(build.base!, deal), pool, at)).total]),
        )
      : undefined;
  const blocked = build.blockers.length > 0;
  const showDealError = triedSearch || saveState === "attempted";

  /* ------------------------------------------------------------ helpers */

  const set = <K extends FormKey>(key: K, value: RequirementFormValues[K]) =>
    setOverrides((current) => ({ ...current, [key]: value }));
  const reset = (keys: FormKey[]) =>
    setOverrides((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
  const isOverridden = (keys: FormKey[]) => keys.some((key) => key in overrides);
  const resetButton = (keys: FormKey[]) =>
    isOverridden(keys) ? <ResetButton locale={locale} onClick={() => reset(keys)} /> : null;
  const setHardFor = (criterion: RequirementCriterion, on: boolean) =>
    setHard((current) => (on ? [...new Set([...current, criterion])] : current.filter((item) => item !== criterion)));
  const hardToggle = (criterion: RequirementCriterion) =>
    filled.has(criterion) ? (
      <HardSoftToggle
        locale={locale}
        criterion={criterion}
        hard={hard.includes(criterion)}
        onChange={(on) => setHardFor(criterion, on)}
      />
    ) : null;
  const toggleIn = <T,>(items: T[], item: T, on: boolean): T[] =>
    on ? [...items.filter((value) => value !== item), item] : items.filter((value) => value !== item);

  function rowState(key: DraftKey): ParsedRowState {
    const keys = formKeysOf[key];
    const touched = keys.filter((formKey) => formKey in overrides);
    if (touched.length === 0) {
      if (!isAutoApplied(draft, key)) return "suggestion";
      return key === "budget" && !valuesFromDraftField(draft, key).currency ? "amount_only" : "applied";
    }
    const proposal = valuesFromDraftField(draft, key);
    const same = touched.every((formKey) => JSON.stringify(overrides[formKey]) === JSON.stringify(proposal[formKey]));
    return same ? "applied" : "overridden";
  }

  /** Moves focus to the first thing that blocks the search, instead of a silent disabled button. */
  function focusFirstBlocker() {
    const root = fieldsRef.current;
    if (!root) return;
    const selector = build.blockers.includes("deal_type")
      ? `input[name="${id}-deal"]`
      : build.blockers.includes("currency")
        ? `input[name="${id}-currency"]`
        : '[aria-invalid="true"]';
    root.querySelector<HTMLElement>(selector)?.focus();
  }

  function onSearch() {
    setTriedSearch(true);
    if (blocked) {
      focusFirstBlocker();
      return;
    }
    if (counts.total === 0) return;
    setShowResults((shown) => !shown);
    if (!showResults) requestAnimationFrame(() => resultsRef.current?.focus());
  }

  function addExtra() {
    const value = extraDraft.trim();
    if (!value) return;
    if (
      !values.extras.some(
        (extra) => extra.toLocaleLowerCase(intlLocale[locale]) === value.toLocaleLowerCase(intlLocale[locale]),
      )
    ) {
      set("extras", [...values.extras, value]);
    }
    setExtraDraft("");
  }

  const ctaLabel = blocked
    ? t.results.ctaBlocked
    : showResults
      ? t.results.hide
      : counts.total === 0
        ? t.results.ctaNone
        : format(plural(locale, counts.total, t.results.cta), { n: counts.total });
  const blockedText = build.blockers.includes("deal_type")
    ? t.results.blockedDealType
    : build.blockers.includes("currency")
      ? t.results.blockedCurrency
      : build.blockers.includes("invalid")
        ? t.results.blockedInvalid
        : undefined;
  const ctaHintId = `${id}-cta-hint`;

  const warnings = draft.warnings.filter((warning) => warning !== "empty_text" && warning !== "nothing_recognized");
  const parsedRows = draftKeys.flatMap((key) => {
    const value = parsedValueText(locale, draft, key);
    return value ? [{ key, value }] : [];
  });

  const saveClient =
    clientOptions.find((option) => option.id === clientId) ?? (client?.id === clientId ? client : undefined);
  const existing = clientId ? activeRequirements[clientId] : undefined;
  const saveErrors: string[] = [];
  if (!clientId) saveErrors.push(t.save.errorClient);
  if (blocked && blockedText) saveErrors.push(blockedText);

  /* --------------------------------------------------------- rendering */

  /**
   * The live result block in three places: the desktop aside (`aside`), an
   * inline copy for phones with the details and the Telegram switch
   * (`inline`), and the compact thumb-zone bar with the CTA (`bar`).
   */
  const summaryPanel = (variant: "aside" | "inline" | "bar"): ReactNode => {
    const compact = variant === "bar";
    const hintId = `${ctaHintId}-${variant}`;
    return (
      <div className={cn("space-y-3", compact && "space-y-2")}>
        {!compact ? <h2 className="text-small font-semibold text-fg-muted">{t.results.live}</h2> : null}
        {blocked ? (
          <p id={hintId} className="flex items-start gap-1.5 text-small font-medium text-warning-fg">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {blockedText}
          </p>
        ) : (
          <p
            className={cn("text-fg", compact ? "text-small" : "text-display")}
            aria-live={variant === "inline" ? undefined : "polite"}
          >
            {compact ? `${t.results.live}: ` : null}
            <span className="tabular font-bold">{counts.total}</span>
          </p>
        )}
        {!compact && !blocked ? (
          <div className="space-y-1 text-caption text-fg-muted">
            <p>{format(t.results.breakdown, { listings: counts.listings, telegram: counts.telegram })}</p>
            <p>
              {format(t.results.bands, { excellent: counts.excellent, good: counts.good, possible: counts.possible })}
            </p>
          </div>
        ) : null}
        {!compact && perDealType ? (
          <p className="text-caption text-fg-muted">
            {format(t.results.byDealType, { sale: perDealType.sale ?? 0, rent: perDealType.rent ?? 0 })}
          </p>
        ) : null}
        {!compact ? (
          <div className="space-y-1">
            <CheckboxRow checked={includeTelegram} onChange={setIncludeTelegram}>
              {t.results.includeTelegram}
            </CheckboxRow>
            <FieldHint>{t.results.telegramHint}</FieldHint>
          </div>
        ) : null}
        {variant !== "inline" ? (
          // A blocked CTA stays clickable: it moves focus to the field that needs an answer.
          <Button
            size={compact ? "md" : "lg"}
            className={cn("w-full", blocked && "opacity-60")}
            onClick={onSearch}
            aria-disabled={!blocked && counts.total === 0 && !showResults ? true : undefined}
            aria-describedby={blocked ? hintId : undefined}
            aria-expanded={blocked ? undefined : showResults}
          >
            <Search aria-hidden className="size-5" />
            {ctaLabel}
          </Button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          {/* 1. The sentence ------------------------------------------------ */}
          <section aria-labelledby={`${id}-text-label`} className="space-y-2">
            <FieldLabel htmlFor={`${id}-text`} className="text-body">
              <span id={`${id}-text-label`}>{t.text.label}</span>
            </FieldLabel>
            <textarea
              id={`${id}-text`}
              rows={3}
              value={text}
              placeholder={t.text.placeholder}
              aria-describedby={`${id}-text-hint`}
              onChange={(event) => setText(event.target.value)}
              className={textareaClasses}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldHint id={`${id}-text-hint`}>{t.text.hint}</FieldHint>
              {!text.trim() ? (
                <Button variant="ghost" onClick={() => setText(t.text.example)} className="h-11 px-2 text-small">
                  <Sparkles aria-hidden className="size-4" />
                  {t.text.useExample}
                </Button>
              ) : null}
            </div>
          </section>

          {/* 2. What the parser understood --------------------------------- */}
          <Card className="p-4">
            <h2 className="flex items-center gap-2 text-small font-semibold text-fg">
              <ListChecks aria-hidden className="size-4 text-primary" />
              {t.parsed.title}
            </h2>
            <div aria-live="polite" className="mt-2">
              {!deferredText.trim() ? (
                <p className="text-small text-fg-muted">{t.parsed.empty}</p>
              ) : parsedRows.length === 0 ? (
                <p className="text-small text-fg-muted">{t.parsed.nothing}</p>
              ) : (
                <ul>
                  {parsedRows.map(({ key, value }) => (
                    <ParsedRow
                      key={key}
                      locale={locale}
                      label={t.parsed.field[key]}
                      value={value}
                      field={draft[key]}
                      state={rowState(key)}
                      onApply={() => setOverrides((current) => ({ ...current, ...valuesFromDraftField(draft, key) }))}
                    />
                  ))}
                </ul>
              )}
              {warnings.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-1.5 text-caption font-medium text-warning-fg">
                      <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                      {t.parsed.warnings[warning]}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Card>

          {/* 3. Structured fields ------------------------------------------ */}
          <section aria-labelledby={`${id}-fields-title`} className="space-y-4">
            <div className="space-y-1">
              <h2 id={`${id}-fields-title`} className="text-h2 text-fg">
                {t.fields.title}
              </h2>
              <p className="text-small text-fg-muted">{t.fields.hint}</p>
              <p className="text-caption text-fg-muted">{t.hard.hint}</p>
            </div>

            <div
              ref={fieldsRef}
              className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card"
            >
              {/* Deal type */}
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <SegmentedRadio<DealType>
                    name={`${id}-deal`}
                    legend={t.fields.dealType}
                    value={values.dealType}
                    onChange={(value) => set("dealType", value)}
                    invalid={!values.dealType && showDealError}
                    describedBy={!values.dealType ? `${id}-deal-error` : undefined}
                    options={dealTypes.map((deal) => ({ value: deal, label: d.dealType[deal] }))}
                  />
                  {resetButton(["dealType"])}
                </div>
                {!values.dealType ? (
                  showDealError ? (
                    <FieldError id={`${id}-deal-error`}>{t.fields.dealTypeRequired}</FieldError>
                  ) : (
                    <FieldHint id={`${id}-deal-error`}>{t.fields.dealTypeRequired}</FieldHint>
                  )
                ) : null}
              </div>

              {/* Property types */}
              <fieldset className="space-y-2 p-4">
                <legend className="sr-only">{t.fields.propertyTypes}</legend>
                <CriterionHeader title={t.fields.propertyTypes} reset={resetButton(["propertyTypes"])} />
                <div className="flex flex-wrap gap-2">
                  {propertyTypes.map((type) => (
                    <ToggleChip
                      key={type}
                      checked={values.propertyTypes.includes(type)}
                      onChange={(on) => set("propertyTypes", toggleIn(values.propertyTypes, type, on))}
                    >
                      {d.propertyType[type]}
                    </ToggleChip>
                  ))}
                </div>
                <FieldHint>{t.fields.propertyTypesNote}</FieldHint>
              </fieldset>

              {/* Districts */}
              <fieldset className="space-y-2 p-4">
                <legend className="sr-only">{t.fields.districts}</legend>
                <CriterionHeader title={t.fields.districts} reset={resetButton(["districts"])}>
                  {hardToggle("location")}
                </CriterionHeader>
                <div className="flex flex-wrap gap-2">
                  {[...districtIds]
                    .sort((a, b) => districtName(a, locale).localeCompare(districtName(b, locale), intlLocale[locale]))
                    .map((district) => (
                      <ToggleChip
                        key={district}
                        checked={values.districts.includes(district)}
                        onChange={(on) => set("districts", toggleIn(values.districts, district, on))}
                        hint={districtNames[district][locale === "ru" ? "uz" : "ru"]}
                      >
                        {districtName(district, locale)}
                      </ToggleChip>
                    ))}
                </div>
                {values.districts.length === 0 ? <FieldHint>{t.fields.districtsHint}</FieldHint> : null}
              </fieldset>

              {/* Rooms */}
              <fieldset className="space-y-2 p-4">
                <legend className="sr-only">{t.fields.rooms}</legend>
                <CriterionHeader title={t.fields.rooms} reset={resetButton(["rooms"])}>
                  {hardToggle("rooms")}
                </CriterionHeader>
                <RangeInputs
                  idPrefix={`${id}-rooms`}
                  label={t.fields.rooms}
                  locale={locale}
                  min={values.rooms.min}
                  max={values.rooms.max}
                  onChange={(next) => set("rooms", next)}
                  error={build.errors.rooms}
                />
              </fieldset>

              {/* Area */}
              <fieldset className="space-y-2 p-4">
                <legend className="sr-only">{t.fields.area}</legend>
                <CriterionHeader title={t.fields.area} reset={resetButton(["area"])}>
                  {hardToggle("area")}
                </CriterionHeader>
                <RangeInputs
                  idPrefix={`${id}-area`}
                  label={t.fields.area}
                  locale={locale}
                  min={values.area.min}
                  max={values.area.max}
                  onChange={(next) => set("area", next)}
                  error={build.errors.area}
                  inputMode="decimal"
                />
              </fieldset>

              {/* Budget */}
              <fieldset className="space-y-3 p-4">
                <legend className="sr-only">{t.fields.budget}</legend>
                <CriterionHeader title={t.fields.budget} reset={resetButton(["budgetMin", "budgetMax", "currency"])}>
                  {hardToggle("price")}
                </CriterionHeader>
                <RangeInputs
                  idPrefix={`${id}-budget`}
                  label={t.fields.budget}
                  locale={locale}
                  min={values.budgetMin}
                  max={values.budgetMax}
                  onChange={(next) => {
                    if (next.min !== values.budgetMin) set("budgetMin", next.min);
                    if (next.max !== values.budgetMax) set("budgetMax", next.max);
                  }}
                  error={build.errors.budget}
                  numberMessage={t.fields.amountError}
                  inputMode="decimal"
                />
                {(() => {
                  const min = parseAmount(values.budgetMin);
                  const max = parseAmount(values.budgetMax);
                  const preview = [
                    min.ok ? amountPreview(locale, min.value, values.currency) : undefined,
                    max.ok ? amountPreview(locale, max.value, values.currency) : undefined,
                  ].filter(Boolean);
                  return preview.length > 0 ? (
                    <p className="text-caption text-fg-muted tabular">= {preview.join(" – ")}</p>
                  ) : (
                    <FieldHint>{t.fields.budgetHint}</FieldHint>
                  );
                })()}
                <SegmentedRadio<Currency>
                  name={`${id}-currency`}
                  legend={t.fields.currency}
                  value={values.currency}
                  onChange={(value) => set("currency", value)}
                  invalid={build.blockers.includes("currency")}
                  describedBy={build.blockers.includes("currency") ? `${id}-currency-error` : undefined}
                  options={[
                    { value: "USD", label: t.fields.currencyNames.USD },
                    { value: "UZS", label: t.fields.currencyNames.UZS },
                  ]}
                />
                {build.blockers.includes("currency") ? (
                  <div id={`${id}-currency-error`} className="space-y-2">
                    <FieldError>{t.fields.currencyRequired}</FieldError>
                    {suggested ? (
                      <div className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
                        <span>
                          {format(t.fields.currencySuggested, { currency: t.fields.currencyShort[suggested] })}
                        </span>
                        <Button variant="soft" className="h-11" onClick={() => set("currency", suggested)}>
                          {format(t.fields.confirmSuggested, { currency: t.fields.currencyShort[suggested] })}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </fieldset>

              {/* Floor */}
              <fieldset className="space-y-2 p-4">
                <legend className="sr-only">{t.fields.floor}</legend>
                <CriterionHeader title={t.fields.floor} reset={resetButton(["floor"])}>
                  {hardToggle("floor")}
                </CriterionHeader>
                <div className="flex flex-wrap gap-x-6">
                  <CheckboxRow
                    checked={values.floor.notFirst}
                    onChange={(on) => set("floor", { ...values.floor, notFirst: on })}
                  >
                    {t.fields.notFirst}
                  </CheckboxRow>
                  <CheckboxRow
                    checked={values.floor.notLast}
                    onChange={(on) => set("floor", { ...values.floor, notLast: on })}
                  >
                    {t.fields.notLast}
                  </CheckboxRow>
                </div>
                <RangeInputs
                  idPrefix={`${id}-floor`}
                  label={t.fields.floor}
                  locale={locale}
                  min={values.floor.min}
                  max={values.floor.max}
                  onChange={(next) => set("floor", { ...values.floor, ...next })}
                  error={build.errors.floor}
                />
              </fieldset>

              {/* Building kind */}
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <SegmentedRadio<BuildingKind | "any">
                    name={`${id}-building`}
                    legend={t.fields.buildingKind}
                    value={values.buildingKind ?? "any"}
                    onChange={(value) => set("buildingKind", value === "any" ? undefined : value)}
                    options={[
                      { value: "any", label: t.fields.any },
                      { value: "new_building", label: d.buildingKind.new_building },
                      { value: "secondary", label: d.buildingKind.secondary },
                    ]}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {resetButton(["buildingKind"])}
                    {hardToggle("building_kind")}
                  </div>
                </div>
              </div>

              {/* Renovation */}
              <fieldset className="space-y-2 p-4">
                <legend className="sr-only">{t.fields.renovation}</legend>
                <CriterionHeader title={t.fields.renovation} reset={resetButton(["renovation"])}>
                  {hardToggle("renovation")}
                </CriterionHeader>
                <div className="flex flex-wrap gap-2">
                  {renovationStates.map((state) => (
                    <ToggleChip
                      key={state}
                      checked={values.renovation.includes(state)}
                      onChange={(on) => set("renovation", toggleIn(values.renovation, state, on))}
                    >
                      {d.renovation[state]}
                    </ToggleChip>
                  ))}
                </div>
                {values.renovation.length === 0 ? <FieldHint>{t.fields.renovationHint}</FieldHint> : null}
              </fieldset>

              {/* Mortgage */}
              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <SegmentedRadio<"unknown" | "yes" | "no">
                    name={`${id}-mortgage`}
                    legend={t.fields.mortgage}
                    value={values.mortgage === undefined ? "unknown" : values.mortgage ? "yes" : "no"}
                    onChange={(value) => set("mortgage", value === "unknown" ? undefined : value === "yes")}
                    options={[
                      { value: "unknown", label: t.fields.mortgageUnknown },
                      { value: "yes", label: t.fields.mortgageYes },
                      { value: "no", label: t.fields.mortgageNo },
                    ]}
                  />
                  {resetButton(["mortgage"])}
                </div>
                <FieldHint>{t.fields.mortgageHint}</FieldHint>
              </div>

              {/* Extras */}
              <fieldset className="space-y-2 p-4">
                <legend className="sr-only">{t.fields.extras}</legend>
                <CriterionHeader title={t.fields.extras} htmlFor={`${id}-extra`} reset={resetButton(["extras"])} />
                {values.extras.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {values.extras.map((extra) => (
                      <li key={extra}>
                        <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-primary bg-primary-soft py-1 pr-1 pl-3.5 text-small font-medium text-primary-soft-fg">
                          {extra}
                          <button
                            type="button"
                            onClick={() =>
                              set(
                                "extras",
                                values.extras.filter((value) => value !== extra),
                              )
                            }
                            className="inline-flex size-9 items-center justify-center rounded-full hover:bg-surface/60"
                            aria-label={format(t.fields.removeExtra, { text: extra })}
                          >
                            <X aria-hidden className="size-4" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex gap-2">
                  <input
                    id={`${id}-extra`}
                    value={extraDraft}
                    placeholder={t.fields.extrasPlaceholder}
                    aria-describedby={`${id}-extra-hint`}
                    onChange={(event) => setExtraDraft(event.target.value)}
                    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addExtra();
                      }
                    }}
                    className={inputClasses}
                  />
                  <Button variant="secondary" onClick={addExtra}>
                    <Plus aria-hidden className="size-4" />
                    {t.fields.extrasAdd}
                  </Button>
                </div>
                <FieldHint id={`${id}-extra-hint`}>{t.fields.extrasHint}</FieldHint>
              </fieldset>
            </div>
          </section>

          <Card className="p-4 lg:hidden">{summaryPanel("inline")}</Card>

          {/* 4. Search quality hints (never blocking) ------------------------- */}
          {missing.length > 0 ? (
            <Notice kind="info" title={t.quality.title}>
              {format(t.quality.text, {
                list: new Intl.ListFormat(intlLocale[locale], { type: "conjunction" }).format(
                  missing.map((criterion) => domain[locale].requirementCriterion[criterion]),
                ),
              })}
            </Notice>
          ) : (
            <p className="flex items-center gap-1.5 text-small text-success-fg">
              <CircleCheck aria-hidden className="size-4" />
              {t.quality.complete}
            </p>
          )}

          {/* 5. Live results ------------------------------------------------ */}
          {showResults && !blocked ? (
            <section aria-labelledby={`${id}-results`} className="space-y-3">
              <h2 id={`${id}-results`} ref={resultsRef} tabIndex={-1} className="text-h2 text-fg">
                {t.results.title}
              </h2>
              {matches.length > 0 ? (
                <>
                  <ul className="space-y-3">
                    {matches.slice(0, RESULTS_SHOWN).map((match) => (
                      <li key={match.candidate.target.id}>
                        <ResultItem locale={locale} match={match} item={byTarget.get(match.candidate.target.id)} />
                      </li>
                    ))}
                  </ul>
                  {matches.length > RESULTS_SHOWN ? (
                    <p className="text-caption text-fg-muted">
                      {format(t.results.shown, { shown: RESULTS_SHOWN, total: matches.length })}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="rounded-lg border border-dashed border-border-strong p-4 text-small text-fg-muted">
                  {t.results.empty}
                </p>
              )}
            </section>
          ) : null}

          {/* 6. Save (demo) ------------------------------------------------- */}
          <section
            aria-labelledby={`${id}-save-title`}
            className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card"
          >
            <h2 id={`${id}-save-title`} className="sr-only">
              {t.save.submit}
            </h2>
            {saveState === "saved" && build.base && build.dealType ? (
              <div role="status" className="space-y-3">
                <Notice kind="info" title={t.save.savedTitle}>
                  <p>{t.save.saved}</p>
                </Notice>
                <div className="space-y-1 text-small text-fg">
                  {saveClient ? <p className="font-semibold">{saveClient.name}</p> : null}
                  <p>{requirementSummary(locale, withDealType(build.base, build.dealType))}</p>
                  <p className="text-fg-muted">
                    {build.base.naturalLanguageInput
                      ? format(t.save.verbatim, { text: build.base.naturalLanguageInput })
                      : t.save.noVerbatim}
                  </p>
                  <p className="text-fg-muted">
                    {build.hardCriteria.length > 0
                      ? format(t.save.hardList, {
                          list: new Intl.ListFormat(intlLocale[locale], { type: "conjunction" }).format(
                            build.hardCriteria.map((criterion) => domain[locale].requirementCriterion[criterion]),
                          ),
                        })
                      : t.save.noHard}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {clientId ? (
                    <Link
                      href={appPath(locale, `/clients/${encodeURIComponent(clientId)}`)}
                      className={buttonClasses("primary")}
                    >
                      {t.save.openClient}
                    </Link>
                  ) : null}
                  <Link href={appHref(locale, "clients")} className={buttonClasses("secondary")}>
                    {t.save.toClients}
                  </Link>
                  <Button variant="ghost" onClick={() => setSaveState("idle")}>
                    {t.save.edit}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {client ? (
                  <p className="text-small text-fg">
                    {t.context.client}:{" "}
                    <Link
                      href={appPath(locale, `/clients/${encodeURIComponent(client.id)}`)}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {client.name}
                    </Link>
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={`${id}-client`}>{t.context.client}</FieldLabel>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        id={`${id}-client`}
                        value={clientId}
                        aria-invalid={saveState === "attempted" && !clientId ? true : undefined}
                        aria-describedby={`${id}-client-hint`}
                        onChange={(event) => setClientId(event.target.value)}
                        className={inputClasses}
                      >
                        <option value="">{t.context.clientPlaceholder}</option>
                        {clientOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                      <Link
                        href={
                          lead
                            ? `${appHref(locale, "clientsNew")}?leadId=${encodeURIComponent(lead.id)}`
                            : appHref(locale, "clientsNew")
                        }
                        className={buttonClasses("secondary")}
                      >
                        <UserPlus aria-hidden className="size-4" />
                        {t.context.newClient}
                      </Link>
                    </div>
                    <FieldHint id={`${id}-client-hint`}>{lead ? t.context.leadClient : t.context.clientHint}</FieldHint>
                  </div>
                )}

                {existing ? (
                  <Notice
                    kind="warning"
                    action={
                      <Link
                        href={appPath(locale, `/requirements/${encodeURIComponent(existing.id)}`)}
                        className="font-semibold underline underline-offset-2"
                      >
                        {t.context.openExisting}
                      </Link>
                    }
                  >
                    {format(t.context.existing, { summary: existing.summary })}
                  </Notice>
                ) : null}

                {saveState === "attempted" && saveErrors.length > 0 ? (
                  <div role="alert" className="space-y-1">
                    {saveErrors.map((error) => (
                      <FieldError key={error}>{error}</FieldError>
                    ))}
                  </div>
                ) : null}

                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    if (saveErrors.length > 0 || !build.base || !build.dealType) {
                      setSaveState("attempted");
                      if (blocked) focusFirstBlocker();
                      return;
                    }
                    setSaveState("saved");
                  }}
                >
                  <Save aria-hidden className="size-5" />
                  {t.save.submit}
                </Button>
              </>
            )}
          </section>
        </div>

        <aside aria-label={t.stickyLabel} className="hidden lg:sticky lg:top-6 lg:block">
          <Card className="p-4">{summaryPanel("aside")}</Card>
        </aside>
      </div>

      {/* Phone: the count and the CTA stay in the thumb zone (§15.2, §20.2). */}
      <div
        role="region"
        aria-label={t.stickyLabel}
        data-sticky-actions
        className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      >
        <div className="mx-auto max-w-3xl py-2 px-4">{summaryPanel("bar")}</div>
      </div>
      <div aria-hidden className="h-28 lg:hidden" />
    </div>
  );
}
