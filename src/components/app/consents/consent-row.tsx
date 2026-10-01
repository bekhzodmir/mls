"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CheckCheck, ShieldCheck, ShieldOff, ShieldX, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { format } from "@/i18n/define-messages";
import type { Locale } from "@/i18n/config";
import { formatDate, formatDateTime } from "@/i18n/format";
import consents from "@/i18n/messages/consents";
import domain from "@/i18n/messages/domain";
import type { ConsentRegistryItem } from "@/lib/data/views";
import type { Consent, ID } from "@/lib/domain/types";
import { canRevoke, revokeConsent, revokeConsequences, subjectHref } from "./registry";

/**
 * One consent in the registry (§38.6 item 2): subject with a link, purpose,
 * channel, granted and revoked dates, text version and the responsible
 * agent. "Отозвать" asks for confirmation that names the consequences, then
 * changes only this page — nothing is recorded on the server, and the row
 * says so. A revoked consent stays in the list with its date.
 */
export function ConsentRow({
  locale,
  item,
  viewerId,
  nowIso,
}: {
  locale: Locale;
  item: ConsentRegistryItem;
  viewerId: ID;
  nowIso: string;
}) {
  const t = consents[locale];
  const d = domain[locale];
  const id = useId();
  const [consent, setConsent] = useState<Consent>(item.consent);
  const [confirming, setConfirming] = useState(false);
  const demoRevoked = consent.revokedAt !== undefined && item.consent.revokedAt === undefined;
  const resultRef = useRef<HTMLDivElement>(null);
  const purpose = d.consentPurpose[consent.purpose];
  const titleId = `${id}-title`;

  useEffect(() => {
    if (demoRevoked) resultRef.current?.focus();
  }, [demoRevoked]);

  const revokable = canRevoke(item) && !consent.revokedAt;
  const responsible =
    item.responsibleAgent.id === viewerId ? `${item.responsibleAgent.name} (${t.row.you})` : item.responsibleAgent.name;

  return (
    <article aria-labelledby={titleId} className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">{t.row.subject[item.subject.kind]}</p>
          <h2 id={titleId} className="text-body font-semibold text-fg">
            <Link
              href={subjectHref(locale, item.subject)}
              className="hover:underline"
              aria-label={format(t.row.open, { name: item.subject.name })}
            >
              {item.subject.name}
            </Link>
          </h2>
          <p className="text-small font-medium text-fg">{purpose}</p>
        </div>
        {consent.revokedAt ? (
          <Badge tone="danger" icon={ShieldOff}>
            {format(demoRevoked ? t.row.revokedDemo : t.row.revoked, { date: formatDate(locale, consent.revokedAt) })}
          </Badge>
        ) : (
          <Badge tone="success" icon={ShieldCheck}>
            {t.row.active}
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-small sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="text-fg-muted">{t.row.channel}:</dt>
          <dd className="text-fg">{d.consentChannel[consent.channel]}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-fg-muted">{t.row.granted}:</dt>
          <dd className="text-fg">
            <time dateTime={consent.grantedAt}>{formatDateTime(locale, consent.grantedAt)}</time>
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-fg-muted">{t.row.revokedAt}:</dt>
          <dd className="text-fg">
            {consent.revokedAt ? (
              <time dateTime={consent.revokedAt}>{formatDateTime(locale, consent.revokedAt)}</time>
            ) : (
              <span className="text-fg-muted">{t.row.notRevoked}</span>
            )}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-fg-muted">{t.row.version}:</dt>
          <dd className="tabular text-fg">{consent.textVersion}</dd>
        </div>
        <div className="flex gap-1.5 sm:col-span-2">
          <dt className="text-fg-muted">{t.row.responsible}:</dt>
          <dd className="text-fg">{responsible}</dd>
        </div>
      </dl>

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {demoRevoked && consent.revokedAt ? (
          <div className="space-y-2 rounded-md border border-info-border bg-info-bg p-3 text-small text-info-fg">
            <p className="flex items-start gap-2 font-semibold">
              <CheckCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{format(t.revoke.done, { purpose, date: formatDate(locale, consent.revokedAt) })}</span>
            </p>
            <p>{t.revoke.demo}</p>
            <Button variant="ghost" className="-ml-2 text-info-fg" onClick={() => setConsent(item.consent)}>
              <Undo2 aria-hidden className="size-4" />
              {t.revoke.undo}
            </Button>
          </div>
        ) : null}
      </div>

      {revokable && !confirming ? (
        <Button
          variant="secondary"
          className="w-full sm:w-auto"
          aria-label={format(t.revoke.label, { purpose, name: item.subject.name })}
          onClick={() => setConfirming(true)}
        >
          <ShieldX aria-hidden className="size-4" />
          {t.revoke.button}
        </Button>
      ) : null}

      {revokable && confirming ? (
        <div role="group" aria-labelledby={`${id}-confirm`} className="space-y-2 rounded-md border border-border bg-surface-muted p-3">
          <p id={`${id}-confirm`} className="text-small font-semibold text-fg">
            {format(t.revoke.title, { purpose, name: item.subject.name })}
          </p>
          <p className="text-small text-fg-muted">{t.revoke.consequences}</p>
          <ul className="list-disc space-y-1 pl-5 text-small text-fg">
            {revokeConsequences(item).map((code) => (
              <li key={code}>
                {code === "owner_contracts" ? t.revoke.owner : code === "record_kept" ? t.revoke.kept : t.revoke.purpose[code]}
              </li>
            ))}
          </ul>
          <p className="text-caption text-fg-muted">{t.revoke.demo}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={() => {
                const revoked = revokeConsent(consent, nowIso);
                if (revoked) setConsent(revoked);
                setConfirming(false);
              }}
            >
              <ShieldX aria-hidden className="size-4" />
              {t.revoke.confirm}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t.revoke.cancel}
            </Button>
          </div>
        </div>
      ) : null}

      {item.state === "active" && item.scope === "agency" ? (
        <Notice kind="permission">{format(t.revoke.permission, { name: item.responsibleAgent.name })}</Notice>
      ) : null}
    </article>
  );
}
