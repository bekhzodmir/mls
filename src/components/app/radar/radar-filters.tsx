import { Search } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChipLink } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import radar from "@/i18n/messages/radar";
import { districtName } from "@/lib/domain/geo";
import { dealTypes, districtIds } from "@/lib/domain/types";
import { GetForm } from "../mls/get-form";
import { hasRadarFilters, radarHref, radarStatusFilters, type RadarParams } from "./radar-params";

const fieldClass =
  "h-11 w-full rounded-md border border-border bg-surface px-3 text-small text-fg placeholder:text-fg-subtle focus-visible:border-primary";

/**
 * Radar filters (§7.2 "поиск и фильтры"): a search + district form that works
 * without JavaScript, and chip rows for deal type and status. Everything is
 * URL state, so a filtered view is shareable.
 */
export function RadarFilters({ locale, params }: { locale: Locale; params: RadarParams }) {
  const t = radar[locale].filters;
  const d = domain[locale];
  const action = radarHref(locale);

  return (
    <section aria-label={t.label} className="space-y-3">
      <GetForm
        action={action}
        role="search"
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-end"
      >
        <div className="space-y-1">
          <label htmlFor="radar-q" className="text-caption font-medium text-fg-muted">
            {t.search}
          </label>
          <input
            id="radar-q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder={t.searchPlaceholder}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="radar-district" className="text-caption font-medium text-fg-muted">
            {t.district}
          </label>
          <select id="radar-district" name="district" defaultValue={params.district ?? ""} className={fieldClass}>
            <option value="">{t.districtAny}</option>
            {[...districtIds]
              .sort((a, b) => districtName(a, locale).localeCompare(districtName(b, locale), locale))
              .map((id) => (
                <option key={id} value={id}>
                  {districtName(id, locale)}
                </option>
              ))}
          </select>
        </div>
        {params.dealType ? <input type="hidden" name="dealType" value={params.dealType} /> : null}
        {params.status !== "active" ? <input type="hidden" name="status" value={params.status} /> : null}
        <Button type="submit">
          <Search aria-hidden className="size-4" />
          {t.submit}
        </Button>
      </GetForm>

      <div role="group" aria-label={t.deal} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          <li>
            <ChipLink href={radarHref(locale, { ...params, dealType: undefined })} active={!params.dealType}>
              {t.dealAny}
            </ChipLink>
          </li>
          {dealTypes.map((dealType) => (
            <li key={dealType}>
              <ChipLink href={radarHref(locale, { ...params, dealType })} active={params.dealType === dealType}>
                {d.dealType[dealType]}
              </ChipLink>
            </li>
          ))}
        </ul>
      </div>

      <div role="group" aria-label={t.status} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="flex gap-2">
          {radarStatusFilters.map((status) => (
            <li key={status}>
              <ChipLink href={radarHref(locale, { ...params, status })} active={params.status === status}>
                {t.statusValue[status]}
              </ChipLink>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-fg-muted">{t.note}</p>
        {hasRadarFilters(params) ? (
          <ButtonLink href={action} variant="ghost">
            {t.reset}
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}
