import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { getLocale } from "@/i18n/server";

export const metadata: Metadata = {
  title: { template: "%s · Binor", default: "Binor" },
  // The workspace is a private professional tool, not public content.
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children }: LayoutProps<"/[locale]/app">) {
  const locale = await getLocale();
  // TODO(workspace-today): replace with the repository's unread notification count.
  const unreadCount = 0;

  return (
    <AppShell locale={locale} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
