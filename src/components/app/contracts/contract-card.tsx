import Link from "next/link";
import { Building, CalendarRange, ChevronRight, PenLine, ShieldAlert, UserRound, UserRoundCog } from "lucide-react";
import { propertyTitle } from "@/components/app/inventory/labels";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import contracts from "@/i18n/messages/contracts";
import type { ContractView } from "@/lib/data/views";
import type { ContractIssue } from "@/lib/domain/contracts";
import { cn } from "@/lib/cn";
import { ContractKindBadge, ContractStatusBadge, IssueCountBadge } from "./contract-badges";
import { contractHref, displayStatus } from "./contract-rules";
import { daysText } from "./contract-text";

/**
 * One contract in the list: number, kind, customer, property, period,
 * display status with the days left, and how many issues the rules found
 * (§17.5, §38.5). Server component.
 */
export function ContractCard({
  locale,
  view,
  issues,
  now,
}: {
  locale: Locale;
  view: ContractView;
  issues: readonly ContractIssue[];
  now: Date;
}) {
  const t = contracts[locale].card;
  const { contract, customer, listing, agent } = view;
  const status = displayStatus(view, now);
  const href = contractHref(locale, contract.id);
  const titleId = `contract-${contract.id}-title`;
  const days = status === "active" || status === "expired" ? daysText(locale, status, view.daysLeft) : undefined;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "space-y-3 rounded-lg border bg-surface p-4 shadow-card",
        status === "expired" ? "border-danger-border" : status === "expiring" ? "border-warning-border" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={titleId} className="min-w-0 text-body font-semibold text-fg">
          <Link href={href} className="tabular hover:underline">
            {format(t.number, { number: contract.number })}
          </Link>
        </h2>
        <ContractStatusBadge locale={locale} status={status} daysLeft={view.daysLeft} />
      </div>

      <ul className="space-y-1 text-small">
        <li className="flex items-start gap-1.5 text-fg">
          <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <span>{format(t.customer[customer.kind], { name: customer.name })}</span>
        </li>
        <li className="flex items-start gap-1.5 text-fg">
          <Building aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <span className={listing ? undefined : "text-fg-muted"}>
            {listing ? format(t.property, { property: propertyTitle(locale, listing.property) }) : t.noProperty}
          </span>
        </li>
        <li className="flex items-start gap-1.5 text-fg">
          <CalendarRange aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <span>
            {format(t.period, { from: formatDate(locale, contract.startsAt), to: formatDate(locale, contract.endsAt) })}
            {days ? <span className="block text-caption text-fg-muted">{days}</span> : null}
          </span>
        </li>
        <li className="flex items-start gap-1.5 text-fg">
          <UserRoundCog aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          <span>{format(t.agent, { name: view.scope === "own" ? `${agent.name} (${t.you})` : agent.name })}</span>
        </li>
      </ul>

      <div className="flex flex-wrap gap-1.5">
        <ContractKindBadge locale={locale} kind={contract.kind} />
        <IssueCountBadge locale={locale} issues={issues} />
        {view.missingConsents > 0 ? (
          <Badge tone="danger" icon={ShieldAlert}>
            {format(plural(locale, view.missingConsents, t.consentsMissing), { n: view.missingConsents })}
          </Badge>
        ) : null}
        {view.hasSimpleElectronicSignature ? (
          <Badge tone="warning" icon={PenLine}>
            {t.simpleSignature}
          </Badge>
        ) : null}
      </div>

      <ButtonLink
        href={href}
        variant="secondary"
        aria-label={format(t.openLabel, { number: contract.number })}
        className="w-full sm:w-auto"
      >
        {t.open}
        <ChevronRight aria-hidden className="size-4" />
      </ButtonLink>
    </article>
  );
}
