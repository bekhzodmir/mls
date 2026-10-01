import { auditActionText as dealActionText, auditReasonText as dealReasonText } from "@/components/app/deals/rules-text";
import { firstParam, type SearchParamsRecord } from "@/components/app/mls/url";
import { auditCheck } from "@/components/app/team/access";
import { withDemoRole, type DemoRole } from "@/components/app/team/demo-role";
import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import audit from "@/i18n/messages/audit";
import deals from "@/i18n/messages/deals";
import domain from "@/i18n/messages/domain";
import {
  AUDIT_ACTIONS,
  ORG_AUDIT_ACTIONS,
  ORG_AUDIT_TARGET_KINDS,
  SYSTEM_ACTOR_ID,
  type AuditEventView,
} from "@/lib/data/views";
import type { Actor } from "@/lib/domain/permissions";
import { tashkentDateKey } from "@/lib/domain/working-days";
import type { ID } from "@/lib/domain/types";
import { appPath } from "@/lib/routes";

/**
 * Pure helpers for the audit log (§17.6, §18.1, §38.6 item 7, §39.3): which
 * events the role may read (§19 "Audit"), URL filters, and list-safe labels.
 * The repository returns the whole journal with a `scope` per event; the
 * matrix is applied here, before anything is rendered.
 */

/* --------------------------------------------------------------- params */

export interface AuditParams {
  /** An agent id or `system`. */
  actor?: string;
  action?: string;
  target?: string;
  sensitive?: boolean;
}

const ACTIONS: ReadonlySet<string> = new Set<string>([...ORG_AUDIT_ACTIONS, ...AUDIT_ACTIONS]);

/** Org journal kinds plus the deal-history kinds labelled in the deals namespace. */
export const AUDIT_TARGET_KINDS: readonly string[] = [
  ...new Set<string>([...ORG_AUDIT_TARGET_KINDS, ...Object.keys(deals.ru.audit.kinds)]),
];

const ACTOR_PATTERN = /^[a-z0-9-]{1,40}$/;

/** Unknown values are dropped, not errors: a stale link still opens the journal. */
export function parseAuditParams(params: SearchParamsRecord): AuditParams {
  const parsed: AuditParams = {};
  const actor = firstParam(params, "actor");
  const action = firstParam(params, "action");
  const target = firstParam(params, "target");
  const sensitive = firstParam(params, "sensitive");
  if (actor && ACTOR_PATTERN.test(actor)) parsed.actor = actor;
  if (action && ACTIONS.has(action)) parsed.action = action;
  if (target && AUDIT_TARGET_KINDS.includes(target)) parsed.target = target;
  if (sensitive === "1" || sensitive === "true" || sensitive === "on") parsed.sensitive = true;
  return parsed;
}

export function auditHref(locale: string, params: AuditParams = {}, demoRole?: DemoRole): string {
  const query = new URLSearchParams();
  if (params.actor) query.set("actor", params.actor);
  if (params.action) query.set("action", params.action);
  if (params.target) query.set("target", params.target);
  if (params.sensitive) query.set("sensitive", "1");
  const search = query.toString();
  return withDemoRole(`${appPath(locale, "/audit")}${search ? `?${search}` : ""}`, demoRole);
}

export function hasFilters(params: AuditParams): boolean {
  return Boolean(params.actor || params.action || params.target || params.sensitive);
}

/* ---------------------------------------------------------------- reach */

/** The events the role may read; the rest are never rendered (§19 "Audit"). */
export function visibleEvents(views: readonly AuditEventView[], actor: Actor): AuditEventView[] {
  return views.filter((view) => auditCheck(actor, view.scope).ok);
}

export function filterEvents(views: readonly AuditEventView[], params: AuditParams): AuditEventView[] {
  return views.filter(
    (view) =>
      (!params.actor || view.event.actorId === params.actor) &&
      (!params.action || view.event.action === params.action) &&
      (!params.target || view.event.target.kind === params.target) &&
      (!params.sensitive || view.sensitive),
  );
}

/* -------------------------------------------------------------- options */

export interface ActorOption {
  id: ID;
  name?: string;
  system: boolean;
}

