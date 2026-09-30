import { notFound } from "next/navigation";
import { loadCooperation } from "@/lib/data/cached";

/**
 * Checks that the cooperation request exists (and is visible to the viewer) before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id gets a
 * real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function CooperationLayout({ children, params }: LayoutProps<"/[locale]/app/mls/cooperation/[id]">) {
  const { id } = await params;
  if (!(await loadCooperation(id))) notFound();
  return children;
}
