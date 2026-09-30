import { describe, expect, it } from "vitest";
import { getViewing } from "@/lib/data/repository";
import type { Viewing } from "@/lib/domain/types";
import { initialViewingDemoState, reduceViewingDemo } from "./viewing-demo-state";

async function viewing(id: string): Promise<Viewing> {
  const view = await getViewing(id);
  if (!view) throw new Error(`missing ${id}`);
  return view.viewing;
}

describe("viewing demo state", () => {
  it("confirms, and becomes 'confirmed' only when both sides agreed", async () => {
    let state = initialViewingDemoState(await viewing("vw-02")); // client yes, partner not yet
    state = reduceViewingDemo(state, { type: "confirm", client: true, ownerOrPartner: false });
    expect(state.viewing.status).toBe("scheduled");
    state = reduceViewingDemo(state, { type: "confirm", client: true, ownerOrPartner: true });
    expect(state.viewing.status).toBe("confirmed");
    expect(state.notice).toEqual({ kind: "confirmed" });
  });

  it("asks both sides to confirm a new time again", async () => {
    const original = await viewing("vw-01"); // confirmed by both
    const state = reduceViewingDemo(initialViewingDemoState(original), {
      type: "reschedule",
      startsAt: "2026-10-02T09:00:00.000Z",
      durationMinutes: 45,
    });
    expect(state.viewing).toMatchObject({
      startsAt: "2026-10-02T09:00:00.000Z",
      durationMinutes: 45,
      status: "scheduled",
      confirmations: { client: false, ownerOrPartner: false },
    });
    // Undo restores the record exactly; the repository copy was never touched.
    expect(reduceViewingDemo(state, { type: "undo" }).viewing).toEqual(original);
    expect(state.original).toEqual(original);
  });

  it("cancels with a reason and keeps the comment trimmed", async () => {
    const state = reduceViewingDemo(initialViewingDemoState(await viewing("vw-05")), {
      type: "cancel",
      reason: "client",
      comment: "  заболел  ",
    });
    expect(state.viewing.status).toBe("cancelled");
    expect(state.notice).toEqual({ kind: "cancelled", reason: "client", comment: "заболел" });
    // A closed viewing is not reopened by later actions.
    expect(reduceViewingDemo(state, { type: "confirm", client: true, ownerOrPartner: true })).toBe(state);
  });

  it("never records an outcome without a next step (§14.8)", async () => {
    const start = initialViewingDemoState(await viewing("vw-01"));
    expect(reduceViewingDemo(start, { type: "complete", nextAction: "   ", rating: 5 })).toBe(start);
    expect(reduceViewingDemo(start, { type: "no_show", nextAction: "" })).toBe(start);
    const done = reduceViewingDemo(start, { type: "complete", nextAction: " Сделать предложение ", rating: 4, text: " ок " });
    expect(done.viewing).toMatchObject({
      status: "completed",
      nextAction: "Сделать предложение",
      feedback: { rating: 4, text: "ок" },
    });
    const missed = reduceViewingDemo(start, { type: "no_show", nextAction: "Перезвонить клиенту", who: "client" });
    expect(missed.viewing).toMatchObject({ status: "no_show", nextAction: "Перезвонить клиенту" });
    expect(missed.notice).toEqual({ kind: "no_show", who: "client" });
  });

  it("adds a missing next step to a finished viewing only", async () => {
    const completed = { ...(await viewing("vw-07")), nextAction: undefined };
    const state = reduceViewingDemo(initialViewingDemoState(completed), { type: "next_action", nextAction: "Позвонить" });
    expect(state.viewing.nextAction).toBe("Позвонить");
    const open = initialViewingDemoState(await viewing("vw-03"));
    expect(reduceViewingDemo(open, { type: "next_action", nextAction: "Позвонить" })).toBe(open);
  });
});
