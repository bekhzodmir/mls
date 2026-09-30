import { describe, expect, it } from "vitest";
import { getLead, listLeads } from "@/lib/data/repository";
import type { LeadSla } from "@/lib/data/views";
import { describeSla, formatDuration, isUrgent, minutesBetween } from "./sla";

const lead = { receivedAt: "2026-09-30T05:00:00.000Z" };

describe("formatDuration", () => {
  it("formats minutes, hours and days in both languages", () => {
    expect(formatDuration("ru", 25)).toBe("25 мин");
    expect(formatDuration("ru", 60)).toBe("1 ч");
    expect(formatDuration("ru", 65)).toBe("1 ч 5 мин");
    expect(formatDuration("ru", 24 * 60)).toBe("1 дн.");
    expect(formatDuration("ru", 26 * 60 + 10)).toBe("1 дн. 2 ч");
    expect(formatDuration("uz", 25)).toBe("25 daqiqa");
    expect(formatDuration("uz", 125)).toBe("2 soat 5 daqiqa");
    expect(formatDuration("uz", 3 * 24 * 60)).toBe("3 kun");
  });

  it("never shows negative or fractional minutes", () => {
    expect(formatDuration("ru", -5)).toBe("0 мин");
    expect(formatDuration("ru", 4.6)).toBe("5 мин");
  });
});

describe("describeSla", () => {
  const sla = (state: LeadSla["state"], minutesLeft: number, respondedLate?: boolean): LeadSla => ({
    state,
    dueAt: "2026-09-30T06:00:00.000Z",
    minutesLeft,
    ...(respondedLate === undefined ? {} : { respondedLate }),
  });

  it("says how late a breached lead is", () => {
    const display = describeSla("ru", lead, sla("breached", -25));
    expect(display).toEqual({ kind: "breached", tone: "danger", text: "Просрочен на 25 мин" });
    expect(describeSla("uz", lead, sla("breached", -25)).text).toBe("Muddati 25 daqiqa oldin o‘tgan");
  });

  it("says how long is left, never promising zero minutes", () => {
    expect(describeSla("ru", lead, sla("due_soon", 40)).text).toBe("Ответить в течение 40 мин");
    expect(describeSla("ru", lead, sla("due_soon", 0)).text).toBe("Ответить в течение 1 мин");
    expect(describeSla("ru", lead, sla("on_track", 125)).tone).toBe("neutral");
  });

  it("measures the first response from the moment the lead arrived", () => {
    const responded = { ...lead, firstResponseAt: "2026-09-30T05:27:00.000Z" };
    expect(describeSla("ru", responded, sla("responded", 30, false))).toEqual({
      kind: "responded",
      tone: "success",
      text: "Ответили через 27 мин",
    });
    const late = describeSla("ru", { ...lead, firstResponseAt: "2026-09-30T06:25:00.000Z" }, sla("responded", 0, true));
    expect(late.kind).toBe("responded_late");
    expect(late.text).toBe("Ответили с опозданием — через 1 ч 25 мин");
  });

  it("describes a closed lead without a response", () => {
    expect(describeSla("uz", lead, sla("closed", -600)).text).toBe("Birinchi javobsiz yopilgan");
  });
});

describe("with the demo inbox", () => {
  it("matches the repository's SLA states for seeded leads", async () => {
    const breached = await getLead("lead-02");
    expect(breached && describeSla("ru", breached.lead, breached.sla).text).toBe("Просрочен на 1 ч");
    const dueSoon = await getLead("lead-01");
    expect(dueSoon && describeSla("ru", dueSoon.lead, dueSoon.sla).text).toBe("Ответить в течение 5 мин");
  });

  it("flags only unanswered leads that are late or close to it", async () => {
    const urgent = (await listLeads()).filter((view) => isUrgent(view.sla)).map((view) => view.lead.id);
    expect(urgent).toContain("lead-01");
    expect(urgent).toContain("lead-02");
    expect(urgent).not.toContain("lead-05");
  });

  it("computes minutes between instants", () => {
    expect(minutesBetween("2026-09-30T05:00:00.000Z", "2026-09-30T05:27:30.000Z")).toBe(28);
  });
});
