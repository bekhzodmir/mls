import { locale as localeParam } from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "./config";

/**
 * Resolves the `[locale]` root segment for the current request in any Server
 * Component or server utility, without prop drilling. Unknown locales 404.
 */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  if (!hasLocale(value)) notFound();
  return value;
}
