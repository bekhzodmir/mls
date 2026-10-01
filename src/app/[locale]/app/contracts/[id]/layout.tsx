import { notFound } from "next/navigation";
import { loadContractRef } from "@/components/app/contracts/load";

/**
 * Checks that the contract exists (and belongs to the viewer's organization)
 * before the route's `loading.tsx` boundary starts streaming, so an unknown
 * id or number gets a real 404 status rather than a "soft" 404 inside a 200.
 */
export default async function ContractLayout({ children, params }: LayoutProps<"/[locale]/app/contracts/[id]">) {
  const { id } = await params;
  if (!(await loadContractRef(id))) notFound();
  return children;
}
