import { Eye, Filter } from "lucide-react";
import { ChipRow } from "@/components/app/crm/layout-parts";
import { GetForm } from "@/components/app/mls/get-form";
import { DEMO_ROLE_PARAM, type DemoRole } from "@/components/app/team/demo-role";
import { Button, ButtonLink } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/field";
import { ChipLink } from "@/components/ui/misc";
import type { Locale } from "@/i18n/config";
import audit from "@/i18n/messages/audit";
import { actionLabel, auditHref, targetKindLabel, type ActorOption, type AuditParams } from "./audit-model";

/**
 * Journal filters, all in the URL (`?actor=&action=&target=&sensitive=1`):
 * chips for sensitivity and record kind, selects for who and what. Options
 * come from the entries the actor may read, so they never reveal names or
 * actions outside the role's audit level.
 */
export function AuditFilters({
  locale,
  params,
  demoRole,
  actors,
  actions,
  targets,
}: {
  locale: Locale;
  params: AuditParams;
  demoRole?: DemoRole;
  actors: ActorOption[];
  actions: { org: string[]; deal: string[] };
  targets: string[];
}) {
  const t = audit[locale].filters;
  const href = (next: AuditParams) => auditHref(locale, next, demoRole);
  const target = params.target && !targets.includes(params.target) ? [...targets, params.target] : targets;

  return (
    <div role="group" aria-label={t.label} className="space-y-3">
      <ChipRow label={t.sensitive}>
        <li>
          <ChipLink href={href({ ...params, sensitive: undefined })} active={!params.sensitive}>
            {t.sensitiveAll}
          </ChipLink>
        </li>
        <li>
          <ChipLink href={href({ ...params, sensitive: true })} active={params.sensitive === true}>
            <Eye aria-hidden className="size-4" />
            {t.sensitiveOnly}
          </ChipLink>
        </li>
      </ChipRow>
      <ChipRow label={t.target}>
        <li>
          <ChipLink href={href({ ...params, target: undefined })} active={!params.target}>
            {t.targetAll}
          </ChipLink>
        </li>
        {target.map((kind) => (
          <li key={kind}>
            <ChipLink href={href({ ...params, target: kind })} active={params.target === kind}>
              {targetKindLabel(locale, kind)}
            </ChipLink>
          </li>
        ))}
      </ChipRow>

      <GetForm action={auditHref(locale)} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <label htmlFor="audit-actor" className="text-small font-semibold text-fg">
            {t.actor}
          </label>
          <select id="audit-actor" name="actor" defaultValue={params.actor ?? ""} className={inputClasses}>
            <option value="">{t.actorAll}</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.system ? t.system : (actor.name ?? actor.id)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="audit-action" className="text-small font-semibold text-fg">
            {t.action}
          </label>
          <select id="audit-action" name="action" defaultValue={params.action ?? ""} className={inputClasses}>
            <option value="">{t.actionAll}</option>
            {actions.org.length > 0 ? (
              <optgroup label={t.orgGroup}>
                {actions.org.map((code) => (
                  <option key={code} value={code}>
                    {actionLabel(locale, code)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {actions.deal.length > 0 ? (
              <optgroup label={t.dealGroup}>
                {actions.deal.map((code) => (
                  <option key={code} value={code}>
                    {actionLabel(locale, code)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
        {params.target ? <input type="hidden" name="target" value={params.target} /> : null}
        {params.sensitive ? <input type="hidden" name="sensitive" value="1" /> : null}
        {demoRole ? <input type="hidden" name={DEMO_ROLE_PARAM} value={demoRole} /> : null}
        <Button type="submit" variant="secondary">
          <Filter aria-hidden className="size-4" />
          {t.apply}
        </Button>
      </GetForm>
      {params.actor || params.action || params.target || params.sensitive ? (
        <ButtonLink href={href({})} variant="ghost">
          {t.reset}
        </ButtonLink>
      ) : null}
    </div>
  );
}
