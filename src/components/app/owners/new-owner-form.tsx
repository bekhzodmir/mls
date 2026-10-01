"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { Building, CircleCheck, ExternalLink, Info, KeyRound, Save, ShieldCheck, Undo2, UserX, Users } from "lucide-react";
import {
  ErrorSummary,
  FieldError,
  FieldHint,
  FieldLabel,
  SegmentedRadio,
  ToggleChip,
  inputClasses,
} from "@/components/app/crm/form-controls";
import { phoneStatus } from "@/components/app/crm/duplicates";
import { PhoneField } from "@/components/app/crm/phone-field";
import { requestHref } from "@/components/app/verification/queue";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatList } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import owners from "@/i18n/messages/owners";
import type { Consent, ConsentPurpose } from "@/lib/domain/types";
import { appHref, appPath } from "@/lib/routes";
import {
  CONSENT_CHANNELS,
  findPhoneDuplicates,
  OWNER_CONSENT_PURPOSES,
  OWNER_CONSENT_TEXT_VERSION,
  personKey,
  validateNewOwner,
  type NewOwnerField,
  type PersonCard,
} from "./new-owner";

/** One of the viewer's listings the new owner can be linked to (serializable). */
export interface PropertyOption {
  listingId: string;
  label: string;
  /** Name of the property's current owner when the viewer knows it. */
  ownerName?: string;
}

/**
 * New owner (§20.3 progressive disclosure, §21.4 #26): name and phone first,
 * with the duplicate check by normalized phone before saving; then an
 * optional link to one of the viewer's properties and the consent per
 * purpose. Saving is demo-only local state and says so.
 */
