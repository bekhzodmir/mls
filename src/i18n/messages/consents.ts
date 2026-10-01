import { defineMessages } from "../define-messages";

/**
 * Consent registry (§21.4 screen 40, §34.2 "Consent", §38.6 item 2): who
 * gave which consent, for what purpose, through which channel, with which
 * text version, and when it was revoked. Purpose and channel labels come
 * from `domain.ts`. Revoking is a demo action that names its consequences
 * and records nothing on the server.
 */
export default defineMessages({
  ru: {
    meta: { title: "Реестр согласий" },
    loading: "Загружаем реестр согласий…",
    list: {
      title: "Реестр согласий",
      subtitle: "Действуют: {active} · отозваны: {revoked}",
      note: "Текст и его версия, канал, даты выдачи и отзыва, ответственный агент. Отзыв не удаляет запись.",
      listLabel: "Согласия клиентов и собственников",
      count: { one: "{n} согласие", few: "{n} согласия", many: "{n} согласий" },
      contracts: "Договоры",
    },
    filters: {
      subject: "Чьё согласие",
      allSubjects: "Все",
      client: "Клиенты",
      owner: "Собственники",
      purpose: "Цель согласия",
      allPurposes: "Все цели",
      state: "Состояние согласия",
      allStates: "Любое состояние",
      active: "Действуют",
      revoked: "Отозваны",
    },
    row: {
      subject: { client: "Клиент", owner: "Собственник" },
      open: "Открыть карточку: {name}",
      channel: "Канал",
      granted: "Выдано",
      revokedAt: "Отозвано",
      notRevoked: "Не отзывалось",
      version: "Версия текста",
      responsible: "Ответственный",
      you: "вы",
      active: "Действует",
      revoked: "Отозвано {date}",
      revokedDemo: "Отозвано {date} · демо",
    },
    revoke: {
      button: "Отозвать",
      label: "Отозвать согласие «{purpose}»: {name}",
      title: "Отозвать согласие «{purpose}» — {name}?",
      consequences: "Что изменится после отзыва:",
      purpose: {
        contact: "Не связываться: звонить и писать по инициативе агентства больше нельзя. Открытые задачи на звонок нужно закрыть.",
        share_with_partners:
          "Партнёры больше не увидят переданные им данные, а новые запросы на сотрудничество пойдут без раскрытия контактов.",
        document_processing:
          "Новые документы обрабатывать нельзя. Что делать с уже загруженными, решают политика хранения и юрист.",
        marketing: "Рассылки и рекламные сообщения этому человеку прекращаются.",
      },
      owner: "Если согласие указано в договоре по объекту, договор потребует нового согласия: согласие каждого правообладателя обязательно (ст. 37).",
      kept: "Запись не удаляется: дата отзыва останется в реестре и журнале.",
      confirm: "Да, отозвать",
      cancel: "Не отзывать",
      done: "Согласие «{purpose}» отозвано {date}.",
      demo: "Демо: отзыв виден только на этой странице — на сервере ничего не записано.",
      undo: "Вернуть как было",
      permission: "Отозвать согласие может ответственный агент ({name}) или руководитель агентства.",
    },
    empty: {
      title: "Согласий пока нет",
      text: "Согласие записывают в карточке клиента или собственника: цель, канал, дату и версию текста.",
      action: "К клиентам",
      filteredTitle: "По выбранным фильтрам согласий нет",
      filteredText: "Измените, чьё согласие, цель или состояние.",
      reset: "Показать все согласия",
    },
  },
  uz: {
    meta: { title: "Roziliklar reyestri" },
    loading: "Roziliklar reyestri yuklanmoqda…",
    list: {
      title: "Roziliklar reyestri",
      subtitle: "Amalda: {active} · qaytarib olingan: {revoked}",
      note: "Matn va uning versiyasi, kanal, berilgan va qaytarib olingan sanalar, mas’ul agent. Qaytarib olish yozuvni o‘chirmaydi.",
      listLabel: "Mijozlar va mulkdorlarning roziliklari",
      count: { one: "{n} ta rozilik", few: "{n} ta rozilik", many: "{n} ta rozilik" },
      contracts: "Shartnomalar",
    },
    filters: {
      subject: "Kimning roziligi",
      allSubjects: "Barchasi",
      client: "Mijozlar",
      owner: "Mulkdorlar",
      purpose: "Rozilik maqsadi",
      allPurposes: "Barcha maqsadlar",
      state: "Rozilik holati",
      allStates: "Istalgan holat",
      active: "Amalda",
      revoked: "Qaytarib olingan",
    },
    row: {
      subject: { client: "Mijoz", owner: "Mulkdor" },
      open: "Kartani ochish: {name}",
      channel: "Kanal",
      granted: "Berilgan",
      revokedAt: "Qaytarib olingan",
      notRevoked: "Qaytarib olinmagan",
      version: "Matn versiyasi",
      responsible: "Mas’ul",
      you: "siz",
      active: "Amalda",
      revoked: "{date} da qaytarib olingan",
      revokedDemo: "{date} da qaytarib olingan · demo",
    },
    revoke: {
      button: "Qaytarib olish",
      label: "«{purpose}» roziligini qaytarib olish: {name}",
      title: "«{purpose}» roziligi qaytarib olinsinmi — {name}?",
      consequences: "Qaytarib olingandan keyin nima o‘zgaradi:",
      purpose: {
        contact:
          "Bog‘lanmang: agentlik tashabbusi bilan qo‘ng‘iroq qilish va yozish endi mumkin emas. Ochiq qo‘ng‘iroq vazifalarini yopish kerak.",
        share_with_partners:
          "Hamkorlar ularga uzatilgan ma’lumotlarni endi ko‘rmaydi, yangi hamkorlik so‘rovlari esa kontaktlarni ochmasdan yuboriladi.",
        document_processing:
          "Yangi hujjatlarni qayta ishlash mumkin emas. Allaqachon yuklanganlari bilan nima qilishni saqlash siyosati va yurist hal qiladi.",
        marketing: "Bu shaxsga yuboriladigan xabarnomalar va reklama xabarlari to‘xtatiladi.",
      },
      owner:
        "Agar rozilik ob’yekt bo‘yicha shartnomada ko‘rsatilgan bo‘lsa, shartnoma yangi rozilikni talab qiladi: har bir huquq egasining roziligi majburiy (37-modda).",
      kept: "Yozuv o‘chirilmaydi: qaytarib olingan sana reyestr va jurnalda qoladi.",
      confirm: "Ha, qaytarib olish",
      cancel: "Qaytarib olmaslik",
      done: "«{purpose}» roziligi {date} da qaytarib olindi.",
      demo: "Demo: qaytarib olish faqat shu sahifada ko‘rinadi — serverda hech narsa yozilmagan.",
      undo: "Avvalgi holatga qaytarish",
      permission: "Rozilikni mas’ul agent ({name}) yoki agentlik rahbari qaytarib olishi mumkin.",
    },
    empty: {
      title: "Hozircha roziliklar yo‘q",
      text: "Rozilik mijoz yoki mulkdor kartasida yoziladi: maqsad, kanal, sana va matn versiyasi.",
      action: "Mijozlarga",
      filteredTitle: "Tanlangan filtrlar bo‘yicha roziliklar yo‘q",
      filteredText: "Kimning roziligi, maqsad yoki holatni o‘zgartiring.",
      reset: "Barcha roziliklarni ko‘rsatish",
    },
  },
});
