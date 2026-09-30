"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { ChevronDown, CircleCheck, Plus, Save, SearchCheck, Trash2 } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import clients from "@/i18n/messages/clients";
import domain from "@/i18n/messages/domain";
import leads from "@/i18n/messages/leads";
import {
  leadSources,
  type Consent,
  type ConsentPurpose,
  type Language,
  type LeadSource,
  type RelatedPartyRole,
} from "@/lib/domain/types";
import { appHref } from "@/lib/routes";
import { DuplicateNotice, type DuplicateDecision } from "./duplicate-notice";
import { findDuplicateClients, normalizeTelegram, phoneStatus, type ContactCard } from "./duplicates";
import {
  CheckboxRow,
  ErrorSummary,
  FieldError,
  FieldHint,
  FieldLabel,
  SegmentedRadio,
  inputClasses,
} from "./form-controls";
import { PhoneField } from "./phone-field";

const purposes: ConsentPurpose[] = ["contact", "share_with_partners", "document_processing", "marketing"];
const channels: Consent["channel"][] = ["written", "electronic", "verbal_recorded"];
const roles: RelatedPartyRole[] = ["spouse", "family", "co_owner", "proxy", "company_rep"];

interface PartyRow {
  key: number;
  name: string;
  role: RelatedPartyRole;
  phone: string;
}

export interface NewClientInitial {
  leadId?: string;
  name?: string;
  phone?: string;
  telegram?: string;
  source?: LeadSource;
  language?: Language;
}

/**
 * New client (§20.3 progressive disclosure, §34.2, §35.3 step 6): name,
 * contact, source and language first; the duplicate check by phone or
 * Telegram runs before saving; related parties and consents are optional and
 * folded away. Each consent is a separate purpose with its channel. Saving is
 * demo-only local state.
 */
