import { defineMessages } from "../define-messages";

/**
 * Human-readable errors of `POST /api/telegram/auth` (§23.3), keyed by the
 * machine code the route returns next to them, so the Mini App never has to
 * show a bare status code.
 */
export default defineMessages({
  ru: {
    telegram_auth_not_configured:
      "Вход через Telegram пока не настроен на сервере. Попробуйте позже или обратитесь к администратору Binor.",
    bad_request: "Не удалось прочитать запрос на вход. Откройте Mini App заново из Telegram.",
    payload_too_large: "Запрос на вход слишком большой. Откройте Mini App заново из Telegram.",
    unsupported_media_type: "Запрос на вход должен быть в формате JSON.",
    missing_hash: "Не удалось подтвердить, что вход выполнен из Telegram. Откройте Mini App заново из бота.",
    bad_hash: "Не удалось подтвердить, что вход выполнен из Telegram. Откройте Mini App заново из бота.",
    expired: "Данные запуска устарели. Закройте Mini App и откройте его снова в Telegram.",
    malformed: "Данные запуска Telegram повреждены. Откройте Mini App заново из бота.",
    telegram_user_missing:
      "Telegram не передал данные пользователя. Откройте Mini App через кнопку меню бота.",
  },
  uz: {
    telegram_auth_not_configured:
      "Telegram orqali kirish serverda hali sozlanmagan. Keyinroq urinib ko‘ring yoki Binor administratoriga murojaat qiling.",
    bad_request: "Kirish so‘rovini o‘qib bo‘lmadi. Mini Appni Telegramdan qayta oching.",
    payload_too_large: "Kirish so‘rovi juda katta. Mini Appni Telegramdan qayta oching.",
    unsupported_media_type: "Kirish so‘rovi JSON formatida bo‘lishi kerak.",
    missing_hash: "Kirish Telegramdan amalga oshirilganini tasdiqlab bo‘lmadi. Mini Appni botdan qayta oching.",
    bad_hash: "Kirish Telegramdan amalga oshirilganini tasdiqlab bo‘lmadi. Mini Appni botdan qayta oching.",
    expired: "Ishga tushirish ma’lumotlari eskirgan. Mini Appni yoping va Telegramda qayta oching.",
    malformed: "Telegram ishga tushirish ma’lumotlari buzilgan. Mini Appni botdan qayta oching.",
    telegram_user_missing:
      "Telegram foydalanuvchi ma’lumotlarini yubormadi. Mini Appni bot menyusidagi tugma orqali oching.",
  },
});
