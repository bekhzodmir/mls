import { notFound } from "next/navigation";
import { loadViewing } from "@/lib/data/cached";

/**
 * Checks that the viewing exists (and is visible to the viewer) before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id gets a
 * real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function ViewingLayout({ children, params }: LayoutProps<"/[locale]/app/viewings/[id]">) {
  const { id } = await params;
  if (!(await loadViewing(id))) notFound();
  return children;
}
