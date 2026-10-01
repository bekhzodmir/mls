import type { ReactNode } from "react";
import { Notice } from "@/components/ui/notice";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatList } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import verification from "@/i18n/messages/verification";
import type { Actor } from "@/lib/domain/permissions";
import type { AccessExplanation, ExplainedArea } from "./access";

export function actorLabel(locale: Locale, actor: Actor): string {
  return actor === "partner" ? verification[locale].access.partner : domain[locale].role[actor];
}

/**
 * Permission-limited state (§23.5): which right is needed, who can grant it,
 * who already holds it, and the safe step available now — instead of a bare
 * "access denied" or a silently missing field.
 */
export function PermissionNotice({
  locale,
  area,
  explanation,
  actor,
  step,
  action,
  className,
}: {
  locale: Locale;
  area: ExplainedArea;
  explanation: AccessExplanation;
  actor: Actor;
  /** What the viewer can do now, as a sentence fragment after "Что можно сейчас:". */
  step: string;
  action?: ReactNode;
  className?: string;
}) {
  if (explanation.ok) return null;
  const t = verification[locale].access;
  const roles = (actors: Actor[]) =>
    formatList(
      locale,
      actors.map((role) => actorLabel(locale, role)),
      "disjunction",
    );
  return (
    <Notice
      kind="permission"
      title={format(t.title, { area: t.area[area] })}
      action={action}
      className={className}
    >
      <p>
        {explanation.reason ? t.reason[explanation.reason] : null} {format(t.role, { role: actorLabel(locale, actor) })}
      </p>
      <p>{explanation.grantors.length > 0 ? format(t.grantedBy, { roles: roles(explanation.grantors) }) : t.noGrant}</p>
      {explanation.holders.length > 0 ? <p>{format(t.holders, { roles: roles(explanation.holders) })}</p> : null}
      <p>{format(t.nextStep, { step })}</p>
    </Notice>
  );
}
