import type { DistrictId } from "./types";

/**
 * Tashkent districts with RU / UZ (Latin) names and spelling variants that
 * appear in Telegram posts and client speech. Variants are lower-case and
 * matched on word stems by the requirement/post parsers.
 */
export const districts: Record<DistrictId, { ru: string; uz: string; variants: string[] }> = {
  bektemir: { ru: "Бектемир", uz: "Bektemir", variants: ["бектемир", "bektemir"] },
  chilanzar: {
    ru: "Чиланзар",
    uz: "Chilonzor",
    variants: ["чиланзар", "чилонзор", "chilanzar", "chilonzor", "chilanzor"],
  },
  mirabad: { ru: "Мирабад", uz: "Mirobod", variants: ["мирабад", "миробод", "mirabad", "mirobod"] },
  mirzo_ulugbek: {
    ru: "Мирзо-Улугбек",
    uz: "Mirzo Ulug‘bek",
    variants: [
      "мирзо-улугбек",
      "мирзо улугбек",
      "улугбек",
      "mirzo ulugbek",
      "mirzo-ulugbek",
      "mirzo ulug‘bek",
      "mirzo ulug'bek",
      "ulugbek",
    ],
  },
  olmazor: {
    ru: "Алмазар",
    uz: "Olmazor",
    variants: ["алмазар", "олмазор", "almazar", "olmazor"],
  },
  sergeli: { ru: "Сергели", uz: "Sergeli", variants: ["сергели", "sergeli"] },
  shaykhantahur: {
    ru: "Шайхантахур",
    uz: "Shayxontohur",
    variants: ["шайхантахур", "шайхонтохур", "shayxontohur", "shaykhantakhur", "shayhontohur"],
  },
  uchtepa: { ru: "Учтепа", uz: "Uchtepa", variants: ["учтепа", "uchtepa"] },
  yakkasaray: {
    ru: "Яккасарай",
    uz: "Yakkasaroy",
    variants: ["яккасарай", "яккасарой", "yakkasaray", "yakkasaroy"],
  },
  yangihayot: {
    ru: "Янгихаёт",
    uz: "Yangihayot",
    variants: ["янгихаёт", "янгихает", "yangihayot"],
  },
  yashnabad: {
    ru: "Яшнабад",
    uz: "Yashnobod",
    variants: ["яшнабад", "яшнобод", "yashnabad", "yashnobod"],
  },
  yunusabad: {
    ru: "Юнусабад",
    uz: "Yunusobod",
    variants: ["юнусабад", "юнусобод", "yunusabad", "yunusobod"],
  },
};

/**
 * Approximate neighbour relation used for partial location credit. This is a
 * matching heuristic, not a cadastral fact — keep it configurable and tune it
 * with real feedback (§12.6).
 */
export const districtNeighbours: Record<DistrictId, DistrictId[]> = {
  bektemir: ["yashnabad", "sergeli", "mirabad"],
  chilanzar: ["uchtepa", "yakkasaray", "sergeli", "olmazor", "yangihayot", "shaykhantahur"],
  mirabad: ["yakkasaray", "yashnabad", "mirzo_ulugbek", "shaykhantahur", "bektemir", "yunusabad"],
  mirzo_ulugbek: ["yunusabad", "yashnabad", "mirabad"],
  olmazor: ["shaykhantahur", "uchtepa", "chilanzar", "yunusabad"],
  sergeli: ["chilanzar", "yakkasaray", "bektemir", "yangihayot"],
  shaykhantahur: ["olmazor", "yunusabad", "mirabad", "yakkasaray", "chilanzar", "uchtepa"],
  uchtepa: ["chilanzar", "olmazor", "shaykhantahur"],
  yakkasaray: ["mirabad", "chilanzar", "sergeli", "shaykhantahur"],
  yangihayot: ["sergeli", "chilanzar"],
  yashnabad: ["mirzo_ulugbek", "mirabad", "bektemir"],
  yunusabad: ["mirzo_ulugbek", "shaykhantahur", "olmazor", "mirabad"],
};

export function districtName(id: DistrictId, locale: "ru" | "uz"): string {
  return districts[id][locale];
}

export function areNeighbours(a: DistrictId, b: DistrictId): boolean {
  return districtNeighbours[a].includes(b) || districtNeighbours[b].includes(a);
}
