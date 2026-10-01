import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building,
  CalendarClock,
  CalendarPlus,
  FileSignature,
  Handshake,
  History,
  Home,
  Lock,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { BandBadge, FreshnessBadge, MoneyText, SourceBadge, VerificationBadge } from "@/components/domain/badges";
import { summarizeMatch } from "@/components/domain/match-explanation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Field } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { format, plural } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDate, formatDateTime } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import properties from "@/i18n/messages/properties";
import type { CooperationView, ListingDetailView, ListingView, OfferView, ReverseMatchView, ViewingView } from "@/lib/data/views";
import { districtName } from "@/lib/domain/geo";
import { formatMoney, subtractMoney } from "@/lib/domain/money";
import { formatUzPhone, maskUzPhone, telHref } from "@/lib/domain/phone";
import type { CommissionTerms, Listing, VerificationItem } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";
import { areaText, floorText, latestPriceChange, textLang } from "./labels";
import {
  AccessBadge,
  AttributeChips,
  ListingStatusBadge,
  PhotoPlaceholder,
  PriceChangeBadge,
  VerificationSummaryBadges,
} from "./listing-badges";
import { listingHref } from "./property-card";

/**
 * Sections of the property / listing profile (§22.6, §36.3). The physical
 * object and the agent's offer are separate cards (Property ≠ Listing,
 * §10.1); restricted fields are either shown with a "restricted" marker or
 * replaced by an explanation of which right is needed (§23.5) — never
 * silently blanked or faked.
 */

const DAY_MS = 86_400_000;

export function DetailSection({
  id,
  title,
  hint,
  icon: Icon,
  action,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("scroll-mt-20", className)}>
      <Card className="space-y-3 p-4">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <h2 id={`${id}-title`} className="flex items-center gap-2 text-h2 text-fg">
              {Icon ? <Icon aria-hidden className="size-5 shrink-0 text-fg-muted" /> : null}
              {title}
            </h2>
            {hint ? <p className="text-caption text-fg-muted">{hint}</p> : null}
          </div>
          {action}
        </header>
        {children}
      </Card>
    </section>
  );
}

function Restricted({ locale }: { locale: Locale }) {
  return (
    <Badge icon={Lock} className="ml-2 align-middle">
      {properties[locale].detail.restricted}
    </Badge>
  );
}

function Unknown({ locale }: { locale: Locale }) {
  return <span className="font-normal italic text-fg-muted">{domain[locale].unknown}</span>;
}

/* -------------------------------------------------------------- property */

