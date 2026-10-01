import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building,
  CalendarRange,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  Handshake,
  Link2,
  ListChecks,
  Lock,
  PenLine,
  Phone,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { DealStageBadge } from "@/components/app/deals/deal-badges";
import { DealSection } from "@/components/app/deals/deal-section";
import { dealHref } from "@/components/app/deals/pipeline";
import { propertyTitle, textLang } from "@/components/app/inventory/labels";
import { MoneyText } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import contracts from "@/i18n/messages/contracts";
import domain from "@/i18n/messages/domain";
import type { ContractDetailView, ContractView, RightHolderView } from "@/lib/data/views";
import type { ContractDisplayStatus, ContractIssue } from "@/lib/domain/contracts";
import { formatUzPhone, telHref } from "@/lib/domain/phone";
import type { Contract, ContractSignature, ID } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { appHref, appPath } from "@/lib/routes";
import { ContractStatusBadge } from "./contract-badges";
import { clauseChecklist, contractHref, displayStatus, type SignatureSide } from "./contract-rules";
import { daysText, percentText, signerName } from "./contract-text";

/**
 * Server-rendered sections of the contract workspace (§17.5, §38.5): parties,
 * service and term, remuneration, the §38.5 required-clause checklist, art.
 * 37 right holders, signatures, linked records and related contracts. The
 * status, check and demo actions live in `contract-demo.tsx`.
 */

const linkClasses =
  "inline-flex min-h-11 items-center gap-1 text-small font-semibold text-primary underline-offset-2 hover:underline";

/** §38.5: templates and legal force are a lawyer's call, not the product's. */
export function LegalDisclaimer({ locale }: { locale: Locale }) {
  const t = contracts[locale].detail;
  return (
    <Notice kind="warning" title={t.legalTitle}>
      {t.legalText}
    </Notice>
  );
}

/* --------------------------------------------------------------- parties */

function customerHref(locale: Locale, customer: ContractView["customer"]): string {
  const base = customer.kind === "owner" ? "/owners" : customer.kind === "client" ? "/clients" : "/partners";
  return appPath(locale, `${base}/${encodeURIComponent(customer.id)}`);
}

