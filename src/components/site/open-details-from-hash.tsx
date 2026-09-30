"use client";

import { useEffect } from "react";

/**
 * Opens the `<details>` element whose id matches the URL fragment, so links
 * such as /faq#visibility land on an expanded answer. Browsers only scroll to
 * a closed `<details>`; they do not open it.
 */
export function OpenDetailsFromHash() {
  useEffect(() => {
    const openTarget = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      if (target instanceof HTMLDetailsElement) target.open = true;
    };
    openTarget();
    window.addEventListener("hashchange", openTarget);
    return () => window.removeEventListener("hashchange", openTarget);
  }, []);

  return null;
}
