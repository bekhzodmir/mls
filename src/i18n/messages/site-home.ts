import { defineMessages } from "../define-messages";

/**
 * Home page copy (§2, §7, §9.5, §42). Claims are limited to the public ones:
 * the Radar volume is the canonical «более 10 000 объявлений из большого пула
 * Telegram-источников» (§7.2) with no channel count (§41 D1); commission
 * splits are between realtors, with no side assigned the larger share (§41 D2)
 * and never presented as a Binor fee (§41 D10).
 */
export default defineMessages({
  ru: {
    meta: {
      title: "Binor — платформа для риэлторов Ташкента",
      description:
        "Объект одного риэлтора. Клиент другого. Binor находит совпадение: объясняет, почему объект подходит запросу, собирает объявления из Telegram и помогает договориться о сотрудничестве.",
    },
    hero: {
      eyebrow: "Для риэлторов и агентств · Ташкент",
      line1: "Объект одного риэлтора.",
      line2: "Клиент другого.",
      line3: "Binor находит совпадение.",
      lead: "Binor автоматически сопоставляет объекты одних риэлторов с запросами клиентов других и присылает совпадения в Telegram — с объяснением, что совпало, а что стоит уточнить.",
      factsLabel: "Коротко о Binor",
      facts: {
        channel: "Telegram-бот и Mini App",
        languages: "Русский и O‘zbekcha",
        region: "Ташкент и область",
        deals: "Продажа и аренда",
      },
    },
    example: {
      label: "Пример совпадения",
      objectRole: "Объект · риэлтор A",
      objectTitle: "Квартира, 2 комнаты",
      objectFloor: "{floor}-й этаж из {floors}",
      requestRole: "Запрос клиента · риэлтор B",
      requestTitle: "Ищет квартиру, 2 комнаты",
      requestFloor: "не последний этаж",
      budget: "до {amount}",
      match: "Совпадение",
      parking: "парковка",
      connector: "сопоставляются",
      notify: "Уведомление в Telegram обеим сторонам",
    },
    matching: {
      eyebrow: "Автоматический подбор",
      title: "Совпадение с объяснением, а не просто цифра",
      lead: "Новый объект сравнивается с активными запросами клиентов, новый запрос — с активными объектами. Когда параметры сходятся, обе стороны получают уведомление в Telegram.",
      steps: {
        object: {
          title: "Объект",
          text: "Риэлтор добавляет объект: тип, район, цену, комнаты, площадь.",
        },
        request: {
          title: "Запрос клиента",
          text: "Другой риэлтор добавляет, что ищет его клиент: район, бюджет, комнаты.",
        },
        match: {
          title: "Совпадение",
          text: "Binor сопоставляет их и показывает причины: что совпало, что отличается и что стоит уточнить.",
        },
      },
      explainTitle: "Причины вместо «оценки 87,43»",
      explainText: "Вместо непонятного процента — формулировки, с которыми можно работать:",
      hardFilters:
        "Критичные несовпадения — другой тип сделки, город, тип недвижимости или бюджет вне допустимого диапазона — отсекаются сразу, чтобы не засорять ленту.",
    },
    radar: {
      badge: "Новое",
      eyebrow: "Вкладка ТГ",
      title: "Telegram Radar",
      lead: "Более 10 000 объявлений из большого пула Telegram-источников в одном месте. У каждого объявления есть ссылка на исходную публикацию.",
      points: {
        source: "Ссылка на оригинальный пост: видно, где и когда опубликовано объявление.",
        search: "Поиск подходящих объявлений вместо ручного просмотра десятков чатов.",
      },
      limitsTitle: "Что важно знать",
      limits:
        "Radar показывает то, что опубликовано в публичных Telegram-каналах: охват не исчерпывающий, а данные в посте могут быть неполными или устаревшими. Перед показом клиенту уточняйте детали по ссылке на оригинал.",
      postChannel: "Публичный Telegram-канал",
      postText: "Текст объявления в том виде, в каком он опубликован",
      postLink: "Исходный пост в Telegram",
    },
    cobroking: {
      eyebrow: "Сотрудничество",
      title: "Сначала условия, потом контакты",
      lead: "Когда объект одного риэлтора подходит клиенту другого, они договариваются о разделе комиссии: 50/50, 70/30, 80/20 или на своих условиях. Условия согласуются до того, как стороны получают контакты друг друга.",
      splitsLabel: "Варианты раздела комиссии между риэлторами",
      sidesNote:
        "Какой стороне какая доля и от какой суммы считается процент, риэлторы указывают в запросе на сотрудничество. Binor не выбирает это за вас.",
      stepsLabel: "Как договариваются стороны",
      steps: {
        propose: { title: "Предложите условия", text: "Роль вашей стороны, доля и база расчёта." },
        respond: { title: "Партнёр отвечает", text: "Принимает, отклоняет или предлагает изменения." },
        reveal: {
          title: "Контакты открываются",
          text: "После согласия — только необходимый минимум для совместной работы.",
        },
      },
      notFee: "Это раздел комиссии между риэлторами, а не плата Binor.",
    },
    trust: {
      eyebrow: "Доверие и приватность",
      title: "Что видят партнёры — и когда",
      lead: "Binor раскрывает данные поэтапно и только в нужном объёме. До согласования условий ваши контакты и данные клиентов остаются при вас.",
      visible: "Видно партнёру",
      hidden: "Скрыто",
      stages: {
        match: {
          title: "Совпадение найдено",
          visible: "Параметры объекта или запроса: тип, район, цена или бюджет, комнаты — и причины совпадения.",
          hidden: "Контакты риэлтора, данные клиента и собственника.",
        },
        agreed: {
          title: "Условия согласованы",
          visible: "Контакты партнёра — необходимый минимум для совместной работы.",
          hidden: "Всё, что не нужно для совместной сделки.",
        },
        deal: {
          title: "Совместная сделка",
          visible: "Детали сделки — только её участникам.",
          hidden: "Документы и чувствительные сведения не публикуются в общей базе.",
        },
      },
      control:
        "Решения принимает человек: Binor ускоряет подбор, но не заключает договорённости и не принимает юридически значимых решений за вас.",
      faqLink: "Подробнее о данных и контактах",
    },
    audience: {
      eyebrow: "Для кого",
      title: "Для профессионалов рынка недвижимости",
      individual: {
        title: "Индивидуальные риэлторы",
        text: "Быстрее закрывать запросы клиентов и находить партнёров без постоянного ручного мониторинга чатов.",
      },
      agency: {
        title: "Агентства недвижимости",
        text: "Расширять доступный инвентарь за счёт объектов коллег и находить покупателей и арендаторов для своих объектов.",
      },
      partner: {
        title: "Риэлторы-партнёры",
        text: "Находить объекты коллег под своих клиентов и договариваться о совместной сделке на понятных условиях.",
      },
      b2c: "Binor создан для риэлторов и агентств. Отдельного сервиса для покупателей и собственников сейчас нет.",
    },
    finalCta: {
      title: "Начните с Telegram",
      text: "Зарегистрируйтесь в боте @{bot}, добавьте объекты и запросы клиентов — совпадения придут в Telegram.",
      howLink: "Как это работает",
    },
  },
  uz: {
    meta: {
      title: "Binor — Toshkent rieltorlari uchun platforma",
      description:
        "Bir rieltorning ob’yekti. Boshqasining mijozi. Binor moslikni topadi: ob’yekt so‘rovga nega mos kelishini tushuntiradi, Telegramdagi e’lonlarni jamlaydi va hamkorlik bo‘yicha kelishishga yordam beradi.",
    },
    hero: {
      eyebrow: "Rieltorlar va agentliklar uchun · Toshkent",
      line1: "Bir rieltorning ob’yekti.",
      line2: "Boshqasining mijozi.",
      line3: "Binor moslikni topadi.",
      lead: "Binor ba’zi rieltorlarning ob’yektlarini boshqa rieltorlar mijozlarining so‘rovlari bilan avtomatik solishtiradi va mosliklarni Telegramga yuboradi — nima mos kelgani va nimani aniqlashtirish kerakligini tushuntirib.",
      factsLabel: "Binor haqida qisqacha",
      facts: {
        channel: "Telegram-bot va Mini App",
        languages: "Русский va O‘zbekcha",
        region: "Toshkent va viloyat",
        deals: "Sotuv va ijara",
      },
    },
    example: {
      label: "Moslik namunasi",
      objectRole: "Ob’yekt · A rieltor",
      objectTitle: "Kvartira, 2 xonali",
      objectFloor: "{floors} qavatli uyning {floor}-qavati",
      requestRole: "Mijoz so‘rovi · B rieltor",
      requestTitle: "2 xonali kvartira qidirmoqda",
      requestFloor: "oxirgi qavat emas",
      budget: "{amount} gacha",
      match: "Moslik",
      parking: "avtoturargoh",
      connector: "solishtiriladi",
      notify: "Ikkala tomonga Telegramda bildirishnoma",
    },
    matching: {
      eyebrow: "Avtomatik qidiruv",
      title: "Shunchaki raqam emas — izohli moslik",
      lead: "Yangi ob’yekt faol mijoz so‘rovlari bilan, yangi so‘rov esa faol ob’yektlar bilan solishtiriladi. Parametrlar mos kelganda ikkala tomon ham Telegramda bildirishnoma oladi.",
      steps: {
        object: {
          title: "Ob’yekt",
          text: "Rieltor ob’yektni qo‘shadi: turi, tumani, narxi, xonalari, maydoni.",
        },
        request: {
          title: "Mijoz so‘rovi",
          text: "Boshqa rieltor mijozi nimani qidirayotganini qo‘shadi: tuman, byudjet, xonalar soni.",
        },
        match: {
          title: "Moslik",
          text: "Binor ularni solishtiradi va sabablarini ko‘rsatadi: nima mos keldi, nima farq qiladi va nimani aniqlashtirish kerak.",
        },
      },
      explainTitle: "«87,43 ball» o‘rniga sabablar",
      explainText: "Tushunarsiz foiz o‘rniga — ish uchun qulay izohlar:",
      hardFilters:
        "Jiddiy nomuvofiqliklar — boshqa bitim turi, shahar, ko‘chmas mulk turi yoki ruxsat etilgan chegaradan tashqaridagi byudjet — lentani to‘ldirmasligi uchun darhol chiqarib tashlanadi.",
    },
    radar: {
      badge: "YANGI",
      eyebrow: "TG bo‘limi",
      title: "Telegram Radar",
      lead: "Katta Telegram manbalari to‘plamidan 10 000 dan ortiq e’lon bir joyda. Har bir e’londa asl nashrga havola bor.",
      points: {
        source: "Asl postga havola: e’lon qayerda va qachon joylangani ko‘rinadi.",
        search: "O‘nlab chatlarni qo‘lda ko‘rib chiqish o‘rniga mos e’lonlarni qidirish.",
      },
      limitsTitle: "Nimani bilish muhim",
      limits:
        "Radar ochiq Telegram kanallarida e’lon qilingan narsalarni ko‘rsatadi: qamrov to‘liq emas, postdagi ma’lumotlar esa to‘liq bo‘lmasligi yoki eskirgan bo‘lishi mumkin. Mijozga ko‘rsatishdan oldin tafsilotlarni asl postdagi havola orqali aniqlashtiring.",
      postChannel: "Ochiq Telegram kanali",
      postText: "E’lon matni — qanday joylangan bo‘lsa, shundayligicha",
      postLink: "Telegramdagi asl post",
    },
    cobroking: {
      eyebrow: "Hamkorlik",
      title: "Avval shartlar, keyin kontaktlar",
      lead: "Bir rieltorning ob’yekti boshqa rieltorning mijoziga mos kelsa, ular komissiyani taqsimlash bo‘yicha kelishadi: 50/50, 70/30, 80/20 yoki o‘z shartlari asosida. Shartlar tomonlar bir-birining kontaktlarini olishidan oldin kelishiladi.",
      splitsLabel: "Rieltorlar o‘rtasida komissiyani taqsimlash variantlari",
      sidesNote:
        "Qaysi tomonga qancha ulush tegishi va foiz qaysi summadan hisoblanishini rieltorlar hamkorlik so‘rovida ko‘rsatadi. Binor buni siz uchun tanlamaydi.",
      stepsLabel: "Tomonlar qanday kelishadi",
      steps: {
        propose: { title: "Shartlarni taklif qiling", text: "Tomoningizning roli, ulush va hisoblash asosi." },
        respond: { title: "Hamkor javob beradi", text: "Qabul qiladi, rad etadi yoki o‘zgartirish taklif qiladi." },
        reveal: {
          title: "Kontaktlar ochiladi",
          text: "Kelishuvdan keyin — birgalikda ishlash uchun zarur minimum.",
        },
      },
      notFee: "Bu rieltorlar o‘rtasida komissiyani taqsimlash, Binor to‘lovi emas.",
    },
    trust: {
      eyebrow: "Ishonch va maxfiylik",
      title: "Hamkorlar nimani ko‘radi — va qachon",
      lead: "Binor ma’lumotlarni bosqichma-bosqich va faqat zarur hajmda ochadi. Shartlar kelishilgunga qadar kontaktlaringiz va mijozlaringiz ma’lumotlari o‘zingizda qoladi.",
      visible: "Hamkorga ko‘rinadi",
      hidden: "Yashirin",
      stages: {
        match: {
          title: "Moslik topildi",
          visible: "Ob’yekt yoki so‘rov parametrlari: turi, tumani, narxi yoki byudjeti, xonalari — va moslik sabablari.",
          hidden: "Rieltor kontaktlari, mijoz va mulk egasi ma’lumotlari.",
        },
        agreed: {
          title: "Shartlar kelishildi",
          visible: "Hamkorning kontaktlari — birgalikda ishlash uchun zarur minimum.",
          hidden: "Birgalikdagi bitim uchun kerak bo‘lmagan hamma narsa.",
        },
        deal: {
          title: "Birgalikdagi bitim",
          visible: "Bitim tafsilotlari — faqat uning ishtirokchilariga.",
          hidden: "Hujjatlar va maxfiy ma’lumotlar umumiy bazada e’lon qilinmaydi.",
        },
      },
      control:
        "Qarorlarni inson qabul qiladi: Binor tanlashni tezlashtiradi, lekin siz uchun kelishuvlar tuzmaydi va yuridik ahamiyatga ega qarorlar qabul qilmaydi.",
      faqLink: "Ma’lumotlar va kontaktlar haqida batafsil",
    },
    audience: {
      eyebrow: "Kimlar uchun",
      title: "Ko‘chmas mulk bozori mutaxassislari uchun",
      individual: {
        title: "Individual rieltorlar",
        text: "Mijoz so‘rovlarini tezroq yopish va chatlarni doimiy qo‘lda kuzatmasdan hamkor topish.",
      },
      agency: {
        title: "Ko‘chmas mulk agentliklari",
        text: "Hamkasblar ob’yektlari hisobiga mavjud takliflarni kengaytirish va o‘z ob’yektlariga xaridor va ijarachi topish.",
      },
      partner: {
        title: "Rieltor-hamkorlar",
        text: "Mijozlaringiz uchun hamkasblar ob’yektlarini topish va aniq shartlar asosida birgalikdagi bitim bo‘yicha kelishish.",
      },
      b2c: "Binor rieltorlar va agentliklar uchun yaratilgan. Xaridorlar va mulk egalari uchun alohida xizmat hozircha yo‘q.",
    },
    finalCta: {
      title: "Telegramdan boshlang",
      text: "@{bot} botida ro‘yxatdan o‘ting, ob’yektlar va mijoz so‘rovlarini qo‘shing — mosliklar Telegramga keladi.",
      howLink: "Qanday ishlaydi",
    },
  },
});
