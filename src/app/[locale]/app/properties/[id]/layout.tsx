import { notFound } from "next/navigation";
import { loadListing } from "@/lib/data/cached";

/**
 * Checks that the listing exists (and is visible to the viewer) before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id gets a
 * real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function PropertyLayout({ children, params }: LayoutProps<"/[locale]/app/properties/[id]">) {
  const { id } = await params;
  if (!(await loadListing(id))) notFound();
  return children;
}
