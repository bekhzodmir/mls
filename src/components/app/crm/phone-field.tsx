"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import leads from "@/i18n/messages/leads";
import { formatUzPhone } from "@/lib/domain/phone";
import { phoneStatus } from "./duplicates";
import { FieldError, FieldHint, FieldLabel, inputClasses } from "./form-controls";

/**
 * +998 phone input with live normalization (§34.1, §20.7 "Phone Input").
 * The agent may type any common spelling; the field confirms the recognized
 * number, says "keep typing" while digits are missing and shows an error only
 * after leaving the field or submitting.
 */
export function PhoneField({
  id,
  locale,
  value,
  onChange,
  label,
  optional,
  showErrors,
  required,
}: {
  id: string;
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  optional?: string;
  /** Set after a submit attempt so errors show even for untouched fields. */
  showErrors?: boolean;
  required?: boolean;
}) {
  const t = leads[locale].phone;
  const [blurred, setBlurred] = useState(false);
  const status = phoneStatus(value);
  const reveal = blurred || Boolean(showErrors);
  const error = status.state === "invalid" || (reveal && status.state === "incomplete");
  const messageId = `${id}-message`;

  return (
    <div className="space-y-1.5">
      <FieldLabel htmlFor={id} optional={optional}>
        {label ?? t.label}
      </FieldLabel>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t.placeholder}
        value={value}
        required={required}
        aria-invalid={error || undefined}
        aria-describedby={messageId}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setBlurred(true)}
        className={`${inputClasses} tabular`}
      />
      <div id={messageId} aria-live="polite">
        {status.state === "valid" && status.e164 ? (
          <p className="flex items-center gap-1.5 text-caption font-medium text-success-fg">
            <CircleCheck aria-hidden className="size-3.5 shrink-0" />
            {format(t.valid, { phone: formatUzPhone(status.e164) })}
          </p>
        ) : error ? (
          <FieldError>{status.state === "invalid" ? t.invalid : t.incomplete}</FieldError>
        ) : (
          <FieldHint>{status.state === "incomplete" ? t.incomplete : t.hint}</FieldHint>
        )}
      </div>
    </div>
  );
}
