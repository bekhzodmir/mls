import type { Locale } from "@/i18n/config";
import { format } from "@/i18n/define-messages";
import { formatList } from "@/i18n/format";
import calls from "@/i18n/messages/calls";
import type { CallView, SubjectRef } from "@/lib/data/views";
import { formatUzPhone, maskUzPhone } from "@/lib/domain/phone";

/**
 * Who a call is with, as text. A lead without a name stays nameless
 * («Имя не указано») — never invented; a call attached to nothing is shown
 * by its number.
 */

export function subjectName(locale: Locale, ref: Pick<SubjectRef, "name">): string {
  return ref.name ?? calls[locale].party.noName;
}

/** «Лид · Нодир», «Собственник · Ахмад Каримов». */
export function subjectRefText(locale: Locale, ref: SubjectRef): string {
  const t = calls[locale];
  return format(t.party.ref, { kind: t.subjectKind[ref.kind], name: subjectName(locale, ref) });
}

/** The linked person's name, or the number when the call is attached to nothing. */
export function partyTitle(locale: Locale, view: Pick<CallView, "call" | "linked">): string {
  return view.linked ? subjectName(locale, view.linked) : formatUzPhone(view.call.phone);
}

/**
 * «Клиент · +998 93 000 03 01», «Неизвестный номер», «Номер не привязан».
 * `phoneHidden`: the viewer may not see this owner's contact (§34.2) — the
 * number is masked even on the viewer's own call record.
 */
export function partyCaption(
  locale: Locale,
  view: Pick<CallView, "call" | "linked" | "unknownNumber">,
  phoneHidden = false,
): string {
  const t = calls[locale];
  const phone = phoneHidden ? maskUzPhone(view.call.phone) : formatUzPhone(view.call.phone);
  if (view.linked) return `${t.subjectKind[view.linked.kind]} · ${phone}`;
  return view.unknownNumber ? t.party.unknownNumber : t.party.unlinked;
}

/** «Похоже на: Лид · Мадина Эргашева и Клиент · Madina Ergasheva». */
export function looksLikeText(locale: Locale, matches: readonly SubjectRef[]): string {
  return format(calls[locale].card.looksLike, {
    list: formatList(
      locale,
      matches.map((ref) => subjectRefText(locale, ref)),
    ),
  });
}
