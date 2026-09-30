import { notFound } from "next/navigation";
import { loadDeal } from "@/lib/data/cached";

/**
 * Checks that the deal exists (and is visible to the viewer) before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id gets a
 * real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function DealLayout({ children, params }: LayoutProps<"/[locale]/app/deals/[id]">) {
  const { id } = await params;
  if (!(await loadDeal(id))) notFound();
  return children;
}
