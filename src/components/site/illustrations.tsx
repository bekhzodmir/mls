import {
  ArrowLeftRight,
  ArrowUpDown,
  Building2,
  ExternalLink,
  Send,
  Sparkles,
  UserSearch,
  type LucideIcon,
} from "lucide-react";
import { BandBadge, SourceBadge } from "@/components/domain/badges";
import { MatchReasons, summarizeMatch } from "@/components/domain/match-explanation";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import domain from "@/i18n/messages/domain";
import site from "@/i18n/messages/site";
import siteHome from "@/i18n/messages/site-home";
import { districtName } from "@/lib/domain/geo";
import { formatMoney, money } from "@/lib/domain/money";
import type { MatchReason } from "@/lib/domain/types";
import { publicSplitPresets } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * Schematic, clearly labelled illustrations for the public site (no product
 * screenshots exist yet, §42.2 recommendation 4). The reason breakdown uses
 * the product's own `MatchReasons` and `formatMoney`, so the site explains
 * matches exactly as the product does: by reasons, never by a bare score
 * (§12.4). All example data is fictional.
 */

const example = {
  district: "chilanzar",
  price: money(68_000, "USD"),
  budget: money(70_000, "USD"),
  floor: 9,
  floors: 9,
} as const;

/** One fictional object ↔ request pair: three fits, one difference, one open question. */
export function exampleReasons(missingExtra: string): MatchReason[] {
  return [
    {
      criterion: "location",
      outcome: "match",
      credit: 1,
      weight: 25,
      requested: true,
      detail: { kind: "district_exact", district: example.district },
    },
    { criterion: "price", outcome: "match", credit: 1, weight: 25, requested: true, detail: { kind: "price_within" } },
    { criterion: "rooms", outcome: "match", credit: 1, weight: 15, requested: true },
    { criterion: "floor", outcome: "partial", credit: 0.5, weight: 5, requested: true, detail: { kind: "floor_last" } },
    {
      criterion: "extras",
      outcome: "unknown",
      credit: 0,
      weight: 5,
      requested: true,
      detail: { kind: "extras", matched: [], missing: [missingExtra] },
    },
  ];
}

function exampleView(locale: Locale) {
  const t = siteHome[locale].example;
  const district = districtName(example.district, locale);
  const reasons = exampleReasons(t.parking);
  return {
    t,
    district,
    price: formatMoney(locale, example.price),
    budget: format(t.budget, { amount: formatMoney(locale, example.budget) }),
    floor: format(t.objectFloor, { floor: example.floor, floors: example.floors }),
    reasons,
    // The product's own summary line, so the site words a match as the product does.
    summary: summarizeMatch(locale, reasons),
  };
}

function ExampleCard({
  icon: Icon,
  role,
  title,
  detail,
  value,
}: {
  icon: LucideIcon;
  role: string;
  title: string;
  detail: string;
  value?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 shadow-card">
      <p className="flex items-start gap-1.5 text-caption text-fg-subtle">
        <Icon aria-hidden className="mt-px size-3.5 shrink-0" />
        <span>{role}</span>
      </p>
      <p className="mt-1.5 text-small font-semibold text-fg">{title}</p>
      <p className="mt-0.5 text-caption text-fg-muted">{detail}</p>
      {value ? <p className="mt-1 text-small font-semibold tabular text-fg">{value}</p> : null}
    </div>
  );
}

/** Hero schematic: object (realtor A) + request (realtor B) → explained match → Telegram. */
export function HeroDiagram({ locale, className }: { locale: Locale; className?: string }) {
  const { t, district, price, budget, summary } = exampleView(locale);

  return (
    <figure className={cn("mx-auto w-full max-w-md lg:max-w-none", className)}>
      <div className="grid grid-cols-2 gap-3">
        <ExampleCard icon={Building2} role={t.objectRole} title={t.objectTitle} detail={district} value={price} />
        <ExampleCard icon={UserSearch} role={t.requestRole} title={t.requestTitle} detail={district} value={budget} />
      </div>
      <svg aria-hidden viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-10 w-full text-border-strong">
        <path
          d="M25 0 C25 24 50 16 50 40 M75 0 C75 24 50 16 50 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="rounded-lg border border-primary/40 bg-surface p-4 shadow-float">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-small font-semibold text-fg">
            <Sparkles aria-hidden className="size-4 text-primary" />
            {t.match}
          </p>
          <BandBadge locale={locale} band="good" />
        </div>
        <p className="mt-2 text-small text-fg">{summary}</p>
        <p className="mt-3 flex items-center gap-2 rounded-md border border-info-border bg-info-bg px-3 py-2 text-caption text-info-fg">
          <Send aria-hidden className="size-3.5 shrink-0" />
          {t.notify}
        </p>
      </div>
      <figcaption className="mt-3 text-center text-caption text-fg-subtle">{site[locale].illustration}</figcaption>
    </figure>
  );
}

