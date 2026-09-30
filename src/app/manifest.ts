import type { MetadataRoute } from "next";
import { publicContacts } from "@/lib/site";

/**
 * Minimal web app manifest: name and theme colours matching the root layout's
 * light theme. Language-neutral on purpose — one manifest serves both locales.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: publicContacts.brand,
    short_name: publicContacts.brand,
    start_url: "/",
    display: "browser",
    background_color: "#faf9fd",
    theme_color: "#faf9fd",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
