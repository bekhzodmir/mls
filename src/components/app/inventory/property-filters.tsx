import { Coins, LayoutList, MapPinned, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChipLink } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { compareText, formatNumber } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import properties from "@/i18n/messages/properties";
import { districtName } from "@/lib/domain/geo";
import { formatMoney, money } from "@/lib/domain/money";
import {
  currencies,
  dealTypes,
  districtIds,
  propertyTypes,
  sourceKinds,
  type Currency,
} from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";
import { CleanGetForm } from "./clean-get-form";
import {
  activeFilters,
  freshnessStates,
  listingScopes,
  listingStatuses,
  pendingPrice,
  propertyListHref,
  roomChoices,
  roomsChoiceActive,
  ROOMS_OPEN_ENDED_FROM,
  withoutAllFilters,
  withoutFilter,
  withRoomsChoice,
  type FilterKey,
  type PropertyListParams,
  type PropertyListView,
} from "./filters";
import { inputClasses } from "@/components/ui/field";

/**
 * Property search controls (§15.2, §36.4): scope, quick chips (deal, type,
 * rooms), district and price in a small GET form, and — behind a disclosure
 * — text, status, freshness and source as three separate dimensions. Every
 * state is a URL; the removable chips below say exactly what narrows the list.
 */

function ChipGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <li className={cn("shrink-0", className)}>
      <ul role="group" aria-label={label} className="flex gap-2">
        {children}
      </ul>
    </li>
  );
}

function Divider() {
  return <li aria-hidden className="my-2 w-px shrink-0 bg-border" />;
}