export function NewClientForm({
  locale,
  clients: existing,
  initial = {},
}: {
  locale: Locale;
  clients: ContactCard[];
  initial?: NewClientInitial;
}) {
  const t = clients[locale].form;
  const l = leads[locale];
  const d = domain[locale];
  const id = useId();
  const ids = {
    name: `${id}-name`,
    phone: `${id}-phone`,
    telegram: `${id}-telegram`,
    source: `${id}-source`,
    duplicate: `${id}-duplicate`,
    parties: `${id}-parties`,
  };
  const summaryRef = useRef<HTMLDivElement>(null);
  const nextKey = useRef(1);

  const [name, setName] = useState(initial.name ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [telegram, setTelegram] = useState(initial.telegram ?? "");
  const [source, setSource] = useState<LeadSource | "">(initial.source ?? "");
  const [language, setLanguage] = useState<Language>(initial.language ?? locale);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [consents, setConsents] = useState<Partial<Record<ConsentPurpose, Consent["channel"]>>>({});
  const [decision, setDecision] = useState<{ clientId: string; value: DuplicateDecision }>();
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState<string>();
  const [moreOpen, setMoreOpen] = useState(false);

  const phoneState = phoneStatus(phone);
  const telegramValue = normalizeTelegram(telegram);
  const hits = findDuplicateClients(
    { name, phones: phoneState.e164 ? [phoneState.e164] : [], telegramUsername: telegramValue },
    existing,
  );
  const best = hits[0];
  const currentDecision = best && decision?.clientId === best.client.id ? decision.value : undefined;

  const errors: { id: string; text: string }[] = [];
  if (!name.trim()) errors.push({ id: ids.name, text: t.errorName });
  if (phoneState.state === "empty" && !telegram.trim()) errors.push({ id: ids.phone, text: t.errorContact });
  if (phoneState.state === "incomplete" || phoneState.state === "invalid")
    errors.push({ id: ids.phone, text: t.errorPhone });
  if (telegram.trim() && !telegramValue) errors.push({ id: ids.telegram, text: l.form.errorTelegram });
  if (!source) errors.push({ id: ids.source, text: l.form.errorSource });
  if (best && !currentDecision) errors.push({ id: ids.duplicate, text: l.form.errorDuplicate });
  parties.forEach((party) => {
    if (!party.name.trim()) errors.push({ id: `${ids.parties}-${party.key}-name`, text: t.errorParty });
    const state = phoneStatus(party.phone).state;
    if (state === "incomplete" || state === "invalid") {
      errors.push({ id: `${ids.parties}-${party.key}-phone`, text: t.errorPartyPhone });
    }
  });
  const errorFor = (fieldId: string) => (submitted ? errors.find((error) => error.id === fieldId)?.text : undefined);

  function updateParty(key: number, patch: Partial<PartyRow>) {
    setParties((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (errors.length > 0) {
      // Errors inside the folded section must be reachable from the summary links.
      if (errors.some((error) => error.id.startsWith(ids.parties))) setMoreOpen(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSaved(name.trim());
  }

  if (saved) {
    const requirementHref = initial.leadId
      ? `${appHref(locale, "requirementsNew")}?leadId=${encodeURIComponent(initial.leadId)}`
      : appHref(locale, "requirementsNew");
    return (
      <div role="status" className="space-y-4">
        <Notice kind="info" title={t.demoTitle}>
          <p className="flex items-start gap-1.5">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            {format(t.success, { name: saved })}
          </p>
          <p className="mt-1">{t.successNext}</p>
        </Notice>
        <div className="flex flex-wrap gap-2">
          <Link href={requirementHref} className={buttonClasses("primary")}>
            <SearchCheck aria-hidden className="size-4" />
            {t.toRequirement}
          </Link>
          <Link href={appHref(locale, "clients")} className={buttonClasses("secondary")}>
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
          aria-invalid={errorFor(ids.name) ? true : undefined}
          onChange={(event) => setName(event.target.value)}
          className={inputClasses}
        />
        {errorFor(ids.name) ? <FieldError>{errorFor(ids.name)}</FieldError> : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <PhoneField id={ids.phone} locale={locale} value={phone} onChange={setPhone} showErrors={submitted} />
        <div className="space-y-1.5">
          <FieldLabel htmlFor={ids.telegram} optional={t.optional}>
            {t.telegram}
          </FieldLabel>
          <input
            id={ids.telegram}
            value={telegram}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={l.form.telegramPlaceholder}
            aria-invalid={errorFor(ids.telegram) ? true : undefined}
            onChange={(event) => setTelegram(event.target.value)}
            className={inputClasses}
          />
          {errorFor(ids.telegram) ? <FieldError>{errorFor(ids.telegram)}</FieldError> : null}
        </div>
      </div>
      {submitted && errorFor(ids.phone) === t.errorContact ? <FieldError>{t.errorContact}</FieldError> : null}

      <div id={ids.duplicate} tabIndex={-1} aria-live="polite">
        {best ? (
          <DuplicateNotice
            locale={locale}
            hits={hits}
            variant="form"
            decision={currentDecision}
            onDecide={(value) => setDecision(value ? { clientId: best.client.id, value } : undefined)}
          />
        ) : phoneState.state === "valid" ? (
          <p className="flex items-center gap-1.5 text-caption text-fg-muted">
            <CircleCheck aria-hidden className="size-3.5" />
            {l.form.noDuplicates}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel htmlFor={ids.source}>{t.source}</FieldLabel>
          <select
            id={ids.source}
            value={source}
            required
            aria-invalid={errorFor(ids.source) ? true : undefined}
            onChange={(event) => setSource(event.target.value as LeadSource | "")}
            className={inputClasses}
          >
            <option value="">{l.form.sourcePlaceholder}</option>
            {leadSources.map((code) => (
              <option key={code} value={code}>
                {d.leadSource[code]}
              </option>
            ))}
          </select>
          {errorFor(ids.source) ? <FieldError>{errorFor(ids.source)}</FieldError> : null}
        </div>
        <SegmentedRadio<Language>
          name={`${id}-language`}
          legend={t.language}
          value={language}
          onChange={setLanguage}
          options={[
            { value: "ru", label: l.language.ru },
            { value: "uz", label: l.language.uz },
          ]}
        />
      </div>

      <details
        className="group rounded-lg border border-border bg-surface"
        open={moreOpen}
        onToggle={(event) => setMoreOpen(event.currentTarget.open)}
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-small font-semibold text-fg">{t.more}</span>
            <span className="block text-caption text-fg-muted">{t.moreHint}</span>
          </span>
          <ChevronDown
            aria-hidden
            className="size-5 shrink-0 text-fg-muted transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="space-y-6 border-t border-border p-4">
          <fieldset className="space-y-3">
            <legend className="text-small font-semibold text-fg">{t.household}</legend>
            <FieldHint>{t.householdHint}</FieldHint>
            {parties.map((party, index) => {
              const nameId = `${ids.parties}-${party.key}-name`;
              const roleId = `${ids.parties}-${party.key}-role`;
              const phoneId = `${ids.parties}-${party.key}-phone`;
              return (
                <div
                  key={party.key}
                  className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_10rem_1fr_auto] sm:items-end"
                >
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={nameId}>
                      {t.partyName} {index + 1}
                    </FieldLabel>
                    <input
                      id={nameId}
                      value={party.name}
                      aria-invalid={errorFor(nameId) ? true : undefined}
                      onChange={(event) => updateParty(party.key, { name: event.target.value })}
                      className={inputClasses}
                    />
                    {errorFor(nameId) ? <FieldError>{errorFor(nameId)}</FieldError> : null}
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={roleId}>{t.partyRole}</FieldLabel>
                    <select
                      id={roleId}
                      value={party.role}
                      onChange={(event) => updateParty(party.key, { role: event.target.value as RelatedPartyRole })}
                      className={inputClasses}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {d.relatedPartyRole[role]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel htmlFor={phoneId} optional={t.optional}>
                      {t.partyPhone}
                    </FieldLabel>
                    <input
                      id={phoneId}
                      type="tel"
                      inputMode="tel"
                      value={party.phone}
                      placeholder={l.phone.placeholder}
                      aria-invalid={errorFor(phoneId) ? true : undefined}
                      onChange={(event) => updateParty(party.key, { phone: event.target.value })}
                      className={`${inputClasses} tabular`}
                    />
                    {errorFor(phoneId) ? <FieldError>{errorFor(phoneId)}</FieldError> : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setParties((rows) => rows.filter((row) => row.key !== party.key))}
                    aria-label={`${t.removeParty}: ${party.name || `${t.partyName} ${index + 1}`}`}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              variant="soft"
              onClick={() => {
                const key = nextKey.current++;
                setParties((rows) => [...rows, { key, name: "", role: "spouse", phone: "" }]);
              }}
            >
              <Plus aria-hidden className="size-4" />
              {t.addParty}
            </Button>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-small font-semibold text-fg">{t.consents}</legend>
            <FieldHint>{t.consentsHint}</FieldHint>
            <ul className="space-y-2">
              {purposes.map((purpose) => {
                const channel = consents[purpose];
                const channelId = `${id}-consent-${purpose}`;
                return (
                  <li key={purpose} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CheckboxRow
                      checked={channel !== undefined}
                      onChange={(checked) =>
                        setConsents((all) => {
                          const next = { ...all };
                          if (checked) next[purpose] = "electronic";
                          else delete next[purpose];
                          return next;
                        })
                      }
                    >
                      {d.consentPurpose[purpose]}
                    </CheckboxRow>
                    {channel ? (
                      <div className="flex items-center gap-2 sm:w-64">
                        <label htmlFor={channelId} className="shrink-0 text-caption text-fg-muted">
                          {t.consentChannel}
                        </label>
                        <select
                          id={channelId}
                          value={channel}
                          onChange={(event) =>
                            setConsents((all) => ({ ...all, [purpose]: event.target.value as Consent["channel"] }))
                          }
                          className={inputClasses}
                        >
                          {channels.map((code) => (
                            <option key={code} value={code}>
                              {domain[locale].consentChannel[code]}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </div>
      </details>

      <Button type="submit" size="lg" className="w-full sm:w-auto">
        <Save aria-hidden className="size-5" />
        {t.submit}
      </Button>
    </form>
  );
}
