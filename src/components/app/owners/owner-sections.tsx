import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  Handshake,
  Lock,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { consentListHref } from "@/components/app/consents/registry";
import { ConsentStateBadge } from "@/components/app/crm/badges";
import { CrmSection } from "@/components/app/crm/layout-parts";
import { listingHref, propertyLabel } from "@/components/app/crm/object-label";
import { ListingStatusBadge } from "@/components/app/inventory/listing-badges";
import { QueueItemCard } from "@/components/app/verification/queue-item";
import { queueHref } from "@/components/app/verification/queue";
import { FreshnessBadge, MoneyText } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Field } from "@/components/ui/card";
import type { Locale } from "@/i18n/config";
import { format, plural } from "@/i18n/define-messages";
import { formatDate, formatDateTime } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import owners from "@/i18n/messages/owners";
import type { ContractView, ListingView, OwnerDetailView, VerificationQueueItem } from "@/lib/data/views";
import { formatMoney, subtractMoney } from "@/lib/domain/money";
import type { CommunicationChannel, ID } from "@/lib/domain/types";
import { ContractStatusBadge, HolderConsentBadge, RestrictedBadge } from "./owner-badges";
import {
  callHref,
  callsTimelineHref,
  contractHref,
  listingHistory,
  ownerHref,
  ownerTimeline,
  type ListingHistoryEvent,
  type OwnerPropertyGroup,
} from "./owner-model";

/**
 * Sections of the owner profile (§14.6): contact and consents, properties
 * with their listings, contracts, checked facts, listing history and the
 * viewer's own timeline. Restricted values are shown with a marker or
 * replaced by the reason they are hidden — never blanked or invented.
 */

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border-strong p-4 text-small text-fg-muted">{children}</p>
  );
}

function Unknown({ locale }: { locale: Locale }) {
  return <span className="font-normal italic text-fg-muted">{domain[locale].unknown}</span>;
}

const linkClasses =
  "inline-flex min-h-11 items-center gap-1 text-small font-medium text-primary underline-offset-2 hover:underline";

/* -------------------------------------------------------------- consents */

