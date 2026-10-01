import Link from "next/link";
import {
  ArrowRight,
  Building,
  CalendarClock,
  CalendarPlus,
  Circle,
  CircleCheck,
  Clock,
  MessageSquarePlus,
  OctagonAlert,
  SearchCheck,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import shell from "@/i18n/messages/shell";
import today from "@/i18n/messages/today";
import { cn } from "@/lib/cn";
import { appHref, appPath, type AppRoute } from "@/lib/routes";
import { FeedList, FeedRow } from "./feed-row";
import { listHref } from "./links";
import { blockRows } from "./rows";
import type { TodayBlock, TodayBlockKey, TodayUrgency } from "./today-plan";

/** Rows shown per block before "show all"; the full list is one tap away. */
export const TODAY_ROWS_PER_BLOCK = 3;

/**
 * Where each block leads: the list with the matching filter already applied
 * (§36.2). Filter names follow the list screens' URL parameters.
 */
export function blockListHref(locale: Locale, key: TodayBlockKey): string {
  switch (key) {
    case "leads":
      return listHref(locale, "/leads", { status: "new" });
    case "calls":
      return listHref(locale, "/calls", { filter: "missed" });
    case "overdueTasks":
      return listHref(locale, "/tasks", { status: "overdue" });
    case "todayTasks":
      return listHref(locale, "/tasks", { status: "today" });
    case "viewings":
      return listHref(locale, "/viewings", { range: "today" });
    case "contracts":
      return listHref(locale, "/contracts", { status: "expiring" });
    case "matches":
      return listHref(locale, "/matches", { status: "new" });
    case "cooperation":
      return listHref(locale, "/mls/cooperation", { direction: "incoming" });
    case "stale":
      return listHref(locale, "/properties", { scope: "mine", freshness: "needs_confirmation" });
    case "priceDrops":
      return listHref(locale, "/properties");
    case "deals":
      return listHref(locale, "/deals");
  }
}

const urgencyStyle: Record<TodayUrgency, { tone: Tone; icon: LucideIcon }> = {
  overdue: { tone: "danger", icon: OctagonAlert },
  today: { tone: "warning", icon: CalendarClock },
  soon: { tone: "info", icon: Clock },
  later: { tone: "brand", icon: Sparkles },
};

export function UrgencyBadge({ locale, urgency }: { locale: Locale; urgency: TodayUrgency }) {
  const { tone, icon } = urgencyStyle[urgency];
  return (
    <Badge tone={tone} icon={icon}>
      {today[locale].urgency[urgency]}
    </Badge>
  );
}

export function TodayBlockSection({ locale, block, at }: { locale: Locale; block: TodayBlock; at: Date }) {
  const t = today[locale].blocks[block.key];
  const id = `today-${block.key}`;
  const rows = blockRows(locale, block, at);
  return (
    <section aria-labelledby={id}>
      <Card className="flex h-full flex-col overflow-hidden">
        <header className="space-y-1.5 px-4 pt-4 pb-2">
          <UrgencyBadge locale={locale} urgency={block.urgency} />
          <h2 id={id} className="text-h2 text-fg">
            {t.title} <span className="tabular text-fg-muted">{rows.length}</span>
          </h2>
        </header>
        <div className="flex-1">
          <FeedList rows={rows.slice(0, TODAY_ROWS_PER_BLOCK)} />
        </div>
        <Link
          href={blockListHref(locale, block.key)}
          className="flex min-h-11 items-center justify-between gap-2 border-t border-border px-4 text-small font-semibold text-primary -outline-offset-2 hover:bg-surface-muted/60"
        >
          {format(today[locale].showAll, { label: t.all, n: rows.length })}
          <ArrowRight aria-hidden className="size-4 shrink-0" />
        </Link>
      </Card>
    </section>
  );
}

/** §22.1 primary action: the single most urgent item, with one clear button. */
export function NextStepCard({ locale, step, at }: { locale: Locale; step: TodayBlock; at: Date }) {
  const t = today[locale];
  const [row] = blockRows(locale, step, at);
  if (!row) return null;
  return (
    <section aria-labelledby="today-next-step">
      <Card className="border-primary/40 bg-primary-soft/30">
        <header className="flex flex-wrap items-center gap-2 px-4 pt-4">
          <h2 id="today-next-step" className="text-small font-semibold text-primary-soft-fg">
            {t.nextStep.title}
          </h2>
          <span aria-hidden className="text-fg-subtle">
            ·
          </span>
          <span className="text-small text-fg-muted">{t.blocks[step.key].title}</span>
          <UrgencyBadge locale={locale} urgency={step.urgency} />
        </header>
        <FeedRow row={row} linked={false} />
        {row.href ? (
          <div className="px-4 pb-4">
            <ButtonLink href={row.href} size="lg" className="w-full sm:w-auto">
              {t.nextStep.open}
              <ArrowRight aria-hidden className="size-5" />
            </ButtonLink>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

const quickActions: { key: "lead" | "client" | "requirement" | "property" | "viewing"; route: AppRoute; icon: LucideIcon }[] =
  [
    { key: "lead", route: "leadsNew", icon: MessageSquarePlus },
    { key: "client", route: "clientsNew", icon: UserPlus },
    { key: "requirement", route: "requirementsNew", icon: SearchCheck },
    { key: "property", route: "propertiesNew", icon: Building },
    { key: "viewing", route: "viewingsNew", icon: CalendarPlus },
  ];

/** Quick actions (§36.2): the same destinations as the global "+", one tap from Today. */
export function QuickActions({ locale }: { locale: Locale }) {
  const t = shell[locale].quickCreate;
  return (
    <nav aria-labelledby="today-quick-actions">
      <h2 id="today-quick-actions" className="sr-only">
        {today[locale].quickActions}
      </h2>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        {quickActions.map(({ key, route, icon: Icon }) => (
          <li key={key} className="shrink-0">
            <Link
              href={appHref(locale, route)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-small font-medium text-fg transition-colors hover:border-primary hover:bg-primary-soft/40"
            >
              <Icon aria-hidden className="size-4.5 text-primary" />
              {t[key]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface OnboardingProgress {
  profile: boolean;
  client: boolean;
  requirement: boolean;
  property: boolean;
  radar: boolean;
}

const onboardingRoutes: Record<keyof OnboardingProgress, string> = {
  profile: "/more",
  client: "/clients/new",
  requirement: "/requirements/new",
  property: "/properties/new",
  radar: "/radar",
};

/** §22.1 new-user state: a checklist instead of an empty feed. */
export function OnboardingChecklist({ locale, progress }: { locale: Locale; progress: OnboardingProgress }) {
  const t = today[locale].onboarding;
  const steps = (Object.keys(onboardingRoutes) as (keyof OnboardingProgress)[]).map((key) => ({
    key,
    done: progress[key],
    ...t.steps[key],
  }));
  return (
    <section aria-labelledby="today-onboarding">
      <Card className="overflow-hidden">
        <header className="space-y-1 px-4 pt-4 pb-2">
          <h2 id="today-onboarding" className="text-h2 text-fg">
            {t.title}
          </h2>
          <p className="text-small text-fg-muted">{t.text}</p>
        </header>
        <ol className="divide-y divide-border">
          {steps.map((step) => {
            const Icon = step.done ? CircleCheck : Circle;
            return (
              <li key={step.key}>
                <Link
                  href={appPath(locale, onboardingRoutes[step.key])}
                  className="flex min-h-11 items-start gap-3 px-4 py-3 -outline-offset-2 hover:bg-surface-muted/60"
                >
                  <Icon
                    aria-hidden
                    className={cn("mt-0.5 size-5 shrink-0", step.done ? "text-success-fg" : "text-fg-subtle")}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-small font-semibold", step.done && "text-fg-muted")}>
                      {step.title}
                    </span>
                    <span className="block text-caption text-fg-muted">{step.hint}</span>
                  </span>
                  <Badge tone={step.done ? "success" : "neutral"} icon={step.done ? CircleCheck : Circle}>
                    {step.done ? t.done : t.todo}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>
    </section>
  );
}
