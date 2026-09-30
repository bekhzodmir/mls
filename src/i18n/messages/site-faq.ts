import { defineMessages } from "../define-messages";

/**
 * /faq (§42.2 recommendation 6). Every answer is grounded in the master
 * document: matching (§12), Telegram Radar and its limits (§7.2, §41 D1),
 * duplicates and freshness (§13.4–13.5, §34.6), staged disclosure (§16.3,
 * §18.2), commission splits between realtors (§7.4, §41 D2, D10), pricing that
 * is not publicly disclosed (§26.1, §41 D3) and data handling without invented
 * legal commitments (§41 D17).
 *
 * Placeholders are filled from `publicContacts`, `defaultFreshnessConfig` and
 * the shared domain labels, so numbers and labels have a single source.
 */
export default defineMessages({
  ru: {
    meta: {
      title: "Вопросы и ответы",
      description:
        "Как работают совпадения и Telegram Radar, что происходит с дублями и устаревшими объявлениями, как делится комиссия между риэлторами, какие языки поддерживаются и как Binor обращается с данными.",
    },
    intro: {
      eyebrow: "Вопросы и ответы",
      title: "Частые вопросы о Binor",
      lead: "Коротко о том, как работают совпадения, Telegram Radar, сотрудничество и данные.",
    },
    upTo: "до {n} {days}",
    days: { one: "дня", few: "дней", many: "дней" },
    items: {
      what: {
        q: "Что такое Binor?",
        a: [
          "Binor — профессиональная платформа для риэлторов и агентств недвижимости Ташкента. Через Telegram-бот и Mini App она автоматически сопоставляет объекты одних риэлторов с запросами клиентов других и сообщает о совпадениях в Telegram.",
          "Во вкладке ТГ (Telegram Radar) дополнительно собраны объявления из Telegram со ссылками на исходные публикации.",
        ],
      },
      who: {
        q: "Кто может пользоваться Binor?",
        a: [
          "Профессионалы рынка недвижимости: индивидуальные риэлторы, агенты и руководители агентств. Регион работы — Ташкент и Ташкентская область.",
          "Отдельного сервиса для покупателей и собственников сейчас нет: Binor создан для работы риэлторов.",
        ],
      },
      matching: {
        q: "Как Binor находит совпадения?",
        a: [
          "Каждый новый объект сравнивается с активными запросами клиентов, а каждый новый запрос — с активными объектами.",
          "Критичные несовпадения — другой тип сделки, город, тип недвижимости или бюджет вне допустимого диапазона — отсекаются сразу. По остальным параметрам (район, комнаты, площадь, цена, этаж и другие) Binor показывает причины: что совпало, что отличается и что нужно уточнить. Голую «оценку» без объяснения мы не показываем.",
        ],
      },
      radar: {
        q: "Что такое Telegram Radar и какие у него ограничения?",
        a: [
          "Telegram Radar (вкладка ТГ) — более 10 000 объявлений из большого пула публичных Telegram-источников, собранных в одном месте. У каждого объявления есть ссылка на исходный пост.",
          "Охват не исчерпывающий: Radar видит не все каналы и не все публикации. Данные в посте могут быть неполными или устаревшими, поэтому перед показом клиенту проверяйте детали по ссылке на оригинал и у автора объявления.",
        ],
      },
      duplicates: {
        q: "Что происходит с дублями и устаревшими объявлениями?",
        a: [
          "Одно и то же предложение часто публикуется в нескольких каналах и разными риэлторами. Binor сравнивает район, цену, характеристики, фото, текст и телефоны и помечает возможные дубли. Если уверенности нет, объявления не объединяются автоматически — решение остаётся за человеком.",
          "Возраст объявления тоже учитывается: {fresh} — «{freshLabel}», {normal} — «{normalLabel}», {aging} — «{agingLabel}», старше — «{needsLabel}». Пороги могут уточняться. Старое объявление не выдаётся за актуальное, но и не считается проданным только из-за возраста.",
        ],
      },
      visibility: {
        q: "Что видят другие риэлторы и когда открываются контакты?",
        a: [
          "До согласования сотрудничества партнёр видит только то, что нужно для совпадения: тип объекта, район, цену или бюджет, комнаты и причины совпадения. Контакты и персональные данные клиентов и собственников не раскрываются.",
          "После того как стороны согласовали условия, открываются контакты — необходимый минимум для совместной работы. Документы и чувствительные сведения не публикуются в общей базе.",
        ],
      },
      commission: {
        q: "Как делится комиссия между риэлторами?",
        a: [
          "Раздел комиссии — договорённость между риэлторами, которые ведут сделку вместе: 50/50, 70/30, 80/20 или свои условия.",
          "Какая сторона получает большую долю, от какой суммы считается процент и когда производится выплата, стороны фиксируют в запросе на сотрудничество до передачи контактов. Эти доли — не плата Binor.",
        ],
      },
      languages: {
        q: "На каких языках работает Binor?",
        a: [
          "На русском и узбекском (латиница). Сайт доступен на обоих языках — переключатель RU / UZ находится в шапке страницы.",
        ],
      },
      pricing: {
        q: "Сколько стоит Binor?",
        a: [
          "Тарифы Binor публично не раскрыты. Актуальные условия подключения можно уточнить в поддержке: в Telegram-боте @{bot} или по телефону {phone} ({from}–{to} по Ташкенту).",
        ],
      },
      privacy: {
        q: "Как Binor обращается с данными?",
        a: [
          "Данные раскрываются поэтапно и в минимально нужном объёме: параметры для совпадения — сразу, контакты — после согласования условий, а документы и чувствительные сведения в общую базу не попадают.",
          "Подробное описание обработки данных пока не опубликовано на сайте. Вопросы о ваших данных можно задать в поддержке.",
        ],
      },
    },
    more: {
      title: "Не нашли ответ?",
      text: "Напишите в Telegram-бот (24/7) или позвоните: {from}–{to} по Ташкенту.",
    },
  },
  uz: {
    meta: {
      title: "Savol-javoblar",
      description:
        "Mosliklar va Telegram Radar qanday ishlaydi, dublikat va eskirgan e’lonlar bilan nima bo‘ladi, rieltorlar o‘rtasida komissiya qanday taqsimlanadi, qaysi tillar qo‘llab-quvvatlanadi va Binor ma’lumotlar bilan qanday ishlaydi.",
    },
    intro: {
      eyebrow: "Savol-javoblar",
      title: "Binor haqida ko‘p beriladigan savollar",
      lead: "Mosliklar, Telegram Radar, hamkorlik va ma’lumotlar qanday ishlashi haqida qisqacha.",
    },
    upTo: "{n} kungacha",
    days: { one: "kun", few: "kun", many: "kun" },
    items: {
      what: {
        q: "Binor nima?",
        a: [
          "Binor — Toshkentdagi rieltorlar va ko‘chmas mulk agentliklari uchun professional platforma. Telegram-bot va Mini App orqali u ba’zi rieltorlarning ob’yektlarini boshqa rieltorlar mijozlarining so‘rovlari bilan avtomatik solishtiradi va mosliklar haqida Telegramda xabar beradi.",
          "TG bo‘limida (Telegram Radar) qo‘shimcha ravishda Telegramdagi e’lonlar asl nashrlarga havolalar bilan jamlangan.",
        ],
      },
      who: {
        q: "Binordan kimlar foydalanishi mumkin?",
        a: [
          "Ko‘chmas mulk bozori mutaxassislari: individual rieltorlar, agentlik agentlari va rahbarlari. Ish hududi — Toshkent va Toshkent viloyati.",
          "Xaridorlar va mulk egalari uchun alohida xizmat hozircha yo‘q: Binor rieltorlar ishi uchun yaratilgan.",
        ],
      },
      matching: {
        q: "Binor mosliklarni qanday topadi?",
        a: [
          "Har bir yangi ob’yekt faol mijoz so‘rovlari bilan, har bir yangi so‘rov esa faol ob’yektlar bilan solishtiriladi.",
          "Jiddiy nomuvofiqliklar — boshqa bitim turi, shahar, ko‘chmas mulk turi yoki ruxsat etilgan chegaradan tashqaridagi byudjet — darhol chiqarib tashlanadi. Qolgan parametrlar (tuman, xonalar, maydon, narx, qavat va boshqalar) bo‘yicha Binor sabablarni ko‘rsatadi: nima mos keldi, nima farq qiladi va nimani aniqlashtirish kerak. Izohsiz «ball»ni ko‘rsatmaymiz.",
        ],
      },
      radar: {
        q: "Telegram Radar nima va uning cheklovlari qanday?",
        a: [
          "Telegram Radar (TG bo‘limi) — katta ochiq Telegram manbalari to‘plamidan bir joyga jamlangan 10 000 dan ortiq e’lon. Har bir e’londa asl postga havola bor.",
          "Qamrov to‘liq emas: Radar barcha kanallar va barcha nashrlarni ko‘rmaydi. Postdagi ma’lumotlar to‘liq bo‘lmasligi yoki eskirgan bo‘lishi mumkin, shuning uchun mijozga ko‘rsatishdan oldin tafsilotlarni asl postdagi havola orqali va e’lon muallifidan tekshiring.",
        ],
      },
      duplicates: {
        q: "Dublikat va eskirgan e’lonlar bilan nima bo‘ladi?",
        a: [
          "Bitta taklif ko‘pincha bir nechta kanalda va turli rieltorlar tomonidan joylanadi. Binor tuman, narx, xususiyatlar, rasmlar, matn va telefonlarni solishtiradi va ehtimoliy dublikatlarni belgilaydi. Ishonch bo‘lmasa, e’lonlar avtomatik birlashtirilmaydi — qarorni inson qabul qiladi.",
          "E’lonning yoshi ham hisobga olinadi: {fresh} — «{freshLabel}», {normal} — «{normalLabel}», {aging} — «{agingLabel}», undan eskisi — «{needsLabel}». Chegaralar aniqlashtirilishi mumkin. Eski e’lon dolzarb deb ko‘rsatilmaydi, lekin faqat yoshi tufayli sotilgan deb ham hisoblanmaydi.",
        ],
      },
      visibility: {
        q: "Boshqa rieltorlar nimani ko‘radi va kontaktlar qachon ochiladi?",
        a: [
          "Hamkorlik kelishilgunga qadar hamkor faqat moslik uchun kerakli narsalarni ko‘radi: ob’yekt turi, tuman, narx yoki byudjet, xonalar va moslik sabablari. Mijozlar va mulk egalarining kontaktlari hamda shaxsiy ma’lumotlari oshkor qilinmaydi.",
          "Tomonlar shartlarni kelishganidan keyin kontaktlar ochiladi — birgalikda ishlash uchun zarur minimum. Hujjatlar va maxfiy ma’lumotlar umumiy bazada e’lon qilinmaydi.",
        ],
      },
      commission: {
        q: "Rieltorlar o‘rtasida komissiya qanday taqsimlanadi?",
        a: [
          "Komissiyani taqsimlash — bitimni birga olib borayotgan rieltorlar o‘rtasidagi kelishuv: 50/50, 70/30, 80/20 yoki o‘z shartlari.",
          "Qaysi tomon kattaroq ulush olishi, foiz qaysi summadan hisoblanishi va to‘lov qachon amalga oshirilishini tomonlar kontaktlar berilishidan oldin hamkorlik so‘rovida qayd etadi. Bu ulushlar Binor to‘lovi emas.",
        ],
      },
      languages: {
        q: "Binor qaysi tillarda ishlaydi?",
        a: [
          "Rus va o‘zbek (lotin yozuvi) tillarida. Sayt ikkala tilda ham mavjud — RU / UZ almashtirgichi sahifaning yuqori qismida joylashgan.",
        ],
      },
      pricing: {
        q: "Binordan foydalanish narxi qancha?",
        a: [
          "Binor tariflari ommaga oshkor qilinmagan. Ulanishning amaldagi shartlarini yordam xizmatidan aniqlashtirish mumkin: @{bot} Telegram-botida yoki {phone} telefoni orqali (Toshkent vaqti bilan {from}–{to}).",
        ],
      },
      privacy: {
        q: "Binor ma’lumotlar bilan qanday ishlaydi?",
        a: [
          "Ma’lumotlar bosqichma-bosqich va minimal zarur hajmda ochiladi: moslik uchun parametrlar — darhol, kontaktlar — shartlar kelishilgandan keyin, hujjatlar va maxfiy ma’lumotlar esa umumiy bazaga tushmaydi.",
          "Ma’lumotlarga ishlov berishning batafsil tavsifi hozircha saytda e’lon qilinmagan. Ma’lumotlaringiz haqidagi savollarni yordam xizmatiga berishingiz mumkin.",
        ],
      },
    },
    more: {
      title: "Javob topmadingizmi?",
      text: "Telegram-botga yozing (24/7) yoki qo‘ng‘iroq qiling: Toshkent vaqti bilan {from}–{to}.",
    },
  },
});
