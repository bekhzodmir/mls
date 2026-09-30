"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { CircleCheck, Plus, Save } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import domain from "@/i18n/messages/domain";
import leads from "@/i18n/messages/leads";
import { leadSources, type Language, type LeadSource } from "@/lib/domain/types";
import { appHref } from "@/lib/routes";
import { DuplicateNotice, type DuplicateDecision } from "./duplicate-notice";
import { findDuplicateClients, normalizeTelegram, phoneStatus, type ContactCard } from "./duplicates";
import {
  ErrorSummary,
  FieldError,
  FieldHint,
  FieldLabel,
  SegmentedRadio,
  inputClasses,
  textareaClasses,
} from "./form-controls";
import type { AgentOption } from "./lead-actions";
import { PhoneField } from "./phone-field";

/**
 * Manual lead capture (§35.3 steps 1–4): source is required but may be
 * Unknown, the phone is normalized to +998, and existing clients with the
 * same phone or Telegram are shown before saving so the agent decides Link,
 * Merge or Create separately. Saving is demo-only local state.
 */
export function NewLeadForm({
  locale,
  clients,
  agents,
  viewerId,
}: {
  locale: Locale;
  clients: ContactCard[];
  agents: AgentOption[];
  viewerId: string;
}) {
  const t = leads[locale];
  const d = domain[locale];
  const id = useId();
  const ids = {
    source: `${id}-source`,
    phone: `${id}-phone`,
    telegram: `${id}-telegram`,
    name: `${id}-name`,
    message: `${id}-message`,
    responsible: `${id}-responsible`,
    duplicate: `${id}-duplicate`,
  };
  const summaryRef = useRef<HTMLDivElement>(null);

  const [source, setSource] = useState<LeadSource | "">("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [language, setLanguage] = useState<Language>(locale);
  const [responsible, setResponsible] = useState(viewerId);
  const [decision, setDecision] = useState<{ clientId: string; value: DuplicateDecision }>();
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState<string>();

  const phoneState = phoneStatus(phone);
  const telegramValue = normalizeTelegram(telegram);
  const hits = findDuplicateClients(
    { name, phones: phoneState.e164 ? [phoneState.e164] : [], telegramUsername: telegramValue },
    clients,
  );
  const best = hits[0];
  const currentDecision = best && decision?.clientId === best.client.id ? decision.value : undefined;

  const errors: { id: string; text: string }[] = [];
  if (!source) errors.push({ id: ids.source, text: t.form.errorSource });
  if (phoneState.state === "empty" && !telegram.trim()) errors.push({ id: ids.phone, text: t.form.errorContact });
  if (phoneState.state === "incomplete" || phoneState.state === "invalid") {
    errors.push({ id: ids.phone, text: t.form.errorPhone });
  }
  if (telegram.trim() && !telegramValue) errors.push({ id: ids.telegram, text: t.form.errorTelegram });
  if (best && !currentDecision) errors.push({ id: ids.duplicate, text: t.form.errorDuplicate });
  const errorFor = (fieldId: string) => (submitted ? errors.find((error) => error.id === fieldId)?.text : undefined);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (errors.length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSaved(name.trim() || (phoneState.e164 ?? `@${telegramValue}`));
  }

  function reset() {
    setSource("");
    setPhone("");
    setTelegram("");
    setName("");
    setMessage("");
    setLanguage(locale);
    setResponsible(viewerId);
    setDecision(undefined);
    setSubmitted(false);
    setSaved(undefined);
  }

  if (saved) {
    return (
      <div role="status" className="space-y-4">
        <Notice kind="info" title={t.form.demoTitle}>
          <p className="flex items-start gap-1.5">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            {format(t.form.success, { name: saved })}
          </p>
          <p className="mt-1">{t.form.successNext}</p>
        </Notice>
        <div className="flex flex-wrap gap-2">
          <Link href={appHref(locale, "clientsNew")} className={buttonClasses("primary")}>
            {t.form.toClient}
          </Link>
          <Button variant="secondary" onClick={reset}>
            <Plus aria-hidden className="size-4" />
            {t.form.another}
          </Button>
          <Link href={appHref(locale, "leads")} className={buttonClasses("ghost")}>
            {t.form.toInbox}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Notice kind="info" title={t.form.demoTitle}>
        {t.form.demo}
      </Notice>

      {submitted ? (
        <ErrorSummary
          title={format(t.form.errorSummary, { n: errors.length })}
          errors={errors}
          summaryRef={summaryRef}
        />
      ) : null}

      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.source}>{t.form.source}</FieldLabel>
        <select
          id={ids.source}
          value={source}
          required
          aria-invalid={errorFor(ids.source) ? true : undefined}
          aria-describedby={`${ids.source}-hint`}
          onChange={(event) => setSource(event.target.value as LeadSource | "")}
          className={inputClasses}
        >
          <option value="">{t.form.sourcePlaceholder}</option>
          {leadSources.map((code) => (
            <option key={code} value={code}>
              {d.leadSource[code]}
            </option>
          ))}
        </select>
        {errorFor(ids.source) ? <FieldError>{errorFor(ids.source)}</FieldError> : null}
        <FieldHint id={`${ids.source}-hint`}>{t.form.sourceHint}</FieldHint>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <PhoneField id={ids.phone} locale={locale} value={phone} onChange={setPhone} showErrors={submitted} />
        <div className="space-y-1.5">
          <FieldLabel htmlFor={ids.telegram} optional={t.form.nameHint}>
            {t.form.telegram}
          </FieldLabel>
          <input
            id={ids.telegram}
            value={telegram}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t.form.telegramPlaceholder}
            aria-invalid={errorFor(ids.telegram) ? true : undefined}
            aria-describedby={`${ids.telegram}-hint`}
            onChange={(event) => setTelegram(event.target.value)}
            className={inputClasses}
          />
          {errorFor(ids.telegram) ? <FieldError>{errorFor(ids.telegram)}</FieldError> : null}
          <FieldHint id={`${ids.telegram}-hint`}>{t.form.telegramHint}</FieldHint>
        </div>
      </div>
      {submitted && errorFor(ids.phone) === t.form.errorContact ? <FieldError>{t.form.errorContact}</FieldError> : null}

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
            {t.form.noDuplicates}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.name} optional={t.form.nameHint}>
          {t.form.name}
        </FieldLabel>
        <input
          id={ids.name}
          value={name}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
          className={inputClasses}
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor={ids.message}>{t.form.message}</FieldLabel>
        <textarea
          id={ids.message}
          rows={3}
          value={message}
          placeholder={t.form.messagePlaceholder}
          aria-describedby={`${ids.message}-hint`}
          onChange={(event) => setMessage(event.target.value)}
          className={textareaClasses}
        />
        <FieldHint id={`${ids.message}-hint`}>{t.form.messageHint}</FieldHint>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SegmentedRadio<Language>
          name={`${id}-language`}
          legend={t.form.language}
          value={language}
          onChange={setLanguage}
          options={[
            { value: "ru", label: t.language.ru },
            { value: "uz", label: t.language.uz },
          ]}
        />
        <div className="space-y-1.5">
          <FieldLabel htmlFor={ids.responsible}>{t.form.responsible}</FieldLabel>
          <select
            id={ids.responsible}
            value={responsible}
            onChange={(event) => setResponsible(event.target.value)}
            className={inputClasses}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.id === viewerId ? format(t.assign.me, { name: agent.name }) : agent.name}
              </option>
            ))}
            <option value="">{t.form.responsibleNone}</option>
          </select>
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full sm:w-auto">
        <Save aria-hidden className="size-5" />
        {t.form.submit}
      </Button>
    </form>
  );
}
