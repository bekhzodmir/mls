import { notFound } from "next/navigation";
import { loadCall } from "@/lib/data/cached";

/**
 * Checks that the call exists (and is the viewer's own) before the route's
 * `loading.tsx` boundary starts streaming, so an unknown id gets a real 404
 * status rather than a "soft" 404 inside a 200 response.
 */
export default async function CallLayout({ children, params }: LayoutProps<"/[locale]/app/calls/[id]">) {
  const { id } = await params;
  if (!(await loadCall(id))) notFound();
  return children;
}
