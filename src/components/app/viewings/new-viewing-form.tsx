"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarCheck, CalendarPlus, Handshake, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDateTime, formatList, formatTime } from "@/i18n/format";
import viewings from "@/i18n/messages/viewings";
import { DEFAULT_DURATION, DURATION_OPTIONS } from "./agenda";
import { CheckRow, ErrorSummary, Hint, InlineError, inputClasses, Label } from "./form-parts";
import {
  checkNewViewing,
  type ClientOption,
  type ExistingSlot,
  type ListingGroup,
  type ListingOption,
  type NewViewingError,
} from "./new-viewing";
import { tashkentParts } from "./time";

/**
 * "Новый просмотр" (§8.3 flow 9, §22.10): client + listing + Tashkent date
 * and time + duration, with a live overlap check against the agent's other
 * viewings. Saving is a demo — the confirmation says nothing was stored or
 * sent.
 */

const GROUPS: readonly ListingGroup[] = ["owner", "agency", "partner"];

interface Saved {
  client: string;
  property: string;
  startsAt: string;
}

export function NewViewingForm({
  locale,
  clients,
  listings,
  slots,
  nowIso,
  initialClientId,
  initialListingId,
  listHref,
  cooperationHref,
}: {
  locale: Locale;
  clients: ClientOption[];
  listings: ListingOption[];
  slots: ExistingSlot[];
  nowIso: string;
  initialClientId?: string;
  initialListingId?: string;
  listHref: string;
  /** `/mls/cooperation/new` without a query; ids are added for the chosen listing and client. */
  cooperationHref: string;
}) {
  const t = viewings[locale].form;
  const id = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const today = tashkentParts(now).date;

  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [listingId, setListingId] = useState(initialListingId ?? "");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  const [clientConfirmed, setClientConfirmed] = useState(false);
  const [otherConfirmed, setOtherConfirmed] = useState(false);
  const [overlapAcknowledged, setOverlapAcknowledged] = useState(false);
  const [submitted, setSubmitted] = useState(0);
  const [saved, setSaved] = useState<Saved | null>(null);

  const check = checkNewViewing(
    { clientId, listingId, date, time, durationMinutes: duration, overlapAcknowledged },
    now,
    { slots, clientIds: clients.map((client) => client.id), listingIds: listings.map((listing) => listing.id) },
  );
  const listing = listings.find((item) => item.id === listingId);
  const client = clients.find((item) => item.id === clientId);
  const showErrors = submitted > 0;
  const has = (code: NewViewingError) => showErrors && check.errors.includes(code);

  useEffect(() => {
    if (submitted > 0) summaryRef.current?.focus();
  }, [submitted]);

  const errorText: Record<NewViewingError, string> = t.errors;
  const fieldOf: Record<NewViewingError, string> = {
    client: `${id}-client`,
    listing: `${id}-listing`,
    date: `${id}-date`,
    time: `${id}-time`,
    past: `${id}-time`,
    overlap: `${id}-overlap`,
  };

  const coopHref = (() => {
    if (!listing) return cooperationHref;
    const query = new URLSearchParams({ listingId: listing.id });
    if (client?.requirementId) query.set("requirementId", client.requirementId);
    return `${cooperationHref}?${query}`;
  })();

  const overlapList = formatList(locale, 
    check.overlaps.map((slot) => `${formatTime(locale, slot.startsAt)} · ${slot.clientName} · ${slot.propertyLabel}`),
  );

  if (saved) {
    return (
      <Card className="space-y-3 p-4" role="status">
        <p className="flex items-center gap-2 text-h2 text-fg">
          <CalendarCheck aria-hidden className="size-5 shrink-0 text-success-fg" />
          {t.saved.title}
        </p>
        <p className="text-body text-fg">
          {format(t.saved.summary, {
            client: saved.client,
            property: saved.property,
            when: formatDateTime(locale, saved.startsAt),
          })}
        </p>
        <Notice kind="info">{t.saved.text}</Notice>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={listHref}>{t.saved.list}</ButtonLink>
          <Button
            variant="secondary"
            onClick={() => {
              setSaved(null);
              setTime("");
              setSubmitted(0);
              setOverlapAcknowledged(false);
            }}
          >
            <CalendarPlus aria-hidden className="size-4" />
            {t.saved.again}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <form
      noValidate
      className="max-w-2xl space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (check.errors.length === 0 && check.startsAt && client && listing) {
          setSaved({ client: client.name, property: listing.label, startsAt: check.startsAt });
          return;
        }
        setSubmitted((count) => count + 1);
      }}
    >
      <ErrorSummary
        title={t.errorsTitle}
        errors={
          showErrors
            ? check.errors.map((code) => ({ id: fieldOf[code], text: errorText[code] }))
            : []
        }
        summaryRef={summaryRef}
      />

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-client`}>{t.client}</Label>
        <select
          id={`${id}-client`}
          className={inputClasses}
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          aria-invalid={has("client") || undefined}
          aria-describedby={has("client") ? `${id}-client-error` : undefined}
          required
        >
          <option value="">{t.chooseClient}</option>
          {clients.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        {has("client") ? <InlineError id={`${id}-client-error`}>{t.errors.client}</InlineError> : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-listing`}>{t.listing}</Label>
        <select
          id={`${id}-listing`}
          className={inputClasses}
          value={listingId}
          onChange={(event) => setListingId(event.target.value)}
          aria-invalid={has("listing") || undefined}
          aria-describedby={`${listing ? `${id}-listing-hint` : ""}${has("listing") ? ` ${id}-listing-error` : ""}` || undefined}
          required
        >
          <option value="">{t.chooseListing}</option>
          {GROUPS.map((group) => {
            const options = listings.filter((option) => option.group === group);
            if (options.length === 0) return null;
            return (
              <optgroup key={group} label={t.listingGroups[group]}>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} · {option.price}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {listing ? (
          <Hint id={`${id}-listing-hint`}>
            {listing.price} · {listing.agentName}
          </Hint>
        ) : null}
        {has("listing") ? <InlineError id={`${id}-listing-error`}>{t.errors.listing}</InlineError> : null}
      </div>

      {listing?.group === "partner" ? (
        <Notice
          kind={listing.access === "partner_masked" ? "permission" : "info"}
          title={format(t.partner.title, { agent: listing.agentName })}
          action={
            listing.access === "partner_masked" ? (
              <ButtonLink href={coopHref} variant="secondary">
                <Handshake aria-hidden className="size-4" />
                {t.partner.request}
              </ButtonLink>
            ) : undefined
          }
        >
          {listing.access === "partner_masked" ? t.partner.masked : t.partner.shared}
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-date`}>{t.date}</Label>
          <input
            id={`${id}-date`}
            type="date"
            className={inputClasses}
            value={date}
            min={today}
            onChange={(event) => setDate(event.target.value)}
            aria-invalid={has("date") || undefined}
            aria-describedby={has("date") ? `${id}-date-error` : undefined}
            required
          />
          {has("date") ? <InlineError id={`${id}-date-error`}>{t.errors.date}</InlineError> : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-time`}>{t.time}</Label>
          <input
            id={`${id}-time`}
            type="time"
            step={300}
            className={inputClasses}
            value={time}
            onChange={(event) => setTime(event.target.value)}
            aria-invalid={has("time") || has("past") || undefined}
            aria-describedby={`${id}-tz${has("time") || has("past") ? ` ${id}-time-error` : ""}`}
            required
          />
          {has("time") || has("past") ? (
            <InlineError id={`${id}-time-error`}>{has("time") ? t.errors.time : t.errors.past}</InlineError>
          ) : null}
        </div>
      </div>
      <Hint id={`${id}-tz`}>{t.timeHint}</Hint>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-duration`}>{t.duration}</Label>
        <select
          id={`${id}-duration`}
          className={inputClasses}
          value={duration}
          onChange={(event) => setDuration(Number(event.target.value))}
        >
          {DURATION_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {format(t.minutes, { n: minutes })}
            </option>
          ))}
        </select>
      </div>

      <div id={`${id}-overlap`} aria-live="polite" tabIndex={-1}>
        {check.startsAt && check.overlaps.length > 0 ? (
          <div className="space-y-2 rounded-md border border-warning-border bg-warning-bg p-3 text-small text-warning-fg">
            <p className="flex items-start gap-2 font-semibold">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t.overlapTitle}
            </p>
            <p>{overlapList}</p>
            <CheckRow checked={overlapAcknowledged} onChange={setOverlapAcknowledged}>
              {t.overlapAck}
            </CheckRow>
            {has("overlap") ? <InlineError>{t.errors.overlap}</InlineError> : null}
          </div>
        ) : check.startsAt && !check.errors.includes("past") ? (
          <p className="flex items-center gap-2 text-small text-fg-muted">
            <CalendarCheck aria-hidden className="size-4 shrink-0" />
            {t.noOverlap}
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-1">
        <legend className="text-small font-semibold text-fg">{t.already}</legend>
        <CheckRow checked={clientConfirmed} onChange={setClientConfirmed}>
          {t.clientConfirmed}
        </CheckRow>
        <CheckRow checked={otherConfirmed} onChange={setOtherConfirmed}>
          {listing?.group === "partner" ? t.partnerConfirmed : t.ownerConfirmed}
        </CheckRow>
      </fieldset>

      <Button type="submit" size="lg">
        <CalendarPlus aria-hidden className="size-5" />
        {t.submit}
      </Button>
    </form>
  );
}
