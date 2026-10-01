"use client";

import { useEffect } from "react";
import { htmlLang, locales } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import errors from "@/i18n/messages/errors";
import { publicContacts } from "@/lib/site";

/**
 * Last-resort boundary for a failure in the root layout itself (§23.3). It
 * replaces the whole document, so the locale is not known and globals.css is
 * not loaded: the copy is shown in both languages, with a few inline styles
 * that follow the OS colour scheme.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Kept for the developer console and error reporting; never rendered.
    console.error(error);
  }, [error]);

  return (
    <html lang={htmlLang.ru} style={{ colorScheme: "light dark" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          lineHeight: 1.5,
        }}
      >
        <title>{publicContacts.brand}</title>
        <main role="alert" style={{ maxWidth: "28rem", display: "flex", flexDirection: "column", gap: "24px" }}>
          {locales.map((locale) => {
            const t = errors[locale].boundary;
            return (
              <section key={locale} lang={htmlLang[locale]}>
                <h1 style={{ fontSize: "1.25rem", margin: "0 0 8px" }}>{t.title}</h1>
                <p style={{ margin: "0 0 12px" }}>{t.text}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => retry()}
                    style={{ minHeight: "44px", padding: "0 16px", borderRadius: "12px", font: "inherit", cursor: "pointer" }}
                  >
                    {t.retry}
                  </button>
                  <a
                    href={`/${locale}`}
                    style={{ minHeight: "44px", padding: "0 16px", display: "inline-flex", alignItems: "center", color: "inherit" }}
                  >
                    {t.home}
                  </a>
                </div>
                <p style={{ margin: "12px 0 0", fontSize: "0.875rem" }}>
                  {format(t.support, { bot: publicContacts.telegramBot })}
                </p>
              </section>
            );
          })}
        </main>
      </body>
    </html>
  );
}
