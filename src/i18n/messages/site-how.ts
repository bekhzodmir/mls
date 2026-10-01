import { defineMessages } from "../define-messages";

/**
 * /how-it-works: the public five-step path (§8.1) and, for each step, what
 * other realtors can see (§16.3, §18.2, §42.2 recommendation 2).
 */
export default defineMessages({
  ru: {
    meta: {
      title: "Как это работает: пять шагов",
      description:
        "Регистрация в Telegram-боте, объекты и запросы клиентов, автоматические совпадения, уведомления и совместная сделка: пять шагов Binor и какие данные видны другим риэлторам на каждом из них.",
    },
    intro: {
      eyebrow: "Как это работает",
      title: "Пять шагов от регистрации до совместной сделки",
      lead: "На каждом шаге понятно, что делает Binor и какие данные видят другие риэлторы.",
    },
    stepsLabel: "Шаги работы с Binor",
    stepLabel: "Шаг {n}",
    visibleLabel: "Что видят другие",
    steps: {
      register: {
        title: "Регистрация через Telegram-бот",
        text: "Откройте @{bot} и зарегистрируйтесь. Бот — точка входа: через него открывается Mini App и приходят уведомления. Бот работает 24/7.",
        visible: "Пока вы ничего не добавили, другим риэлторам нечего показывать.",
      },
      add: {
        title: "Объекты и запросы клиентов",
        text: "Добавьте свои объекты — тип, район, цену, комнаты, площадь — и запросы клиентов: что ищет клиент и в каком бюджете. Чем точнее параметры, тем точнее совпадения.",
        visible:
          "Для подбора используются параметры объекта и запроса. Контакты и персональные данные клиентов и собственников другим риэлторам не показываются.",
      },
      match: {
        title: "Автоматический поиск совпадений",
        text: "Новый объект сравнивается с активными запросами, новый запрос — с активными объектами. Критичные несовпадения отсекаются сразу, а для остальных Binor объясняет, что совпало, что отличается и что нужно уточнить.",
        visible: "Параметры и причины совпадения — без контактов.",
      },
      notify: {
        title: "Уведомление в Telegram",
        text: "Когда совпадение найдено, вы получаете уведомление о потенциальном партнёре: чей объект подходит вашему клиенту или чей клиент ищет ваш объект.",
        visible: "Суть совпадения. Контакты сторон ещё закрыты.",
      },
      deal: {
        title: "Контакт, условия и совместная сделка",
        text: "Договоритесь с партнёром о разделе комиссии — 50/50, 70/30, 80/20 или на своих условиях — и ведите сделку вместе.",
        visible:
          "После согласования условий стороны видят контакты друг друга — необходимый минимум для совместной работы.",
      },
    },
    principles: {
      title: "Главное",
      reasons: {
        title: "Причины, а не проценты",
        text: "Совпадение объясняется словами: что подходит, что отличается, что уточнить.",
      },
      split: {
        title: "Доли — между риэлторами",
        text: "50/50, 70/30, 80/20 или свои условия — договорённость сторон, а не плата Binor.",
      },
      radar: {
        title: "Telegram Radar со ссылками",
        text: "Более 10 000 объявлений из большого пула Telegram-источников — у каждого ссылка на исходный пост.",
      },
    },
    cta: {
      title: "Готовы попробовать?",
      text: "Регистрация — в Telegram-боте. Вопросы о сотрудничестве и данных собраны в разделе «Вопросы и ответы».",
      faqLink: "Вопросы и ответы",
    },
  },
  uz: {
    meta: {
      title: "Qanday ishlaydi: besh qadam",
      description:
        "Telegram-botda ro‘yxatdan o‘tish, ob’yektlar va mijoz so‘rovlari, avtomatik mosliklar, bildirishnomalar va birgalikdagi bitim: Binorning besh qadami va har birida boshqa rieltorlarga qaysi ma’lumotlar ko‘rinishi.",
    },
    intro: {
      eyebrow: "Qanday ishlaydi",
      title: "Ro‘yxatdan o‘tishdan birgalikdagi bitimgacha besh qadam",
      lead: "Har bir qadamda Binor nima qilishi va boshqa rieltorlar qaysi ma’lumotlarni ko‘rishi tushunarli.",
    },
    stepsLabel: "Binor bilan ishlash qadamlari",
    stepLabel: "{n}-qadam",
    visibleLabel: "Boshqalar nimani ko‘radi",
    steps: {
      register: {
        title: "Telegram-bot orqali ro‘yxatdan o‘tish",
        text: "@{bot} ni oching va ro‘yxatdan o‘ting. Bot — kirish nuqtasi: u orqali Mini App ochiladi va bildirishnomalar keladi. Bot 24/7 ishlaydi.",
        visible: "Siz hali hech narsa qo‘shmagansiz — boshqa rieltorlarga ko‘rsatiladigan narsa yo‘q.",
      },
      add: {
        title: "Ob’yektlar va mijoz so‘rovlari",
        text: "O‘z ob’yektlaringizni — turi, tumani, narxi, xonalari, maydonini — va mijoz so‘rovlarini qo‘shing: mijoz nimani va qanday byudjetda qidirmoqda. Parametrlar qanchalik aniq bo‘lsa, mosliklar shunchalik aniq bo‘ladi.",
        visible:
          "Tanlash uchun ob’yekt va so‘rov parametrlaridan foydalaniladi. Mijozlar va mulk egalarining kontaktlari hamda shaxsiy ma’lumotlari boshqa rieltorlarga ko‘rsatilmaydi.",
      },
      match: {
        title: "Mosliklarni avtomatik qidirish",
        text: "Yangi ob’yekt faol so‘rovlar bilan, yangi so‘rov faol ob’yektlar bilan solishtiriladi. Jiddiy nomuvofiqliklar darhol chiqarib tashlanadi, qolganlari uchun Binor nima mos kelgani, nima farq qilishi va nimani aniqlashtirish kerakligini tushuntiradi.",
        visible: "Moslik parametrlari va sabablari — kontaktlarsiz.",
      },
      notify: {
        title: "Telegramda bildirishnoma",
        text: "Moslik topilganda siz potensial hamkor haqida bildirishnoma olasiz: kimning ob’yekti mijozingizga mos keladi yoki kimning mijozi ob’yektingizni qidirmoqda.",
        visible: "Moslik mazmuni. Tomonlarning kontaktlari hali yopiq.",
      },
      deal: {
        title: "Aloqa, shartlar va birgalikdagi bitim",
        text: "Hamkor bilan komissiyani taqsimlash bo‘yicha kelishing — 50/50, 70/30, 80/20 yoki o‘z shartlaringiz asosida — va bitimni birga olib boring.",
        visible:
          "Shartlar kelishilgach, tomonlar bir-birining kontaktlarini ko‘radi — birgalikda ishlash uchun zarur minimum.",
      },
    },
    principles: {
      title: "Asosiysi",
      reasons: {
        title: "Foizlar emas, sabablar",
        text: "Moslik so‘z bilan tushuntiriladi: nima mos, nima farq qiladi, nimani aniqlashtirish kerak.",
      },
      split: {
        title: "Ulushlar — rieltorlar o‘rtasida",
        text: "50/50, 70/30, 80/20 yoki o‘z shartlari — tomonlar kelishuvi, Binor to‘lovi emas.",
      },
      radar: {
        title: "Havolali Telegram Radar",
        text: "Katta Telegram manbalari to‘plamidan 10 000 dan ortiq e’lon — har birida asl postga havola.",
      },
    },
    cta: {
      title: "Sinab ko‘rishga tayyormisiz?",
      text: "Ro‘yxatdan o‘tish — Telegram-botda. Hamkorlik va ma’lumotlar haqidagi savollar «Savol-javoblar» bo‘limida jamlangan.",
      faqLink: "Savol-javoblar",
    },
  },
});
