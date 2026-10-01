import { defineMessages } from "../define-messages";

/**
 * Notification centre (§36.5). Category and kind names come from
 * `domain.ts` (notificationCategory / notificationKind); this namespace holds
 * the screen copy around them.
 */
export default defineMessages({
  ru: {
    meta: { title: "Уведомления" },
    title: "Уведомления",
    unreadCount: "Непрочитанных: {n}",
    allRead: "Все уведомления прочитаны",
    filter: { label: "Категории уведомлений", all: "Все" },
    unread: "Новое",
    open: "Открыть: {entity}",
    openList: "Открыть список",
    noLink: "Без связанной записи",
    empty: {
      title: "Уведомлений пока нет",
      text: "Здесь появятся сроки ответа клиентам, новые совпадения, запросы партнёров и события по сделкам.",
      categoryTitle: "В разделе «{category}» пока пусто",
      categoryText: "Новые события этой категории появятся здесь. Остальные уведомления — во вкладке «Все».",
      reset: "Показать все",
    },
    security: {
      title: "Уведомления безопасности не отключаются",
      text: "Вход с нового устройства и изменение прав доступа приходят всегда — это защищает ваши данные и данные клиентов.",
    },
    settings: "Настроить уведомления",
  },
  uz: {
    meta: { title: "Bildirishnomalar" },
    title: "Bildirishnomalar",
    unreadCount: "O‘qilmagan: {n}",
    allRead: "Barcha bildirishnomalar o‘qilgan",
    filter: { label: "Bildirishnoma toifalari", all: "Barchasi" },
    unread: "Yangi",
    open: "Ochish: {entity}",
    openList: "Ro‘yxatni ochish",
    noLink: "Bog‘langan yozuv yo‘q",
    empty: {
      title: "Hozircha bildirishnomalar yo‘q",
      text: "Bu yerda mijozlarga javob muddatlari, yangi mosliklar, hamkorlar so‘rovlari va bitimlar bo‘yicha voqealar paydo bo‘ladi.",
      categoryTitle: "«{category}» bo‘limi hozircha bo‘sh",
      categoryText: "Bu toifadagi yangi voqealar shu yerda paydo bo‘ladi. Qolgan bildirishnomalar «Barchasi» bo‘limida.",
      reset: "Barchasini ko‘rsatish",
    },
    security: {
      title: "Xavfsizlik bildirishnomalari o‘chirilmaydi",
      text: "Yangi qurilmadan kirish va kirish huquqlarining o‘zgarishi haqida xabar doim keladi — bu sizning va mijozlaringizning ma’lumotlarini himoya qiladi.",
    },
    settings: "Bildirishnomalarni sozlash",
  },
});
