import { describe, expect, it } from "vitest";
import * as repo from "@/lib/data/repository";
import type { ContractDetailView } from "@/lib/data/views";
import { CONTRACT_CLAUSES, contractIssues, type ContractIssue, type ContractIssueCode } from "@/lib/domain/contracts";
import { initialContractDemoState, reduceContractDemo } from "./contract-demo-state";
import {
  availableActions,
  CHECKLIST_ITEMS,
  clauseChecklist,
  contractHref,
  contractListHref,
  existingRenewal,
  issueContext,
  issuesOf,
  missingSignatures,
  newerTemplate,
  parseContractListParams,
  renewalDraft,
  sendCheck,
  terminateContract,
} from "./contract-rules";
import { daysText, issueText, percentText } from "./contract-text";

/** The demo clock: 11:00 in Tashkent on 30 September 2026. */
const NOW = new Date("2026-09-30T06:00:00.000Z");
const AT = NOW.toISOString();

async function load(id: string): Promise<ContractDetailView> {
  const view = await repo.getContract(id);
  if (!view) throw new Error(`missing ${id}`);
  return view;
}

describe("contract list params", () => {
  it("reads known status (incl. expiring), kind and a trimmed query; ignores the rest", () => {
    expect(parseContractListParams({ status: "expiring", kind: "buyer_service", q: "  DR-2026 " })).toEqual({
      status: "expiring",
      kind: "buyer_service",
      q: "DR-2026",
    });
    expect(parseContractListParams({ status: "bogus", kind: "x", q: "" })).toEqual({});
  });

  it("builds links with a stable key order and the id or the number", () => {
    expect(contractListHref("ru")).toBe("/ru/app/contracts");
    expect(contractListHref("uz", { q: "Цой", kind: "owner_service", status: "active" })).toBe(
      "/uz/app/contracts?status=active&kind=owner_service&q=%D0%A6%D0%BE%D0%B9",
    );
    expect(contractHref("ru", "DR-2026-041")).toBe("/ru/app/contracts/DR-2026-041");
  });
});

describe("§38.5 checklist", () => {
  it("covers every stored clause plus service, term and remuneration", () => {
    for (const clause of CONTRACT_CLAUSES) expect(CHECKLIST_ITEMS).toContain(clause);
    expect(CHECKLIST_ITEMS).toHaveLength(CONTRACT_CLAUSES.length + 3);
  });

  it("marks the missing insurance clause of DR-2026-043", async () => {
    const view = await load("ctr-dr-2026-043");
    const rows = clauseChecklist(view.contract, issuesOf(view));
    expect(rows.filter((row) => !row.present).map((row) => row.item)).toEqual(["insuranceDetails"]);
  });

  it("derives service, term and remuneration from the domain issues", async () => {
    const view = await load("ctr-dr-2026-041");
    const broken = { ...view.contract, service: " ", remuneration: { ...view.contract.remuneration, paymentTerms: "" } };
    const rows = clauseChecklist(broken, contractIssues(broken));
    expect(rows.filter((row) => !row.present).map((row) => row.item)).toEqual(["service", "remuneration"]);
  });
});

