import { notFound } from "next/navigation";
import { loadTelegramListing } from "@/lib/data/cached";

/**
 * Checks that the Telegram post exists (and is visible to the viewer) before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id gets a
 * real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function RadarPostLayout({ children, params }: LayoutProps<"/[locale]/app/radar/[id]">) {
  const { id } = await params;
  if (!(await loadTelegramListing(id))) notFound();
  return children;
}