export function ContractPartiesSection({ locale, view }: { locale: Locale; view: ContractView }) {
  const t = contracts[locale].parties;
  const { customer, agent, organization } = view;
  return (
    <DealSection id="contract-parties" title={contracts[locale].detail.sections.parties} icon={Users}>
      <ul className="-my-3 divide-y divide-border">
        <li className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">{t.customer[customer.kind]}</p>
            <p className="text-small font-semibold text-fg">
              <Link
                href={customerHref(locale, customer)}
                className="hover:underline"
                aria-label={format(t.open, { name: customer.name })}
              >
                {customer.name}
              </Link>
            </p>
            {customer.phone ? (
              <p className="tabular text-caption text-fg-muted">{formatUzPhone(customer.phone)}</p>
            ) : customer.contactHidden ? (
              <p className="flex items-start gap-1.5 text-caption text-fg-muted">
                <Lock aria-hidden className="mt-px size-3.5 shrink-0" />
                {t.hidden[customer.contactHidden]}
              </p>
            ) : null}
          </div>
          {customer.phone ? (
            <a
              href={telHref(customer.phone)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border text-fg hover:bg-surface-muted"
              aria-label={format(t.call, { name: customer.name })}
            >
              <Phone aria-hidden className="size-4" />
            </a>
          ) : null}
        </li>
        <li className="space-y-0.5 py-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">{t.agent}</p>
          <p className="text-small font-semibold text-fg">
            {agent.name}
            {view.scope === "own" ? <span className="font-normal text-fg-muted"> ({t.you})</span> : null}
          </p>
        </li>
        <li className="space-y-0.5 py-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">{t.organization}</p>
          <p className="text-small text-fg">{organization?.name ?? (agent.organizationId ? domain[locale].unknown : t.individual)}</p>
        </li>
      </ul>
    </DealSection>
  );
}

/* --------------------------------------------------------- service, term */

export function ContractServiceSection({
  locale,
  view,
  now,
  newerTemplate,
}: {
  locale: Locale;
  view: ContractView;
  now: Date;
  newerTemplate?: string;
}) {
  const t = contracts[locale].service;
  const { contract } = view;
  const status = displayStatus(view, now);
  const days = daysText(locale, status, view.daysLeft);
  return (
    <DealSection id="contract-service" title={contracts[locale].detail.sections.service} icon={CalendarRange}>
      <dl className="divide-y divide-border">
        <div className="space-y-1 py-2">
          <dt className="text-small text-fg-muted">{t.service}</dt>
          <dd lang={contract.service ? textLang(contract.service) : undefined} className="text-small font-medium text-fg">
            {contract.service.trim() || <span className="font-normal italic text-fg-muted">{domain[locale].unknown}</span>}
          </dd>
        </div>
        <Field label={t.starts} value={formatDate(locale, contract.startsAt)} />
        <Field label={t.ends} value={formatDate(locale, contract.endsAt)} />
        {days ? <Field label={t.left} value={days} /> : null}
        <Field label={t.template} value={<span className="tabular">{contract.templateVersion}</span>} />
        <Field label={t.created} value={formatDate(locale, contract.createdAt)} />
      </dl>
      {newerTemplate ? <Notice kind="info">{format(t.templateNewer, { version: newerTemplate })}</Notice> : null}
    </DealSection>
  );
}

/* ---------------------------------------------------------- remuneration */

export function ContractRemunerationSection({ locale, contract }: { locale: Locale; contract: Contract }) {
  const t = contracts[locale].remuneration;
  const { remuneration } = contract;
  const missing = <span className="font-normal italic text-fg-muted">{t.missing}</span>;
  return (
    <DealSection id="contract-remuneration" title={contracts[locale].detail.sections.remuneration} icon={Wallet}>
      <dl className="divide-y divide-border">
        {remuneration.kind === "percent" ? (
          <Field
            label={t.percent}
            value={remuneration.percent !== undefined ? percentText(locale, remuneration.percent) : missing}
          />
        ) : (
          <Field
            label={t.fixed}
            value={remuneration.amount ? <MoneyText locale={locale} value={remuneration.amount} /> : missing}
          />
        )}
        <div className="space-y-1 py-2">
          <dt className="text-small text-fg-muted">{t.terms}</dt>
          <dd lang={remuneration.paymentTerms ? textLang(remuneration.paymentTerms) : undefined} className="text-small text-fg">
            {remuneration.paymentTerms.trim() || missing}
          </dd>
        </div>
      </dl>
      {contract.kind === "cooperation" ? <p className="text-caption text-fg-muted">{t.cooperation}</p> : null}
    </DealSection>
  );
}

/* --------------------------------------------------------------- clauses */

export function ContractClausesSection({
  locale,
  contract,
  issues,
}: {
  locale: Locale;
  contract: Contract;
  issues: readonly ContractIssue[];
}) {
  const t = contracts[locale].clauses;
  const rows = clauseChecklist(contract, issues);
  const done = rows.filter((row) => row.present).length;
  return (
    <DealSection
      id="contract-clauses"
      title={contracts[locale].detail.sections.clauses}
      icon={ListChecks}
      hint={format(t.progress, { done, total: rows.length })}
    >
      <p className="text-caption text-fg-muted">{t.hint}</p>
      <ul className="-mx-4 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.item} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <span className="min-w-0 text-small text-fg">{t.items[row.item]}</span>
            {row.present ? (
              <Badge tone="success" icon={CircleCheck}>
                {t.present}
              </Badge>
            ) : (
              <Badge tone="danger" icon={CircleX}>
                {t.missing}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </DealSection>
  );
}

/* --------------------------------------------------------- right holders */

function HolderBadge({ locale, holder }: { locale: Locale; holder: RightHolderView }) {
  const t = contracts[locale].rightHolders;
  if (holder.status === "missing") {
    return (
      <Badge tone="danger" icon={ShieldAlert}>
        {t.missing}
      </Badge>
    );
  }
  if (holder.consent?.revokedAt) {
    return (
      <Badge tone="danger" icon={ShieldAlert}>
        {format(t.revoked, { date: formatDate(locale, holder.consent.revokedAt) })}
      </Badge>
    );
  }
  return (
    <Badge tone="success" icon={ShieldCheck}>
      {t.confirmed}
    </Badge>
  );
}

/** Art. 37: one row per right holder; one holder's consent never stands for another's. */
export function ContractRightHoldersSection({ locale, view }: { locale: Locale; view: ContractView }) {
  const t = contracts[locale].rightHolders;
  const d = domain[locale];
  const holders = view.rightHolders;
  const confirmed = holders.filter((holder) => holder.status === "confirmed" && !holder.consent?.revokedAt).length;
  return (
    <DealSection
      id="contract-right-holders"
      title={contracts[locale].detail.sections.rightHolders}
      icon={ClipboardCheck}
      hint={holders.length > 0 ? format(t.summary, { confirmed, total: holders.length }) : undefined}
    >
      <p className="text-caption text-fg-muted">{t.hint}</p>
      {holders.length === 0 ? (
        view.contract.kind === "owner_service" ? (
          <Notice kind="danger">{t.none}</Notice>
        ) : (
          <p className="text-small text-fg-muted">{t.notApplicable}</p>
        )
      ) : (
        <>
          <ul className="-mx-4 divide-y divide-border">
            {holders.map((holder) => (
              <li key={holder.ownerId} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-small font-semibold text-fg">
                      <Link
                        href={appPath(locale, `/owners/${encodeURIComponent(holder.ownerId)}`)}
                        className="hover:underline"
                        aria-label={format(t.open, { name: holder.name })}
                      >
                        {holder.name}
                      </Link>
                    </p>
                    <p className="text-caption text-fg-muted">{holder.isCustomer ? t.customer : t.other}</p>
                  </div>
                  <HolderBadge locale={locale} holder={holder} />
                </div>
                {holder.consent ? (
                  <p className="text-caption text-fg-muted">
                    {format(t.consent, {
                      purpose: d.consentPurpose[holder.consent.purpose],
                      channel: d.consentChannel[holder.consent.channel],
                      date: formatDate(locale, holder.consent.grantedAt),
                      version: holder.consent.textVersion,
                    })}
                  </p>
                ) : holder.status === "confirmed" ? (
                  <p className="flex items-start gap-1.5 text-caption text-warning-fg">
                    <ShieldQuestion aria-hidden className="mt-px size-3.5 shrink-0" />
                    {t.unlinked}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <Notice kind="info">{t.separate}</Notice>
        </>
      )}
    </DealSection>
  );
}

/* ------------------------------------------------------------ signatures */

function partyLabel(locale: Locale, signature: ContractSignature): string {
  return contracts[locale].signatures.party[signature.party];
}

/**
 * Who signed, how and when. The method is always explicit: a simple
 * electronic signature carries a neutral warning, and nothing here calls a
 * button press a qualified signature (§38.5).
 */
export function ContractSignaturesSection({
  locale,
  contract,
  agentNames,
  missing,
}: {
  locale: Locale;
  contract: Contract;
  agentNames: Record<ID, string>;
  missing: readonly SignatureSide[];
}) {
  const t = contracts[locale].signatures;
  const simple = contract.signatures.some((signature) => signature.method === "simple_electronic");
  return (
    <DealSection id="contract-signatures" title={contracts[locale].detail.sections.signatures} icon={PenLine}>
      {contract.signatures.length === 0 ? (
        <p className="text-small text-fg-muted">{t.none}</p>
      ) : (
        <ul className="-mx-4 divide-y divide-border">
          {contract.signatures.map((signature, index) => (
            <li key={`${signature.party}-${index}`} className="space-y-0.5 px-4 py-2.5">
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-small">
                <span className="font-semibold text-fg">{signerName(signature, agentNames)}</span>
                <span className="text-caption text-fg-muted">{partyLabel(locale, signature)}</span>
              </p>
              <p
                className={cn(
                  "flex items-center gap-1.5 text-caption",
                  signature.method === "simple_electronic" ? "text-warning-fg" : "text-fg-muted",
                )}
              >
                <PenLine aria-hidden className="size-3.5 shrink-0" />
                {format(t.signed, { method: t.method[signature.method], date: formatDate(locale, signature.signedAt) })}
              </p>
            </li>
          ))}
        </ul>
      )}
      {missing.length > 0 ? (
        <ul className="space-y-1">
          {missing.map((side) => (
            <li key={side} className="flex items-start gap-2 text-small text-danger-fg">
              <CircleX aria-hidden className="mt-0.5 size-4 shrink-0" />
              {side === "customer" ? t.missingCustomer : t.missingAgent}
            </li>
          ))}
        </ul>
      ) : null}
      {simple ? (
        <Notice kind="warning" title={t.simpleTitle}>
          {t.simpleText}
        </Notice>
      ) : null}
      <p className="text-caption text-fg-muted">{t.buttonNote}</p>
    </DealSection>
  );
}

/* ----------------------------------------------------------------- links */

export function ContractLinksSection({ locale, detail }: { locale: Locale; detail: ContractDetailView }) {
  const t = contracts[locale].links;
  const { listing, deal, requirement, cooperation } = detail;
  const rows: { key: string; icon: LucideIcon; label: string; body: ReactNode }[] = [];
  if (listing) {
    rows.push({
      key: "listing",
      icon: Building,
      label: t.property,
      body: (
        <Link href={appPath(locale, `/properties/${encodeURIComponent(listing.listing.id)}`)} className={linkClasses}>
          {propertyTitle(locale, listing.property)}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ),
    });
  }
  if (deal) {
    rows.push({
      key: "deal",
      icon: Briefcase,
      label: t.deal,
      body: (
        <div className="flex flex-wrap items-center gap-2">
          <DealStageBadge locale={locale} stage={deal.deal.stage} />
          <Link href={dealHref(locale, deal.deal.id)} className={linkClasses}>
            {propertyTitle(locale, deal.listing.property)}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      ),
    });
  }
  if (requirement) {
    rows.push({
      key: "requirement",
      icon: ClipboardList,
      label: t.requirement,
      body: (
        <Link href={appPath(locale, `/requirements/${encodeURIComponent(requirement.id)}`)} className={linkClasses}>
          {t.openRequirement}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ),
    });
  }
  if (cooperation) {
    rows.push({
      key: "cooperation",
      icon: Handshake,
      label: t.cooperation,
      body: (
        <Link
          href={appPath(locale, `/mls/cooperation/${encodeURIComponent(cooperation.request.id)}`)}
          className={linkClasses}
        >
          {t.openCooperation}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      ),
    });
  }
  return (
    <DealSection id="contract-links" title={contracts[locale].detail.sections.links} icon={Link2}>
      {rows.length === 0 ? (
        <p className="text-small text-fg-muted">{t.none}</p>
      ) : (
        <ul className="-mx-4 divide-y divide-border">
          {rows.map(({ key, icon: Icon, label, body }) => (
            <li key={key} className="space-y-0.5 px-4 py-2">
              <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-fg-subtle">
                <Icon aria-hidden className="size-3.5 shrink-0" />
                {label}
              </p>
              {body}
            </li>
          ))}
        </ul>
      )}
      <Link href={appHref(locale, "consents")} className={linkClasses}>
        <ClipboardCheck aria-hidden className="size-4" />
        {t.consents}
      </Link>
    </DealSection>
  );
}

/* --------------------------------------------------------------- related */

export function ContractRelatedSection({
  locale,
  related,
  renewalId,
  now,
}: {
  locale: Locale;
  related: readonly ContractView[];
  renewalId?: ID;
  now: Date;
}) {
  const t = contracts[locale];
  return (
    <DealSection id="contract-related" title={t.detail.sections.related} icon={FileStack}>
      {related.length === 0 ? (
        <p className="text-small text-fg-muted">{t.related.none}</p>
      ) : (
        <ul className="-mx-4 divide-y divide-border">
          {related.map((view) => {
            const status: ContractDisplayStatus = displayStatus(view, now);
            return (
              <li key={view.contract.id}>
                <Link
                  href={contractHref(locale, view.contract.id)}
                  aria-label={format(t.related.open, { number: view.contract.number })}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-surface-muted/60"
                >
                  <span className="min-w-0 space-y-0.5">
                    <span className="tabular block text-small font-semibold text-fg">{view.contract.number}</span>
                    <span className="block text-caption text-fg-muted">
                      {format(t.card.period, {
                        from: formatDate(locale, view.contract.startsAt),
                        to: formatDate(locale, view.contract.endsAt),
                      })}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {view.contract.id === renewalId ? <Badge tone="brand">{t.related.renewal}</Badge> : null}
                    <ContractStatusBadge locale={locale} status={status} daysLeft={view.daysLeft} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DealSection>
  );
}