describe("issues and activation", () => {
  it("names the co-owner whose consent is missing (art. 37) and blocks sending for signature", async () => {
    const view = await load("ctr-dr-2026-061");
    const issues = issuesOf(view);
    expect(issues.map((issue) => issue.code)).toEqual(["right_holder_consent_missing"]);
    expect(issueText("ru", issues[0])).toBe("Нет согласия правообладателя: Дилноза Норматова (ст. 37).");
    const check = sendCheck(view.contract, NOW, issueContext(view));
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.issues.map((issue) => issue.code)).toEqual(["right_holder_consent_missing"]);
  });

  it("lets a complete draft go out for both signatures, and a co-broking agreement to the partner", async () => {
    const draft = await load("ctr-dr-2026-062");
    expect(sendCheck(draft.contract, NOW, issueContext(draft))).toEqual({ ok: true, parties: ["customer", "agent"], warnings: [] });
    const partner = await load("ctr-co-2026-005");
    expect(missingSignatures(partner.contract, NOW)).toEqual(["customer"]);
  });

  it("flags a simple electronic signature as a warning, never as an error", async () => {
    const view = await load("ctr-dr-2026-052");
    const issues = issuesOf(view);
    expect(issues.map((issue) => [issue.code, issue.severity])).toEqual([
      ["signature_method_unverified", "warning"],
      ["signature_method_unverified", "warning"],
    ]);
    expect(issueText("ru", issues[0])).toContain("простая электронная");
  });

  it("has a sentence for every rule code in both languages", () => {
    const samples: Record<ContractIssueCode, ContractIssue> = {
      period_invalid: { code: "period_invalid", severity: "error" },
      service_missing: { code: "service_missing", severity: "error" },
      clause_missing: { code: "clause_missing", severity: "error", params: { clause: "liability" } },
      remuneration_incomplete: { code: "remuneration_incomplete", severity: "error", params: { field: "percent" } },
      remuneration_invalid: { code: "remuneration_invalid", severity: "error", params: { field: "amount" } },
      right_holders_missing: { code: "right_holders_missing", severity: "error" },
      right_holder_consent_missing: { code: "right_holder_consent_missing", severity: "error", params: { ownerId: "owner-x" } },
      right_holder_consent_revoked: {
        code: "right_holder_consent_revoked",
        severity: "error",
        params: { ownerId: "owner-x", consentId: "c", ownerName: "Ali" },
      },
      right_holder_consent_unlinked: { code: "right_holder_consent_unlinked", severity: "warning", params: { ownerId: "owner-x" } },
      signature_missing: { code: "signature_missing", severity: "error", params: { party: "customer" } },
      signature_method_unverified: { code: "signature_method_unverified", severity: "warning", params: { party: "agent" } },
      status_not_activatable: { code: "status_not_activatable", severity: "error", params: { status: "expired" } },
      period_ended: { code: "period_ended", severity: "error", params: { endsAt: "2026-09-27T18:59:00.000Z" } },
    };
    for (const locale of ["ru", "uz"] as const) {
      for (const issue of Object.values(samples)) {
        const text = issueText(locale, issue, { "owner-x": "Owner X" });
        expect(text, issue.code).not.toMatch(/\{\w+\}|undefined/);
        expect(text.length, issue.code).toBeGreaterThan(10);
      }
    }
    expect(issueText("ru", samples.clause_missing)).toBe("В тексте нет обязательного условия: Ответственность.");
    expect(issueText("ru", samples.right_holder_consent_missing, {})).toContain("правообладатель owner-x");
    expect(issueText("uz", samples.status_not_activatable)).toContain("Muddati tugagan");
  });
});

