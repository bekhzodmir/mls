import { AlarmClock, Ban, CircleCheck, Gauge, History, Inbox, Plane, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { format, plural } from "@/i18n/define-messages";
import { formatDateTime, formatRelative } from "@/i18n/format";
import team from "@/i18n/messages/team";
import type { ID } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import type { TeamException } from "./team-model";

/**
 * "Панель исключений и действий" for a lead (§33.2): what broke and the one
 * action that fixes it, instead of report charts. Each item carries its own
 * icon and words; colour only repeats them.
 */

const style: Record<TeamException["kind"], { icon: LucideIcon; className: string }> = {
  sla_breach: { icon: AlarmClock, className: "bg-danger-bg text-danger-fg" },
  unassigned: { icon: Inbox, className: "bg-warning-bg text-warning-fg" },
  over_capacity: { icon: Ban, className: "bg-warning-bg text-warning-fg" },
  away: { icon: Plane, className: "bg-surface-muted text-fg-muted" },
  away_ended: { icon: History, className: "bg-warning-bg text-warning-fg" },
  near_capacity: { icon: Gauge, className: "bg-info-bg text-info-fg" },
};

export interface ExceptionLinks {
  viewerId: ID;
  /** Routing simulator, when the actor may assign leads; otherwise undefined. */
  distributeHref?: string;
  inboxHref: string;
  myUrgentHref: string;
  memberHref: (agentId: ID) => string;
}

function describe(
  locale: Locale,
  item: TeamException,
  names: Readonly<Record<ID, string>>,
  now: Date,
  links: ExceptionLinks,
): { text: string; detail?: string; action?: { href: string; label: string } } {
  const t = team[locale].exceptions;
  const name = (id: ID) => names[id] ?? id;
  const profile = (id: ID) => ({ href: links.memberHref(id), label: t.actions.profile });
  switch (item.kind) {
    case "sla_breach":
      return {
        text: format(plural(locale, item.count, t.slaBreach), { name: name(item.agentId), n: item.count }),
        detail: item.away ? t.slaBreachAway : undefined,
        action:
          item.agentId === links.viewerId
            ? { href: links.myUrgentHref, label: t.actions.myUrgent }
            : links.distributeHref
              ? { href: links.distributeHref, label: t.actions.distribute }
              : profile(item.agentId),
      };
    case "unassigned": {
      const details = [
        item.breached > 0 ? format(t.unassignedBreached, { n: item.breached }) : undefined,
        item.nextDueAt ? format(t.unassignedNext, { relative: formatRelative(locale, item.nextDueAt, now) }) : undefined,
      ].filter((part): part is string => part !== undefined);
      return {
        text: format(plural(locale, item.count, t.unassigned), { n: item.count }),
        detail: details.length > 0 ? details.join(" ") : undefined,
        action: links.distributeHref
          ? { href: links.distributeHref, label: t.actions.distribute }
          : { href: links.inboxHref, label: t.actions.inbox },
      };
    }
    case "over_capacity":
      return {
        text: format(t.overCapacity, { name: name(item.agentId), used: item.used, capacity: item.capacity }),
        action: profile(item.agentId),
      };
    case "near_capacity":
      return {
        text: format(t.nearCapacity, { name: name(item.agentId), used: item.used, capacity: item.capacity }),
        action: profile(item.agentId),
      };
    case "away":
      return {
        text: item.until
          ? format(t.away, { name: name(item.agentId), date: formatDateTime(locale, item.until) })
          : format(t.awayOpen, { name: name(item.agentId) }),
        detail:
          item.openLeads !== undefined && item.openLeads > 0
            ? format(plural(locale, item.openLeads, t.awayLeads), { n: item.openLeads })
            : undefined,
        action: profile(item.agentId),
      };
    case "away_ended":
      return {
        text: format(t.awayEnded, { name: name(item.agentId), date: formatDateTime(locale, item.until) }),
        action: profile(item.agentId),
      };
  }
}

export function ExceptionsPanel({
  locale,
  items,
  names,
  now,
  links,
  hiddenNote,
}: {
  locale: Locale;
  items: readonly TeamException[];
  names: Readonly<Record<ID, string>>;
  now: Date;
  links: ExceptionLinks;
  /** Metric-based exceptions of colleagues are outside the actor's reports level. */
  hiddenNote?: boolean;
}) {
  const t = team[locale].exceptions;
  return (
    <section aria-labelledby="team-exceptions" className="space-y-3">
      <div className="space-y-1">
        <h2 id="team-exceptions" className="text-h2 text-fg">
          {t.title}
        </h2>
        <p className="text-small text-fg-muted">{t.subtitle}</p>
      </div>
      {items.length === 0 ? (
        <p className="flex items-start gap-2 rounded-md border border-success-border bg-success-bg p-3 text-small text-success-fg">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t.none}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => {
            const { icon: Icon, className } = style[item.kind];
            const { text, detail, action } = describe(locale, item, names, now, links);
            return (
              <li
                key={`${item.kind}-${"agentId" in item ? item.agentId : index}`}
                className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", className)}>
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-small font-medium text-fg">{text}</p>
                    {detail ? <p className="text-caption text-fg-muted">{detail}</p> : null}
                  </div>
                </div>
                {action ? (
                  <ButtonLink href={action.href} variant="secondary" className="self-start sm:self-auto">
                    {action.label}
                  </ButtonLink>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {hiddenNote ? <p className="text-caption text-fg-muted">{t.hidden}</p> : null}
    </section>
  );
}
