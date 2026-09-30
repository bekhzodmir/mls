/**
 * Public facts about Binor that the product may state (§2, §42.3). Only
 * [ПУБЛИЧНО]-level statements belong here; internal S4 metrics (users, deals,
 * average commission, retention) must not be published until verified (§41 D4).
 */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://binor.uz";

export const publicContacts = {
  brand: "Binor",
  domain: "binor.uz",
  telegramBot: "binor2030_bot",
  telegramBotUrl: "https://t.me/binor2030_bot",
  phoneDisplay: "+998 90 174 54 55",
  phoneE164: "+998901745455",
  instagram: "astor_rieltor",
  instagramUrl: "https://www.instagram.com/astor_rieltor/",
  /** Phone support hours, Tashkent time. The bot itself is stated as 24/7. */
  supportHours: { from: "09:00", to: "20:00" },
} as const;

/** Commission split presets between realtors — not a Binor fee (§7.4, §41 D10). */
export const publicSplitPresets = ["50/50", "70/30", "80/20"] as const;