export function ScopeChips({ locale, params }: { locale: Locale; params: PropertyListParams }) {
  const t = properties[locale].list.scope;
  return (
    <nav aria-label={t.label} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-2">
        {listingScopes.map((scope) => (
          <li key={scope}>
            <ChipLink href={propertyListHref(locale, { ...params, scope })} active={params.scope === scope}>
              {t[scope]}
            </ChipLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Deal type, property type and rooms as toggling chips in one scrollable row. */
export function QuickChips({ locale, params }: { locale: Locale; params: PropertyListParams }) {
  const t = properties[locale].list.quick;
  const d = domain[locale];
  const toggle = <K extends "dealType" | "propertyType">(key: K, value: NonNullable<PropertyListParams[K]>) =>
    params[key] === value ? withoutFilter(params, key) : { ...params, [key]: value };

  return (
    <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul aria-label={t.label} className="flex gap-2">
        <ChipGroup label={t.dealType}>
          {dealTypes.map((dealType) => (
            <li key={dealType}>
              <ChipLink
                href={propertyListHref(locale, toggle("dealType", dealType))}
                active={params.dealType === dealType}
              >
                {d.dealType[dealType]}
              </ChipLink>
            </li>
          ))}
        </ChipGroup>
        <Divider />
        <ChipGroup label={t.propertyType}>
          {propertyTypes.map((type) => (
            <li key={type}>
              <ChipLink
                href={propertyListHref(locale, toggle("propertyType", type))}
                active={params.propertyType === type}
              >
                {d.propertyType[type]}
              </ChipLink>
            </li>
          ))}
        </ChipGroup>
        <Divider />
        <ChipGroup label={t.rooms}>
          {roomChoices.map((rooms) => (
            <li key={rooms}>
              <ChipLink
                href={propertyListHref(locale, withRoomsChoice(params, rooms))}
                active={roomsChoiceActive(params, rooms)}
              >
                {format(rooms >= ROOMS_OPEN_ENDED_FROM ? t.roomsFrom : t.roomsChip, { n: rooms })}
              </ChipLink>
            </li>
          ))}
        </ChipGroup>
      </ul>
    </div>
  );
}

function Field({ id, label, children, className }: { id: string; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-caption font-medium text-fg-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

/** District, price with an explicit currency, and the advanced dimensions. */
export function FilterForm({ locale, params }: { locale: Locale; params: PropertyListParams }) {
  const t = properties[locale].list.form;
  const d = domain[locale];
  const advancedOpen = Boolean(params.q || params.status || params.freshness || params.source);
  // Chips own these values; the form carries them along unchanged.
  const hidden: [string, string | number | undefined][] = [
    ["scope", params.scope === "all" ? undefined : params.scope],
    ["dealType", params.dealType],
    ["propertyType", params.propertyType],
    ["roomsMin", params.roomsMin],
    ["roomsMax", params.roomsMax],
    ["view", params.view === "list" ? undefined : params.view],
  ];

  return (
    <CleanGetForm action={appPath(locale, "/properties")} aria-label={t.label} className="space-y-3">
      {hidden.map(([name, value]) =>
        value === undefined ? null : <input key={name} type="hidden" name={name} value={value} />,
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] sm:items-end">
        <Field id="filter-district" label={t.district} className="col-span-2 sm:col-span-1">
          <select id="filter-district" name="district" defaultValue={params.district ?? ""} className={inputClasses}>
            <option value="">{t.anyDistrict}</option>
            {[...districtIds]
              .sort((a, b) => compareText(locale, districtName(a, locale), districtName(b, locale)))
              .map((id) => (
                <option key={id} value={id}>
                  {districtName(id, locale)}
                </option>
              ))}
          </select>
        </Field>
        <Field id="filter-price" label={t.priceMax}>
          <input
            id="filter-price"
            name="priceMax"
            inputMode="decimal"
            autoComplete="off"
            placeholder={t.pricePlaceholder}
            defaultValue={params.priceMax ?? ""}
            aria-describedby="filter-currency-hint"
            className={cn(inputClasses, "tabular")}
          />
        </Field>
        <Field id="filter-currency" label={t.currency}>
          <select id="filter-currency" name="currency" defaultValue={params.currency ?? ""} className={inputClasses}>
            <option value="">{t.anyCurrency}</option>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" className="col-span-2 sm:col-span-1">
          {t.apply}
        </Button>
      </div>
      <p id="filter-currency-hint" className="text-caption text-fg-muted">
        {t.currencyHint}
      </p>

      <details open={advancedOpen} className="group rounded-md border border-border bg-surface">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-small font-medium text-fg [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal aria-hidden className="size-4 text-fg-muted" />
          {t.advanced}
        </summary>
        <div className="space-y-3 border-t border-border p-3">
          <p className="text-caption text-fg-muted">{t.advancedHint}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="filter-q" label={t.query}>
              <input
                id="filter-q"
                name="q"
                type="search"
                autoComplete="off"
                placeholder={t.queryPlaceholder}
                defaultValue={params.q ?? ""}
                className={inputClasses}
              />
            </Field>
            <Field id="filter-status" label={t.status}>
              <select id="filter-status" name="status" defaultValue={params.status ?? ""} className={inputClasses}>
                <option value="">{t.anyStatus}</option>
                {listingStatuses.map((status) => (
                  <option key={status} value={status}>
                    {d.listingStatus[status]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="filter-freshness" label={t.freshness}>
              <select id="filter-freshness" name="freshness" defaultValue={params.freshness ?? ""} className={inputClasses}>
                <option value="">{t.anyFreshness}</option>
                {freshnessStates.map((state) => (
                  <option key={state} value={state}>
                    {d.freshness[state]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="filter-source" label={t.source}>
              <select id="filter-source" name="source" defaultValue={params.source ?? ""} className={inputClasses}>
                <option value="">{t.anySource}</option>
                {sourceKinds.map((source) => (
                  <option key={source} value={source}>
                    {d.source[source]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
            {t.apply}
          </Button>
        </div>
      </details>
    </CleanGetForm>
  );
}

/** Human label of one active filter, e.g. «Чиланзар», «Комнат: 2–3», «До $80 000». */
export function filterLabel(locale: Locale, params: PropertyListParams, key: FilterKey): string {
  const t = properties[locale].list.chip;
  const d = domain[locale];
  switch (key) {
    case "q":
      return format(t.text, { q: params.q ?? "" });
    case "dealType":
      return params.dealType ? d.dealType[params.dealType] : "";
    case "propertyType":
      return params.propertyType ? d.propertyType[params.propertyType] : "";
    case "district":
      return params.district ? districtName(params.district, locale) : "";
    case "rooms": {
      const { roomsMin: min, roomsMax: max } = params;
      if (min !== undefined && max !== undefined) {
        return min === max ? format(t.roomsExact, { n: min }) : format(t.roomsRange, { min, max });
      }
      return min !== undefined ? format(t.roomsFrom, { n: min }) : format(t.roomsTo, { n: max ?? "" });
    }
    case "price":
      return params.priceMax !== undefined && params.currency
        ? format(t.priceUpTo, { amount: formatMoney(locale, money(params.priceMax, params.currency)) })
        : "";
    case "currency":
      return format(t.currencyOnly, { currency: params.currency ?? "" });
    case "status":
      return params.status ? format(t.status, { value: d.listingStatus[params.status] }) : "";
    case "freshness":
      return params.freshness ? format(t.freshness, { value: d.freshness[params.freshness] }) : "";
    case "source":
      return params.source ? format(t.source, { value: d.source[params.source] }) : "";
  }
}

/** Removable chips for every active filter, plus "reset all" (§23.1: show which filters to remove). */
export function ActiveFilterChips({ locale, params }: { locale: Locale; params: PropertyListParams }) {
  const t = properties[locale].list.active;
  const active = activeFilters(params);
  if (active.length === 0) return null;
  return (
    <ul aria-label={t.label} className="flex flex-wrap gap-2">
      {active.map((key) => {
        const label = filterLabel(locale, params, key);
        return (
          <li key={key}>
            <ChipLink
              href={propertyListHref(locale, withoutFilter(params, key))}
              aria-label={format(t.remove, { filter: label })}
              className="border-primary/40 bg-primary-soft text-primary-soft-fg"
            >
              {label}
              <X aria-hidden className="size-4" />
            </ChipLink>
          </li>
        );
      })}
      {active.length > 1 ? (
        <li>
          <ChipLink href={propertyListHref(locale, withoutAllFilters(params))}>{t.resetAll}</ChipLink>
        </li>
      ) : null}
    </ul>
  );
}

/** A price typed without a currency is not applied: ask, never assume USD (§35.5). */
export function PendingPriceNotice({ locale, params }: { locale: Locale; params: PropertyListParams }) {
  const amount = pendingPrice(params);
  if (amount === undefined) return null;
  const t = properties[locale].list.pendingPrice;
  const choice = (currency: Currency) => ({ ...params, currency });
  const noPrice = { ...params };
  delete noPrice.priceMax;
  return (
    <Notice kind="warning" title={t.title}>
      <p>{format(t.text, { amount: formatNumber(locale, amount) })}</p>
      <ul className="flex flex-wrap gap-2 pt-2">
        {currencies.map((currency) => (
          <li key={currency}>
            <ChipLink href={propertyListHref(locale, choice(currency))}>
              <Coins aria-hidden className="size-4" />
              {format(t.choice, { amount: formatMoney(locale, money(amount, currency)) })}
            </ChipLink>
          </li>
        ))}
        <li>
          <ChipLink href={propertyListHref(locale, noPrice)}>{t.remove}</ChipLink>
        </li>
      </ul>
    </Notice>
  );
}

const viewIcons: Record<PropertyListView, typeof LayoutList> = { list: LayoutList, districts: MapPinned };

export function ViewSwitch({ locale, params }: { locale: Locale; params: PropertyListParams }) {
  const t = properties[locale].list.view;
  return (
    <nav aria-label={t.label}>
      <ul className="flex gap-2">
        {(["list", "districts"] as const).map((view) => {
          const Icon = viewIcons[view];
          return (
            <li key={view}>
              <ChipLink href={propertyListHref(locale, { ...params, view })} active={params.view === view}>
                <Icon aria-hidden className="size-4" />
                {t[view]}
              </ChipLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
