import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { htmlLang, locales } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { siteUrl } from "@/lib/site";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Binor",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9fd" },
    { media: "(prefers-color-scheme: dark)", color: "#16131f" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  return (
    <html lang={htmlLang[locale]} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
