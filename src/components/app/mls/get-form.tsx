"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";

/**
 * A plain GET form — it works without JavaScript — that, once hydrated,
 * drops empty fields before navigating, so shared filter URLs stay short:
 * `?district=chilanzar` instead of `?district=chilanzar&status=&q=`.
 */
export function GetForm({
  action,
  children,
  className,
  "aria-label": ariaLabel,
  role,
}: {
  action: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  role?: "search";
}) {
  const router = useRouter();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string" && value.trim() !== "") query.append(key, value.trim());
    }
    const search = query.toString();
    router.push(search ? `${action}?${search}` : action);
  }

  return (
    <form method="get" action={action} onSubmit={onSubmit} className={className} aria-label={ariaLabel} role={role}>
      {children}
    </form>
  );
}
