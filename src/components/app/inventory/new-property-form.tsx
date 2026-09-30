"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleAlert, CopyCheck, FileSearch, ImageIcon, Lock, Plus, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import type properties from "@/i18n/messages/properties";
import { formatMoney } from "@/lib/domain/money";
import {
  currencies,
  type Currency,
  type DealType,
  type DedupConflict,
  type DistrictId,
  type DuplicateSignal,
  type PropertyType,
} from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import {
  checkDuplicates,
  draftDedupRecord,
  fieldsFor,
  validateNewProperty,
  type DuplicateMatch,
  type DuplicatePoolEntry,
  type FieldError,
  type FormField,
  type NewPropertyDraft,
  type NewPropertyValues,
  type PrefillField,
  type TelegramPrefill,
} from "./new-property";

type Labels = (typeof properties)["ru"]["new"];

export interface NewPropertyFormProps {
  locale: Locale;
  labels: Labels;
  /** "Ограниченный доступ" marker text. */
  restrictedLabel: string;
  options: {
    propertyTypes: { value: PropertyType; label: string }[];
    dealTypes: { value: DealType; label: string }[];
    districts: { value: DistrictId; label: string }[];
    signals: Record<DuplicateSignal, string>;
    conflicts: Record<DedupConflict, string>;
  };
  initialValues: NewPropertyValues;
  prefill?: Pick<TelegramPrefill, "postId" | "marks" | "dedup">;
  pool: DuplicatePoolEntry[];
  /** `/{locale}/app`, for links to existing records. */
  appBase: string;
}

type Stage =
  | { kind: "edit" }
  | { kind: "check"; draft: NewPropertyDraft; matches: DuplicateMatch[] }
  | { kind: "done"; result: "created" | "listing" | "linked"; id?: string };

const fieldClasses =
  "h-11 w-full rounded-md border bg-surface px-3 text-small text-fg placeholder:text-fg-subtle aria-[invalid=true]:border-danger-border";

/** Error field order, as the fields appear on screen. */
const errorOrder: FormField[] = [
  "propertyType",
  "dealType",
  "district",
  "price",
  "currency",
  "rooms",
  "areaTotal",
  "floor",
  "floorsTotal",
];

const prefillKey: Partial<Record<FormField, PrefillField>> = {
  propertyType: "propertyType",
  dealType: "dealType",
  district: "district",
  price: "price",
  currency: "price",
  rooms: "rooms",
  areaTotal: "areaTotal",
  floor: "floor",
  floorsTotal: "floorsTotal",
};

/**
 * "New property" (§20.3, §22.5, §34.5): step one only, then a Duplicate Check
 * before anything would be created. Candidates are suggestions with their
 * signals; the agent chooses — add an offer to the existing object, link a
 * Telegram ad, open the existing record, or create a new object. Nothing is
 * merged automatically and, in the demo, nothing is saved (it says so).
 */
