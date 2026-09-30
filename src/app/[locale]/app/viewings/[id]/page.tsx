import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowRight, Building, Handshake, MapPin, Phone, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { CrmTabs } from "@/components/app/crm-tabs";
import { locationLine, propertyTitle } from "@/components/app/inventory/labels";
import { AccessBadge, AttributeChips } from "@/components/app/inventory/listing-badges";
import { PageHeader } from "@/components/app/page-header";
import { newViewingHref, viewingListHref } from "@/components/app/viewings/agenda";
import { timeRange } from "@/components/app/viewings/agenda-view";
import { toExistingSlot } from "@/components/app/viewings/new-viewing";
import {
  ViewingActionBar,
  ViewingDemoProvider,
  ViewingResultCard,
  ViewingStatusCard,
} from "@/components/app/viewings/viewing-live";
import { FreshnessBadge, MoneyText } from "@/components/domain/badges";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, Field } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDay } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import viewings from "@/i18n/messages/viewings";
import { getLocale } from "@/i18n/server";
import { now } from "@/lib/clock";
import { loadViewing } from "@/lib/data/cached";
import { getViewer, listRequirements, listViewings } from "@/lib/data/repository";
import type { ViewingView } from "@/lib/data/views";
import { districtName } from "@/lib/domain/geo";
import { formatUzPhone, telHref } from "@/lib/domain/phone";
import type { Agent } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";


