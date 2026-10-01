import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import domain from "@/i18n/messages/domain";
import type { VerificationItem } from "@/lib/domain/types";
import { SourceBadge, VerificationBadge } from "./badges";

describe("SourceBadge", () => {
  it("names provenance without a verification claim (§16.4, §38.2)", () => {
    // A badge that names no single checked fact must not read as "verified".
    expect(domain.ru.source.verified_binor).not.toMatch(/провер|подтвержд/i);
    expect(domain.uz.source.verified_binor).not.toMatch(/tekshir|tasdiq/i);
    const html = renderToStaticMarkup(createElement(SourceBadge, { locale: "ru", source: "verified_binor" }));
    expect(html).toContain(domain.ru.source.verified_binor);
    expect(html).not.toContain("lucide-badge-check");
  });
});

describe("VerificationBadge", () => {
  const item: VerificationItem = {
    id: "v-1",
    subject: "contract",
    status: "confirmed",
    method: "document_review",
    source: "Договор оказания услуг № NE-2026-131",
  };

  it("puts the source in the title only when it may be shown", () => {
    expect(renderToStaticMarkup(createElement(VerificationBadge, { locale: "ru", item }))).toContain("NE-2026-131");
    const partner = renderToStaticMarkup(createElement(VerificationBadge, { locale: "ru", item, showSource: false }));
    expect(partner).not.toContain("NE-2026-131");
    expect(partner).toContain(domain.ru.verificationMethod.document_review);
  });
});
