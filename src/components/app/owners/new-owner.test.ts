import { describe, expect, it } from "vitest";
import { listClients, listOwners } from "@/lib/data/repository";
import { findPhoneDuplicates, personKey, validateNewOwner, type NewOwnerDraft, type PersonCard } from "./new-owner";

const people: PersonCard[] = [
  { kind: "client", id: "cl-01", name: "Санжар Ибрагимов", phones: ["+998901112233"] },
  { kind: "owner", id: "owner-01", name: "Бахтиёр Юлдашев", phones: ["+998910000201"] },
  { kind: "owner", id: "owner-02", name: "Наргиза Хамидова", phones: ["+998 91 000 02 02"] },
  { kind: "client", id: "cl-02", name: "Бахтиёр Юлдашев", phones: ["+998930000000", "998910000201"] },
];

describe("findPhoneDuplicates", () => {
  it("normalizes any common spelling to +998 before comparing", () => {
    for (const spelling of ["+998 91 000 02 01", "998910000201", "91 000-02-01", "8 910000201"]) {
      expect(findPhoneDuplicates(spelling, "", people).map((hit) => personKey(hit.person))).toEqual([
        "owner:owner-01",
        "client:cl-02",
      ]);
    }
    expect(findPhoneDuplicates("910000202", "", people).map((hit) => hit.person.id)).toEqual(["owner-02"]);
  });

  it("finds nothing for an incomplete number and says whether the name looks alike too", () => {
    expect(findPhoneDuplicates("+998 91 000", "", people)).toEqual([]);
    const hits = findPhoneDuplicates("+998910000201", "Бахтиёр", people);
    expect(hits.every((hit) => hit.sameName)).toBe(true);
    expect(findPhoneDuplicates("+998910000201", "Ильдар", people).some((hit) => hit.sameName)).toBe(false);
  });

  it("recognises a seeded owner whose contact the viewer may see", async () => {
    const owners = await listOwners();
    const clients = await listClients();
    const cards: PersonCard[] = [
      ...owners.flatMap((item): PersonCard[] =>
        item.owner.phone ? [{ kind: "owner", id: item.owner.id, name: item.owner.name, phones: [item.owner.phone] }] : [],
      ),
      ...clients.map((item): PersonCard => ({ kind: "client", id: item.client.id, name: item.client.name, phones: item.client.phones })),
    ];
    expect(findPhoneDuplicates("+998 91 000 02 34", "", cards).map((hit) => hit.person.id)).toEqual(["owner-34"]);
    // A colleague's owner (contact hidden) is not in the cards, so its number cannot be probed.
    expect(cards.some((card) => card.id === "owner-13")).toBe(false);
  });
});

describe("validateNewOwner", () => {
  const draft: NewOwnerDraft = {
    name: "Тест Тестов",
    phone: "+998 90 555 12 34",
    purposes: [],
    consentObtained: false,
    differentFrom: [],
  };

  it("needs a name and a valid phone; consent is optional", () => {
    expect(validateNewOwner(draft, [])).toEqual([]);
    expect(validateNewOwner({ ...draft, name: "  ", phone: "" }, [])).toEqual([
      { field: "name", error: "name_required" },
      { field: "phone", error: "phone_required" },
    ]);
    expect(validateNewOwner({ ...draft, phone: "+998 90 555" }, [])).toEqual([{ field: "phone", error: "phone_invalid" }]);
  });

  it("blocks saving until every phone match is opened or marked as a different person", () => {
    const hits = findPhoneDuplicates("+998910000201", "", people);
    expect(validateNewOwner({ ...draft, phone: "+998910000201" }, hits)).toEqual([
      { field: "duplicates", error: "duplicate_unresolved" },
    ]);
    expect(
      validateNewOwner({ ...draft, phone: "+998910000201", differentFrom: ["owner:owner-01"] }, hits).map((e) => e.error),
    ).toEqual(["duplicate_unresolved"]);
    expect(
      validateNewOwner({ ...draft, phone: "+998910000201", differentFrom: ["owner:owner-01", "client:cl-02"] }, hits),
    ).toEqual([]);
  });

  it("records a consent only with a channel and the explicit 'actually obtained' statement", () => {
    expect(validateNewOwner({ ...draft, purposes: ["contact"] }, [])).toEqual([
      { field: "channel", error: "channel_required" },
      { field: "consentObtained", error: "consent_not_confirmed" },
    ]);
    expect(validateNewOwner({ ...draft, purposes: ["contact"], channel: "written" }, [])).toEqual([
      { field: "consentObtained", error: "consent_not_confirmed" },
    ]);
    expect(
      validateNewOwner({ ...draft, purposes: ["contact", "marketing"], channel: "written", consentObtained: true }, []),
    ).toEqual([]);
  });
});