export function NewPropertyForm({ locale, labels, restrictedLabel, options, initialValues, prefill, pool, appBase }: NewPropertyFormProps) {
  const [values, setValues] = useState<NewPropertyValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<FormField, FieldError>>>({});
  const [edited, setEdited] = useState<Set<PrefillField>>(() => new Set());
  const [stage, setStage] = useState<Stage>({ kind: "edit" });
  const summaryRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [focusSummary, setFocusSummary] = useState(0);
  const id = useId();
  const shown = fieldsFor(values.propertyType);

  useEffect(() => {
    if (focusSummary > 0) summaryRef.current?.focus();
  }, [focusSummary]);

  useEffect(() => {
    if (stage.kind !== "edit") stageRef.current?.focus();
  }, [stage]);

  function set<K extends keyof NewPropertyValues>(key: K, value: NewPropertyValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    const origin = prefillKey[key as FormField];
    if (origin) setEdited((current) => new Set(current).add(origin));
    if (errors[key as FormField]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key as FormField];
        return next;
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateNewProperty(values);
    if (!result.ok) {
      setErrors(result.errors);
      setFocusSummary((n) => n + 1);
      return;
    }
    setErrors({});
    const target = draftDedupRecord(result.draft, prefill?.dedup);
    const matches = checkDuplicates(target, pool, prefill ? [prefill.postId] : []);
    setStage({ kind: "check", draft: result.draft, matches });
  }

  const fieldId = (field: string) => `${id}-${field}`;
  const errorText = (field: FormField): string | undefined => {
    const error = errors[field];
    if (!error) return undefined;
    if (field === "currency") return labels.errors.currency;
    return labels.errors[error];
  };

  // Render helpers are plain functions, not components: inputs keep their identity (and focus) across renders.
  function prefillMark(field: PrefillField): ReactNode {
    const mark = prefill?.marks[field];
    if (!mark || edited.has(field)) return null;
    const percent = Math.round(mark.confidence * 100);
    const title = mark.evidence
      ? format(labels.fromTelegram.badgeTitle, { evidence: mark.evidence, percent })
      : format(labels.fromTelegram.badgeTitleNoEvidence, { percent });
    return (
      <Badge tone="info" icon={Sparkles} title={title} className="ml-2 align-middle">
        {labels.fromTelegram.badge}
        <span className="sr-only">. {title}</span>
      </Badge>
    );
  }

  function label(htmlFor: string, children: ReactNode, options: { field?: PrefillField; optional?: boolean } = {}): ReactNode {
    return (
      <label htmlFor={htmlFor} className="block text-small font-medium text-fg">
        {children}
        {options.optional ? <span className="ml-1 font-normal text-fg-muted">({labels.field.optional})</span> : null}
        {options.field ? prefillMark(options.field) : null}
      </label>
    );
  }

  function errorLine(field: FormField): ReactNode {
    const text = errorText(field);
    if (!text) return null;
    return (
      <p id={fieldId(`${field}-error`)} className="flex items-start gap-1 text-caption text-danger-fg">
        <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {text}
      </p>
    );
  }

  const describedBy = (field: FormField, hint?: string) =>
    [errors[field] ? fieldId(`${field}-error`) : undefined, hint].filter(Boolean).join(" ") || undefined;

  function choice<T extends string>(
    field: FormField,
    legend: string,
    items: { value: T; label: string }[],
    value: T | undefined,
    onChange: (value: T) => void,
  ): ReactNode {
    const key = prefillKey[field];
    return (
      <fieldset aria-describedby={describedBy(field)} aria-invalid={errors[field] ? true : undefined} className="space-y-2">
        <legend className="text-small font-medium text-fg">
          {legend}
          {key ? prefillMark(key) : null}
        </legend>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <label
              key={item.value}
              className={cn(
                "inline-flex h-11 cursor-pointer items-center rounded-full border px-4 text-small font-medium transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                value === item.value
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-surface text-fg hover:bg-surface-muted",
              )}
            >
              <input
                type="radio"
                name={field}
                value={item.value}
                checked={value === item.value}
                onChange={() => onChange(item.value)}
                className="sr-only"
              />
              {item.label}
            </label>
          ))}
        </div>
        {errorLine(field)}
      </fieldset>
    );
  }

  function numberField(
    field: "rooms" | "areaTotal" | "floor" | "floorsTotal",
    text: string,
    inputMode: "numeric" | "decimal",
  ): ReactNode {
    return (
      <div className="space-y-1">
        {label(fieldId(field), text, { field, optional: true })}
        <input
          id={fieldId(field)}
          inputMode={inputMode}
          autoComplete="off"
          value={values[field]}
          onChange={(event) => set(field, event.target.value)}
          aria-invalid={errors[field] ? true : undefined}
          aria-describedby={describedBy(field)}
          className={cn(fieldClasses, "tabular border-border")}
        />
        {errorLine(field)}
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;

  if (stage.kind === "done") {
    const title =
      stage.result === "listing"
        ? labels.result.listingTitle
        : stage.result === "linked"
          ? labels.result.linkedTitle
          : labels.result.createdTitle;
    const text =
      stage.result === "listing"
        ? format(labels.result.listingText, { id: stage.id ?? "" })
        : stage.result === "linked"
          ? format(labels.result.linkedText, { id: stage.id ?? "" })
          : labels.result.createdText;
    return (
      <div ref={stageRef} tabIndex={-1} role="status" className="space-y-4 outline-none">
        <Notice kind="info" title={title}>
          {text}
        </Notice>
        <Card className="space-y-2 p-4">
          <h2 className="text-h2 text-fg">{labels.result.next}</h2>
          <ul className="list-disc space-y-1 pl-5 text-small text-fg">
            {Object.entries(labels.result.nextItems).map(([key, item]) => (
              <li key={key}>{item}</li>
            ))}
          </ul>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setStage({ kind: "edit" })}>
            {labels.result.back}
          </Button>
          <ButtonLink href={`${appBase}/properties`} variant="ghost">
            {labels.result.toList}
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (stage.kind === "check") {
    const { matches, draft } = stage;
    return (
      <div ref={stageRef} tabIndex={-1} className="space-y-4 outline-none" aria-labelledby={`${id}-dup-title`} role="region">
        <Card className="space-y-3 p-4">
          <h2 id={`${id}-dup-title`} className="flex items-center gap-2 text-h2 text-fg">
            <FileSearch aria-hidden className="size-5 text-fg-muted" />
            {labels.duplicates.title}
          </h2>
          <p className="text-small text-fg-muted">{labels.duplicates.intro}</p>
          <p role="status" className="text-small font-semibold text-fg">
            {matches.length === 0
              ? labels.duplicates.none
              : format(plural(locale, matches.length, labels.duplicates.found), { n: matches.length })}
          </p>
          <p className="text-caption text-fg-muted">
            {[
              options.propertyTypes.find((item) => item.value === draft.propertyType)?.label,
              options.districts.find((item) => item.value === draft.district)?.label,
              formatMoney(locale, draft.price),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Card>

        {matches.length > 0 ? (
          <ul className="space-y-3">
            {matches.map(({ entry, candidate }) => (
              <li key={entry.id}>
                <Card className="space-y-2 p-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge icon={entry.kind === "telegram" ? Send : undefined} tone={entry.kind === "telegram" ? "info" : "neutral"}>
                      {entry.kind === "telegram" ? labels.duplicates.telegram : labels.duplicates.listing}
                    </Badge>
                    {candidate.recommendation === "likely_duplicate" ? (
                      <Badge tone="warning" icon={CopyCheck}>
                        {labels.duplicates.likely}
                      </Badge>
                    ) : (
                      <Badge icon={FileSearch}>{labels.duplicates.review}</Badge>
                    )}
                  </div>
                  <h3 className="text-small font-semibold text-fg">{entry.title}</h3>
                  <p className="text-caption text-fg-muted">
                    {[entry.place, entry.price ? formatMoney(locale, entry.price) : undefined, entry.by]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-small text-fg">
                    {format(labels.duplicates.signals, {
                      list: candidate.signals.map((signal) => options.signals[signal]).join(", "),
                    })}
                  </p>
                  {candidate.conflicts.length > 0 ? (
                    <p className="text-small text-warning-fg">
                      {format(labels.duplicates.conflicts, {
                        list: candidate.conflicts.map((conflict) => options.conflicts[conflict]).join(", "),
                      })}
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
                    <Button
                      variant="soft"
                      onClick={() =>
                        setStage(
                          entry.kind === "listing"
                            ? { kind: "done", result: "listing", id: entry.propertyId ?? entry.id }
                            : { kind: "done", result: "linked", id: entry.id },
                        )
                      }
                    >
                      {entry.kind === "listing" ? labels.duplicates.sameProperty : labels.duplicates.sameAd}
                    </Button>
                    <ButtonLink href={`${appBase}${entry.path}`} variant="secondary">
                      {entry.kind === "listing" ? labels.duplicates.openExisting : labels.duplicates.openPost}
                    </ButtonLink>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        <Card className="space-y-2 p-4">
          <p className="text-small text-fg-muted">{labels.duplicates.createNewHint}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => setStage({ kind: "done", result: "created" })}>
              <Plus aria-hidden className="size-4" />
              {labels.duplicates.createNew}
            </Button>
            <Button variant="ghost" onClick={() => setStage({ kind: "edit" })}>
              {labels.duplicates.edit}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      {errorCount > 0 ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="outline-none">
          <Notice kind="danger" title={format(plural(locale, errorCount, labels.errors.summary), { n: errorCount })}>
            <ul className="list-disc space-y-0.5 pl-5">
              {errorOrder
                .filter((field) => errors[field])
                .map((field) => (
                  <li key={field}>
                    <a href={`#${fieldId(field)}`} className="underline underline-offset-2">
                      {field === "areaTotal" ? labels.field.area : labels.field[field]}
                    </a>
                    : {errorText(field)}
                  </li>
                ))}
            </ul>
          </Notice>
        </div>
      ) : null}

      <Card className="space-y-4 p-4">
        <h2 className="text-h2 text-fg">{labels.section.basics}</h2>
        <div id={fieldId("propertyType")} tabIndex={-1} className="outline-none">
          {choice("propertyType", labels.field.propertyType, options.propertyTypes, values.propertyType, (value) =>
            set("propertyType", value),
          )}
        </div>
        <div id={fieldId("dealType")} tabIndex={-1} className="outline-none">
          {choice("dealType", labels.field.dealType, options.dealTypes, values.dealType, (value) => set("dealType", value))}
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="text-h2 text-fg">{labels.section.location}</h2>
        <div className="space-y-1">
          {label(fieldId("district"), labels.field.district, { field: "district" })}
          <select
            id={fieldId("district")}
            value={values.district ?? ""}
            onChange={(event) => set("district", (event.target.value || undefined) as DistrictId | undefined)}
            aria-invalid={errors.district ? true : undefined}
            aria-describedby={describedBy("district")}
            className={cn(fieldClasses, "border-border")}
          >
            <option value="">{labels.field.chooseDistrict}</option>
            {options.districts.map((district) => (
              <option key={district.value} value={district.value}>
                {district.label}
              </option>
            ))}
          </select>
          {errorLine("district")}
        </div>
        <div className="space-y-1">
          {label(fieldId("areaName"), labels.field.areaName, { optional: true })}
          <input
            id={fieldId("areaName")}
            value={values.areaName}
            onChange={(event) => set("areaName", event.target.value)}
            aria-describedby={fieldId("areaName-hint")}
            autoComplete="off"
            className={cn(fieldClasses, "border-border")}
          />
          <p id={fieldId("areaName-hint")} className="text-caption text-fg-muted">
            {labels.field.areaNameHint}
          </p>
        </div>
        <div className="space-y-1">
          {label(
            fieldId("address"),
            <>
              {labels.field.address}
              <Badge icon={Lock} className="ml-2 align-middle">
                {restrictedLabel}
              </Badge>
            </>,
            { optional: true },
          )}
          <input
            id={fieldId("address")}
            value={values.address}
            onChange={(event) => set("address", event.target.value)}
            aria-describedby={fieldId("address-hint")}
            autoComplete="off"
            className={cn(fieldClasses, "border-border")}
          />
          <p id={fieldId("address-hint")} className="text-caption text-fg-muted">
            {labels.field.addressHint}
          </p>
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="text-h2 text-fg">{labels.section.price}</h2>
        <div className="space-y-1">
          {label(fieldId("price"), labels.field.price, { field: "price" })}
          <input
            id={fieldId("price")}
            inputMode="decimal"
            autoComplete="off"
            value={values.price}
            onChange={(event) => set("price", event.target.value)}
            aria-invalid={errors.price ? true : undefined}
            aria-describedby={describedBy("price", fieldId("price-hint"))}
            className={cn(fieldClasses, "tabular border-border")}
          />
          <p id={fieldId("price-hint")} className="text-caption text-fg-muted">
            {labels.field.priceHint}
          </p>
          {errorLine("price")}
        </div>
        <div id={fieldId("currency")} tabIndex={-1} className="outline-none">
          {choice<Currency>(
            "currency",
            labels.field.currency,
            currencies.map((currency) => ({ value: currency, label: currency })),
            values.currency,
            (value) => set("currency", value),
          )}
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="text-h2 text-fg">{labels.section.attributes}</h2>
        <div className="grid grid-cols-2 gap-3">
          {shown.rooms ? numberField("rooms", labels.field.rooms, "numeric") : null}
          {numberField("areaTotal", labels.field.area, "decimal")}
          {shown.floor ? numberField("floor", labels.field.floor, "numeric") : null}
          {shown.floorsTotal ? numberField("floorsTotal", labels.field.floorsTotal, "numeric") : null}
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="text-h2 text-fg">{labels.section.photos}</h2>
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border-strong p-4 text-small text-fg-muted">
          <ImageIcon aria-hidden className="size-6 shrink-0" />
          <p>{labels.photos}</p>
        </div>
      </Card>

      <div className="space-y-2">
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          <FileSearch aria-hidden className="size-5" />
          {labels.check}
        </Button>
        <p className="text-caption text-fg-muted">{labels.demo}</p>
      </div>
    </form>
  );
}
