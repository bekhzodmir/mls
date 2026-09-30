import { serializeJsonLd } from "./structured-data";

/**
 * Structured data as a plain `<script>` in the page body, as recommended by the
 * Next.js JSON-LD guide (it is data, not executable code, so not next/script).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Escaped in serializeJsonLd: "<" becomes <.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
