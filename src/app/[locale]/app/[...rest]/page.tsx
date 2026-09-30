import { notFound } from "next/navigation";

/**
 * Unknown paths under /{locale}/app render the workspace `not-found.tsx`
 * inside the workspace chrome, instead of falling through to the public
 * site's 404 at `[locale]/[...rest]`.
 */
export default function WorkspaceCatchAll() {
  notFound();
}
