"use client";

import { useState } from "react";
import { Bell, BellRing, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoNote } from "../radar/card-actions";

/**
 * "Сохранить поиск" and "Уведомлять о новых объектах" (§15.2). Demo only:
 * the toggles live in this tab and the note says nothing reached a server.
 */
export function SavedSearch({
  labels,
}: {
  labels: { save: string; saved: string; notify: string; notifyOn: string; demo: string };
}) {
  const [saved, setSaved] = useState(false);
  const [notify, setNotify] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant={saved ? "soft" : "secondary"} aria-pressed={saved} onClick={() => setSaved(!saved)}>
          {saved ? <BookmarkCheck aria-hidden className="size-4" /> : <Bookmark aria-hidden className="size-4" />}
          {saved ? labels.saved : labels.save}
        </Button>
        <Button variant={notify ? "soft" : "secondary"} aria-pressed={notify} onClick={() => setNotify(!notify)}>
          {notify ? <BellRing aria-hidden className="size-4" /> : <Bell aria-hidden className="size-4" />}
          {notify ? labels.notifyOn : labels.notify}
        </Button>
      </div>
      {saved || notify ? <DemoNote text={labels.demo} /> : null}
    </div>
  );
}
