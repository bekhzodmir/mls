import { notFound } from "next/navigation";
import { loadOffer } from "@/lib/data/cached";

/**
 * Checks that the offer exists (and is visible to the viewer) before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id gets a
 * real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function OfferLayout({ children, params }: LayoutProps<"/[locale]/app/offers/[id]">) {
  const { id } = await params;
  if (!(await loadOffer(id))) notFound();
  return children;
}
