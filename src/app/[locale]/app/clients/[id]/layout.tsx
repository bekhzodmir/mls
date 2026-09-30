import { notFound } from "next/navigation";
import { loadClient } from "@/lib/data/cached";

/**
 * Checks that the client exists (and is visible to the viewer) before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id gets a
 * real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function ClientLayout({ children, params }: LayoutProps<"/[locale]/app/clients/[id]">) {
  const { id } = await params;
  if (!(await loadClient(id))) notFound();
  return children;
}