/** Full match card for the "how matching works" section: what fits, what differs, what to clarify. */
export function MatchExample({ locale, className }: { locale: Locale; className?: string }) {
  const { t, district, price, budget, floor, reasons, summary } = exampleView(locale);

  return (
    <figure className={cn("rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-small font-semibold text-fg">{t.label}</span>
        <span className="text-caption text-fg-subtle">{site[locale].illustration}</span>
      </figcaption>

      <div className="relative mt-4 grid gap-3 sm:grid-cols-2">
        <ExampleCard icon={Building2} role={t.objectRole} title={t.objectTitle} detail={`${district} · ${floor}`} value={price} />
        <span
          aria-hidden
          className="flex justify-center text-fg-subtle sm:absolute sm:top-1/2 sm:left-1/2 sm:z-10 sm:size-9 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:items-center sm:rounded-full sm:border sm:border-border sm:bg-surface sm:shadow-card"
        >
          <ArrowUpDown className="size-4 sm:hidden" />
          <ArrowLeftRight className="hidden size-4 sm:block" />
        </span>
        <ExampleCard
          icon={UserSearch}
          role={t.requestRole}
          title={t.requestTitle}
          detail={`${district} · ${t.requestFloor}`}
          value={budget}
        />
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface-muted p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex items-center gap-2 text-small font-semibold text-fg">
            <Sparkles aria-hidden className="size-4 text-primary" />
            {t.match}
          </p>
          <BandBadge locale={locale} band="good" />
        </div>
        <p className="mt-1 text-small text-fg">{summary}</p>
        <MatchReasons locale={locale} reasons={reasons} className="mt-4" />
      </div>
    </figure>
  );
}

/** Telegram Radar post card: source badge and the link to the original post (§7.2). */
export function RadarPostExample({ locale, className }: { locale: Locale; className?: string }) {
  const t = siteHome[locale].radar;

  return (
    <figure className={cn("relative isolate", className)}>
      <div
        aria-hidden
        className="absolute inset-x-5 -bottom-3 -z-10 h-full rounded-xl border border-border bg-surface-muted"
      />
      <div className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-info-bg text-info-fg"
          >
            <Send className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-small font-semibold text-fg">{t.postChannel}</p>
            <p className="text-caption text-fg-subtle">{t.postText}</p>
          </div>
        </div>
        <div aria-hidden className="mt-4 space-y-2">
          <div className="h-2.5 w-11/12 rounded-full bg-surface-sunken" />
          <div className="h-2.5 w-4/5 rounded-full bg-surface-sunken" />
          <div className="h-2.5 w-3/5 rounded-full bg-surface-sunken" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SourceBadge locale={locale} source="telegram" />
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-small font-medium text-primary-soft-fg">
          <ExternalLink aria-hidden className="size-4 shrink-0" />
          {t.postLink}
        </p>
        <figcaption className="mt-4 border-t border-border pt-3 text-caption text-fg-subtle">
          {site[locale].illustration}
        </figcaption>
      </div>
    </figure>
  );
}

/**
 * The split presets as neutral two-part bars. Sides are deliberately not
 * labelled: which party receives the larger share is agreed between the
 * realtors, not implied by Binor (§41 D2), and it is never a Binor fee (D10).
 */
export function SplitPresets({ locale, label }: { locale: Locale; label: string }) {
  const presets = domain[locale].splitPreset;

  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {publicSplitPresets.map((preset) => {
        const [first] = preset.split("/").map(Number);
        return (
          <li key={preset} className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <p className="text-h2 tabular text-fg">{presets[preset]}</p>
            <div aria-hidden className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
              <span className="rounded-l-full bg-primary" style={{ width: `${first}%` }} />
              <span className="flex-1 rounded-r-full bg-accent-400" />
            </div>
          </li>
        );
      })}
      <li className="rounded-lg border border-dashed border-border-strong bg-surface p-4">
        <p className="text-h2 text-fg">{presets.custom}</p>
        <div aria-hidden className="mt-3 h-2 rounded-full border border-dashed border-border-strong" />
      </li>
    </ul>
  );
}
