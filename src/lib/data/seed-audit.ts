import type { AuditEvent, ID, ISODateTime } from "@/lib/domain/types";
import { day, minutesFromNow } from "./seed-time";
import { SYSTEM_ACTOR_ID, type OrgAuditAction, type OrgAuditTargetKind } from "./views";

/**
 * Demo Realty's organization journal (§17.6, §36.5, §38.6 item 7, §39.6) —
 * all fictional. Append-only and in time order: events are never edited or
 * removed; a mistake is corrected by a new event (records_merged → merge_undone).
 *
 * - Reveals and views of restricted data, exports, permission and role
 *   changes and new-device logins carry the purpose in `reason`.
 * - A change of responsible agent always has a reason (§36.5).
 * - Automatic assignments are by `system` and name the routing rule id;
 *   manual ones are by the team lead.
 * - Deal histories stay on each Deal (`deal.audit`); the repository merges
 *   both logs for the audit screen.
 */

interface OrgAuditEvent extends AuditEvent {
  action: OrgAuditAction;
  target: { kind: OrgAuditTargetKind; id: ID };
}

type Row = [ISODateTime, ID, OrgAuditAction, OrgAuditTargetKind, ID, string?];

const rows: Row[] = [
  [day(-60, "10:00"), SYSTEM_ACTOR_ID, "role_changed", "agent", "agent-02", "agency_agent → team_lead: решение руководителя агентства"],
  [day(-58, "10:05"), "agent-01", "contract_signed", "contract", "ctr-drb-2026-003"],
  [day(-50, "10:05"), "agent-01", "contract_signed", "contract", "ctr-dr-2026-038"],
  [day(-45, "11:35"), "agent-01", "contract_signed", "contract", "ctr-dr-2026-041"],
  [
    day(-40, "12:10"),
    "agent-02",
    "responsible_changed",
    "client",
    "cl-10",
    "agent-02 → agent-01: клиент ищет в Сергели, это территория Азиза. Автор записи сохранён",
  ],
  [day(-40, "15:05"), "agent-01", "contract_signed", "contract", "ctr-dr-2026-040"],
  [day(-38, "10:05"), "agent-01", "contract_signed", "contract", "ctr-co-2026-004"],
  [day(-35, "10:05"), "agent-02", "contract_signed", "contract", "ctr-dr-2026-033"],
  [day(-30, "14:05"), "agent-01", "contract_signed", "contract", "ctr-dr-2026-044"],
  [day(-30, "14:20"), "agent-01", "verification_requested", "listing", "lst-02", "Право собственности: запрос в реестр прав"],
  [day(-29, "12:05"), "agent-01", "contract_signed", "contract", "ctr-drb-2026-015"],
  [day(-25, "10:05"), "agent-02", "contract_signed", "contract", "ctr-dr-2026-047"],
  [day(-20, "14:05"), "agent-01", "consent_revoked", "consent", "cons-cl-11-contact", "Клиентка попросила больше не связываться"],
  [
    day(-15, "09:00"),
    "agent-02",
    "responsible_changed",
    "listing",
    "lst-34",
    "agent-02 → agent-03: Авиасозлар — территория Тимура. Автор записи сохранён",
  ],
  [
    day(-14, "10:00"),
    "agent-02",
    "restricted_document_viewed",
    "document",
    "doc-deal-03-3",
    "Сверка паспортных данных покупателя для договора",
  ],
  [day(-14, "12:10"), "agent-01", "listing_status_changed", "listing", "lst-06", "contract_signed → verification_pending"],
  [day(-14, "12:20"), "agent-01", "verification_requested", "listing", "lst-06", "Право собственности: запрос в реестр прав"],
  [day(-12, "13:00"), "agent-01", "records_merged", "client", "cl-03", "Лид lead-10 и клиент — один человек: совпал телефон"],
  [day(-9, "11:35"), "agent-01", "contract_signed", "contract", "ctr-drb-2026-011"],
  [day(-9, "12:05"), "agent-01", "listing_status_changed", "listing", "lst-05", "active_mls → offer"],
  [
    day(-7, "10:00"),
    "agent-03",
    "verification_requested",
    "agent",
    "agent-03",
    "Квалификационный сертификат загружен, запрошена проверка в реестре",
  ],
  [
    day(-6, "09:00"),
    "agent-02",
    "permission_granted",
    "agent",
    "agent-01",
    "Данные собственника lst-12 на 5 дней: встречное предложение по offer-05",
  ],
  [day(-6, "10:30"), "agent-01", "export_requested", "export", "export-2026-09-24-01", "Свои объекты для отчёта собственникам, без контактов"],
  [day(-6, "11:05"), "agent-03", "contract_signed", "contract", "ctr-dr-2026-057"],
  [day(-6, "18:05"), "agent-03", "contract_signed", "contract", "ctr-dr-2026-058"],
  [day(-5, "16:10"), "agent-03", "records_merged", "client", "cl-18", "Похожее имя в Telegram"],
  [
    day(-5, "16:40"),
    "agent-03",
    "merge_undone",
    "client",
    "cl-18",
    "Ошибочное объединение: телефоны разные. Записи разделены, история сохранена",
  ],
  [day(-4, "13:05"), "agent-01", "contract_signed", "contract", "ctr-drb-2026-013"],
  [day(-3, "08:30"), "agent-03", "login_new_device", "session", "session-agent-03-0927", "Android, Ташкент"],
  [day(-3, "10:40"), "agent-03", "listing_status_changed", "listing", "lst-11", "offer → under_contract"],
  [
    day(-3, "11:05"),
    "agent-01",
    "restricted_document_viewed",
    "document",
    "doc-deal-05-5",
    "Проверка паспорта покупателя перед нотариусом",
  ],
  [day(-3, "18:35"), "agent-01", "contract_signed", "contract", "ctr-drb-2026-014"],
  [day(-2, "00:00"), SYSTEM_ACTOR_ID, "listing_status_changed", "listing", "lst-07", "active_mls → expired: срок публикации истёк"],
  [day(-2, "10:55"), "agent-08", "cooperation_accepted", "cooperation", "coop-07"],
  [day(-2, "11:05"), "agent-01", "contact_revealed", "agent", "agent-08", "Сотрудничество coop-07 принято: контакты партнёра открыты"],
  [day(-2, "14:11"), SYSTEM_ACTOR_ID, "lead_assigned", "lead", "lead-08", "rule-99 «Все остальные лиды»: round-robin → agent-01"],
  [day(-1, "09:00"), "agent-02", "export_requested", "export", "export-2026-09-29-01", "Нагрузка команды за сентябрь, без контактов клиентов"],
  [day(-1, "13:05"), "agent-02", "owner_contact_viewed", "owner", "owner-12", "Звонок собственнице по встречному предложению"],
  [
    day(-1, "13:30"),
    "agent-02",
    "permission_revoked",
    "agent",
    "agent-01",
    "Встречное предложение получено: доступ к данным собственника lst-12 закрыт",
  ],
  [day(-1, "15:05"), "agent-01", "owner_contact_viewed", "owner", "owner-34", "Отправить согласие правообладателя на подпись"],
  [day(-1, "16:11"), SYSTEM_ACTOR_ID, "lead_assigned", "lead", "lead-15", "rule-99 «Все остальные лиды»: round-robin → agent-03"],
  [day(-1, "17:48"), "agent-03", "owner_contact_viewed", "owner", "owner-11", "Звонок собственнику о подписании у нотариуса"],
  [day(0, "07:58"), "agent-01", "login_new_device", "session", "session-agent-01-0930", "Telegram Desktop, Ташкент"],
  [day(0, "08:06"), SYSTEM_ACTOR_ID, "lead_assigned", "lead", "lead-05", "rule-02 «Лиды на узбекском»: наименьшая загрузка → agent-01"],
  [minutesFromNow(-119), SYSTEM_ACTOR_ID, "lead_assigned", "lead", "lead-02", "rule-99 «Все остальные лиды»: round-robin → agent-01"],
  [day(0, "09:19"), "agent-01", "contact_revealed", "lead", "lead-04", "Перезвонить по номеру без комментария"],
  [day(0, "09:26"), SYSTEM_ACTOR_ID, "lead_assigned", "lead", "lead-13", "rule-02 «Лиды на узбекском»: наименьшая загрузка → agent-02"],
  [day(0, "09:28"), "agent-01", "owner_contact_viewed", "owner", "owner-06", "Звонок о продлении договора DR-2026-055"],
  [
    day(0, "10:06"),
    SYSTEM_ACTOR_ID,
    "lead_assigned",
    "lead",
    "lead-14",
    "rule-01 «Telegram: Юнусабад и Мирзо-Улугбек»: round-robin → agent-03",
  ],
  [
    minutesFromNow(-39),
    SYSTEM_ACTOR_ID,
    "lead_assigned",
    "lead",
    "lead-03",
    "rule-05 выключено → rule-99 «Все остальные лиды»: round-robin → agent-01",
  ],
  [day(0, "10:22"), "agent-02", "lead_assigned", "lead", "lead-12", "Вручную: повторное обращение бывшей клиентки Азиза (cl-11)"],
  [minutesFromNow(-14), "agent-02", "lead_assigned", "lead", "lead-07", "Вручную: рекомендация клиента Азиза (cl-01)"],
];

export const orgAuditLog: OrgAuditEvent[] = rows.map(([at, actorId, action, kind, id, reason], index) => {
  const event: OrgAuditEvent = {
    id: `aud-org-${String(index + 1).padStart(2, "0")}`,
    at,
    actorId,
    action,
    target: { kind, id },
  };
  if (reason) event.reason = reason;
  return event;
});
