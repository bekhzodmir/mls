import { notFound } from "next/navigation";
import { loadRequirement } from "@/lib/data/cached";

/**
 * Checks that the requirement exists (and is visible to the viewer) before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id gets a
 * real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function RequirementLayout({ children, params }: LayoutProps<"/[locale]/app/requirements/[id]">) {
  const { id } = await params;
  if (!(await loadRequirement(id))) notFound();
  return children;
}