export async function generateMetadata({ params }: PageProps<"/[locale]/app/viewings/[id]">): Promise<Metadata> {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadViewing(id);
  const t = viewings[locale].meta;
  // Privacy-safe label only (type, rooms, massif) — never the address.
  return { title: view ? `${t.detail}: ${propertyTitle(locale, view.listing.property)}` : t.detail };
}

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`}>
      <Card className="space-y-3 p-4">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-h2 text-fg">
          <Icon aria-hidden className="size-5 shrink-0 text-fg-muted" />
          {title}
        </h2>
        {children}
      </Card>
    </section>
  );
}

/** Address only with the right to see it (§35.2 row 9, §18.2); otherwise district, landmark and why. */
function PlaceSection({ locale, view, cooperationHref }: { locale: Locale; view: ViewingView; cooperationHref: string }) {
  const t = viewings[locale].detail;
  const property = view.listing.property;
  return (
    <Section id="viewing-place" title={t.sections.place} icon={MapPin}>
      <dl className="divide-y divide-border">
        <Field label={t.district} value={districtName(property.district, locale)} />
        {property.areaName ? <Field label={t.area} value={property.areaName} /> : null}
        <Field label={t.landmark} value={property.landmark ?? <span className="italic text-fg-muted">{domain[locale].unknown}</span>} />
        {property.address ? <Field label={t.address} value={property.address} /> : null}
      </dl>
      {property.address ? null : (
        <Notice
          kind="permission"
          title={t.addressRestricted.title}
          action={
            <ButtonLink href={cooperationHref} variant="secondary">
              <Handshake aria-hidden className="size-4" />
              {t.addressRestricted.action}
            </ButtonLink>
          }
        >
          {format(t.addressRestricted.text, { agent: view.listing.agent.name })}
        </Notice>
      )}
    </Section>
  );
}

function PropertySection({ locale, view }: { locale: Locale; view: ViewingView }) {
  const t = viewings[locale].detail;
  const { listing, property } = view.listing;
  return (
    <Section id="viewing-property" title={t.sections.property} icon={Building}>
      <div className="space-y-2">
        <p className="text-body font-semibold text-fg">{propertyTitle(locale, property)}</p>
        <p className="text-small text-fg-muted">{locationLine(locale, property)}</p>
        <p className="text-small">
          <span className="text-fg-muted">{t.price}: </span>
          <MoneyText locale={locale} value={listing.price} className="font-semibold text-fg" />
          <span className="text-fg-muted"> · {domain[locale].dealType[listing.dealType]}</span>
        </p>
        <AttributeChips locale={locale} facts={property} />
        <div className="flex flex-wrap gap-1.5">
          <AccessBadge locale={locale} access={view.listing.access} />
          <FreshnessBadge locale={locale} freshness={view.listing.freshness} />
        </div>
      </div>
      <Link
        href={appPath(locale, `/properties/${encodeURIComponent(listing.id)}`)}
        className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-primary underline-offset-2 hover:underline"
      >
        {t.openProperty}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </Section>
  );
}

function Person({
  locale,
  name,
  role,
  you,
  phone,
  note,
}: {
  locale: Locale;
  name: string;
  role: string;
  you?: boolean;
  phone?: string;
  note?: string;
}) {
  const t = viewings[locale].detail;
  return (
    <li className="flex items-start gap-3 py-3">
      <Avatar name={name} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">{role}</p>
        <p className="text-small font-semibold text-fg">
          {name}
          {you ? <Badge className="ml-2 align-middle">{t.you}</Badge> : null}
        </p>
        {note ? <p className="text-caption text-fg-muted">{note}</p> : null}
      </div>
      {phone ? (
        <a
          href={telHref(phone)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border text-fg hover:bg-surface-muted"
          aria-label={format(t.call, { name })}
          title={formatUzPhone(phone)}
        >
          <Phone aria-hidden className="size-4" />
        </a>
      ) : null}
    </li>
  );
}

function ParticipantsSection({ locale, view, viewer }: { locale: Locale; view: ViewingView; viewer: Agent }) {
  const t = viewings[locale].detail;
  const listingAgent = view.listing.agent;
  const ownListing = view.listing.access === "owner" || view.listing.access === "agency";
  const showListingAgent = !view.partner && listingAgent.id !== view.agent.id;
  return (
    <Section id="viewing-participants" title={t.sections.participants} icon={Users}>
      <ul className="-my-3 divide-y divide-border">
        <Person locale={locale} name={view.client.name} role={t.roles.client} phone={view.client.phones[0]} />
        <Person locale={locale} name={view.agent.name} role={t.roles.agent} you={view.agent.id === viewer.id} />
        {view.partner ? (
          <Person locale={locale} name={view.partner.name} role={t.roles.partner} phone={view.partner.phone} />
        ) : null}
        {showListingAgent ? (
          <Person locale={locale} name={listingAgent.name} role={t.roles.listingAgent} phone={listingAgent.phone} />
        ) : null}
        <li className="py-3">
          <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">{t.roles.owner}</p>
          <p className="mt-1 text-small text-fg-muted">
            {ownListing && listingAgent.id === viewer.id
              ? t.ownerOwn
              : format(t.ownerViaAgent, { agent: (view.partner ?? listingAgent).name })}
          </p>
        </li>
      </ul>
    </Section>
  );
}

/**
 * Viewing detail (§22.10, §8.3 flow 9): time and place (address only with
 * rights), property, participants, confirmations, the outcome with a
 * mandatory next step, and demo actions — confirm, reschedule, cancel with a
 * reason, record the outcome — that stay on this page.
 */
export default async function ViewingPage({ params }: PageProps<"/[locale]/app/viewings/[id]">) {
  const locale = await getLocale();
  const { id } = await params;
  const view = await loadViewing(id);
  if (!view) notFound();

  const at = now();
  const t = viewings[locale].detail;
  const [{ agent: viewer }, all, requirements] = await Promise.all([
    getViewer(),
    listViewings(),
    listRequirements({ clientId: view.client.id, status: "active" }),
  ]);

  const slots = all.map((item) =>
    toExistingSlot(item.viewing, item.client.name, propertyTitle(locale, item.listing.property)),
  );
  const listingAgent = view.listing.agent;
  const lower = (text: string) => text.toLocaleLowerCase(locale);
  const participants = [
    `${view.client.name} (${lower(t.roles.client)})`,
    view.partner
      ? `${view.partner.name} (${lower(t.roles.partner)})`
      : listingAgent.id === viewer.id
        ? lower(t.roles.owner)
        : `${listingAgent.name} (${lower(t.roles.listingAgent)})`,
  ];
  const cooperationQuery = new URLSearchParams({ listingId: view.listing.listing.id });
  if (requirements[0]) cooperationQuery.set("requirementId", requirements[0].requirement.id);
  const cooperationHref = `${appPath(locale, "/mls/cooperation/new")}?${cooperationQuery}`;

  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <PageHeader
        locale={locale}
        title={propertyTitle(locale, view.listing.property)}
        subtitle={`${formatDay(locale, view.viewing.startsAt)} · ${timeRange(locale, view.viewing.startsAt, view.viewing.durationMinutes)} · ${view.client.name}`}
        backHref={viewingListHref(locale)}
        className="mb-0"
      >
        <CrmTabs locale={locale} />
      </PageHeader>

      <ViewingDemoProvider
        locale={locale}
        viewing={view.viewing}
        nowIso={at.toISOString()}
        slots={slots}
        hasPartner={Boolean(view.viewing.partnerAgentId)}
        participants={participants}
        newViewingHref={newViewingHref(locale, { clientId: view.client.id, listingId: view.listing.listing.id })}
        clientHref={appPath(locale, `/clients/${encodeURIComponent(view.client.id)}`)}
      >
        <ViewingActionBar />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
          <div className="space-y-4">
            <ViewingStatusCard />
            <PlaceSection locale={locale} view={view} cooperationHref={cooperationHref} />
            <ViewingResultCard />
          </div>
          <div className="space-y-4">
            <PropertySection locale={locale} view={view} />
            <ParticipantsSection locale={locale} view={view} viewer={viewer} />
          </div>
        </div>
      </ViewingDemoProvider>
    </div>
  );
}
