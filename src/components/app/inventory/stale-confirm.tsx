"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Подтвердить актуальность" (§34.6, §36.6 Stale). A demo action: it only
 * changes local state and says the confirmation was not saved — it never
 * pretends a server call happened.
 */
export function StaleConfirm({ label, confirmedText }: { label: string; confirmedText: string }) {
  const [confirmed, setConfirmed] = useState(false);
  if (confirmed) {
    return (
      <p role="status" className="flex items-start gap-2 text-small font-medium">
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        {confirmedText}
      </p>
    );
  }
  return (
    <Button variant="secondary" onClick={() => setConfirmed(true)}>
      <CircleCheck aria-hidden className="size-4" />
      {label}
    </Button>
  );
}
