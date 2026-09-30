import Link from "next/link";
import { AlarmClock, CalendarClock, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, Chip } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDate, formatDateTime, formatRelative } from "@/i18n/format";
import clients from "@/i18n/messages/clients";
import domain from "@/i18n/messages/domain";
import type { ClientListItem } from "@/lib/data/views";
import type { Requirement } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import { appPath } from "@/lib/routes";
import { ClientStatusBadge } from "./badges";
import { contactRevokedAt } from "./duplicates";
import { requirementChips } from "./requirement-summary";

export function clientHref(locale: Locale, id: string): string {
  return appPath(locale, `/clients/${encodeURIComponent(id)}`);
}

/** The requirement that best describes the client right now: active first, then the latest. */
export function leadingRequirement(requirements: Requirement[]): Requirement | undefined {
  return requirements.find((requirement) => requirement.status === "active") ?? requirements[0];
}

export function isOverdue(dueAt: string | undefined, at: Date): boolean {
  return Boolean(dueAt && new Date(dueAt).getTime() < at.getTime());
}

/** Next step line; an overdue step is marked with an icon and a word, not only colour. */
export function NextAction({
  locale,
  nextAction,
  at,
  className,
}: {
  locale: Locale;
  nextAction: { text: string; dueAt?: string } | undefined;
  at: Date;
  className?: string;
}) {
  const t = clients[locale].card;
  if (!nextAction) return <p className={cn("text-small text-fg-muted", className)}>{t.noNextAction}</p>;
  const overdue = isOverdue(nextAction.dueAt, at);
  const due = nextAction.dueAt ? format(t.due, { date: formatDateTime(locale, nextAction.dueAt) }) : undefined;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg", className)}>
      {overdue ? (
        <Badge tone="danger" icon={AlarmClock}>
          {t.overdue}
        </Badge>
      ) : null}
      <span className={cn(overdue && "font-medium")}>{nextAction.text}</span>
      {due ? (
        <span
          className={cn("inline-flex items-center gap-1 text-caption", overdue ? "text-danger-fg" : "text-fg-muted")}
        >
          <CalendarClock aria-hidden className="size-3.5" />
          {due}
        </span>
      ) : null}
    </p>
  );
}

/** Client list card (§22.3 summary, §36.3): who, what they look for, who owns them, what is next. */
export function ClientCard({ locale, item, at }: { locale: Locale; item: ClientListItem; at: Date }) {
  const t = clients[locale].card;
  const { client, requirements } = item;
  const requirement = leadingRequirement(requirements);
  const others = requirements.filter((other) => other.id !== requirement?.id && other.status === "active").length;
  const revoked = contactRevokedAt(client);

  return (
    // Stretched link: the whole card is clickable, while screen readers still read its content.
    <article className="relative space-y-3 rounded-lg border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong hover:bg-surface-muted/40 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring">
      <div className="flex items-start gap-3">
        <Avatar name={client.name} />
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold text-fg">
            <Link
              href={clientHref(locale, client.id)}
              className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
            >
              {client.name}
            </Link>
          </h2>
          <p className="text-caption text-fg-muted">
            {client.lastContactAt ? (
              <time dateTime={client.lastContactAt}>
                {format(t.lastContact, { time: formatRelative(locale, client.lastContactAt, at) })}
              </time>
            ) : (
              t.noContact
            )}
          </p>
        </div>
        <ClientStatusBadge locale={locale} status={client.status} />
      </div>

      {requirement ? (
        <ul className="flex flex-wrap gap-1.5">
          {requirementChips(locale, requirement).map((chip) => (
            <li key={chip}>
              <Chip>{chip}</Chip>
            </li>
          ))}
          {requirement.status !== "active" ? (
            <li>
              <Chip>{domain[locale].requirementStatus[requirement.status]}</Chip>
            </li>
          ) : null}
          {others > 0 ? (
            <li>
              <Chip>{format(t.moreRequirements, { n: others })}</Chip>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-small text-fg-muted">{t.noRequirement}</p>
      )}

      <NextAction locale={locale} nextAction={client.nextAction} at={at} />

      <div className="flex flex-wrap items-center gap-2 text-caption text-fg-muted">
        <span>{format(t.responsible, { name: item.responsibleAgent.name })}</span>
        {revoked ? (
          <Badge tone="danger" icon={ShieldOff}>
            {domain[locale].consentPurpose.contact}:{" "}
            {format(clients[locale].consents.revoked, { date: formatDate(locale, revoked) })}
          </Badge>
        ) : null}
      </div>
    </article>
  );
}
