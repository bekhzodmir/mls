import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import leads from "@/i18n/messages/leads";
import type { LeadSla } from "@/lib/data/views";
import type { Lead } from "@/lib/domain/types";

/**
 * First-response SLA wording for the Lead Inbox (§14.1, §22.2, §35.3 step 5):
 * «Просрочен на 25 мин» / «Ответить в течение 40 мин». The repository computes
 * the state against the app clock; this module only turns it into text.
 */

const MINUTE_MS = 60_000;

/** "25 мин", "1 ч 5 мин", "2 дн. 3 ч" / "25 daqiqa", "1 soat 5 daqiqa", "2 kun 3 soat". */
export function formatDuration(locale: Locale, minutes: number): string {
  const t = leads[locale].duration;
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return format(t.minutes, { m: total });
  const hours = Math.floor(total / 60);
  const restMinutes = total % 60;
  if (hours < 24) {
    return restMinutes === 0 ? format(t.hours, { h: hours }) : format(t.hoursMinutes, { h: hours, m: restMinutes });
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0 ? format(t.days, { d: days }) : format(t.daysHours, { d: days, h: restHours });
}

export type SlaKind = LeadSla["state"] | "responded_late";

export interface SlaDisplay {
  kind: SlaKind;
  tone: "danger" | "warning" | "neutral" | "success";
  text: string;
}

/**
 * One line that says what to do about the deadline. Due states never say
 * "0 мин": the smallest promise is one minute.
 */
export function describeSla(
  locale: Locale,
  lead: Pick<Lead, "receivedAt" | "firstResponseAt">,
  sla: LeadSla,
): SlaDisplay {
  const t = leads[locale].sla;
  switch (sla.state) {
    case "breached":
      return {
        kind: "breached",
        tone: "danger",
        text: format(t.breached, { duration: formatDuration(locale, -sla.minutesLeft) }),
      };
    case "due_soon":
      return {
        kind: "due_soon",
        tone: "warning",
        text: format(t.dueSoon, { duration: formatDuration(locale, Math.max(1, sla.minutesLeft)) }),
      };
    case "on_track":
      return {
        kind: "on_track",
        tone: "neutral",
        text: format(t.onTrack, { duration: formatDuration(locale, Math.max(1, sla.minutesLeft)) }),
      };
    case "responded": {
      const minutes = lead.firstResponseAt ? minutesBetween(lead.receivedAt, lead.firstResponseAt) : 0;
      const duration = formatDuration(locale, minutes);
      return sla.respondedLate
        ? { kind: "responded_late", tone: "warning", text: format(t.respondedLate, { duration }) }
        : { kind: "responded", tone: "success", text: format(t.responded, { duration }) };
    }
    case "closed":
      return { kind: "closed", tone: "neutral", text: t.closed };
  }
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / MINUTE_MS);
}

/** Leads that still wait for a first answer and are late or close to it. */
export function isUrgent(sla: LeadSla): boolean {
  return sla.state === "breached" || sla.state === "due_soon";
}
