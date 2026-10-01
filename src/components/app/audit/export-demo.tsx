"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { CircleCheck, Download, X } from "lucide-react";
import { FieldError, FieldHint, FieldLabel, textareaClasses } from "@/components/app/crm/form-controls";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import audit from "@/i18n/messages/audit";
import { purposeError } from "./export-purpose";

/**
 * Demo export of the journal (§18.1 export controls, §39.3 "permission and
 * export audit"): it explains that exporting needs its own permission and is
 * itself written to the journal with a purpose. Nothing is sent or created.
 */
export function ExportDemo({
  locale,
  visibleCount,
  permission,
  selfCanGrant,
}: {
  locale: Locale;
  /** Entries the actor can see now — the most an export could contain. */
  visibleCount: number;
  /** Server-rendered explanation of the export permission. */
  permission: ReactNode;
  selfCanGrant: boolean;
}) {
  const t = audit[locale].export;
  const ids = { panel: useId(), purpose: useId(), hint: useId() };
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState<string>();
  const error = submitted ? purposeError(purpose) : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (purposeError(purpose)) return;
    setDone(purpose.trim());
  }

  function close() {
    setOpen(false);
    setSubmitted(false);
    setPurpose("");
    setDone(undefined);
  }

  return (
    <div className="space-y-3">
      <Button variant="secondary" aria-expanded={open} aria-controls={ids.panel} onClick={() => (open ? close() : setOpen(true))}>
        <Download aria-hidden className="size-4" />
        {t.button}
      </Button>
      {open ? (
        <section id={ids.panel} aria-label={t.title} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-body font-semibold text-fg">{t.title}</h2>
            <Button variant="ghost" size="icon" onClick={close} aria-label={t.close}>
              <X aria-hidden className="size-4" />
            </Button>
          </div>
          <p className="text-small text-fg">{t.logged}</p>
          <p className="text-small text-fg-muted">{format(t.scope, { n: visibleCount })}</p>
          {permission}
          {done ? (
            <div role="status">
              <Notice kind="info">
                <span className="inline-flex items-start gap-1.5">
                  <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {format(t.done, { purpose: done })}
                </span>
              </Notice>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-3">
              <div className="space-y-1.5">
                <FieldLabel htmlFor={ids.purpose}>{t.purpose}</FieldLabel>
                <textarea
                  id={ids.purpose}
                  value={purpose}
                  rows={2}
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={[ids.hint, error ? `${ids.purpose}-error` : undefined].filter(Boolean).join(" ")}
                  onChange={(event) => setPurpose(event.target.value)}
                  className={textareaClasses}
                />
                <FieldHint id={ids.hint}>{t.purposeHint}</FieldHint>
                {error ? (
                  <FieldError id={`${ids.purpose}-error`}>{error === "required" ? t.purposeRequired : t.purposeShort}</FieldError>
                ) : null}
              </div>
              <Button type="submit">{selfCanGrant ? t.requestGrant : t.request}</Button>
            </form>
          )}
        </section>
      ) : null}
    </div>
  );
}