export function PropertySection({ locale, view }: { locale: Locale; view: ListingView }) {
  const t = properties[locale].detail;
  const d = domain[locale];
  const { property } = view;
  const type = property.propertyType;
  const hasRooms = type === "apartment" || type === "house";
  const hasFloor = type === "apartment" || type === "commercial" || type === "room";
  const floor = floorText(locale, { floor: property.floor });

  return (
    <DetailSection id="property" icon={Home} title={t.sections.property} hint={t.sections.propertyHint}>
      <dl className="divide-y divide-border">
        <Field label={t.field.type} value={d.propertyType[type]} />
        {hasRooms ? <Field label={t.field.rooms} value={property.rooms ?? <Unknown locale={locale} />} /> : null}
        <Field label={t.field.area} value={property.areaTotal === undefined ? <Unknown locale={locale} /> : areaText(locale, property.areaTotal)} />
        {hasFloor ? <Field label={t.field.floor} value={floor ?? <Unknown locale={locale} />} /> : null}
        {type !== "land" ? (
          <Field label={t.field.floorsTotal} value={property.floorsTotal ?? <Unknown locale={locale} />} />
        ) : null}
        {type !== "land" ? (
          <Field
            label={t.field.buildingKind}
            value={property.buildingKind ? d.buildingKind[property.buildingKind] : <Unknown locale={locale} />}
          />
        ) : null}
        {type !== "land" ? (
          <Field
            label={t.field.renovation}
            value={property.renovation ? d.renovation[property.renovation] : <Unknown locale={locale} />}
          />
        ) : null}
        <Field label={t.field.yearBuilt} value={property.yearBuilt ?? <Unknown locale={locale} />} />
        <Field label={t.field.district} value={districtName(property.district, locale)} />
        <Field label={t.field.areaName} value={property.areaName ?? <Unknown locale={locale} />} />
        <Field label={t.field.landmark} value={property.landmark ?? <Unknown locale={locale} />} />
        <Field
          label={t.field.address}
          value={
            property.address ? (
              <>
                {property.address}
                <Restricted locale={locale} />
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-fg-muted">
                <Lock aria-hidden className="size-3.5" />
                {t.hiddenValue}
              </span>
            )
          }
        />
        <Field
          label={t.field.cadastre}
          value={
            view.ownerData ? (
              property.cadastralNumber ? (
                <>
                  <span className="tabular">{property.cadastralNumber}</span>
                  <Restricted locale={locale} />
                </>
              ) : (
                <Unknown locale={locale} />
              )
            ) : (
              <span className="inline-flex items-center gap-1 text-fg-muted">
                <Lock aria-hidden className="size-3.5" />
                {t.hiddenValue}
              </span>
            )
          }
        />
        <Field label={t.field.geo} value={property.geo ? t.geo[property.geo.precision] : t.geo.none} />
        <Field label={t.field.propertyId} value={<span className="tabular">{property.id}</span>} />
      </dl>
      {!property.address ? <Notice kind="permission">{t.hiddenAddress}</Notice> : null}
      {!view.ownerData && property.address ? <p className="text-caption text-fg-muted">{t.hiddenCadastre}</p> : null}
    </DetailSection>
  );
}

/* --------------------------------------------------------------- listing */

export function ListingSection({ locale, view, at }: { locale: Locale; view: ListingView; at: Date }) {
  const t = properties[locale].detail;
  const d = domain[locale];
  const { listing } = view;
  const change = latestPriceChange(listing);
  const own = view.access === "owner";

  return (
    <DetailSection id="listing" icon={Building} title={t.sections.listing} hint={t.sections.listingHint}>
      <dl className="divide-y divide-border">
        <Field label={t.field.dealType} value={d.dealType[listing.dealType]} />
        <Field
          label={t.field.price}
          value={
            <span className="inline-flex flex-wrap items-center justify-end gap-2">
              <MoneyText locale={locale} value={listing.price} />
              {change ? <PriceChangeBadge locale={locale} change={change} /> : null}
            </span>
          }
        />
        <Field label={t.field.status} value={<ListingStatusBadge locale={locale} status={listing.status} />} />
        <Field label={t.field.source} value={<SourceBadge locale={locale} source={listing.source} />} />
        <Field label={t.field.agent} value={view.agent.name} />
        {view.organization ? <Field label={t.field.organization} value={view.organization.name} /> : null}
        {!own ? (
          <Field
            label={t.field.agentPhone}
            value={
              // A partner's direct phone opens only once cooperation terms are accepted (§18.2).
              view.access === "partner_masked" ? (
                <span>
                  <span className="tabular">{maskUzPhone(view.agent.phone)}</span>{" "}
                  <span className="text-caption text-fg-muted">({t.phoneMaskedHint})</span>
                </span>
              ) : (
                <a href={telHref(view.agent.phone)} className="tabular text-primary underline-offset-2 hover:underline">
                  {formatUzPhone(view.agent.phone)}
                </a>
              )
            }
          />
        ) : null}
        <Field label={t.field.confidentiality} value={d.confidentiality[listing.confidentiality]} />
        <Field label={t.field.exclusive} value={listing.exclusive ? t.yes : t.no} />
        <Field label={t.field.published} value={formatDate(locale, listing.publishedAt)} />
        <Field
          label={t.field.confirmed}
          value={listing.lastConfirmedAt ? formatDate(locale, listing.lastConfirmedAt) : t.notConfirmed}
        />
        {listing.expiresAt ? (
          <Field
            label={t.field.expires}
            value={
              <span className={cn(new Date(listing.expiresAt).getTime() <= at.getTime() && "text-danger-fg")}>
                {formatDate(locale, listing.expiresAt)}
              </span>
            }
          />
        ) : null}
        <Field label={t.field.listingId} value={<span className="tabular">{listing.id}</span>} />
      </dl>
      {listing.description ? (
        <div className="space-y-1">
          <h3 className="text-small font-semibold text-fg">{t.sections.description}</h3>
          <p lang={textLang(listing.description)} className="text-small whitespace-pre-line text-fg">
            {listing.description}
          </p>
        </div>
      ) : null}
      <PriceHistory locale={locale} listing={listing} />
    </DetailSection>
  );
}

