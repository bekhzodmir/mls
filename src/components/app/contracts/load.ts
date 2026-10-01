import { cache } from "react";
import { loadContract } from "@/lib/data/cached";
import { getContractByNumber } from "@/lib/data/repository";
import type { ContractDetailView } from "@/lib/data/views";

/**
 * The contract behind a `/contracts/[id]` segment: the id ("ctr-dr-2026-041")
 * or the document number a listing carries ("DR-2026-041"), so other
 * screens can link by either. Request-scoped like the other detail loaders:
 * the layout, `generateMetadata` and the page ask the repository once.
 * Same visibility as `getContract` — a partner's contract is undefined.
 */
export const loadContractRef = cache(async (ref: string): Promise<ContractDetailView | undefined> => {
  return (await loadContract(ref)) ?? (await getContractByNumber(ref));
});
