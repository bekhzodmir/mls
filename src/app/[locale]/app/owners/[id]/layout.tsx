import { notFound } from "next/navigation";
import { loadOwner } from "@/lib/data/cached";

/**
 * Checks that the owner exists (and is linked to the viewer's organization)
 * before the route's `loading.tsx` boundary starts streaming, so an unknown
 * id gets a real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function OwnerLayout({ children, params }: LayoutProps<"/[locale]/app/owners/[id]">) {
  const { id } = await params;
  if (!(await loadOwner(id))) notFound();
  return children;
}