export function NewOwnerForm({
  locale,
  people,
  properties,
  hiddenOwners,
  initial,
}: {
  locale: Locale;
  people: PersonCard[];
  properties: PropertyOption[];
  /** Owners in the organization whose phone the viewer cannot see (not checked). */
  hiddenOwners: number;
  initial: { phone?: string; listingId?: string };
}) {
  const t = owners[locale].form;
  const d = domain[locale];
  const id = useId();
  const ids: Record<NewOwnerField | "property", string> = {
    name: `${id}-name`,
    phone: `${id}-phone`,
    duplicates: `${id}-duplicates`,
    property: `${id}-property`,
    channel: `${id}-channel`,
    consentObtained: `${id}-obtained`,
  };
  const summaryRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [listingId, setListingId] = useState(initial.listingId ?? "");
  const [purposes, setPurposes] = useState<ConsentPurpose[]>([]);
  const [channel, setChannel] = useState<Consent["channel"]>();
  const [consentObtained, setConsentObtained] = useState(false);
  const [differentFrom, setDifferentFrom] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);

  const hits = findPhoneDuplicates(phone, name, people);
  const problems = validateNewOwner({ name, phone, purposes, channel, consentObtained, differentFrom }, hits);
  const errors = problems.map((problem) => ({ id: ids[problem.field], text: t.errors[problem.error] }));
  const errorFor = (field: NewOwnerField) => {
    if (!submitted) return undefined;
    const problem = problems.find((item) => item.field === field);
    return problem ? t.errors[problem.error] : undefined;
  };
  const property = properties.find((item) => item.listingId === listingId);
  const phoneValid = phoneStatus(phone).state === "valid";
  // Consent texts follow the order of the purpose chips, not the order of clicks.
  const chosen = OWNER_CONSENT_PURPOSES.filter((purpose) => purposes.includes(purpose));

  function togglePurpose(purpose: ConsentPurpose, checked: boolean) {
    setPurposes((current) => (checked ? [...current, purpose] : current.filter((item) => item !== purpose)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (problems.length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSaved(true);
  }

  if (saved) {
    return (
      <div role="status" className="space-y-4">
        <Notice kind="info" title={t.demoTitle}>
          <div className="space-y-1">
            <p className="flex items-start gap-1.5">
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              {format(t.success, { name: name.trim() })}
            </p>
            <p>
              {chosen.length > 0 && channel
                ? format(t.successConsent, {
                    purposes: formatList(
                      locale,
                      chosen.map((purpose) => d.consentPurpose[purpose]),
                    ),
                    channel: d.consentChannel[channel],
                    version: OWNER_CONSENT_TEXT_VERSION,
                  })
                : t.successNoConsent}
            </p>
            {property ? <p>{format(t.successProperty, { label: property.label })}</p> : null}
            <p className="pt-1">{t.next}</p>
          </div>
        </Notice>
        <div className="flex flex-wrap gap-2">
          {property ? (
            <Link href={requestHref(locale, { listingId: property.listingId })} className={buttonClasses("primary")}>
              <ShieldCheck aria-hidden className="size-4" />
              {t.toRequest}
            </Link>
          ) : (
            <Link href={appHref(locale, "propertiesNew")} className={buttonClasses("primary")}>
              <Building aria-hidden className="size-4" />
              {t.toProperty}
            </Link>
          )}
          <Link href={appHref(locale, "owners")} className={buttonClasses("secondary")}>
            {t.toList}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Notice kind="info" title={t.demoTitle}>
        {t.demo}
      </Notice>

      {submitted ? (
        <ErrorSummary title={format(t.errorSummary, { n: errors.length })} errors={errors} summaryRef={summaryRef} />
      ) : null}

      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.name}>{t.name}</FieldLabel>
        <input
          id={ids.name}
          value={name}
          required
          autoComplete="name"
          placeholder={t.namePlaceholder}
          aria-invalid={errorFor("name") ? true : undefined}
          aria-describedby={errorFor("name") ? `${ids.name}-error` : undefined}
          onChange={(event) => setName(event.target.value)}
          className={inputClasses}
        />
        {errorFor("name") ? <FieldError id={`${ids.name}-error`}>{errorFor("name")}</FieldError> : null}
      </div>

      <div className="space-y-1.5">
        <PhoneField
          id={ids.phone}
          locale={locale}
          value={phone}
          onChange={setPhone}
          label={t.phone}
          showErrors={submitted}
          required
        />
        {initial.phone && phone === initial.phone ? <FieldHint>{t.prefilledPhone}</FieldHint> : null}
        {errorFor("phone") && phone.trim() === "" ? <FieldError>{errorFor("phone")}</FieldError> : null}
      </div>

      <div id={ids.duplicates} tabIndex={-1} aria-live="polite" className="space-y-2">
        {hits.length > 0 ? (
          <div className="space-y-3 rounded-md border border-warning-border bg-warning-bg p-3 text-small text-warning-fg">
            <p className="flex items-center gap-2 font-semibold">
              <Users aria-hidden className="size-4 shrink-0" />
              {t.duplicatesTitle}
            </p>
            <p>{t.duplicatesText}</p>
            <ul className="space-y-3">
              {hits.map(({ person, sameName }) => {
                const key = personKey(person);
                const different = differentFrom.includes(key);
                const href = appPath(locale, `/${person.kind === "owner" ? "owners" : "clients"}/${encodeURIComponent(person.id)}`);
                return (
                  <li key={key} className="space-y-2 rounded-sm bg-surface/70 p-2 text-fg">
                    <p className="flex flex-wrap items-center gap-2">
                      <Badge icon={person.kind === "owner" ? KeyRound : Users}>{t.duplicateKind[person.kind]}</Badge>
                      <span className="font-semibold">{person.name}</span>
                      {sameName ? <span className="text-caption text-fg-muted">· {t.sameName}</span> : null}
                    </p>
                    {different ? (
                      <p className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral" icon={UserX}>
                          {t.differentDone}
                        </Badge>
                        <Button
                          variant="ghost"
                          onClick={() => setDifferentFrom((current) => current.filter((item) => item !== key))}
                        >
                          <Undo2 aria-hidden className="size-4" />
                          {t.undoDifferent}
                        </Button>
                      </p>
                    ) : (
                      <div
                        role="group"
                        aria-label={format(t.decisionLabel, { name: person.name })}
                        className="flex flex-wrap gap-2"
                      >
                        <Link href={href} className={buttonClasses("secondary", "md")}>
                          <ExternalLink aria-hidden className="size-4" />
                          {t.open}
                        </Link>
                        <Button
                          variant="secondary"
                          onClick={() => setDifferentFrom((current) => [...current, key])}
                        >
                          <UserX aria-hidden className="size-4" />
                          {t.different}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {errorFor("duplicates") ? <FieldError>{errorFor("duplicates")}</FieldError> : null}
          </div>
        ) : phoneValid ? (
          <p className="flex items-start gap-1.5 text-caption text-fg-muted">
            <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />
            {t.noDuplicates}
          </p>
        ) : null}
        {phoneValid && hiddenOwners > 0 ? (
          <p className="flex items-start gap-1.5 text-caption text-fg-muted">
            <Info aria-hidden className="mt-px size-3.5 shrink-0" />
            {t.hiddenNote}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.property} optional={t.optional}>
          {t.property}
        </FieldLabel>
        <select
          id={ids.property}
          value={listingId}
          aria-describedby={`${ids.property}-hint`}
          onChange={(event) => setListingId(event.target.value)}
          className={inputClasses}
        >
          <option value="">{t.propertyNone}</option>
          {properties.map((option) => (
            <option key={option.listingId} value={option.listingId}>
              {option.label}
            </option>
          ))}
        </select>
        <div id={`${ids.property}-hint`}>
          {property ? (
            <p className="text-caption text-fg">
              {property.ownerName ? format(t.propertyOwner, { name: property.ownerName }) : t.propertyOwnerUnknown}
            </p>
          ) : (
            <FieldHint>{t.propertyHint}</FieldHint>
          )}
        </div>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 text-small font-semibold text-fg">{t.consent}</legend>
        <FieldHint>{t.consentHint}</FieldHint>

        <div role="group" aria-label={t.purposes} className="flex flex-wrap gap-2">
          {OWNER_CONSENT_PURPOSES.map((purpose) => (
            <ToggleChip
              key={purpose}
              checked={purposes.includes(purpose)}
              onChange={(checked) => togglePurpose(purpose, checked)}
            >
              {d.consentPurpose[purpose]}
            </ToggleChip>
          ))}
        </div>

        {chosen.length > 0 ? (
          <div className="space-y-4">
            <div id={ids.channel} tabIndex={-1}>
              <SegmentedRadio<Consent["channel"]>
                name={`${id}-channel-radio`}
                legend={t.channel}
                value={channel}
                onChange={setChannel}
                invalid={Boolean(errorFor("channel"))}
                describedBy={errorFor("channel") ? `${ids.channel}-error` : undefined}
                options={CONSENT_CHANNELS.map((code) => ({ value: code, label: d.consentChannel[code] }))}
              />
              {errorFor("channel") ? <FieldError id={`${ids.channel}-error`}>{errorFor("channel")}</FieldError> : null}
            </div>

            <div className="space-y-2 rounded-md bg-surface-muted p-3">
              <p className="text-caption font-semibold text-fg">
                {format(t.textTitle, { version: OWNER_CONSENT_TEXT_VERSION })}
              </p>
              <ul className="space-y-2">
                {chosen.map((purpose) => (
                  <li key={purpose} className="text-small text-fg">
                    <span className="font-medium">{d.consentPurpose[purpose]}:</span> {t.text[purpose]}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <label htmlFor={ids.consentObtained} className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-small text-fg">
                <input
                  id={ids.consentObtained}
                  type="checkbox"
                  checked={consentObtained}
                  aria-invalid={errorFor("consentObtained") ? true : undefined}
                  aria-describedby={`${ids.consentObtained}-hint${errorFor("consentObtained") ? ` ${ids.consentObtained}-error` : ""}`}
                  onChange={(event) => setConsentObtained(event.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                />
                <span className="font-medium">{t.obtained}</span>
              </label>
              <FieldHint id={`${ids.consentObtained}-hint`}>{t.obtainedHint}</FieldHint>
              {errorFor("consentObtained") ? (
                <FieldError id={`${ids.consentObtained}-error`}>{errorFor("consentObtained")}</FieldError>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="flex items-start gap-1.5 text-caption text-fg-muted">
            <Info aria-hidden className="mt-px size-3.5 shrink-0" />
            {t.noConsentNote}
          </p>
        )}
      </fieldset>

      <Button type="submit" size="lg" className="w-full sm:w-auto">
        <Save aria-hidden className="size-5" />
        {t.submit}
      </Button>
    </form>
  );
}
