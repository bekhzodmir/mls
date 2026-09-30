"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  CalendarPlus,
  Building,
  ListPlus,
  MessageSquarePlus,
  Plus,
  SearchCheck,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/i18n/config";
import shell from "@/i18n/messages/shell";
import { appHref, type AppRoute } from "./nav-config";

const items: { key: "lead" | "client" | "requirement" | "property" | "viewing" | "task"; route: AppRoute; icon: LucideIcon }[] = [
  { key: "lead", route: "leadsNew", icon: MessageSquarePlus },
  { key: "client", route: "clientsNew", icon: UserPlus },
  { key: "requirement", route: "requirementsNew", icon: SearchCheck },
  { key: "property", route: "propertiesNew", icon: Building },
  { key: "viewing", route: "viewingsNew", icon: CalendarPlus },
  { key: "task", route: "tasksNew", icon: ListPlus },
];

/**
 * Global "+" (§9.1). A native <dialog> gives focus trapping, Esc to close and
 * an inert background for free; on phones it renders as a bottom sheet.
 */
export function QuickCreate({ locale }: { locale: Locale }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const t = shell[locale].quickCreate;

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-float transition-colors hover:bg-primary-hover lg:static lg:size-auto lg:h-11 lg:w-full lg:gap-2 lg:rounded-md lg:px-4 lg:text-small lg:font-semibold lg:shadow-card"
      >
        <Plus aria-hidden className="size-6 lg:size-5" />
        <span className="sr-only lg:not-sr-only">{t.open}</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="quick-create-title"
        onClick={(event) => {
          // Clicking the backdrop (the dialog element itself) closes the sheet.
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="m-0 mt-auto w-full max-w-none rounded-t-xl bg-surface p-0 text-fg shadow-float backdrop:bg-black/40 sm:m-auto sm:max-w-md sm:rounded-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="quick-create-title" className="text-h2">
            {t.title}
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="inline-flex size-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted"
          >
            <X aria-hidden className="size-5" />
            <span className="sr-only">{t.close}</span>
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {items.map(({ key, route, icon: Icon }) => (
            <li key={key}>
              <Link
                href={appHref(locale, route)}
                onClick={() => dialog.current?.close()}
                className="flex min-h-24 flex-col gap-1 rounded-lg border border-border p-3 transition-colors hover:border-primary hover:bg-primary-soft/40"
              >
                <Icon aria-hidden className="size-6 text-primary" />
                <span className="text-small font-semibold">{t[key]}</span>
                <span className="text-caption text-fg-muted">{t[`${key}Hint`]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
