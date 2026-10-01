import { defineMessages } from "../define-messages";

/**
 * Public site chrome shared by every marketing page: header, footer, calls to
 * action, the localized 404 and structured data. Page copy lives in the
 * `site-*.ts` namespaces next to this one.
 *
 * Only [ПУБЛИЧНО] facts from §42.3 are stated here; contacts themselves come
 * from `src/lib/site.ts` so they are never retyped.
 */
export default defineMessages({
  ru: {
    skipToContent: "Перейти к содержимому",
    tagline: "Платформа для риэлторов",
    meta: {
      defaultDescription:
        "Binor — профессиональная платформа для риэлторов и агентств недвижимости Ташкента: автоматические совпадения объектов и запросов клиентов, Telegram Radar и сотрудничество между риэлторами.",
      ogAlt: "Binor: объект одного риэлтора, клиент другого — Binor находит совпадение",
    },
    nav: {
      label: "Разделы сайта",
      home: "Главная",
      howItWorks: "Как это работает",
      about: "О Binor",
      contacts: "Контакты",
      faq: "Вопросы и ответы",
    },
    header: {
      home: "Binor — на главную",
      menu: "Меню",
      language: "Язык",
      login: "Войти",
    },
    cta: {
      telegram: "Открыть в Telegram",
      telegramShort: "Telegram",
      demo: "Демо рабочего места",
      demoBadge: "Демо",
      demoNote: "Демо работает на вымышленных данных, действия в нём не сохраняются.",
      newTab: "откроется в новой вкладке",
    },
    footer: {
      pagesTitle: "Разделы",
      contactsTitle: "Контакты",
      languageTitle: "Язык сайта",
      languageLabel: "Выбор языка",
      smallPrint:
        "Binor — платформа для профессионалов рынка недвижимости: индивидуальных риэлторов и агентств. Доли 50/50, 70/30 и 80/20 — это раздел комиссии между риэлторами, а не плата Binor.",
      copyright: "© Binor",
      bot: "Telegram-бот, 24/7",
      phone: "Телефон, {from}–{to} по Ташкенту",
      instagram: "Instagram",
      region: "Ташкент и Ташкентская область",
    },
    notFound: {
      title: "Страница не найдена",
      code: "Ошибка 404",
      text: "Возможно, ссылка устарела или в адресе есть опечатка. Проверьте адрес или начните с главной страницы.",
      home: "На главную",
      demoHint: "Ищете рабочее место риэлтора? Откройте демо — оно работает на вымышленных данных.",
    },
    structuredData: {
      city: "Ташкент",
      region: "Ташкентская область",
    },
    illustration: "Схематичный пример, данные вымышлены",
  },
  uz: {
    skipToContent: "Asosiy mazmunga o‘tish",
    tagline: "Rieltorlar uchun platforma",
    meta: {
      defaultDescription:
        "Binor — Toshkentdagi rieltorlar va ko‘chmas mulk agentliklari uchun professional platforma: ob’yektlar va mijoz so‘rovlarining avtomatik mosliklari, Telegram Radar va rieltorlar o‘rtasidagi hamkorlik.",
      ogAlt: "Binor: bir rieltorning ob’yekti, boshqasining mijozi — Binor moslikni topadi",
    },
    nav: {
      label: "Sayt bo‘limlari",
      home: "Bosh sahifa",
      howItWorks: "Qanday ishlaydi",
      about: "Binor haqida",
      contacts: "Kontaktlar",
      faq: "Savol-javoblar",
    },
    header: {
      home: "Binor — bosh sahifaga",
      menu: "Menyu",
      language: "Til",
      login: "Kirish",
    },
    cta: {
      telegram: "Telegramda ochish",
      telegramShort: "Telegram",
      demo: "Ish joyi demosi",
      demoBadge: "Demo",
      demoNote: "Demo o‘ylab topilgan ma’lumotlarda ishlaydi, undagi harakatlar saqlanmaydi.",
      newTab: "yangi varaqda ochiladi",
    },
    footer: {
      pagesTitle: "Bo‘limlar",
      contactsTitle: "Kontaktlar",
      languageTitle: "Sayt tili",
      languageLabel: "Tilni tanlash",
      smallPrint:
        "Binor — ko‘chmas mulk bozori mutaxassislari: individual rieltorlar va agentliklar uchun platforma. 50/50, 70/30 va 80/20 ulushlari — rieltorlar o‘rtasida komissiyani taqsimlash, Binor to‘lovi emas.",
      copyright: "© Binor",
      bot: "Telegram-bot, 24/7",
      phone: "Telefon, Toshkent vaqti bilan {from}–{to}",
      instagram: "Instagram",
      region: "Toshkent va Toshkent viloyati",
    },
    notFound: {
      title: "Sahifa topilmadi",
      code: "Xato 404",
      text: "Havola eskirgan yoki manzilda xato bo‘lishi mumkin. Manzilni tekshiring yoki bosh sahifadan boshlang.",
      home: "Bosh sahifaga",
      demoHint: "Rieltor ish joyini qidiryapsizmi? Demoni oching — u o‘ylab topilgan ma’lumotlarda ishlaydi.",
    },
    structuredData: {
      city: "Toshkent",
      region: "Toshkent viloyati",
    },
    illustration: "Sxematik namuna, ma’lumotlar o‘ylab topilgan",
  },
});