export function ConsentsSection({ locale, detail }: { locale: Locale; detail: OwnerDetailView }) {
  const t = owners[locale];
  const d = domain[locale];
  const { owner } = detail;
  const withHolders = detail.contracts.filter((view) => view.rightHolders.length > 0);

  return (
    <CrmSection
      id="consents"
      title={t.sections.consents}
      description={t.consents.text}
      action={
        <ButtonLink href={consentListHref(locale, { subject: "owner" })} variant="secondary">
          {t.consents.registry}
          <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      }
    >
      {owner.consents.length > 0 ? (
        <ul className="space-y-2">
          {owner.consents.map((consent) => (
            <li key={consent.id}>
              <Card className="flex flex-wrap items-start justify-between gap-2 p-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-small font-semibold text-fg">{d.consentPurpose[consent.purpose]}</p>
                  <p className="text-caption text-fg-muted">
                    {format(t.consents.granted, {
                      channel: d.consentChannel[consent.channel],
                      date: formatDate(locale, consent.grantedAt),
                    })}
                  </p>
                  <p className="text-caption text-fg-subtle">{format(t.consents.version, { version: consent.textVersion })}</p>
                </div>
                <ConsentStateBadge locale={locale} consent={consent} />
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyLine>{t.consents.empty}</EmptyLine>
      )}

      {withHolders.length > 0 ? (
        <div className="space-y-2 pt-2">
          <h3 className="text-body font-semibold text-fg">{t.consents.byContract}</h3>
          <p className="text-caption text-fg-muted">{t.consents.byContractText}</p>
          <ul className="space-y-2">
            {withHolders.map((view) => (
              <li key={view.contract.id}>
                <Card className="space-y-2 p-3">
                  <p className="text-small">
                    <Link
                      href={contractHref(locale, view.contract.id)}
                      className="inline-flex min-h-11 items-center font-semibold text-fg underline-offset-2 hover:underline"
                    >
                      <span className="tabular">{view.contract.number}</span>
                    </Link>{" "}
                    <span className="text-fg-muted">· {t.contracts.kind[view.contract.kind]}</span>
                  </p>
                  <ul className="divide-y divide-border">
                    {view.rightHolders.map((holder) => (
                      <li key={holder.ownerId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <div className="min-w-0 text-small">
                          {holder.ownerId === owner.id ? (
                            <span className="font-semibold text-fg">
                              {holder.name} <span className="font-normal text-fg-muted">({t.consents.self})</span>
                            </span>
                          ) : (
                            <Link
                              href={ownerHref(locale, holder.ownerId)}
                              className="inline-flex min-h-11 items-center font-medium text-fg underline-offset-2 hover:underline"
                            >
                              {holder.name}
                            </Link>
                          )}
                          {holder.isCustomer ? <span className="text-fg-muted"> · {t.consents.customer}</span> : null}
                          {holder.status === "confirmed" ? (
                            <p className="text-caption text-fg-muted">
                              {holder.consent
                                ? format(t.consents.holderDate, { date: formatDate(locale, holder.consent.grantedAt) })
                                : t.consents.holderUnknownDate}
                            </p>
                          ) : null}
                        </div>
                        <HolderConsentBadge locale={locale} status={holder.status} />
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </CrmSection>
  );
}

/* ------------------------------------------------------------ properties */

function ListingRow({ locale, view }: { locale: Locale; view: ListingView }) {
  const t = owners[locale].properties;
  return (
    <Link
      href={listingHref(locale, view.listing.id)}
      className="flex min-h-11 items-start justify-between gap-3 px-4 py-3 -outline-offset-2 hover:bg-surface-muted/60"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-small font-semibold text-fg">
          {domain[locale].dealType[view.listing.dealType]} · {format(t.agent, { name: view.agent.name })}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <ListingStatusBadge locale={locale} status={view.listing.status} />
          <FreshnessBadge locale={locale} freshness={view.freshness} />
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-1">
        <MoneyText locale={locale} value={view.listing.price} className="text-small font-semibold text-fg" />
        <ArrowRight aria-hidden className="size-4 text-fg-subtle" />
        <span className="sr-only">{t.open}</span>
      </span>
    </Link>
  );
}

export function PropertiesSection({ locale, groups }: { locale: Locale; groups: OwnerPropertyGroup[] }) {
  const t = owners[locale];
  return (
    <CrmSection id="properties" title={t.sections.properties}>
      {groups.length > 0 ? (
        <ul className="space-y-3">
          {groups.map(({ property, listings, viaContract }) => {
            const ownerData = listings.some((view) => view.ownerData);
            return (
              <li key={property.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-body font-semibold text-fg">{propertyLabel(locale, property)}</h3>
                    <span className="tabular text-caption text-fg-subtle">{property.id}</span>
                  </div>
                  <dl className="divide-y divide-border">
                    <Field
                      label={t.properties.address}
                      value={
                        property.address ? (
                          <>
                            {property.address} <RestrictedBadge locale={locale} />
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-fg-muted">
                            <Lock aria-hidden className="size-3.5" />
                            {t.properties.addressHidden}
                          </span>
                        )
                      }
                    />
                    <Field
                      label={t.properties.cadastre}
                      value={
                        property.cadastralNumber ? (
                          <>
                            <span className="tabular">{property.cadastralNumber}</span> <RestrictedBadge locale={locale} />
                          </>
                        ) : ownerData ? (
                          <Unknown locale={locale} />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-fg-muted">
                            <Lock aria-hidden className="size-3.5" />
                            {t.properties.cadastreHidden}
                          </span>
                        )
                      }
                    />
                    <Field
                      label={t.properties.landmark}
                      value={property.landmark ?? <Unknown locale={locale} />}
                    />
                  </dl>
                  {viaContract ? <p className="text-caption text-fg-muted">{t.properties.viaContract}</p> : null}
                  <div className="space-y-1">
                    <h4 className="text-small font-semibold text-fg">{t.properties.listings}</h4>
                    {listings.length > 0 ? (
                      <ul className="-mx-4 divide-y divide-border">
                        {listings.map((view) => (
                          <li key={view.listing.id}>
                            <ListingRow locale={locale} view={view} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-small text-fg-muted">{t.properties.noListings}</p>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyLine>{t.properties.empty}</EmptyLine>
      )}
    </CrmSection>
  );
}

/* ------------------------------------------------------------- contracts */

function contractDays(locale: Locale, view: ContractView): string | undefined {
  const t = owners[locale].contracts;
  const { status, endsAt } = view.contract;
  if (status === "terminated" || status === "draft" || status === "awaiting_signature") return undefined;
  if (view.daysLeft < 0 || status === "expired") return format(t.ended, { date: formatDate(locale, endsAt) });
  if (view.daysLeft === 0) return t.endsToday;
  return format(plural(locale, view.daysLeft, t.daysLeft), { n: view.daysLeft });
}

export function ContractsSection({ locale, contracts }: { locale: Locale; contracts: ContractView[] }) {
  const t = owners[locale];
  return (
    <CrmSection id="contracts" title={t.sections.contracts} description={t.contracts.text}>
      {contracts.length > 0 ? (
        <ul className="space-y-3">
          {contracts.map((view) => {
            const days = contractDays(locale, view);
            return (
              <li key={view.contract.id}>
                <Card className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body">
                      <span className="tabular font-semibold text-fg">{view.contract.number}</span>{" "}
                      <span className="text-small text-fg-muted">· {t.contracts.kind[view.contract.kind]}</span>
                    </p>
                    <ContractStatusBadge locale={locale} view={view} />
                  </div>
                  <p className="text-small text-fg">
                    {format(t.contracts.period, {
                      from: formatDate(locale, view.contract.startsAt),
                      to: formatDate(locale, view.contract.endsAt),
                    })}
                    {days ? <span className="text-fg-muted"> · {days}</span> : null}
                  </p>
                  <p className="text-caption text-fg-muted">
                    {format(t.contracts.agent, { name: view.agent.name })}
                    {view.listing ? ` · ${propertyLabel(locale, view.listing.property)}` : ""}
                  </p>
                  {view.missingConsents > 0 ? (
                    <p className="flex items-center gap-1.5 text-caption font-medium text-danger-fg">
                      <ShieldAlert aria-hidden className="size-3.5 shrink-0" />
                      {format(t.contracts.missingConsents, { n: view.missingConsents })}
                    </p>
                  ) : null}
                  <Link href={contractHref(locale, view.contract.id)} className={linkClasses}>
                    {t.contracts.open}
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyLine>{t.contracts.empty}</EmptyLine>
      )}
    </CrmSection>
  );
}

/* ---------------------------------------------------------- verification */

export function OwnerVerificationSection({
  locale,
  items,
  at,
  viewerId,
  performers,
  requestHref,
}: {
  locale: Locale;
  /** From `ownerFacts`: the owner's listings and, for a co-owner, the contract's listing. */
  items: VerificationQueueItem[];
  at: Date;
  viewerId: ID;
  performers: Record<ID, string>;
  /** A new request for the viewer's own listing of this owner, if there is one. */
  requestHref?: string;
}) {
  const t = owners[locale];
  return (
    <CrmSection
      id="verification"
      title={t.sections.verification}
      description={t.verification.text}
      action={
        <ButtonLink href={queueHref(locale)} variant="soft">
          <ShieldCheck aria-hidden className="size-4" />
          {t.verification.all}
        </ButtonLink>
      }
    >
      {items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((entry) => (
            <li key={entry.key}>
              <QueueItemCard locale={locale} entry={entry} at={at} viewerId={viewerId} performers={performers} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyLine>{t.verification.empty}</EmptyLine>
      )}
      {items.some((entry) => !entry.detailed) ? (
        <p className="text-caption text-fg-muted">{t.verification.resultOnly}</p>
      ) : null}
      {requestHref ? (
        <ButtonLink href={requestHref} variant="secondary">
          {t.verification.request}
        </ButtonLink>
      ) : null}
    </CrmSection>
  );
}

/* --------------------------------------------------------------- history */

function historyText(locale: Locale, event: ListingHistoryEvent): ReactNode {
  const t = owners[locale].history;
  switch (event.kind) {
    case "published":
      return format(t.published, { price: formatMoney(locale, event.price) });
    case "price": {
      const delta =
        event.price.currency === event.previous.currency ? subtractMoney(event.price, event.previous) : undefined;
      const Icon = delta && delta.amountMinor < 0 ? TrendingDown : TrendingUp;
      return (
        <>
          {format(t.price, { price: formatMoney(locale, event.price) })}
          {delta ? (
            <span className="ml-1 inline-flex items-center gap-1 tabular text-fg-muted">
              <Icon aria-hidden className="size-3.5" />({formatMoney(locale, delta, { signed: true })})
            </span>
          ) : null}
        </>
      );
    }
    case "confirmed":
      return t.confirmed;
    case "status":
      return format(t.status, { status: domain[locale].listingStatus[event.status] });
  }
}

export function HistorySection({ locale, listings, at }: { locale: Locale; listings: ListingView[]; at: Date }) {
  const t = owners[locale];
  return (
    <CrmSection id="history" title={t.sections.history} description={t.history.text}>
      {listings.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {listings.map((view) => {
            const label = propertyLabel(locale, view.property);
            return (
              <li key={view.listing.id}>
                <Card className="space-y-2 p-4">
                  <h3 className="text-small font-semibold text-fg">
                    <Link
                      href={listingHref(locale, view.listing.id)}
                      className="inline-flex min-h-11 items-center underline-offset-2 hover:underline"
                    >
                      {label} · <span className="tabular">{view.listing.id}</span>
                    </Link>
                  </h3>
                  <ol aria-label={format(t.history.caption, { label })} className="space-y-2">
                    {listingHistory(view.listing, at).map((event, index) => (
                      <li key={`${event.kind}-${event.at}-${index}`} className="flex gap-3">
                        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-border-strong" />
                        <div className="min-w-0">
                          <p className="text-small text-fg">{historyText(locale, event)}</p>
                          <p className="text-caption text-fg-muted">
                            <time dateTime={event.at}>{formatDate(locale, event.at)}</time>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyLine>{t.history.empty}</EmptyLine>
      )}
    </CrmSection>
  );
}

/* -------------------------------------------------------------- timeline */

const channelIcon: Record<CommunicationChannel, LucideIcon> = {
  phone: Phone,
  telegram: Send,
  whatsapp: MessageCircle,
  instagram: MessageSquare,
  email: Mail,
  meeting: Handshake,
};

function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function TimelineSection({ locale, detail }: { locale: Locale; detail: OwnerDetailView }) {
  const t = owners[locale].timeline;
  const entries = ownerTimeline(detail);
  return (
    <CrmSection
      id="timeline"
      title={owners[locale].sections.timeline}
      description={t.text}
      action={
        <ButtonLink href={callsTimelineHref(locale, detail.owner.id)} variant="soft">
          {t.all}
        </ButtonLink>
      }
    >
      {entries.length > 0 ? (
        <ol className="space-y-3">
          {entries.map((entry) => {
            if (entry.kind === "communication") {
              const { communication, agent, call } = entry.view;
              const Icon = channelIcon[communication.channel];
              const Direction = communication.direction === "inbound" ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={`c-${entry.id}`}>
                  <Card className="space-y-1 p-3">
                    <p className="flex items-center gap-2 text-small font-semibold text-fg">
                      <Icon aria-hidden className="size-4 shrink-0 text-fg-muted" />
                      {t.channel[communication.channel]}
                      <Direction aria-hidden className="size-3.5 text-fg-muted" />
                      <span className="sr-only">{t.commDirection[communication.direction]}</span>
                    </p>
                    <p className="text-small text-fg">{communication.summary}</p>
                    {communication.nextStep ? (
                      <p className="text-caption text-fg-muted">{format(t.nextStep, { text: communication.nextStep })}</p>
                    ) : null}
                    <p className="text-caption text-fg-muted">
                      <time dateTime={communication.at}>{formatDateTime(locale, communication.at)}</time> ·{" "}
                      {format(t.by, { name: agent.name })}
                    </p>
                    <div className="flex flex-wrap gap-x-4">
                      {call ? (
                        <Link href={callHref(locale, call.id)} className={linkClasses}>
                          {t.openCall}
                          <ChevronRight aria-hidden className="size-4" />
                        </Link>
                      ) : null}
                      {communication.originalUrl ? (
                        <a
                          href={communication.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClasses}
                        >
                          {t.openOriginal}
                          <ExternalLink aria-hidden className="size-4" />
                        </a>
                      ) : null}
                    </div>
                  </Card>
                </li>
              );
            }
            const { call, agent } = entry.view;
            return (
              <li key={`k-${entry.id}`}>
                <Card className="space-y-1 p-3">
                  <p className="flex items-center gap-2 text-small font-semibold text-fg">
                    <Phone aria-hidden className="size-4 shrink-0 text-fg-muted" />
                    {format(t.call, { direction: t.direction[call.direction], outcome: t.outcome[call.outcome] })}
                  </p>
                  {call.durationSeconds > 0 ? (
                    <p className="text-caption text-fg-muted">{format(t.duration, { time: duration(call.durationSeconds) })}</p>
                  ) : null}
                  {call.summary ? (
                    <div className="space-y-1">
                      {call.summary.status === "draft" ? (
                        <Badge tone="warning" icon={Sparkles}>
                          {t.summaryDraft}
                        </Badge>
                      ) : null}
                      <p className="text-small text-fg">{call.summary.text}</p>
                    </div>
                  ) : null}
                  {call.note ? <p className="text-small text-fg">{call.note}</p> : null}
                  <p className="text-caption text-fg-muted">
                    <time dateTime={call.startedAt}>{formatDateTime(locale, call.startedAt)}</time> ·{" "}
                    {format(t.by, { name: agent.name })}
                  </p>
                  <Link href={callHref(locale, call.id)} className={linkClasses}>
                    {t.openCall}
                    <ChevronRight aria-hidden className="size-4" />
                  </Link>
                </Card>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyLine>{t.empty}</EmptyLine>
      )}
    </CrmSection>
  );
}
