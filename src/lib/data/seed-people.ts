import type { Agent, Consent, Organization, Owner, VerificationItem } from "@/lib/domain/types";
import { day } from "./seed-time";

/**
 * Demo professionals, organizations and property owners. Everything here is
 * fictional: agency names say "Demo" / "Namuna" (Uzbek for "sample") / "Test",
 * and every phone number follows the obviously fake "+998 XX 000 XX XX"
 * pattern. Binor's public contacts (`src/lib/site.ts`) are never reused for
 * demo people.
 *
 * Verification items name exactly one checked fact each (§16.4, §38.2): an
 * agent's identity, certificate and an organization's registry entry are
 * separate facts with their own method, source and date.
 */

/** The signed-in demo user: an agency agent at "Demo Realty". */
export const VIEWER_AGENT_ID = "agent-01";

export const organizations: Organization[] = [
  {
    id: "org-01",
    name: "Demo Realty",
    branchName: "Юнусабад",
    registry: {
      id: "ver-org-01-registry",
      subject: "org_registry",
      status: "confirmed",
      method: "official_source",
      source: "Единый реестр риэлторских организаций (демо-выписка)",
      checkedAt: day(-21, "12:00"),
      expiresAt: day(344, "12:00"),
    },
    insurance: {
      id: "ver-org-01-insurance",
      subject: "insurance",
      status: "confirmed",
      method: "document_review",
      source: "Полис страхования ответственности № DEMO-0001",
      checkedAt: day(-60, "15:00"),
      expiresAt: day(120, "23:59"),
    },
  },
  {
    id: "org-02",
    name: "Namuna Estate Demo",
    registry: {
      id: "ver-org-02-registry",
      subject: "org_registry",
      status: "confirmed",
      method: "official_source",
      source: "Единый реестр риэлторских организаций (демо-выписка)",
      checkedAt: day(-35, "10:00"),
    },
    insurance: {
      id: "ver-org-02-insurance",
      subject: "insurance",
      status: "pending",
      method: "document_review",
      source: "Полис загружен, ожидает проверки",
    },
  },
  {
    id: "org-03",
    name: "Test Makon Realty",
    registry: {
      id: "ver-org-03-registry",
      subject: "org_registry",
      // The registry did not answer: shown as "could not verify", never as verified.
      status: "unavailable",
      method: "official_source",
      source: "Единый реестр (демо): сервис не ответил",
      checkedAt: day(-1, "16:20"),
      note: "Повторить запрос позже",
    },
  },
];

function certificate(
  agentId: string,
  status: VerificationItem["status"],
  checkedDaysAgo?: number,
  note?: string,
): VerificationItem {
  const item: VerificationItem = {
    id: `ver-${agentId}-certificate`,
    subject: "agent_certificate",
    status,
    method: "official_source",
    source:
      status === "unavailable"
        ? "Реестр квалификационных сертификатов (демо): нет ответа"
        : "Реестр квалификационных сертификатов (демо)",
  };
  if (checkedDaysAgo !== undefined) item.checkedAt = day(-checkedDaysAgo, "11:30");
  if (status === "confirmed") item.expiresAt = day(640, "23:59");
  if (note) item.note = note;
  return item;
}

function identity(agentId: string, checkedDaysAgo: number): VerificationItem {
  return {
    id: `ver-${agentId}-identity`,
    subject: "agent_identity",
    status: "confirmed",
    method: "document_review",
    source: "Паспорт, проверен администратором агентства (демо)",
    checkedAt: day(-checkedDaysAgo, "10:15"),
  };
}

