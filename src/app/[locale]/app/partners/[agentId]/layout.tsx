import { notFound } from "next/navigation";
import { loadPartner } from "@/lib/data/cached";

/**
 * Checks that the partner exists (an agent outside the viewer's organization)
 * before the route's `loading.tsx` boundary starts streaming, so an unknown
 * id — or a colleague's — gets a real 404 rather than a "soft" 404 in a 200.
 */
export default async function PartnerLayout({ children, params }: LayoutProps<"/[locale]/app/partners/[agentId]">) {
  const { agentId } = await params;
  if (!(await loadPartner(agentId))) notFound();
  return children;
}
