import { notFound } from "next/navigation";
import { loadMatch } from "@/lib/data/cached";

/**
 * Checks that the match exists (and is visible to the viewer) before the
 * route's `loading.tsx` boundary starts streaming, so an unknown id gets a
 * real 404 status rather than a "soft" 404 inside a 200 response.
 */
export default async function MatchLayout({ children, params }: LayoutProps<"/[locale]/app/matches/[id]">) {
  const { id } = await params;
  if (!(await loadMatch(id))) notFound();
  return children;
}
