import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatList } from "@/i18n/format";
import domain from "@/i18n/messages/domain";
import team from "@/i18n/messages/team";
import type { Actor, PermissionArea } from "@/lib/domain/permissions";
import { levelOf, type AccessExplanation } from "./access";

/**
 * A refusal in words (§19 last paragraph, §23.5): the actor's level, what is
 * needed, who has it by role, who grants or changes it. The screen adds the
 * safe next step, which depends on where the refusal happens.
 */

/** «Руководитель группы»; a partner is an external professional, not an organization role. */
export function roleLabel(locale: Locale, role: Actor): string {
  return role === "partner" ? domain[locale].role.individual_realtor : domain[locale].role[role];
}

export function rolesText(locale: Locale, roles: readonly Actor[]): string {
  return formatList(
    locale,
    roles.map((role) => roleLabel(locale, role)),
  );
}

/** «только свои записи», «записи агентства (по одобрению)». */
export function levelText(locale: Locale, actor: Actor, area: PermissionArea): string {
  const t = team[locale].access;
  const level = levelOf(actor, area);
  let text = formatList(
    locale,
    level.scopes.map((scope) => t.scopes[scope]),
  );
  if (level.byGrant) text += ` (${t.byGrant})`;
  if (level.editByGrant) text += ` (${t.editByGrant})`;
  return text;
}

export interface AccessText {
  title: string;
  lines: string[];
}

export function accessText(locale: Locale, explanation: AccessExplanation, need?: string): AccessText {
  const t = team[locale].access;
  const area = t.areas[explanation.area];
  const lines = [
    format(t.yourLevel, {
      role: roleLabel(locale, explanation.actor),
      area,
      level: levelText(locale, explanation.actor, explanation.area),
    }),
    need ??
      format(explanation.action === "edit" ? t.needEdit : t.need, {
        area,
        ownership: t.ownership[explanation.ownership],
      }),
  ];
  if (explanation.holders.length > 0) lines.push(format(t.holders, { roles: rolesText(locale, explanation.holders) }));
  if (explanation.reason === "permission_required" && explanation.granters.length > 0) {
    lines.push(format(t.granters, { roles: rolesText(locale, explanation.granters) }));
  } else if (explanation.roleManagers.length > 0) {
    lines.push(format(t.roleManagers, { roles: rolesText(locale, explanation.roleManagers) }));
  }
  if (explanation.selfCanGrant) lines.push(t.selfGrant);
  return { title: t.title[explanation.reason], lines };
}
