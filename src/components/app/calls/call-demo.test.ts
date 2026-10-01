import { describe, expect, it } from "vitest";
import type { CallSummary } from "@/lib/domain/types";
import { initialSummaryState, reduceSummary, validateHandled, type HandledInput } from "./call-demo";

const draft: CallSummary = {
  status: "draft",
  text: "Ищет 2–3 комнаты в Юнусабаде до $90 000.",
  extractedRequest: "2–3 комнаты в Юнусабаде до 90 тысяч долларов",
  generatedAt: "2026-09-30T05:39:00.000Z",
};
const confirmed: CallSummary = {
  ...draft,
  status: "confirmed",
  confirmedAt: "2026-09-29T13:40:00.000Z",
  confirmedById: "agent-01",
};
const at = "2026-09-30T06:00:00.000Z";

describe("AI summary demo state", () => {
  it("confirms a draft as is, with who and when", () => {
    const state = reduceSummary(initialSummaryState(draft), { type: "confirm", at, by: "Вы" });
    expect(state).toMatchObject({ status: "confirmed", text: draft.text, corrected: false, confirmedAt: at, confirmedBy: "Вы" });
    expect(state.notice).toBe("confirmed");
  });

  it("saves a correction as the agent's confirmed text and ignores an empty one", () => {
    const start = initialSummaryState(draft);
    expect(reduceSummary(start, { type: "correct", text: "   ", at, by: "Вы" })).toBe(start);
    const state = reduceSummary(start, { type: "correct", text: "  Бюджет до $95 000.  ", at, by: "Вы" });
    expect(state).toMatchObject({ status: "confirmed", text: "Бюджет до $95 000.", corrected: true, notice: "corrected" });
  });

  it("rejects only drafts, and a rejected draft cannot be confirmed or corrected", () => {
    const rejected = reduceSummary(initialSummaryState(draft), { type: "reject" });
    expect(rejected.status).toBe("rejected");
    expect(reduceSummary(rejected, { type: "confirm", at, by: "Вы" })).toBe(rejected);
    expect(reduceSummary(rejected, { type: "correct", text: "Текст", at, by: "Вы" })).toBe(rejected);
    const stored = initialSummaryState(confirmed, "Вы");
    expect(reduceSummary(stored, { type: "reject" })).toBe(stored);
  });

  it("keeps who confirmed a stored summary and restores it on undo", () => {
    const stored = initialSummaryState(confirmed, "Вы");
    expect(stored).toMatchObject({ status: "confirmed", confirmedAt: confirmed.confirmedAt, confirmedBy: "Вы" });
    const corrected = reduceSummary(stored, { type: "correct", text: "Новый текст", at, by: "Вы" });
    expect(corrected.corrected).toBe(true);
    const undone = reduceSummary(corrected, { type: "undo" });
    expect(undone).toEqual(stored);
    expect(reduceSummary(reduceSummary(initialSummaryState(draft), { type: "reject" }), { type: "undo" })).toEqual(
      initialSummaryState(draft),
    );
  });
});

describe("mark handled", () => {
  const today = "2026-09-30";
  const base: HandledInput = { mode: "next", text: "", date: "", time: "", reason: "", comment: "" };

  it("needs a next action, or an explicit reason", () => {
    expect(validateHandled(base, today)).toEqual({ text: true });
    expect(validateHandled({ ...base, text: "Отправить подборку" }, today)).toEqual({});
    expect(validateHandled({ ...base, mode: "none" }, today)).toEqual({ reason: true });
    expect(validateHandled({ ...base, mode: "none", reason: "resolved" }, today)).toEqual({});
  });

  it("checks the due date and time", () => {
    const next = { ...base, text: "Перезвонить" };
    expect(validateHandled({ ...next, date: "2026-09-29" }, today)).toEqual({ date: true });
    expect(validateHandled({ ...next, date: today, time: "18:00" }, today)).toEqual({});
    expect(validateHandled({ ...next, time: "18:00" }, today)).toEqual({ time: true });
  });

  it("asks for a comment when the reason is «other»", () => {
    const none: HandledInput = { ...base, mode: "none", reason: "other" };
    expect(validateHandled(none, today)).toEqual({ comment: true });
    expect(validateHandled({ ...none, comment: "Перезвонит сам" }, today)).toEqual({});
  });

  it("ignores the fields of the other mode", () => {
    expect(validateHandled({ ...base, mode: "none", reason: "spam", date: "2020-01-01" }, today)).toEqual({});
    expect(validateHandled({ ...base, text: "Шаг", reason: "other" }, today)).toEqual({});
  });
});