function PriceHistory({ locale, listing }: { locale: Locale; listing: Listing }) {
  const t = properties[locale].detail.priceHistory;
  const history = listing.priceHistory;
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-small font-semibold text-fg">
        <History aria-hidden className="size-4 text-fg-muted" />
        {properties[locale].detail.sections.priceHistory}
      </h3>
      {history.length <= 1 ? (
        <p className="text-small text-fg-muted">{t.single}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-small">
            <caption className="sr-only">{t.caption}</caption>
            <thead className="text-caption text-fg-muted">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">{t.date}</th>
                <th scope="col" className="py-1 pr-3 font-medium">{t.price}</th>
                <th scope="col" className="py-1 font-medium">{t.change}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((step, index) => {
                const previous = index > 0 ? history[index - 1].price : undefined;
                const delta =
                  previous && previous.currency === step.price.currency ? subtractMoney(step.price, previous) : undefined;
                return (
                  <tr key={`${step.at}-${index}`}>
                    <td className="py-2 pr-3 whitespace-nowrap text-fg-muted">{formatDate(locale, step.at)}</td>
                    <td className="py-2 pr-3">
                      <MoneyText locale={locale} value={step.price} className="font-medium text-fg" />
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {delta ? (
                        <span className={cn("tabular", delta.amountMinor < 0 ? "text-success-fg" : "text-fg-muted")}>
                          {formatMoney(locale, delta, { signed: true })}
                        </span>
                      ) : (
                        <span className="text-fg-muted">{t.initial}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------- other listings */

export function OtherListingsSection({ locale, views }: { locale: Locale; views: ListingView[] }) {
  const t = properties[locale].detail;
  return (
    <DetailSection id="other-listings" icon={Users} title={t.sections.otherListings} hint={t.otherListings.hint}>
      {views.length === 0 ? (
        <p className="text-small text-fg-muted">{t.otherListings.none}</p>
      ) : (
        <ul className="-mx-4 divide-y divide-border">
          {views.map((other) => (
            <li key={other.listing.id}>
              <Link
                href={listingHref(locale, other.listing.id)}
                className="flex min-h-11 items-start justify-between gap-3 px-4 py-3 -outline-offset-2 hover:bg-surface-muted/60"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-small font-semibold text-fg">
                    {other.organization
                      ? format(t.otherListings.by, { agent: other.agent.name, organization: other.organization.name })
                      : other.agent.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <ListingStatusBadge locale={locale} status={other.listing.status} />
                    <FreshnessBadge locale={locale} freshness={other.freshness} />
                  </div>
                </div>
                <MoneyText locale={locale} value={other.listing.price} className="shrink-0 text-small font-semibold text-fg" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}

/* ----------------------------------------------------------------- owner */

export function OwnerSection({ locale, detail }: { locale: Locale; detail: ListingDetailView }) {
  const t = properties[locale].detail;
  const d = domain[locale];
  const owner = detail.owner;
  const cooperationHref = `${appPath(locale, "/mls/cooperation/new")}?${new URLSearchParams({ listingId: detail.listing.id })}`;

  let body: ReactNode;
  if (owner) {
    body = (
      <>
        <dl className="divide-y divide-border">
          <Field label={t.owner.name} value={owner.name} />
          <Field
            label={t.owner.phone}
            value={
              <>
                <a href={telHref(owner.phone)} className="tabular text-primary underline-offset-2 hover:underline">
                  {formatUzPhone(owner.phone)}
                </a>
                <Restricted locale={locale} />
              </>
            }
          />
        </dl>
        <div className="space-y-1">
          <h3 className="text-small font-semibold text-fg">{t.owner.consents}</h3>
          {owner.consents.length === 0 ? (
            <p className="text-small text-fg-muted">{t.owner.noConsents}</p>
          ) : (
            <ul className="space-y-1 text-small text-fg">
              {owner.consents.map((consent) => (
                <li key={consent.id} className="flex items-start gap-2">
                  <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success-fg" />
                  <span>
                    {format(t.owner.consentSince, {
                      purpose: d.consentPurpose[consent.purpose],
                      date: formatDate(locale, consent.grantedAt),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    );
  } else if (detail.ownerData) {
    body = <p className="text-small text-fg-muted">{t.owner.notLinked}</p>;
  } else if (detail.access === "agency") {
    body = (
      <Notice kind="permission" title={t.owner.agencyTitle}>
        {format(t.owner.agencyText, { agent: detail.agent.name })}
      </Notice>
    );
  } else if (detail.access === "partner_masked") {
    body = (
      <Notice
        kind="permission"
        title={t.owner.maskedTitle}
        action={
          <ButtonLink href={cooperationHref} variant="secondary">
            <Handshake aria-hidden className="size-4" />
            {t.owner.maskedAction}
          </ButtonLink>
        }
      >
        {format(t.owner.maskedText, {
          agent: detail.organization ? `${detail.agent.name} (${detail.organization.name})` : detail.agent.name,
        })}
      </Notice>
    );
  } else {
    body = (
      <Notice kind="permission" title={t.owner.sharedTitle}>
        {format(t.owner.sharedText, { agent: detail.agent.name })}
      </Notice>
    );
  }

  return (
    <DetailSection id="owner" icon={UserRound} title={t.sections.owner}>
      {body}
    </DetailSection>
  );
}

/* -------------------------------------------------------------- contract */

export function ContractSection({ locale, view, at }: { locale: Locale; view: ListingView; at: Date }) {
  const t = properties[locale].detail.contract;
  const title = properties[locale].detail.sections.contract;
  const { listing } = view;

  if (!view.ownerData) {
    return (
      <DetailSection id="contract" icon={FileSignature} title={title}>
        <Notice kind="permission" title={t.partnerTitle}>
          {view.access === "agency" ? t.agencyText : t.partnerText}
        </Notice>
      </DetailSection>
    );
  }
  if (!listing.contractId && !listing.contractExpiresAt) {
    return (
      <DetailSection id="contract" icon={FileSignature} title={title}>
        <p className="text-small text-fg-muted">{t.none}</p>
      </DetailSection>
    );
  }

  const expiresAt = listing.contractExpiresAt;
  const msLeft = expiresAt ? new Date(expiresAt).getTime() - at.getTime() : undefined;
  const daysLeft = msLeft === undefined ? undefined : Math.floor(msLeft / DAY_MS);
  let warning: ReactNode = null;
  if (expiresAt && msLeft !== undefined && msLeft <= 0) {
    warning = (
      <Notice kind="danger" title={format(t.expired, { date: formatDate(locale, expiresAt) })}>
        {t.expiredText}
      </Notice>
    );
  } else if (daysLeft !== undefined && daysLeft <= 14) {
    warning = (
      <Notice
        kind="warning"
        title={daysLeft === 0 ? t.endsToday : format(plural(locale, daysLeft, t.daysLeft), { n: daysLeft })}
      >
        {t.expiringText}
      </Notice>
    );
  }

  return (
    <DetailSection id="contract" icon={FileSignature} title={title}>
      <dl className="divide-y divide-border">
        {listing.contractId ? (
          <Field
            label={t.number}
            value={
              <>
                <span className="tabular">{listing.contractId}</span>
                <Restricted locale={locale} />
              </>
            }
          />
        ) : null}
        <Field label={t.expires} value={expiresAt ? formatDate(locale, expiresAt) : <Unknown locale={locale} />} />
      </dl>
      {warning}
    </DetailSection>
  );
}

/* ---------------------------------------------------------- verification */

/**
 * One fact per entry. `detailed` (the viewer may see sensitive owner data)
 * adds the source and the note; everyone else gets the result only (§19),
 * since a source can name a contract and a note an ownership problem.
 */
export function VerificationSection({
  locale,
  items,
  detailed,
}: {
  locale: Locale;
  items: VerificationItem[];
  detailed: boolean;
}) {
  const t = properties[locale].detail.verification;
  const d = domain[locale];
  return (
    <DetailSection id="verification" icon={ShieldCheck} title={properties[locale].detail.sections.verification} hint={t.hint}>
      {items.length === 0 ? (
        <p className="text-small text-fg-muted">{t.none}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="space-y-1.5 rounded-md border border-border p-3">
              <VerificationBadge locale={locale} item={item} showSource={detailed} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-caption">
                <dt className="text-fg-muted">{t.method}</dt>
                <dd className="text-fg">{d.verificationMethod[item.method]}</dd>
                {detailed ? (
                  <>
                    <dt className="text-fg-muted">{t.source}</dt>
                    <dd className="text-fg">{item.source}</dd>
                  </>
                ) : null}
                <dt className="text-fg-muted">{t.checked}</dt>
                <dd className="text-fg">{item.checkedAt ? formatDate(locale, item.checkedAt) : t.noDate}</dd>
                {item.expiresAt ? (
                  <>
                    <dt className="text-fg-muted">{t.validUntil}</dt>
                    <dd className="text-fg">{formatDate(locale, item.expiresAt)}</dd>
                  </>
                ) : null}
                {detailed && item.note ? (
                  <>
                    <dt className="text-fg-muted">{t.note}</dt>
                    <dd className="text-fg">{item.note}</dd>
                  </>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      )}
      {!detailed && items.length > 0 ? <p className="text-caption text-fg-muted">{t.resultOnly}</p> : null}
      {items.some((item) => item.status === "unavailable") ? <Notice kind="info">{t.unavailableNote}</Notice> : null}
    </DetailSection>
  );
}

/* ------------------------------------------------------------------- MLS */

function TermsList({ locale, terms }: { locale: Locale; terms: CommissionTerms }) {
  const t = properties[locale].detail.mls;
  const d = domain[locale];
  return (
    <dl className="divide-y divide-border">
      <Field label={t.preset} value={d.splitPreset[terms.preset]} />
      <Field label={t.listingSide} value={<span className="tabular">{terms.listingSidePercent}%</span>} />
      <Field label={t.buyerSide} value={<span className="tabular">{terms.buyerSidePercent}%</span>} />
      <Field label={t.basis} value={d.commissionBasis[terms.basis]} />
      {terms.fixedAmount ? (
        <Field label={t.fixedAmount} value={<MoneyText locale={locale} value={terms.fixedAmount} />} />
      ) : null}
      <Field label={t.payout} value={d.payoutCondition[terms.payoutCondition]} />
      {terms.payoutNote ? <Field label={t.note} value={terms.payoutNote} /> : null}
    </dl>
  );
}

function CooperationRow({ locale, view }: { locale: Locale; view: CooperationView }) {
  const t = properties[locale].detail.mls;
  const d = domain[locale];
  const { request } = view;
  return (
    <Link
      href={appPath(locale, `/mls/cooperation/${encodeURIComponent(request.id)}`)}
      className="flex min-h-11 items-start justify-between gap-3 px-4 py-3 -outline-offset-2 hover:bg-surface-muted/60"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-small font-semibold text-fg">
          {view.direction === "incoming" ? t.incoming : t.outgoing} · {format(t.with, { name: view.counterpart.name })}
        </p>
        <p className="text-caption text-fg-muted">
          {view.overdue ? t.overdue : format(t.respondBy, { date: formatDateTime(locale, request.respondBy) })}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge icon={Handshake}>{d.cooperationStatus[request.status]}</Badge>
          <Badge>{d.splitPreset[view.latest.terms.preset]}</Badge>
        </div>
      </div>
      <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-fg-subtle" />
      <span className="sr-only">{t.open}</span>
    </Link>
  );
}

/** Terms and requests; "overdue" comes pre-computed from the repository's clock. */
export function MlsSection({ locale, detail }: { locale: Locale; detail: ListingDetailView }) {
  const t = properties[locale].detail.mls;
  const { listing } = detail;
  const partner = detail.access === "partner_masked" || detail.access === "partner_shared";
  const hasOutgoing = detail.cooperation.some((view) => view.direction === "outgoing");
  const cooperationHref = `${appPath(locale, "/mls/cooperation/new")}?${new URLSearchParams({ listingId: listing.id })}`;

  return (
    <DetailSection
      id="mls"
      icon={Handshake}
      title={properties[locale].detail.sections.mls}
      action={
        partner && !hasOutgoing ? (
          <ButtonLink href={cooperationHref} variant="soft">
            <Handshake aria-hidden className="size-4" />
            {t.request}
          </ButtonLink>
        ) : undefined
      }
    >
      {listing.confidentiality === "restricted" ? <Notice kind="info">{t.notInMls}</Notice> : null}
      <div className="space-y-1">
        <h3 className="text-small font-semibold text-fg">{t.terms}</h3>
        {listing.cooperation ? (
          <>
            <TermsList locale={locale} terms={listing.cooperation} />
            <p className="text-caption text-fg-muted">{t.notBinor}</p>
          </>
        ) : (
          <p className="text-small text-fg-muted">{t.noTerms}</p>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-small font-semibold text-fg">{t.requests}</h3>
        {detail.cooperation.length === 0 ? (
          <p className="text-small text-fg-muted">{t.noRequests}</p>
        ) : (
          <ul className="-mx-4 divide-y divide-border">
            {detail.cooperation.map((view) => (
              <li key={view.request.id}>
                <CooperationRow locale={locale} view={view} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </DetailSection>
  );
}

/* ------------------------------------------------------ reverse matching */

export function ReverseMatchesSection({ locale, matches, listingId }: { locale: Locale; matches: ReverseMatchView[]; listingId: string }) {
  const t = properties[locale].detail.clients;
  const title = matches.length > 0 ? format(plural(locale, matches.length, t.title), { n: matches.length }) : properties[locale].detail.sections.clients;
  return (
    <DetailSection id="clients" icon={Sparkles} title={title}>
      {matches.length === 0 ? (
        <p className="text-small text-fg-muted">{t.none}</p>
      ) : (
        <ul className="-mx-4 divide-y divide-border">
          {matches.map((match) => (
            <li key={match.requirement.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={appPath(locale, `/clients/${encodeURIComponent(match.client.id)}`)}
                  className="inline-flex min-h-11 items-center gap-2 text-small font-semibold text-fg underline-offset-2 hover:underline"
                >
                  <UserRound aria-hidden className="size-4 text-fg-muted" />
                  {match.client.name}
                </Link>
                <BandBadge locale={locale} band={match.band} score={match.score} />
              </div>
              <p className="text-small text-fg">{summarizeMatch(locale, match.reasons)}</p>
              <div className="flex flex-wrap gap-x-4">
                <Link
                  href={appPath(locale, `/matches/${encodeURIComponent(`${match.requirement.id}--${listingId}`)}`)}
                  className="inline-flex min-h-11 items-center gap-1 text-small font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t.why}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
                <Link
                  href={appPath(locale, `/requirements/${encodeURIComponent(match.requirement.id)}`)}
                  className="inline-flex min-h-11 items-center gap-1 text-small font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t.shortlist}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}

/* ----------------------------------------------------- viewings & offers */

export function ViewingsSection({ locale, viewings, listingId }: { locale: Locale; viewings: ViewingView[]; listingId: string }) {
  const t = properties[locale].detail.viewings;
  const d = domain[locale];
  const scheduleHref = `${appPath(locale, "/viewings/new")}?${new URLSearchParams({ listingId })}`;
  return (
    <DetailSection
      id="viewings"
      icon={CalendarClock}
      title={properties[locale].detail.sections.viewings}
      action={
        <ButtonLink href={scheduleHref} variant="secondary">
          <CalendarPlus aria-hidden className="size-4" />
          {t.schedule}
        </ButtonLink>
      }
    >
      {viewings.length === 0 ? (
        <p className="text-small text-fg-muted">{t.none}</p>
      ) : (
        <ul className="-mx-4 divide-y divide-border">
          {viewings.map((view) => (
            <li key={view.viewing.id}>
              <Link
                href={appPath(locale, `/viewings/${encodeURIComponent(view.viewing.id)}`)}
                className="flex min-h-11 items-start justify-between gap-3 px-4 py-3 -outline-offset-2 hover:bg-surface-muted/60"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-small font-semibold text-fg">
                    {formatDateTime(locale, view.viewing.startsAt)} · {view.client.name}
                  </p>
                  {view.partner ? (
                    <p className="text-caption text-fg-muted">{format(t.partner, { name: view.partner.name })}</p>
                  ) : null}
                  <Badge>{d.viewingStatus[view.viewing.status]}</Badge>
                </div>
                <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-fg-subtle" />
                <span className="sr-only">{t.open}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}

export function OffersSection({ locale, offers }: { locale: Locale; offers: OfferView[] }) {
  const t = properties[locale].detail.offers;
  const d = domain[locale];
  return (
    <DetailSection id="offers" icon={History} title={properties[locale].detail.sections.offers}>
      {offers.length === 0 ? (
        <p className="text-small text-fg-muted">{t.none}</p>
      ) : (
        <ul className="space-y-3">
          {offers.map((view) => (
            <li key={view.offer.id} className="space-y-1.5 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <MoneyText locale={locale} value={view.latest.amount} className="text-body font-semibold text-fg" />
                <Badge>{d.offerStatus[view.offer.status]}</Badge>
              </div>
              <p className="text-caption text-fg-muted">
                {t.by[view.latest.by]} · {view.client.name} · {format(t.version, { n: view.latest.version })} ·{" "}
                {formatDate(locale, view.latest.at)}
              </p>
              {view.offer.dealId ? (
                <Link
                  href={appPath(locale, `/deals/${encodeURIComponent(view.offer.dealId)}`)}
                  className="inline-flex min-h-11 items-center gap-1 text-small font-medium text-primary underline-offset-2 hover:underline"
                >
                  {t.openDeal}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}

/* ------------------------------------------------------------------ hero */

/**
 * Hero (§22.6): photo placeholder, price, key attributes, place, then status,
 * freshness, source, access and the verification summary as separate facts.
 */
export function PropertyHero({ locale, view }: { locale: Locale; view: ListingView }) {
  const { listing, property } = view;
  const change = latestPriceChange(listing);
  return (
    <Card className="overflow-hidden">
      <PhotoPlaceholder locale={locale} count={listing.photoCount} className="h-36 rounded-none sm:h-52" />
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <MoneyText locale={locale} value={listing.price} className="text-display text-fg" />
          <span className="text-small text-fg-muted">{domain[locale].dealType[listing.dealType]}</span>
          {change ? <PriceChangeBadge locale={locale} change={change} /> : null}
        </div>
        <AttributeChips locale={locale} facts={property} />
        <div className="flex flex-wrap gap-1.5">
          <ListingStatusBadge locale={locale} status={listing.status} />
          <FreshnessBadge locale={locale} freshness={view.freshness} />
          <SourceBadge locale={locale} source={listing.source} />
          <AccessBadge locale={locale} access={view.access} />
          <VerificationSummaryBadges locale={locale} items={listing.verifications} />
        </div>
      </div>
    </Card>
  );
}
