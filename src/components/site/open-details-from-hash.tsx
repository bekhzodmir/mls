"use client";

import { useEffect } from "react";

/**
 * The element id a URL fragment names. A malformed escape ("#50%-скидка", a
 * truncated link from a chat) is used as typed instead of throwing.
 */
export function fragmentId(hash: string): string {
  const raw = hash.replace(/^#/, "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Opens the `<details>` element whose id matches the URL fragment, so links
 * such as /faq#visibility land on an expanded answer. Browsers only scroll to
 * a closed `<details>`; they do not open it.
 */
export function OpenDetailsFromHash() {
  useEffect(() => {
    const openTarget = () => {
      const id = fragmentId(window.location.hash);
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