describe("actions", () => {
  it("depend on the display status", async () => {
    const actions = async (id: string) => availableActions((await load(id)).contract, NOW);
    expect(await actions("ctr-dr-2026-062")).toEqual(["send"]);
    expect(await actions("ctr-dr-2026-061")).toEqual(["send", "terminate"]);
    expect(await actions("ctr-dr-2026-055")).toEqual(["renew", "terminate"]); // expiring
    expect(await actions("ctr-dr-2026-019")).toEqual(["renew"]); // expired
    expect(await actions("ctr-drb-2026-003")).toEqual([]); // terminated
  });

  it("finds the renewal already prepared instead of creating a second one", async () => {
    const view = await load("ctr-dr-2026-055");
    expect(existingRenewal(view.contract, view.related)?.contract.number).toBe("DR-2026-062");
    expect(existingRenewal(view.contract, [])).toBeUndefined();
  });

  it("drafts a renewal from the day after the end, same term, without signatures or a number", async () => {
    const view = await load("ctr-dr-2026-041");
    const draft = renewalDraft(view.contract, NOW);
    expect(draft.status).toBe("draft");
    expect(draft.number).toBe("");
    expect(draft.signatures).toEqual([]);
    expect(draft.rightHolderConsents).toEqual(view.contract.rightHolderConsents);
    expect(Date.parse(draft.startsAt)).toBeGreaterThan(Date.parse(view.contract.endsAt));
    expect(Date.parse(draft.startsAt) - Date.parse(view.contract.endsAt)).toBeLessThan(86_400_000);
    // The original is untouched.
    expect(view.contract.status).toBe("active");
    // An expired contract renews from today.
    const expired = await load("ctr-dr-2026-019");
    expect(renewalDraft(expired.contract, NOW).startsAt).toBe("2026-09-29T19:00:00.000Z");
  });

  it("terminates only with a reason and only an active or unsigned contract", async () => {
    const active = (await load("ctr-dr-2026-044")).contract;
    expect(terminateContract(active, "   ", AT)).toBeUndefined();
    expect(terminateContract(active, " Собственник передумал ", AT)).toMatchObject({
      status: "terminated",
      terminatedAt: AT,
      terminationReason: "Собственник передумал",
    });
    expect(terminateContract((await load("ctr-dr-2026-019")).contract, "reason", AT)).toBeUndefined();
  });

  it("runs the demo reducer with the real rules and resets", async () => {
    const view = await load("ctr-dr-2026-061");
    const context = { nowIso: AT, rules: issueContext(view) };
    const blocked = reduceContractDemo(initialContractDemoState(view.contract), { type: "send" }, context);
    expect(blocked.blocked?.map((issue) => issue.code)).toEqual(["right_holder_consent_missing"]);
    expect(blocked.contract.status).toBe("awaiting_signature");

    const draft = await load("ctr-dr-2026-062");
    const sent = reduceContractDemo(initialContractDemoState(draft.contract), { type: "send" }, { nowIso: AT, rules: issueContext(draft) });
    expect(sent.contract.status).toBe("awaiting_signature");
    expect(sent.notice).toEqual({ kind: "sent", parties: ["customer", "agent"] });

    const renewed = reduceContractDemo(initialContractDemoState((await load("ctr-dr-2026-041")).contract), { type: "renew" }, context);
    expect(renewed.renewal?.status).toBe("draft");
    const terminated = reduceContractDemo(renewed, { type: "terminate", reason: "По соглашению сторон" }, context);
    expect(terminated.contract.status).toBe("terminated");
    expect(reduceContractDemo(terminated, { type: "reset" }, context).contract.status).toBe("active");
  });
});

describe("texts", () => {
  it("states days left, days ago and percents in the locale's words", () => {
    expect(daysText("ru", "expiring", 5)).toBe("Истекает через 5 дней");
    expect(daysText("ru", "expiring", 0)).toBe("Истекает сегодня");
    expect(daysText("ru", "active", 1)).toBe("Остался 1 день");
    expect(daysText("ru", "expired", -3)).toBe("Истёк 3 дня назад");
    expect(daysText("uz", "expiring", 13)).toBe("13 kundan keyin tugaydi");
    expect(daysText("ru", "draft", 10)).toBeUndefined();
    expect(percentText("ru", 1.5)).toBe("1,5%");
    expect(percentText("uz", 3)).toBe("3%");
  });

  it("spots a newer template line in use", () => {
    expect(newerTemplate({ templateVersion: "owner-service@2026-05" }, [
      { templateVersion: "owner-service@2026-08" },
      { templateVersion: "buyer-service@2026-09" },
    ])).toBe("owner-service@2026-08");
    expect(newerTemplate({ templateVersion: "owner-service@2026-08" }, [{ templateVersion: "owner-service@2026-05" }])).toBeUndefined();
    expect(newerTemplate({ templateVersion: "no-version" }, [])).toBeUndefined();
  });
});
