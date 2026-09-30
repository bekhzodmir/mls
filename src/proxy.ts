import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, LOCALE_COOKIE, locales, type Locale } from "@/i18n/config";

/**
 * Locale routing. Every page lives under `/ru` or `/uz`; a request without a
 * locale prefix is redirected to the remembered choice (cookie), then to the
 * best match from `Accept-Language`, then to Russian.
 *
 * Kept dependency-free on purpose: Proxy may run at the edge and should not
 * rely on shared modules or globals beyond static config.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasPrefix = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasPrefix) return NextResponse.next();

  const locale = resolveLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

function resolveLocale(request: NextRequest): Locale {
  const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
  if (hasLocale(remembered)) return remembered;
  return negotiate(request.headers.get("accept-language"));
}

/** Minimal RFC 9110 `Accept-Language` negotiation over our two locales. */
export function negotiate(header: string | null): Locale {
  if (!header) return defaultLocale;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const quality = q ? Number.parseFloat(q.trim().slice(2)) : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    if (hasLocale(primary)) return primary;
  }
  return defaultLocale;
}

export const config = {
  matcher: [
    // Everything except Next internals, API routes, metadata files and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|sitemap.xml|robots.txt|manifest.webmanifest|.*\\.[\\w]+$).*)",
  ],
};
