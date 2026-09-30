"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "@/i18n/define-messages";
import type mls from "@/i18n/messages/mls";
import { cn } from "@/lib/cn";
import { advancedCount, matchesMls, mlsHref, parseMlsParams, type MlsFacet, type MlsParams } from "./mls-params";
import { inputClasses } from "@/components/ui/field";

type FilterLabels = (typeof mls)["ru"]["filters"];

export interface Option {
  value: string;
  label: string;
}

export interface MlsFilterOptions {
  dealType: Option[];
  propertyType: Option[];
  district: Option[];
  rooms: Option[];
  currency: Option[];
  renovation: Option[];
  building: Option[];
  updated: Option[];
  agency: Option[];
  source: Option[];
}

/** Form state mirrors the query string: every field is a string, parsed by the same function as the server. */
function toValues(params: MlsParams): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === false) continue;
    values[key] = value === true ? "1" : String(value);
  }
  return values;
}

/**
 * MLS search form (§15.2): quick filters up front, the rest under
 * "Расширенные фильтры", and a primary button that says how many listings
 * it will show ("Показать 12") — counted in the browser with the exact
 * predicate the server uses. Without JavaScript it is a plain GET form.
 */
export function MlsFilterForm({
  locale,
  params,
  facets,
  nowIso,
  labels,
  options,
}: {
  locale: string;
  params: MlsParams;
  /** The tab's listings before structured filters (text search already applied). */
  facets: MlsFacet[];
  nowIso: string;
  labels: FilterLabels;
  options: MlsFilterOptions;
}) {
  const router = useRouter();
  const baseId = useId();
  const [values, setValues] = useState<Record<string, string>>(() => toValues(params));
  const draft = parseMlsParams(values);
  const at = new Date(nowIso);
  const count = facets.filter((facet) => matchesMls(facet, draft, at)).length;
  // Text search runs on the server (it knows which restricted fields the viewer may search).
  const pendingText = (values.q ?? "").trim() !== (params.q ?? "");
  const extra = advancedCount(draft);
  const action = mlsHref(locale);

  const set = (key: string) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const id = (key: string) => `${baseId}-${key}`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(mlsHref(locale, parseMlsParams(values)));
  }

  return (
    <form method="get" action={action} onSubmit={onSubmit} aria-label={labels.label} className="space-y-4">
      <input type="hidden" name="tab" value={params.tab} />

      <div className="space-y-1">
        <label htmlFor={id("q")} className="text-caption font-medium text-fg-muted">
          {labels.search}
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-3.5 left-3 size-4 text-fg-subtle" />
          <input
            id={id("q")}
            name="q"
            type="search"
            value={values.q ?? ""}
            onChange={(event) => set("q")(event.target.value)}
            placeholder={labels.searchPlaceholder}
            className={cn(inputClasses, "pl-9")}
          />
        </div>
      </div>

      <ChipGroup
        legend={labels.deal}
        name="dealType"
        anyLabel={labels.dealAny}
        options={options.dealType}
        value={values.dealType ?? ""}
        onChange={set("dealType")}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id={id("propertyType")}
          name="propertyType"
          label={labels.type}
          anyLabel={labels.typeAny}
          options={options.propertyType}
          value={values.propertyType ?? ""}
          onChange={set("propertyType")}
        />
        <SelectField
          id={id("district")}
          name="district"
          label={labels.district}
          anyLabel={labels.districtAny}
          options={options.district}
          value={values.district ?? ""}
          onChange={set("district")}
        />
      </div>

      <ChipGroup
        legend={labels.rooms}
        name="rooms"
        anyLabel={labels.roomsAny}
        options={options.rooms}
        value={values.rooms ?? ""}
        onChange={set("rooms")}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <NumberField
          id={id("priceMax")}
          name="priceMax"
          label={labels.priceMax}
          value={values.priceMax ?? ""}
          onChange={set("priceMax")}
        />
        <div className="space-y-1">
          <label htmlFor={id("currency")} className="text-caption font-medium text-fg-muted">
            {labels.currency}
          </label>
          <select
            id={id("currency")}
            name="currency"
            value={values.currency ?? "USD"}
            onChange={(event) => set("currency")(event.target.value)}
            className={inputClasses}
          >
            {options.currency.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-caption text-fg-muted">{labels.currencyNote}</p>

      {/* Opens when the applied URL already uses advanced filters; editing never collapses it. */}
      <details
        className="group rounded-lg border border-border bg-surface"
        open={advancedCount(params) > 0 ? true : undefined}
      >
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-small font-semibold text-fg">
          <SlidersHorizontal aria-hidden className="size-4 text-fg-muted" />
          {labels.advanced}
          {extra > 0 ? (
            <span className="font-normal text-fg-muted">· {format(labels.advancedCount, { n: extra })}</span>
          ) : null}
        </summary>
        <div className="space-y-4 border-t border-border p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField
              id={id("areaMin")}
              name="areaMin"
              label={labels.areaMin}
              value={values.areaMin ?? ""}
              onChange={set("areaMin")}
            />
            <NumberField
              id={id("areaMax")}
              name="areaMax"
              label={labels.areaMax}
              value={values.areaMax ?? ""}
              onChange={set("areaMax")}
            />
            <NumberField
              id={id("ppsqmMax")}
              name="ppsqmMax"
              label={labels.ppsqmMax}
              value={values.ppsqmMax ?? ""}
              onChange={set("ppsqmMax")}
            />
            <NumberField
              id={id("floorMin")}
              name="floorMin"
              label={labels.floorMin}
              value={values.floorMin ?? ""}
              onChange={set("floorMin")}
              integer
            />
            <NumberField
              id={id("floorMax")}
              name="floorMax"
              label={labels.floorMax}
              value={values.floorMax ?? ""}
              onChange={set("floorMax")}
              integer
            />
            <NumberField
              id={id("floorsMax")}
              name="floorsMax"
              label={labels.floorsMax}
              value={values.floorsMax ?? ""}
              onChange={set("floorsMax")}
              integer
            />
            <NumberField
              id={id("yearMin")}
              name="yearMin"
              label={labels.yearMin}
              value={values.yearMin ?? ""}
              onChange={set("yearMin")}
              integer
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField
              id={id("renovation")}
              name="renovation"
              label={labels.renovation}
              anyLabel={labels.renovationAny}
              options={options.renovation}
              value={values.renovation ?? ""}
              onChange={set("renovation")}
            />
            <SelectField
              id={id("building")}
              name="building"
              label={labels.building}
              anyLabel={labels.buildingAny}
              options={options.building}
              value={values.building ?? ""}
              onChange={set("building")}
            />
            <SelectField
              id={id("updated")}
              name="updated"
              label={labels.updated}
              anyLabel={labels.updatedAny}
              options={options.updated}
              value={values.updated ?? ""}
              onChange={set("updated")}
            />
            <SelectField
              id={id("agency")}
              name="agency"
              label={labels.agency}
              anyLabel={labels.agencyAny}
              options={options.agency}
              value={values.agency ?? ""}
              onChange={set("agency")}
            />
            <SelectField
              id={id("source")}
              name="source"
              label={labels.source}
              anyLabel={labels.sourceAny}
              options={options.source}
              value={values.source ?? ""}
              onChange={set("source")}
            />
          </div>
          <fieldset className="space-y-1">
            <legend className="text-caption font-medium text-fg-muted">{labels.checks}</legend>
            <CheckField
              name="verified"
              label={labels.verified}
              checked={values.verified === "1"}
              onChange={set("verified")}
            />
            <CheckField
              name="cadastre"
              label={labels.cadastre}
              checked={values.cadastre === "1"}
              onChange={set("cadastre")}
            />
            <CheckField
              name="exclusive"
              label={labels.exclusive}
              checked={values.exclusive === "1"}
              onChange={set("exclusive")}
            />
            {params.tab === "base" ? (
              <CheckField
                name="finished"
                label={labels.finished}
                checked={values.finished === "1"}
                onChange={set("finished")}
              />
            ) : null}
          </fieldset>
          <p className="text-caption text-fg-muted">{labels.unknownNote}</p>
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" className="min-w-40 flex-1 sm:flex-none">
          {pendingText ? labels.showPending : format(labels.show, { n: count })}
        </Button>
        <a
          href={mlsHref(locale, { tab: params.tab })}
          className="inline-flex h-12 items-center rounded-md px-4 text-small font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
        >
          {labels.reset}
        </a>
      </div>
    </form>
  );
}

