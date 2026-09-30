"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Disclosure menu for phones and tablets built on `<details>`, so it opens
 * and is announced as expanded/collapsed even before hydration. After
 * hydration it also closes on Escape (returning focus to the toggle), on a
 * click outside and after following a link — the header lives in the layout
 * and would otherwise stay open across client-side navigations.
 */
export function MobileMenu({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;

    const onPointerDown = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) details.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !details.open) return;
      details.open = false;
      details.querySelector("summary")?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details
      ref={ref}
      className={cn("group", className)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) event.currentTarget.open = false;
      }}
    >
      <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-fg hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <Menu aria-hidden className="size-6 group-open:hidden" />
        <X aria-hidden className="hidden size-6 group-open:block" />
        <span className="sr-only">{label}</span>
      </summary>
      <div className="absolute inset-x-0 top-full max-h-[calc(100dvh_-_4rem)] overflow-y-auto border-b border-border bg-surface shadow-float">
        {children}
      </div>
    </details>
  );
}
