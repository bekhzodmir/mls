import { defineMessages } from "../define-messages";

/**
 * /contacts (§42.3). Contact values come from `publicContacts`; no address,
 * legal entity or e-mail is published because none is disclosed (§41 D13).
 */
export default defineMessages({
  ru: {
    meta: {
      title: "Контакты: Telegram-бот, телефон, Instagram",
      description:
        "Telegram-бот @{bot} работает 24/7, телефонная поддержка — с {from} до {to} по Ташкенту. Регион работы — Ташкент и Ташкентская область.",
    },
    intro: {
      eyebrow: "Контакты",
      title: "Свяжитесь с Binor",
      lead: "Binor работает через Telegram. Напишите в бот или позвоните — ответим на вопросы о платформе и сотрудничестве.",
    },
    channelsLabel: "Способы связи",
    telegram: {
      title: "Telegram-бот",
      text: "Регистрация, работа с объектами и запросами клиентов, уведомления о совпадениях.",
      hours: "Работает 24/7",
      action: "Открыть в Telegram",
    },
    phone: {
      title: "Телефон поддержки",
      text: "Вопросы о платформе и подключении.",
      hours: "{from}–{to} по времени Ташкента",
      action: "Позвонить",
    },
    instagram: {
      title: "Instagram",
      text: "Аккаунт из публичных контактов Binor.",
      action: "Открыть Instagram",
    },
    details: {
      title: "Регион, языки и часы",
      region: "Регион",
      regionValue: "Ташкент; Ташкентская область",
      languages: "Языки",
      languagesValue: "Русский, O‘zbekcha (латиница)",
      bot: "Telegram-бот",
      botValue: "Круглосуточно, 24/7",
      phone: "Телефон",
      phoneValue: "{from}–{to}, время Ташкента (UTC+5)",
    },
    radarNote: {
      title: "Вопрос по объявлению из Telegram Radar?",
      text: "Binor показывает объявления со ссылкой на исходный пост. Детали объекта уточняйте у автора публикации по этой ссылке.",
    },
  },
  uz: {
    meta: {
      title: "Kontaktlar: Telegram-bot, telefon, Instagram",
      description:
        "@{bot} Telegram-boti 24/7 ishlaydi, telefon orqali yordam — Toshkent vaqti bilan {from} dan {to} gacha. Ish hududi — Toshkent va Toshkent viloyati.",
    },
    intro: {
      eyebrow: "Kontaktlar",
      title: "Binor bilan bog‘laning",
      lead: "Binor Telegram orqali ishlaydi. Botga yozing yoki qo‘ng‘iroq qiling — platforma va hamkorlik haqidagi savollarga javob beramiz.",
    },
    channelsLabel: "Bog‘lanish usullari",
    telegram: {
      title: "Telegram-bot",
      text: "Ro‘yxatdan o‘tish, ob’yektlar va mijoz so‘rovlari bilan ishlash, mosliklar haqida bildirishnomalar.",
      hours: "24/7 ishlaydi",
      action: "Telegramda ochish",
    },
    phone: {
      title: "Yordam telefoni",
      text: "Platforma va ulanish bo‘yicha savollar.",
      hours: "Toshkent vaqti bilan {from}–{to}",
      action: "Qo‘ng‘iroq qilish",
    },
    instagram: {
      title: "Instagram",
      text: "Binorning ochiq kontaktlaridagi akkaunt.",
      action: "Instagramni ochish",
    },
    details: {
      title: "Hudud, tillar va ish vaqti",
      region: "Hudud",
      regionValue: "Toshkent; Toshkent viloyati",
      languages: "Tillar",
      languagesValue: "Русский, O‘zbekcha (lotin yozuvi)",
      bot: "Telegram-bot",
      botValue: "Kecha-kunduz, 24/7",
      phone: "Telefon",
      phoneValue: "{from}–{to}, Toshkent vaqti (UTC+5)",
    },
    radarNote: {
      title: "Telegram Radardagi e’lon bo‘yicha savolingiz bormi?",
      text: "Binor e’lonlarni asl postga havola bilan ko‘rsatadi. Ob’yekt tafsilotlarini shu havola orqali e’lon muallifidan aniqlashtiring.",
    },
  },
});