/** People who appear in the visible events, by name; "system" last. Never names outside the actor's reach. */
export function actorOptions(views: readonly AuditEventView[], compare: (a: string, b: string) => number): ActorOption[] {
  const byId = new Map<ID, ActorOption>();
  for (const view of views) {
    if (byId.has(view.event.actorId)) continue;
    const option: ActorOption = { id: view.event.actorId, system: view.system };
    if (view.actor) option.name = view.actor.name;
    byId.set(view.event.actorId, option);
  }
  return [...byId.values()].sort(
    (a, b) => Number(a.system) - Number(b.system) || compare(a.name ?? a.id, b.name ?? b.id),
  );
}

/** Action codes present in the visible events, in the label order of each journal. */
export function actionOptions(views: readonly AuditEventView[]): { org: string[]; deal: string[] } {
  const present = new Set(views.map((view) => view.event.action));
  return {
    org: ORG_AUDIT_ACTIONS.filter((code) => present.has(code)),
    deal: AUDIT_ACTIONS.filter((code) => present.has(code)),
  };
}

export function targetOptions(views: readonly AuditEventView[]): string[] {
  const present = new Set(views.map((view) => view.event.target.kind));
  return AUDIT_TARGET_KINDS.filter((kind) => present.has(kind));
}

/* --------------------------------------------------------------- labels */

function has<T extends object>(record: T, key: string): key is Extract<keyof T, string> {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function actionLabel(locale: Locale, code: string): string {
  const labels = audit[locale].actions;
  return has(labels, code) ? labels[code] : dealActionText(locale, code);
}

export function targetKindLabel(locale: Locale, kind: string): string {
  const shared = deals[locale].audit.kinds;
  const own = audit[locale].targetKinds;
  if (has(shared, kind)) return shared[kind];
  if (has(own, kind)) return own[kind];
  return deals[locale].audit.unknownKind;
}

/** «Документ: Копия паспорта (doc-deal-03-3)», «Клиент: Мадина Эргашева». Never a phone, address or content. */
export function targetLabel(locale: Locale, view: AuditEventView): string {
  const t = audit[locale];
  const kind = targetKindLabel(locale, view.target.kind);
  const label = view.target.documentType
    ? format(t.documentTarget, { type: domain[locale].documentType[view.target.documentType], id: view.target.id })
    : view.target.label;
  return format(t.target, { kind, label });
}

const TRANSITION = /^\s*([a-z_]+)\s*→\s*([a-z_]+)([\s\S]*)$/;

/**
 * Reasons are stored verbatim in the language they were written in. The
 * machine-written parts are localized: a listing status or role transition
 * ("active_mls → offer"), deal stage changes, and agent ids, which are
 * replaced by names.
 */
export function reasonText(
  locale: Locale,
  view: AuditEventView,
  agentName: (id: ID) => string | undefined,
): string | undefined {
  const reason = view.event.reason;
  if (!reason) return undefined;
  if (view.log === "deal") return dealReasonText(locale, reason);
  const d = domain[locale];
  let text = reason;
  const match = TRANSITION.exec(reason);
  if (match) {
    const [, from, to, rest] = match;
    if (has(d.listingStatus, from) && has(d.listingStatus, to)) {
      text = `${d.listingStatus[from]} → ${d.listingStatus[to]}${rest}`;
    } else if (has(d.role, from) && has(d.role, to)) {
      text = `${d.role[from]} → ${d.role[to]}${rest}`;
    }
  }
  return text.replace(/\bagent-\d+\b/g, (id) => agentName(id) ?? id);
}

/** Who acted: the person, "Система" for automatic actions, never blank. */
export function actorLabel(locale: Locale, view: AuditEventView, viewerId: ID): string {
  const t = audit[locale].row;
  if (view.system || view.event.actorId === SYSTEM_ACTOR_ID) return t.system;
  if (!view.actor) return t.unknownActor;
  return view.actor.id === viewerId ? `${view.actor.name} (${t.you})` : view.actor.name;
}

/* ----------------------------------------------------------------- days */

/** Newest day first, events inside a day in the given (newest first) order. */
export function groupByDay(views: readonly AuditEventView[]): { day: string; views: AuditEventView[] }[] {
  const groups: { day: string; views: AuditEventView[] }[] = [];
  for (const view of views) {
    const day = tashkentDateKey(view.event.at);
    const last = groups.at(-1);
    if (last?.day === day) last.views.push(view);
    else groups.push({ day, views: [view] });
  }
  return groups;
}
