import { ImageResponse } from "next/og";
import { defaultLocale, hasLocale, locales } from "@/i18n/config";
import site from "@/i18n/messages/site";
import siteHome from "@/i18n/messages/site-home";
import { publicContacts } from "@/lib/site";

/**
 * Localized share image with the short formula (§2.2). Rendered with the
 * font bundled in next/og, which covers Cyrillic and the Uzbek ‘ ’ marks, so
 * no network font fetch happens at build time. Pages reference it explicitly
 * with a localized alt text (see `sitePageMetadata`); this alt is the fallback.
 */
export const alt = publicContacts.brand;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Route handlers do not inherit the root layout's params: prerender one image per locale.
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Light-theme values of the design tokens (globals.css): bg, fg, fg-muted, violet-600, fuchsia-500, violet-100.
const colors = {
  bg: "#faf9fd",
  fg: "#1f1a2e",
  muted: "#5d5870",
  brand: "#7c3aed",
  accent: "#d946ef",
  glow: "#ede9fe",
};

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  const locale = hasLocale(value) ? value : defaultLocale;
  const hero = siteHome[locale].hero;
  const t = site[locale];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: colors.bg,
          backgroundImage: `radial-gradient(circle at 92% 0%, ${colors.glow} 0%, ${colors.bg} 55%)`,
          color: colors.fg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundImage: `linear-gradient(135deg, ${colors.brand}, ${colors.accent})`,
              color: "#ffffff",
              fontSize: 42,
            }}
          >
            B
          </div>
          <div style={{ fontSize: 44, letterSpacing: -1 }}>{publicContacts.brand}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 68, lineHeight: 1.12, letterSpacing: -2 }}>
          <div>{hero.line1}</div>
          <div>{hero.line2}</div>
          <div style={{ color: colors.brand }}>{hero.line3}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: colors.muted }}>
          <div>{`${t.tagline} · ${t.structuredData.city}`}</div>
          <div>{publicContacts.domain}</div>
        </div>
      </div>
    ),
    size,
  );
}
