import { notFound } from "next/navigation";

/**
 * Unmatched paths under a locale render `[locale]/not-found.tsx` inside the
 * localized root layout instead of the framework's bare 404.
 */
export default function CatchAll() {
  notFound();
}
