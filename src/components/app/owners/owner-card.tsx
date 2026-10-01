import Link from "next/link";
import { Lock, Phone, ShieldOff, ShieldX } from "lucide-react";
import { contactRevokedAt } from "@/components/app/crm/duplicates";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDate, formatRelative } from "@/i18n/format";
import clients from "@/i18n/messages/clients";
import domain from "@/i18n/messages/domain";
import owners from "@/i18n/messages/owners";
import type { OwnerListItem } from "@/lib/data/views";
import { formatUzPhone } from "@/lib/domain/phone";
import { RightHolderBadge } from "./owner-badges";
import { ownerHref } from "./owner-model";

/**
 * Owner list card (§21.4 #24): who, how to reach them (or why the contact is
 * hidden), how many properties, contracts and active consents, who is
 * responsible and when the viewer last spoke to them. The whole card opens
 * the profile.
 */
export function OwnerCard({ locale, item, at }: { locale: Locale; item: OwnerListItem; at: Date }) {
  const t = owners[locale].card;
  const { owner } = item;
  const revoked = contactRevokedAt(owner);

  return (
    <article className="relative space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong hover:bg-surface-muted/40 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring">
      <div className="flex items-start gap-3">
        <Avatar name={owner.name} />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-body font-semibold text-fg">
            <Link
              href={ownerHref(locale, owner.id)}
              className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
            >
              {owner.name}
            </Link>
          </h2>
          <p className="text-caption text-fg-muted">
            {item.lastContactAt ? (
              <time dateTime={item.lastContactAt}>
                {format(t.lastContact, { time: formatRelative(locale, item.lastContactAt, at) })}
              </time>
            ) : (
              t.noContact
            )}
          </p>
        </div>
      </div>

      {item.rightHolderOnly || revoked || item.activeConsents === 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {item.rightHolderOnly ? <RightHolderBadge locale={locale} /> : null}
          {revoked ? (
            <Badge tone="danger" icon={ShieldOff}>
              {domain[locale].consentPurpose.contact}:{" "}
              {format(clients[locale].consents.revoked, { date: formatDate(locale, revoked) })}
            </Badge>
          ) : null}
          {item.activeConsents === 0 ? (
            <Badge tone="warning" icon={ShieldX}>
              {t.noConsents}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <p className="flex items-start gap-2 text-small">
        {owner.phone ? (
          <>
            <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
            <span className="tabular text-fg">{formatUzPhone(owner.phone)}</span>
          </>
        ) : (
          <>
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
            <span>
              <span className="font-medium text-fg">{t.contactHidden}</span>{" "}
              <span className="text-fg-muted">— {t.contactHiddenReason}</span>
            </span>
          </>
        )}
      </p>

      <dl className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            [t.properties, item.propertyIds.length],
            [t.contracts, item.contractIds.length],
            [t.consents, item.activeConsents],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-md bg-surface-muted px-2 py-1.5">
            <dt className="text-caption text-fg-muted">{label}</dt>
            <dd className="tabular text-body font-semibold text-fg">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-caption text-fg-muted">{format(t.responsible, { name: item.responsibleAgent.name })}</p>
    </article>
  );
}
