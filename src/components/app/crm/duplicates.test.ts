import { describe, expect, it } from "vitest";
import { getClient, listClients } from "@/lib/data/repository";
import {
  contactCard,
  contactRevokedAt,
  duplicateReasons,
  findDuplicateClients,
  namesLookAlike,
  normalizeTelegram,
  phoneStatus,
  type ContactCard,
} from "./duplicates";

const cards: ContactCard[] = [
  { id: "cl-a", name: "Гульнара Сафарова", phones: ["+998930000302"], status: "viewing" },
  {
    id: "cl-b",
    name: "Санжар Ибрагимов",
    phones: ["+998930000301"],
    telegramUsername: "sanjar_demo",
    status: "selection",
  },
  { id: "cl-c", name: "Гульнара Ахмедова", phones: ["+998930000399"], status: "new" },
];

describe("phoneStatus", () => {
  it("accepts every common spelling of a Uzbek number", () => {
    expect(phoneStatus("+998 93 000 03 02")).toEqual({ state: "valid", e164: "+998930000302" });
    expect(phoneStatus("93 000 03 02")).toEqual({ state: "valid", e164: "+998930000302" });
    expect(phoneStatus("8 93 000 03 02")).toEqual({ state: "valid", e164: "+998930000302" });
  });

  it("distinguishes typing in progress from an impossible number", () => {
    expect(phoneStatus("")).toEqual({ state: "empty" });
    expect(phoneStatus("+998 93 0")).toEqual({ state: "incomplete" });
    expect(phoneStatus("93 000")).toEqual({ state: "incomplete" });
    expect(phoneStatus("+998 03 000 03 02")).toEqual({ state: "invalid" });
    expect(phoneStatus("+998 93 000 03 02 1")).toEqual({ state: "invalid" });
  });
});

describe("normalizeTelegram", () => {
  it("strips @ and lower-cases, rejecting impossible usernames", () => {
    expect(normalizeTelegram("@Sanjar_Demo")).toBe("sanjar_demo");
    expect(normalizeTelegram("abc")).toBeUndefined();
    expect(normalizeTelegram("имя_кириллицей")).toBeUndefined();
    expect(normalizeTelegram(undefined)).toBeUndefined();
  });
});

describe("duplicate detection", () => {
  it("matches on the normalized phone, whatever the spelling", () => {
    const hits = findDuplicateClients({ phones: ["93 000 03 02"] }, cards);
    expect(hits.map((hit) => hit.client.id)).toEqual(["cl-a"]);
    expect(hits[0].reasons).toEqual(["phone"]);
  });

  it("matches on Telegram and adds a similar name as a supporting reason", () => {
    const hits = findDuplicateClients({ name: "Санжар", phones: [], telegramUsername: "@SANJAR_DEMO" }, cards);
    expect(hits).toHaveLength(1);
    expect(hits[0].reasons).toEqual(["telegram", "name"]);
  });

  it("never warns on a name alone", () => {
    expect(findDuplicateClients({ name: "Гульнара", phones: [] }, cards)).toEqual([]);
    expect(duplicateReasons({ name: "Гульнара", phones: [] }, cards[2])).toEqual(["name"]);
  });

  it("compares names by shared words, ignoring case and short particles", () => {
    expect(namesLookAlike("ГУЛЬНАРА", "Гульнара Сафарова")).toBe(true);
    expect(namesLookAlike("Гуля (Instagram)", "Гульнара Сафарова")).toBe(false);
    expect(namesLookAlike(undefined, "Гульнара")).toBe(false);
  });
});

describe("with the demo CRM", () => {
  it("finds the seeded duplicate of lead-06 by phone", async () => {
    const all = (await listClients()).map((item) => contactCard(item.client));
    const hits = findDuplicateClients({ name: "Гульнара Сафарова", phones: ["+998930000302"] }, all);
    expect(hits[0]?.client.id).toBe("cl-02");
    expect(hits[0]?.reasons).toEqual(["phone", "name"]);
  });

  it("reports a revoked contact consent only when no contact consent is active", async () => {
    const lost = await getClient("cl-11");
    expect(lost && contactRevokedAt(lost.client)).toBeTruthy();
    expect(lost && contactCard(lost.client).contactRevokedAt).toBe(lost?.client.consents[0].revokedAt);
    const active = await getClient("cl-01");
    expect(active && contactRevokedAt(active.client)).toBeUndefined();
  });
});
