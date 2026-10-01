import Link from "next/link";
import { Bot, Building2, Eye, UserRound, Users, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatDateTime, formatTime } from "@/i18n/format";
import audit from "@/i18n/messages/audit";
import type { AuditEventView, AuditScope } from "@/lib/data/views";
import type { ID } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";
import { actionLabel, actorLabel, reasonText, targetHref, targetLabel } from "./audit-model";

const scopeIcon: Record<AuditScope, LucideIcon> = {
  own: UserRound,
  team: Users,
  agency: Building2,
};

/**
 * One journal entry (§18.1, §38.6 item 7): when, who (or the system), what,
 * on which record — by a list-safe label, never a restricted value — and why.
 * Sensitive access is marked with an icon and words, not colour alone.
 */
export function AuditRow({
  locale,
  view,
  viewerId,
  agentName,
  showScope,
}: {
  locale: Locale;
  view: AuditEventView;
  viewerId: ID;
  agentName: (id: ID) => string | undefined;
  /** The actor reads more than their own history: say where each entry sits. */
  showScope: boolean;
}) {
  const t = audit[locale];
  const reason = reasonText(locale, view, agentName);
  const ScopeIcon = scopeIcon[view.scope];
  return (
    <li className="space-y-1.5 rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <time dateTime={view.event.at} title={formatDateTime(locale, view.event.at)} className="text-caption tabular text-fg-muted">
          {formatTime(locale, view.event.at)}
        </time>
        <span className="text-small font-semibold text-fg">{actionLabel(locale, view.event.action)}</span>
        {view.sensitive ? (
          <Badge tone="warning" icon={Eye} title={t.row.sensitiveHint}>
            {t.row.sensitive}
          </Badge>
        ) : null}
        {showScope ? (
          <Badge tone="neutral" icon={ScopeIcon}>
            {t.scope[view.scope]}
          </Badge>
        ) : null}
      </div>
      <p className="flex items-center gap-1.5 text-small text-fg">
        {view.system ? (
          <Bot aria-hidden className="size-4 shrink-0 text-fg-muted" />
        ) : (
          <UserRound aria-hidden className="size-4 shrink-0 text-fg-muted" />
        )}
        {actorLabel(locale, view, viewerId)}
      </p>
      <p className="text-small text-fg">
        {view.target.link ? (
          <Link
            href={targetHref(locale, view.target.link)}
            className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
          >
            {targetLabel(locale, view)}
          </Link>
        ) : (
          targetLabel(locale, view)
        )}
      </p>
      {reason ? <p className="text-caption text-fg-muted">{format(t.row.reason, { reason })}</p> : null}
      {view.log === "deal" && view.dealId ? (
        <Link
          href={appPath(locale, `/deals/${encodeURIComponent(view.dealId)}`)}
          aria-label={format(t.row.openDeal, { id: view.dealId })}
          className="inline-flex min-h-11 items-center text-caption font-medium text-primary underline-offset-4 hover:underline"
        >
          {format(t.row.dealLog, { id: view.dealId })}
        </Link>
      ) : null}
    </li>
  );
}
