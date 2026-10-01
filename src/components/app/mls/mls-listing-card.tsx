import Link from "next/link";
import {
  BriefcaseBusiness,
  Building2,
  Crown,
  Globe,
  Handshake,
  Layers,
  Lock,
  LockOpen,
  Phone,
  ShieldAlert,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { partnerHref } from "@/components/app/partners/partner-model";
import { memberHref } from "@/components/app/team/team-model";
import { FreshnessBadge, MoneyText, VerificationBadge } from "@/components/domain/badges";
import { Badge, type Tone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { format, plural } from "@/i18n/define-messages";
import { formatDateTime, formatRelative } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import domain from "@/i18n/messages/domain";
import mls from "@/i18n/messages/mls";
import type { CooperationView, ListingView } from "@/lib/data/views";
import { formatMoney } from "@/lib/domain/money";
import { formatUzPhone, maskUzPhone, telHref } from "@/lib/domain/phone";
import { displayedProfessionalStatus } from "@/lib/domain/professional-status";
import type { Confidentiality, ListingStatus } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";
import { cooperationHref, deadlineState, newCooperationHref } from "./cooperation-model";
import { termsLabels } from "./cooperation-labels";
import { agentLine, listingPlace, listingTitle, sizeLine } from "./listing-labels";
import { pricePerSqm } from "./mls-params";
import { TermsSummary } from "./terms-summary";

const confidentialityIcon: Record<Confidentiality, LucideIcon> = {
  public: Globe,
  professional: BriefcaseBusiness,
  restricted: Lock,
};

function statusTone(status: ListingStatus): Tone {
  if (status === "disputed" || status === "verification_failed") return "danger";
  if (status === "offer" || status === "under_contract") return "info";
  return "neutral";
}

const MAX_CHECKS = 3;

/**
 * An MLS listing as a professional card (§15.1, §22.9): who offers it and
 * from which agency, what was checked (one fact per badge), how widely it is
 * shared, the cooperation terms with both roles named, and the state of the
 * viewer's request with its response deadline. A partner's address, owner
 * and direct phone stay masked until terms are accepted (§18.2).
 */
export function MlsListingCard({
  locale,
  view,
  now,
  request,
  variant = "card",
  headingLevel = 2,
}: {
  locale: Locale;
  view: ListingView;
  now: Date;
  /** The viewer's open or accepted request on this listing, either direction. */
  request?: CooperationView;
  /** "summary" drops the cooperation call to action (used inside cooperation pages). */
  variant?: "card" | "summary";
  headingLevel?: 2 | 3;
}) {
  const t = mls[locale].card;
  const d = domain[locale];
  const { listing, property, agent, access, freshness } = view;
  const partner = access === "partner_masked" || access === "partner_shared";
  const titleId = `mls-${listing.id}-title`;
  const perSqm = pricePerSqm(listing.price, property.areaTotal);
  const size = sizeLine(locale, property);
  const checks = listing.verifications.slice(0, MAX_CHECKS);
  const moreChecks = listing.verifications.length - checks.length;
  const ConfidentialityIcon = confidentialityIcon[listing.confidentiality];
  const deadline = request ? deadlineState(request.request, now) : undefined;
  const propertyHref = appPath(locale, `/properties/${encodeURIComponent(listing.id)}`);
  // A colleague's card is on the team screens, anyone outside the organization is a partner.
  const agentHref =
    access === "agency" ? memberHref(locale, agent.id) : partner ? partnerHref(locale, agent.id) : undefined;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article aria-labelledby={titleId} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        {access === "owner" ? (
          <Badge tone="brand" icon={UserCheck}>
            {t.own}
          </Badge>
        ) : access === "agency" ? (
          <Badge tone="neutral" icon={Building2}>
            {t.agency}
          </Badge>
        ) : null}
        {listing.exclusive ? (
          <Badge tone="brand" icon={Crown}>
            {t.exclusive}
          </Badge>
        ) : null}
        {listing.status !== "active_mls" ? (
          <Badge tone={statusTone(listing.status)} icon={listing.status === "disputed" ? ShieldAlert : undefined}>
            {d.listingStatus[listing.status]}
          </Badge>
        ) : null}
        <FreshnessBadge locale={locale} freshness={freshness} />
        <Badge tone="neutral" icon={ConfidentialityIcon}>
          {d.confidentiality[listing.confidentiality]}
        </Badge>
      </div>

      <div>
        <Heading id={titleId} className="text-body font-semibold text-fg">
          <Link href={propertyHref} className="underline-offset-4 hover:underline">
            {listingTitle(locale, property)}
          </Link>
        </Heading>
        <p className="text-small text-fg-muted">{listingPlace(locale, property)}</p>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <MoneyText locale={locale} value={listing.price} className="text-h2 font-bold text-fg" />
        <span className="text-small text-fg-muted">{d.dealType[listing.dealType]}</span>
        {perSqm ? (
          <span className="text-caption text-fg-muted">
            {format(t.pricePerSqm, { price: formatMoney(locale, perSqm) })}
          </span>
        ) : null}
      </div>
      {size ? <p className="text-small text-fg">{size}</p> : null}

      <p className="text-small text-fg">
        {agentHref ? (
          <Link href={agentHref} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {agentLine(locale, view)}
          </Link>
        ) : (
          agentLine(locale, view)
        )}
        <span className="text-fg-muted"> · {d.professionalStatus[displayedProfessionalStatus(agent)]}</span>
      </p>

      <div className="space-y-1">
        <p className="text-caption font-medium text-fg-muted">{t.checks}</p>
        {checks.length === 0 ? (
          <p className="text-small text-fg-muted">{t.checksNone}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {checks.map((item) => (
              <li key={item.id}>
                <VerificationBadge locale={locale} item={item} showSource={view.ownerData} />
              </li>
            ))}
            {moreChecks > 0 ? (
              <li className="self-center text-caption text-fg-muted">{format(t.checksMore, { n: moreChecks })}</li>
            ) : null}
          </ul>
        )}
      </div>

      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-caption font-medium text-fg-muted">
          <Handshake aria-hidden className="size-3.5" />
          {t.terms}
        </p>
        {listing.cooperation ? (
          <TermsSummary locale={locale} terms={listing.cooperation} labels={termsLabels(locale)} compact />
        ) : (
          <p className="text-small text-fg-muted">{t.termsNone}</p>
        )}
      </div>

      {request ? (
        <div className="rounded-md border border-border bg-surface-muted p-3 text-small">
          <p className="font-medium text-fg">
            {format(t.request, { status: d.cooperationStatus[request.request.status] })}
          </p>
          {deadline?.kind === "open" ? (
            <p className="text-fg-muted">
              {format(t.respondBy, {
                date: formatDateTime(locale, request.request.respondBy),
                relative: formatRelative(locale, request.request.respondBy, now),
              })}
            </p>
          ) : deadline?.kind === "overdue" ? (
            <p className="text-warning-fg">
              {format(t.overdue, { relative: formatRelative(locale, request.request.respondBy, now) })}
            </p>
          ) : null}
        </div>
      ) : null}

      {partner ? (
        <div className="space-y-1 text-small">
          <p className="flex items-start gap-1.5 text-fg-muted">
            {access === "partner_masked" ? (
              <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : (
              <LockOpen aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            {access === "partner_masked" ? t.masked : t.shared}
          </p>
          {access === "partner_shared" && property.address ? (
            <p className="text-small text-fg">
              <span className="text-fg-muted">{t.address}: </span>
              {property.address}
            </p>
          ) : null}
          <p className="flex flex-wrap items-center gap-1.5 text-fg">
            <Phone aria-hidden className="size-4 shrink-0 text-fg-muted" />
            <span className="text-fg-muted">{t.agentPhone}:</span>
            {access === "partner_masked" ? (
              <span>
                <span className="tabular">{maskUzPhone(agent.phone)}</span>{" "}
                <span className="text-caption text-fg-muted">({t.phoneMaskedHint})</span>
              </span>
            ) : (
              <a
                href={telHref(agent.phone)}
                className="inline-flex min-h-11 items-center tabular text-primary underline-offset-4 hover:underline"
              >
                {formatUzPhone(agent.phone)}
              </a>
            )}
          </p>
        </div>
      ) : null}

      {view.otherListingsOnProperty > 0 ? (
        <p className="flex items-center gap-1.5 text-caption text-fg-muted">
          <Layers aria-hidden className="size-3.5" />
          {format(plural(locale, view.otherListingsOnProperty, t.otherListings), { n: view.otherListingsOnProperty })}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {variant === "card" && request ? (
          <ButtonLink href={cooperationHref(locale, request.request.id)} aria-describedby={titleId}>
            <Handshake aria-hidden className="size-4" />
            {t.openRequest}
          </ButtonLink>
        ) : variant === "card" && partner ? (
          <ButtonLink href={newCooperationHref(locale, listing.id)} aria-describedby={titleId}>
            <Handshake aria-hidden className="size-4" />
            {t.requestAction}
          </ButtonLink>
        ) : null}
        <ButtonLink href={propertyHref} variant="secondary" aria-describedby={titleId}>
          {t.openListing}
        </ButtonLink>
      </div>
    </article>
  );
}
