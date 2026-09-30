import { defineMessages } from "../define-messages";

/**
 * Human-readable failure and loading copy for the workspace (§23.2, §23.3):
 * say what happened and what to do next, never a bare status code.
 */
export default defineMessages({
  ru: {
    boundary: {
      title: "Не удалось показать этот экран",
      text: "Произошёл временный сбой при загрузке данных. Попробуйте ещё раз — обычно это помогает. Если не поможет, вернитесь на главную и откройте экран снова.",
      retry: "Повторить",
      home: "На главную",
      support: "Ошибка повторяется? Напишите в поддержку в Telegram: @{bot}",
    },
    loading: "Загрузка…",
    notFound: {
      title: "Такой страницы нет",
      text: "Возможно, запись удалена, ссылка набрана с ошибкой или у вас нет доступа к ней. Вернитесь на главную или найдите нужное через поиск.",
      home: "На главную",
      search: "Открыть поиск",
    },
  },
  uz: {
    boundary: {
      title: "Bu ekranni ko‘rsatib bo‘lmadi",
      text: "Ma’lumotlarni yuklashda vaqtinchalik nosozlik yuz berdi. Qayta urinib ko‘ring — odatda bu yordam beradi. Yordam bermasa, bosh sahifaga qayting va ekranni qaytadan oching.",
      retry: "Qayta urinish",
      home: "Bosh sahifaga",
      support: "Xato takrorlanyaptimi? Telegram’da qo‘llab-quvvatlash xizmatiga yozing: @{bot}",
    },
    loading: "Yuklanmoqda…",
    notFound: {
      title: "Bunday sahifa yo‘q",
      text: "Yozuv o‘chirilgan, havola xato terilgan yoki unga kirish huquqingiz yo‘q bo‘lishi mumkin. Bosh sahifaga qayting yoki keraklisini qidiruv orqali toping.",
      home: "Bosh sahifaga",
      search: "Qidiruvni ochish",
    },
  },
});
