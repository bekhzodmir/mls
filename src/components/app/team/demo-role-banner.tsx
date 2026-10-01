import { Eye, LogOut } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { ChipLink } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import team from "@/i18n/messages/team";
import type { UserRole } from "@/lib/domain/types";
import { roleLabel } from "./access-text";
import { DEMO_ROLES, type DemoRole } from "./demo-role";

/**
 * The persistent banner of a demo role preview: whose rights are shown, that
 * the real role comes from the account, and the way out. Rendered at the top
 * of every previewed page, never hidden.
 */
export function DemoRoleBanner({
  locale,
  demoRole,
  exitHref,
}: {
  locale: Locale;
  demoRole: DemoRole;
  /** The same page without `demoRole`. */
  exitHref: string;
}) {
  const t = team[locale].demoRole;
  return (
    <div
      role="note"
      className="flex flex-col gap-3 rounded-md border-2 border-dashed border-warning-border bg-warning-bg p-3 text-small text-warning-fg sm:flex-row sm:items-center"
    >
      <Eye aria-hidden className="size-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-semibold">{format(t.banner, { role: roleLabel(locale, demoRole) })}</p>
        <p>{t.note}</p>
      </div>
      <ButtonLink href={exitHref} variant="secondary">
        <LogOut aria-hidden className="size-4" />
        {t.exit}
      </ButtonLink>
    </div>
  );
}

/**
 * Entry to the preview: one chip per role, the account's own role first. A
 * closed `<details>` at the end of the page, so it never competes with the
 * screen's own work.
 */
export function DemoRoleSwitcher({
  locale,
  viewerRole,
  demoRole,
  hrefFor,
}: {
  locale: Locale;
  viewerRole: UserRole;
  demoRole?: DemoRole;
  /** This page with the given preview role (undefined = the account's own role). */
  hrefFor: (role?: DemoRole) => string;
}) {
  const t = team[locale].demoRole;
  return (
    <details className="group rounded-lg border border-border bg-surface p-4" open={demoRole !== undefined}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-small font-semibold text-fg">
        <Eye aria-hidden className="size-4 text-fg-muted" />
        {t.switcher}
      </summary>
      <p className="mt-2 text-caption text-fg-muted">{t.switcherText}</p>
      <nav aria-label={t.group} className="mt-3">
        <ul className="flex flex-wrap gap-2">
          <li>
            <ChipLink href={hrefFor()} active={demoRole === undefined}>
              {format(t.own, { role: roleLabel(locale, viewerRole) })}
            </ChipLink>
          </li>
          {DEMO_ROLES.filter((role) => role !== viewerRole).map((role) => (
            <li key={role}>
              <ChipLink href={hrefFor(role)} active={demoRole === role}>
                {roleLabel(locale, role)}
              </ChipLink>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
