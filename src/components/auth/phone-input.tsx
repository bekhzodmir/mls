"use client";

import { useState, type Ref } from "react";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import auth from "@/i18n/messages/auth";
import { formatUzPhone } from "@/lib/domain/phone";
import { cn } from "@/lib/cn";
import { describedBy, FieldError, FieldHint, FieldLabel, FieldValid, inputClasses } from "./controls";
import { phoneMessage } from "./phone-step";

/**
 * +998 phone field with live normalization (§20.7 "Phone Input", §34.1).
 * Any common spelling is accepted; the line under the field confirms the
 * recognized number, hints while digits are missing and turns into an error
 * only after leaving the field or trying to continue (see `phoneMessage`).
 */
export function PhoneInput({
  id,
  locale,
  label,
  value,
  onChange,
  submitted,
  required = true,
  optionalLabel,
  note,
  inputRef,
  maxLength,
}: {
  id: string;
  locale: Locale;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Set after a submit attempt so errors show even for an untouched field. */
  submitted: boolean;
  required?: boolean;
  /** "необязательно" for an optional phone. */
  optionalLabel?: string;
  /** Extra context under the label, e.g. where a prefilled number came from. */
  note?: string;
  inputRef?: Ref<HTMLInputElement>;
  maxLength?: number;
}) {
  const t = auth[locale].phone;
  const [touched, setTouched] = useState(false);
  const message = phoneMessage(value, { touched, submitted, required });
  const messageId = `${id}-message`;
  const noteId = note ? `${id}-note` : undefined;

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} optional={required ? undefined : optionalLabel}>
        {label}
      </FieldLabel>
      {note ? <FieldHint id={noteId}>{note}</FieldHint> : null}
      <input
        ref={inputRef}
        id={id}
        name={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t.placeholder}
        value={value}
        maxLength={maxLength}
        aria-required={required || undefined}
        aria-invalid={message.tone === "error" || undefined}
        aria-describedby={describedBy(noteId, messageId)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTouched(true)}
        className={cn(inputClasses, "tabular")}
      />
      <div id={messageId} aria-live="polite">
        {message.tone === "valid" ? (
          <FieldValid>{format(t.valid, { phone: formatUzPhone(message.e164) })}</FieldValid>
        ) : message.tone === "error" ? (
          <FieldError>{t[message.key]}</FieldError>
        ) : (
          <FieldHint>{t[message.key]}</FieldHint>
        )}
      </div>
    </div>
  );
}
