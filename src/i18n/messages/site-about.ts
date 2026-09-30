import { defineMessages } from "../define-messages";

/**
 * /about: mission and vision (§3.1, §3.3), the market problem (§4.1–4.2),
 * practical goals (§3.2), values (§3.4), audiences (§5) and channels (§6).
 * Goals are phrased as goals, not as delivered results or metrics.
 */
export default defineMessages({
  ru: {
    meta: {
      title: "О платформе: миссия, проблема и ценности",
      description:
        "Binor объединяет риэлторов Ташкента в общей платформе для взаимовыгодного сотрудничества. Миссия, проблема рынка, ценности и для кого создан продукт.",
    },
    intro: {
      eyebrow: "О Binor",
      title: "Делаем рынок недвижимости Ташкента прозрачнее и эффективнее",
      lead: "Binor — профессиональная платформа для риэлторов и агентств недвижимости. Она автоматически сопоставляет объекты одних риэлторов с запросами клиентов других и доставляет совпадения через Telegram.",
    },
    mission: {
      title: "Миссия",
      text: "Сделать рынок недвижимости Ташкента прозрачнее и эффективнее, объединив риэлторов в общей платформе для взаимовыгодного сотрудничества.",
      visionTitle: "Видение",
      vision:
        "Каждый новый объект и каждый новый запрос клиента должны увеличивать вероятность сделки для всей профессиональной сети — при этом чувствительные данные остаются под контролем их владельцев.",
    },
    problem: {
      title: "Проблема, которую мы решаем",
      lead: "У одного риэлтора есть подходящий объект, у другого — клиент с подходящими требованиями. Они не знают друг о друге, поэтому сделка не происходит или находится слишком поздно. Это проблема раздробленности спроса и предложения.",
      listTitle: "Почему так происходит",
      items: [
        "Объекты распределены между множеством риэлторов.",
        "Запросы клиентов распределены между разными агентами.",
        "Значимая часть рынка живёт в потоковых Telegram-каналах.",
        "Ручной поиск по каналам плохо масштабируется.",
        "Нет автоматической связки «спрос ↔ предложение».",
        "Объекты бывают дублями, устаревшими или с разными версиями данных.",
        "После совпадения сторонам нужны понятные правила сотрудничества.",
        "Риэлтору нужно держать в голове звонки, показы, документы и следующие шаги.",
      ],
    },
    goals: {
      title: "К чему стремится Binor",
      items: [
        "Сокращать время поиска объекта под клиента.",
        "Сокращать время поиска покупателя или арендатора для объекта.",
        "Устранять информационные разрывы между риэлторами.",
        "Сокращать ручной просмотр Telegram-каналов.",
        "Увеличивать число сделок между риэлторами.",
        "Структурировать разрозненные предложение и спрос.",
        "Делать ключевые действия выполнимыми с телефона, одной рукой.",
      ],
    },
    values: {
      title: "Ценности",
      caption: "Ценности Binor и то, как они проявляются в продукте",
      valueColumn: "Ценность",
      productColumn: "Как проявляется в продукте",
      rows: {
        efficiency: {
          name: "Эффективность",
          text: "Автоматизация рутины и сокращение времени до результата.",
        },
        partnership: {
          name: "Партнёрство",
          text: "Инструменты совместных сделок, прозрачные условия и фиксация договорённостей.",
        },
        community: {
          name: "Сообщество",
          text: "Сеть профессионалов, общая структурированная база и доверие.",
        },
        explainability: {
          name: "Объяснимость",
          text: "Пользователь понимает, почему найдено совпадение и откуда взялись данные.",
        },
        humanControl: {
          name: "Контроль человека",
          text: "AI ускоряет работу, но не принимает юридически значимые решения сам.",
        },
      },
    },
    audience: {
      title: "Для кого Binor",
      individual: {
        title: "Индивидуальный риэлтор",
        text: "Работает самостоятельно. Когда появляется клиент с конкретными требованиями, важно быстро получить подходящие объекты других риэлторов — и не просматривать вручную десятки чатов.",
      },
      agency: {
        title: "Агентство недвижимости",
        text: "Агенты, руководители и администраторы. Агентству важно расширять доступный инвентарь, вести общую базу и масштабировать сделки.",
      },
      partner: {
        title: "Риэлтор-партнёр",
        text: "Внешний агент или агентство, которое находит объект коллеги под своего клиента и договаривается о совместной сделке на понятных условиях.",
      },
      b2c: "На текущем этапе Binor ориентирован на профессионалов. Прямого сервиса для собственников и конечных покупателей нет.",
    },
    channels: {
      title: "Как устроен Binor",
      bot: { title: "Telegram-бот", text: "@{bot} — вход, регистрация и уведомления. Работает 24/7." },
      miniApp: {
        title: "Telegram Mini App",
        text: "Рабочая среда риэлтора: объекты, запросы клиентов, совпадения и вкладка ТГ.",
      },
      site: { title: "Сайт {domain}", text: "Рассказывает о платформе и ведёт в Telegram." },
    },
  },
  uz: {
    meta: {
      title: "Platforma haqida: missiya, muammo va qadriyatlar",
      description:
        "Binor Toshkent rieltorlarini o‘zaro manfaatli hamkorlik uchun umumiy platformada birlashtiradi. Missiya, bozor muammosi, qadriyatlar va mahsulot kimlar uchun yaratilgani.",
    },
    intro: {
      eyebrow: "Binor haqida",
      title: "Toshkent ko‘chmas mulk bozorini shaffofroq va samaraliroq qilamiz",
      lead: "Binor — rieltorlar va ko‘chmas mulk agentliklari uchun professional platforma. U ba’zi rieltorlarning ob’yektlarini boshqa rieltorlar mijozlarining so‘rovlari bilan avtomatik solishtiradi va mosliklarni Telegram orqali yetkazadi.",
    },
    mission: {
      title: "Missiya",
      text: "Rieltorlarni o‘zaro manfaatli hamkorlik uchun umumiy platformada birlashtirib, Toshkent ko‘chmas mulk bozorini shaffofroq va samaraliroq qilish.",
      visionTitle: "Istiqbol",
      vision:
        "Har bir yangi ob’yekt va har bir yangi mijoz so‘rovi butun professional tarmoq uchun bitim ehtimolini oshirishi kerak — bunda maxfiy ma’lumotlar o‘z egalarining nazoratida qoladi.",
    },
    problem: {
      title: "Biz hal qiladigan muammo",
      lead: "Bir rieltorda mos ob’yekt, boshqasida esa mos talablarga ega mijoz bor. Ular bir-biri haqida bilmaydi, shuning uchun bitim amalga oshmaydi yoki juda kech topiladi. Bu talab va taklifning tarqoqligi muammosi.",
      listTitle: "Nega shunday bo‘ladi",
      items: [
        "Ob’yektlar ko‘plab rieltorlar o‘rtasida tarqoq.",
        "Mijoz so‘rovlari turli agentlar o‘rtasida tarqoq.",
        "Bozorning katta qismi oqimli Telegram kanallarida.",
        "Kanallar bo‘yicha qo‘lda qidirish yomon kengayadi.",
        "«Talab ↔ taklif» o‘rtasida avtomatik bog‘lanish yo‘q.",
        "Ob’yektlar dublikat, eskirgan yoki turli ma’lumot versiyalariga ega bo‘ladi.",
        "Moslik topilgach, tomonlarga hamkorlikning tushunarli qoidalari kerak.",
        "Rieltor qo‘ng‘iroqlar, ko‘riklar, hujjatlar va keyingi qadamlarni yodda tutishi kerak.",
      ],
    },
    goals: {
      title: "Binor nimaga intiladi",
      items: [
        "Mijoz uchun ob’yekt qidirish vaqtini qisqartirish.",
        "Ob’yekt uchun xaridor yoki ijarachi qidirish vaqtini qisqartirish.",
        "Rieltorlar o‘rtasidagi axborot uzilishlarini bartaraf etish.",
        "Telegram kanallarini qo‘lda ko‘rib chiqishni kamaytirish.",
        "Rieltorlar o‘rtasidagi bitimlar sonini oshirish.",
        "Tarqoq taklif va talabni tartibga solish.",
        "Asosiy amallarni telefonda, bir qo‘l bilan bajarish imkonini berish.",
      ],
    },
    values: {
      title: "Qadriyatlar",
      caption: "Binor qadriyatlari va ular mahsulotda qanday namoyon bo‘lishi",
      valueColumn: "Qadriyat",
      productColumn: "Mahsulotda qanday namoyon bo‘ladi",
      rows: {
        efficiency: {
          name: "Samaradorlik",
          text: "Muntazam ishlarni avtomatlashtirish va natijaga erishish vaqtini qisqartirish.",
        },
        partnership: {
          name: "Hamkorlik",
          text: "Birgalikdagi bitim vositalari, shaffof shartlar va kelishuvlarni qayd etish.",
        },
        community: {
          name: "Hamjamiyat",
          text: "Mutaxassislar tarmog‘i, umumiy tuzilgan baza va ishonch.",
        },
        explainability: {
          name: "Tushunarlilik",
          text: "Foydalanuvchi moslik nima uchun topilganini va ma’lumotlar qayerdan olinganini tushunadi.",
        },
        humanControl: {
          name: "Inson nazorati",
          text: "Sun’iy intellekt ishni tezlashtiradi, lekin yuridik ahamiyatga ega qarorlarni o‘zi qabul qilmaydi.",
        },
      },
    },
    audience: {
      title: "Binor kimlar uchun",
      individual: {
        title: "Individual rieltor",
        text: "Mustaqil ishlaydi. Aniq talablarga ega mijoz paydo bo‘lganda, boshqa rieltorlarning mos ob’yektlarini tezda olish muhim — o‘nlab chatlarni qo‘lda ko‘rib chiqmasdan.",
      },
      agency: {
        title: "Ko‘chmas mulk agentligi",
        text: "Agentlar, rahbarlar va administratorlar. Agentlik uchun mavjud takliflarni kengaytirish, umumiy bazani yuritish va bitimlar hajmini oshirish muhim.",
      },
      partner: {
        title: "Rieltor-hamkor",
        text: "Mijozi uchun hamkasbining ob’yektini topadigan va aniq shartlar asosida birgalikdagi bitim bo‘yicha kelishadigan tashqi agent yoki agentlik.",
      },
      b2c: "Hozirgi bosqichda Binor mutaxassislarga yo‘naltirilgan. Mulk egalari va yakuniy xaridorlar uchun to‘g‘ridan-to‘g‘ri xizmat yo‘q.",
    },
    channels: {
      title: "Binor qanday tuzilgan",
      bot: { title: "Telegram-bot", text: "@{bot} — kirish, ro‘yxatdan o‘tish va bildirishnomalar. 24/7 ishlaydi." },
      miniApp: {
        title: "Telegram Mini App",
        text: "Rieltorning ish muhiti: ob’yektlar, mijoz so‘rovlari, mosliklar va TG bo‘limi.",
      },
      site: { title: "{domain} sayti", text: "Platforma haqida gapirib beradi va Telegramga olib boradi." },
    },
  },
});