function SelectField({
  id,
  name,
  label,
  anyLabel,
  options,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  anyLabel: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-caption font-medium text-fg-muted">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClasses}
      >
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  id,
  name,
  label,
  value,
  onChange,
  integer = false,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  integer?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-caption font-medium text-fg-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        inputMode={integer ? "numeric" : "decimal"}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(inputClasses, "tabular")}
      />
    </div>
  );
}

function CheckField({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 text-small text-fg hover:bg-surface-muted">
      <input
        type="checkbox"
        name={name}
        value="1"
        checked={checked}
        onChange={(event) => onChange(event.target.checked ? "1" : "")}
        className="size-5 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

/** A radio group drawn as chips; native radios keep it working without JavaScript. */
function ChipGroup({
  legend,
  name,
  anyLabel,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  anyLabel: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}): ReactNode {
  const all = [{ value: "", label: anyLabel }, ...options];
  return (
    <fieldset>
      <legend className="mb-1 text-caption font-medium text-fg-muted">{legend}</legend>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {all.map((option) => (
          <label key={option.value || "any"} className="shrink-0">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="inline-flex h-11 cursor-pointer items-center rounded-full border border-border bg-surface px-4 text-small font-medium text-fg transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-fg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:bg-surface-muted peer-checked:hover:bg-primary-hover">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
