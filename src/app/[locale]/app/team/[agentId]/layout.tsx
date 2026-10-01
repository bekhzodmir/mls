import { notFound } from "next/navigation";
import { loadTeamMember } from "@/lib/data/cached";

/**
 * Checks that the colleague exists in the viewer's organization before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id — or a
 * partner's — gets a real 404 status rather than a "soft" 404 inside a 200.
 */
export default async function TeamMemberLayout({ children, params }: LayoutProps<"/[locale]/app/team/[agentId]">) {
  const { agentId } = await params;
  if (!(await loadTeamMember(agentId))) notFound();
  return children;
}
