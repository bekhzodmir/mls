import { notFound } from "next/navigation";
import { loadLead } from "@/lib/data/cached";

/**
 * Checks that the lead exists (and is visible to the viewer) before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id gets a
 * real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function LeadLayout({ children, params }: LayoutProps<"/[locale]/app/leads/[id]">) {
  const { id } = await params;
  if (!(await loadLead(id))) notFound();
  return children;
}