export const agents: Agent[] = [
  {
    id: VIEWER_AGENT_ID,
    name: "Азиз Каримов",
    phone: "+998900000101",
    telegramUsername: "aziz_karimov_demo",
    organizationId: "org-01",
    role: "agency_agent",
    professionalStatus: "certified_realtor",
    verifications: [identity("agent-01", 120), certificate("agent-01", "confirmed", 30)],
    territory: ["yunusabad", "mirzo_ulugbek", "chilanzar", "mirabad", "yakkasaray"],
    languages: ["ru", "uz"],
  },
  {
    id: "agent-02",
    name: "Нигора Юсупова",
    phone: "+998900000102",
    telegramUsername: "nigora_demo",
    organizationId: "org-01",
    role: "team_lead",
    professionalStatus: "certified_realtor",
    verifications: [identity("agent-02", 300), certificate("agent-02", "confirmed", 30)],
    territory: ["yunusabad", "mirzo_ulugbek"],
    languages: ["ru", "uz"],
  },
  {
    id: "agent-03",
    name: "Тимур Ахмедов",
    phone: "+998900000103",
    telegramUsername: "timur_akhmedov_demo",
    organizationId: "org-01",
    role: "agency_agent",
    professionalStatus: "certified_realtor",
    verifications: [identity("agent-03", 45), certificate("agent-03", "pending")],
    territory: ["chilanzar", "yakkasaray", "yashnabad"],
    languages: ["ru"],
  },
  {
    id: "agent-04",
    name: "Дильноза Рахимова",
    phone: "+998900000104",
    telegramUsername: "dilnoza_namuna_demo",
    organizationId: "org-02",
    role: "agency_owner",
    professionalStatus: "certified_realtor",
    verifications: [identity("agent-04", 200), certificate("agent-04", "confirmed", 35)],
    territory: ["uchtepa", "chilanzar", "mirzo_ulugbek", "mirabad"],
    languages: ["uz", "ru"],
  },
  {
    id: "agent-05",
    name: "Jasur Tursunov",
    phone: "+998900000105",
    telegramUsername: "jasur_namuna_demo",
    organizationId: "org-02",
    role: "agency_agent",
    professionalStatus: "certified_realtor",
    verifications: [
      identity("agent-05", 90),
      certificate("agent-05", "unavailable", 2, "Реестр не ответил — статус сертификата неизвестен"),
    ],
    territory: ["yunusabad", "yashnabad", "olmazor", "mirzo_ulugbek"],
    languages: ["uz", "ru"],
  },
  {
    id: "agent-06",
    name: "Shaxlo Mirzayeva",
    phone: "+998900000106",
    telegramUsername: "shaxlo_makon_demo",
    organizationId: "org-03",
    role: "agency_agent",
    professionalStatus: "certified_realtor",
    verifications: [identity("agent-06", 150), certificate("agent-06", "confirmed", 50)],
    territory: ["chilanzar", "sergeli"],
    languages: ["uz", "ru"],
  },
  {
    id: "agent-07",
    name: "Бобур Алиев",
    phone: "+998900000107",
    organizationId: "org-03",
    role: "agency_agent",
    professionalStatus: "certified_realtor",
    verifications: [certificate("agent-07", "pending")],
    territory: ["mirzo_ulugbek", "yunusabad", "chilanzar"],
    languages: ["ru", "uz"],
  },
  {
    id: "agent-08",
    name: "Малика Назарова",
    phone: "+998900000108",
    telegramUsername: "malika_nazarova_demo",
    role: "individual_realtor",
    professionalStatus: "certified_realtor",
    verifications: [identity("agent-08", 80), certificate("agent-08", "confirmed", 12)],
    territory: ["bektemir", "mirabad", "yashnabad"],
    languages: ["ru", "uz"],
  },
  {
    id: "agent-09",
    name: "Рустам Исмоилов",
    phone: "+998900000109",
    telegramUsername: "rustam_agent_demo",
    role: "individual_realtor",
    // A distinct legal status with narrower rights than a certified realtor (§38.2).
    professionalStatus: "real_estate_agent",
    verifications: [
      identity("agent-09", 20),
      {
        id: "ver-agent-09-registry",
        subject: "org_registry",
        status: "confirmed",
        method: "official_source",
        source: "Единый реестр агентов по недвижимости (демо-выписка)",
        checkedAt: day(-20, "14:00"),
      },
      {
        id: "ver-agent-09-insurance",
        subject: "insurance",
        status: "pending",
        method: "document_review",
        source: "Полис загружен, ожидает проверки",
      },
    ],
    territory: ["olmazor", "yangihayot", "sergeli"],
    languages: ["uz", "ru"],
  },
];

function ownerConsent(ownerId: string, grantedDaysAgo: number): Consent {
  return {
    id: `cons-${ownerId}-listing`,
    purpose: "share_with_partners",
    channel: "written",
    grantedAt: day(-grantedDaysAgo, "12:00"),
    textVersion: "owner-consent-v1-demo",
  };
}

/** Owner contacts are RESTRICTED (§34.2): only the listing side sees them. */
function owner(id: string, name: string, phone: string, consentDaysAgo?: number): Owner {
  return {
    id,
    name,
    phone,
    confidentiality: "restricted",
    consents: consentDaysAgo === undefined ? [] : [ownerConsent(id, consentDaysAgo)],
  };
}

export const owners: Owner[] = [
  owner("owner-01", "Бахтиёр Юлдашев", "+998910000201", 46),
  owner("owner-02", "Наргиза Хамидова", "+998910000202", 31),
  owner("owner-03", "Владимир Цой", "+998910000203", 52),
  owner("owner-04", "Lola Saidova", "+998910000204", 11),
  owner("owner-05", "ООО «Demo Savdo»", "+998910000205", 41),
  owner("owner-06", "Ильдар Гафуров", "+998910000206", 15),
  owner("owner-07", "Шерзод Каюмов", "+998910000207", 76),
  owner("owner-08", "Azamat Tojiboyev", "+998910000208", 41),
  owner("owner-09", "ООО «Demo Qurilish»", "+998910000209", 21),
  owner("owner-10", "Феруза Алимова", "+998910000210", 36),
  owner("owner-11", "Санжар Мухамедов", "+998910000211", 31),
  owner("owner-12", "Diyora Karimova", "+998910000212", 26),
  owner("owner-13", "Антон Ким", "+998910000213", 7),
  owner("owner-14", "ООО «Demo Ofis»", "+998910000214", 17),
  owner("owner-15", "Umid Rasulov", "+998910000215"),
  owner("owner-16", "Гульчехра Азимова", "+998910000216"),
  owner("owner-17", "Олег Шин", "+998910000217"),
  owner("owner-18", "Botir Yo‘ldoshev", "+998910000218"),
  owner("owner-19", "Мохира Турсунова", "+998910000219"),
  owner("owner-20", "Farhod Ergashev", "+998910000220"),
  owner("owner-21", "Эльвира Насырова", "+998910000221"),
  owner("owner-22", "Rustam Aminov", "+998910000222"),
  owner("owner-23", "Зульфия Каримова", "+998910000223", 6),
  owner("owner-24", "Jamshid Qosimov", "+998910000224"),
  owner("owner-25", "Людмила Пак", "+998910000225"),
  owner("owner-26", "ООО «Demo Market»", "+998910000226"),
  owner("owner-27", "Aziza Normatova", "+998910000227"),
  owner("owner-28", "Икром Садыков", "+998910000228"),
  owner("owner-29", "Sevara Xudoyberdiyeva", "+998910000229"),
  owner("owner-30", "Марат Галиев", "+998910000230"),
  owner("owner-31", "Nilufar Oripova", "+998910000231"),
  owner("owner-32", "Евгений Лим", "+998910000232", 16),
];
