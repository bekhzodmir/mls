# BINOR — Master Document платформы

**Версия:** 1.1  
**Дата консолидации и среза сведений:** 30 сентября 2026  
**Статус:** единый рабочий источник знаний о продукте  
**География первого этапа:** Ташкент и Ташкентская область, Узбекистан  
**Языки:** русский и O‘zbekcha (латиница)

---

## 0. Назначение документа

Этот документ объединяет все предоставленные материалы о Binor: публичные паспорта продукта, продуктовую спецификацию, UX/UI-архитектуру, техническую модель, анализ рынка и правовую модель MLS в Узбекистане.

Документ предназначен для использования как:

- основной Product / Business / System Reference;
- единая база для discovery, дизайна, разработки и операционного запуска;
- источник терминов, ролей, сущностей, процессов, требований и метрик;
- основа для последующего PRD, UX-spec, API-spec, архитектурной документации и roadmap.

### 0.1. Правила чтения

Чтобы не смешивать действующие возможности продукта с проектируемой системой и аналитическими гипотезами, используются маркеры:

- **[ПУБЛИЧНО]** — наблюдаемая формулировка или функциональность сайта/публичного бота. Это подтверждает публичное заявление, но не автоматически фактическое качество или масштаб работы функции.
- **[ИСТОЧНИК]** — факт или показатель, сообщённый в одном из внутренних документов; идентификатор источника и ограничения измерения приводятся рядом.
- **[ЦЕЛЬ]** — целевое состояние продукта, сформулированное в UX/Product Passport, а не заявление о текущей реализации.
- **[ГИПОТЕЗА]** — аналитическая оценка или допущение исходного документа, которую требуется проверить.
- **[РЕКОМЕНДАЦИЯ]** — продуктовая, UX или техническая рекомендация, которую следует принять отдельным решением перед реализацией.
- **[ПРАВО]** — положение нормативного акта. Для юридического запуска следует перепроверить применимую редакцию, подзаконные акты и официальную языковую версию.
- **[ОТКРЫТО]** — исходные документы не дают единого ответа; вопрос вынесен в реестр решений.

Если утверждение описывает текущую функцию или числовой факт, рядом указан источник из реестра §31.1. Непомеченные функциональные требования относятся к целевой модели, а не к подтверждённому production-состоянию. Слова «реальное время», «проверенный», «официальный», «точный» не трактуются как SLA или юридическая гарантия без отдельного нормативного/технического основания.

### 0.2. Принцип консолидации

Разные формулировки из исходников сведены в одну модель без удаления фактов. Повторяющиеся описания объединены; более детальные требования сохранены в соответствующих разделах и приложениях. Числа, которые относятся к разным датам, охватам или типам показателей, не усредняются. Несовместимые трактовки сохраняются в реестре разночтений (§41), а не разрешаются редакторским предположением. Там, где материалы описывают разный уровень зрелости, это оформлено как переход:

`Telegram-first matching tool → verified inventory → agency workspace → compliance room → private MLS → transaction infrastructure → market intelligence`.

---

# 1. Executive Summary

Binor — профессиональная PropTech-платформа для риэлторов и агентств недвижимости. Ее исходное ядро — Telegram Bot + Telegram Mini App, которые автоматически сопоставляют объекты недвижимости одних риэлторов с клиентскими запросами других и доставляют совпадения через Telegram.

Дополнительный слой — **TG / Telegram Radar**: агрегатор объявлений из сотен Telegram-каналов с заявленным объемом более 10 000 объявлений и ссылками на исходные публикации.

Целевая форма Binor — не просто каталог объявлений и не классическая тяжелая CRM, а **рабочая операционная система риэлтора**, объединяющая:

`Lead → Client → Requirement → Matching → Property → Listing → Viewing → Offer → Verification → Deal → Closing`.

Параллельный контур собственника и профессионального сотрудничества:

`Owner → Property → Contract → Consent → Verification → Listing → MLS → Cooperation → Buyer → Deal`.

Платформа должна уменьшать ручной поиск и помогать риэлтору совершать следующий правильный шаг: ответить клиенту, найти объект, обнаружить подходящего покупателя, договориться с партнером, провести просмотр, собрать документы и довести сделку до закрытия.

Ключевой эффект продукта:

`меньше ручного мониторинга → больше релевантных контактов → больше показов → больше закрытых сделок`.

---

# 2. Паспорт продукта

| Параметр | Значение |
|---|---|
| Название | Binor |
| Домен | `https://binor.uz/` |
| Категория | PropTech / Real Estate Tech / Realtor Collaboration Platform |
| Исходный интерфейс | Telegram Bot + Telegram Mini App |
| Telegram Bot | `@binor2030_bot` |
| Основной use case | Matching «объект ↔ заказ клиента» |
| Дополнительный use case | Поиск релевантных Telegram-объявлений |
| Пользователи | Индивидуальные риэлторы, агентства, руководители, администраторы, профессиональные партнеры |
| Типы сделок | Продажа и аренда |
| География | Ташкент и Ташкентская область; архитектура должна масштабироваться на Узбекистан |
| Языки | RU / UZ |
| Уведомления | Telegram; внутри платформы — центр уведомлений |
| Режим бота | 24/7 |
| Поддержка по телефону | 09:00–20:00 по Ташкенту |
| Публичный телефон | `+998 90 174 54 55` |
| Instagram | `@astor_rieltor` |
| Публичная модель комиссии между риэлторами | 50/50, 70/30, 80/20 |
| Монетизация Binor | Публично не раскрыта |
| Публичный сайт | Маркетинговый лендинг и информационные страницы; личного кабинета на сайте не заявлено |
| Статус | Действующий продукт; вкладка ТГ отмечена как новая функция |

## 2.1. Публичное позиционирование

> Telegram Mini App для автоматического поиска совпадений между объектами недвижимости и заказами клиентов.

## 2.2. Целевое позиционирование

> Binor — профессиональная сеть и рабочая операционная система риэлтора, которая автоматически соединяет объекты, клиентские запросы и предложения из Telegram, а затем помогает провести сотрудничество и сделку с проверяемой историей.

Короткая формула:

> Объект одного риэлтора. Клиент другого. Binor находит совпадение.

---

# 3. Миссия, видение и ценности

## 3.1. Миссия

Сделать рынок недвижимости Ташкента прозрачнее и эффективнее, объединив риэлторов в общей платформе для взаимовыгодного сотрудничества.

## 3.2. Практическая продуктовая миссия

Binor должен:

- сокращать время поиска объекта под клиента;
- сокращать время поиска покупателя или арендатора для объекта;
- устранять информационные разрывы между риэлторами;
- сокращать ручной просмотр Telegram-каналов;
- увеличивать число межриэлторских сделок;
- структурировать разрозненные предложение и спрос;
- сохранять контекст работы риэлтора между звонками, Telegram, объектами и встречами;
- делать ключевые действия выполнимыми с телефона и одной рукой.

## 3.3. Видение

Каждый новый объект и каждый новый заказ должны увеличивать вероятность сделки для всей профессиональной сети, при этом чувствительные данные остаются под контролем владельцев и соответствующих прав доступа.

## 3.4. Ценности

| Ценность | Проявление в продукте |
|---|---|
| Эффективность | Автоматизация рутины и сокращение времени до результата |
| Партнерство | Инструменты co-broking, прозрачные условия и фиксация договоренностей |
| Сообщество | Сеть профессионалов, общая структурированная база и доверие |
| Объяснимость | Пользователь понимает, почему найдено совпадение и откуда взялись данные |
| Контроль человека | AI ускоряет работу, но не принимает юридически значимые решения сам |

---

# 4. Проблема рынка и ценностное предложение

## 4.1. Главная проблема

У одного риэлтора может находиться подходящий объект, а у другого — клиент с соответствующими требованиями. Они не знают друг о друге, поэтому потенциальная сделка не происходит или находится слишком поздно.

Это проблема фрагментации спроса и предложения.

## 4.2. Подпроблемы

1. Объекты распределены между множеством риэлторов.
2. Клиентские запросы распределены между разными агентами.
3. Значимая часть рынка живет в потоковых Telegram-каналах.
4. Ручной поиск по каналам плохо масштабируется.
5. Нет автоматической связки «спрос ↔ предложение».
6. Объекты могут быть дублями, устаревшими или иметь разные версии данных.
7. После нахождения совпадения сторонам нужны понятные правила сотрудничества.
8. Агенту необходимо удерживать контекст звонков, показов, документов и следующих действий.

## 4.3. Ценность по сегментам

| Сегмент | Ценность |
|---|---|
| Индивидуальный риэлтор | Быстрее закрывать запросы и находить партнеров без постоянного ручного мониторинга |
| Агентство | Увеличивать доступный инвентарь, управлять общей базой и масштабировать сделки |
| Руководитель | Видеть pipeline, SLA, качество базы, нагрузку и результативность команды |
| Партнерский агент | Быстро находить listing, отправлять cooperation request и проводить совместную сделку |
| Профессиональная организация | Получать доверенную identity, стандартизированные данные и compliance-инфраструктуру |
| Застройщик, в будущем | Распределять актуальный inventory через сеть брокеров и видеть attribution |

---

# 5. Целевая аудитория, роли и JTBD

## 5.1. Individual Realtor

Работает самостоятельно. Нужны: клиенты, собственники, объекты, поиск, matching, TG Radar, звонки, задачи, просмотры, сделки, MLS, партнеры, документы и аналитика.

**JTBD:** когда появляется клиент с конкретными требованиями, быстро получить подходящие объекты других риэлторов и не просматривать вручную десятки чатов.

## 5.2. Agency Agent

Работает внутри агентства. Дополнительно нужны assigned leads, общая база компании, внутренние комментарии, team activity, распределение клиентов и права на объекты.

## 5.3. Team Lead

Отвечает за команду, распределение лидов, SLA, нагрузку, клиентов, задачи, сделки и performance.

## 5.4. Agency Manager / Owner

Нужны pipeline агентства, KPI, агенты, лиды, объекты, сделки, revenue, source attribution, team performance, data quality и настройки организации.

## 5.5. Agency Administrator

Управляет пользователями, ролями, филиалами, правами, интеграциями, справочниками, импортом/экспортом, настройками CRM и аудитом.

## 5.6. Professional Partner

Внешний агент или агентство, работающее через MLS, shared listing, buyer requests, cooperation requests, offers, viewings и deal collaboration.

## 5.7. Compliance / Authorized Employee

Роль для ограниченных verification-функций, юридических проверок и операций, требующих полномочий организации. Недоступность действия должна объясняться человеческим языком, а не только кодом 403.

## 5.8. Binor Administrator

Управляет пользователями, качеством базы, Telegram-источниками, модерацией, жалобами, parsing/matching, справочниками, безопасностью и системными настройками.

## 5.9. Конечные покупатели и собственники

На публичной стадии Binor ориентирован на профессионалов. Прямой B2C-канал для собственников и конечных покупателей не подтвержден; он может появиться позже как отдельный слой поверх профессиональной инфраструктуры.

---

# 6. Продуктовая модель и каналы

## 6.1. Telegram Bot

`@binor2030_bot` — точка входа, регистрация, открытие Mini App, получение уведомлений и поддержка основного рабочего сценария.

## 6.2. Telegram Mini App

Исходная рабочая среда риэлтора: объекты, заказы, совпадения и вкладка ТГ. В целевой модели Mini App или mobile-first web shell содержит CRM, поиск, MLS, сделки и операционный workspace.

## 6.3. Web Landing

`binor.uz` объясняет продукт и переводит пользователя в Telegram. Публично подтверждены страницы:

```text
/
/how-it-works
/about
/contacts
```

## 6.4. Основной принцип каналов

Telegram остается notification-channel и точкой входа. Основная платформа должна быть полноценной: пользователь не должен постоянно возвращаться в Telegram для ведения клиента, объекта, сделки и документов.

---

# 7. Основные функциональные контуры

## 7.1. Auto Matching

Система автоматически сопоставляет `Property / Listing` и `Client Requirement`, а также поддерживает обратный сценарий `Property → подходящие клиенты`.

При появлении совпадения система создает Match, объясняет причины совпадения и отправляет уведомление с учетом anti-spam и privacy rules.

## 7.2. TG / Telegram Radar

Отдельный профессиональный модуль, а не бесконечная лента:

- сбор объявлений из публичных Telegram-каналов;
- parsing и нормализация;
- поиск и фильтры;
- исходный URL поста;
- сохранение;
- привязка к клиенту;
- преобразование в потенциальный Property/Listing;
- поиск дубликатов;
- скрытие и жалоба на неактуальность;
- подписка на похожие публикации;
- уведомления о новых подходящих постах.

В исходных материалах встречаются формулировки «сотни каналов», «77–100+ каналов» и «10 000+ объявлений». Каноническая формулировка: **более 10 000 объявлений из большого пула Telegram-источников; точное число каналов является операционным показателем и должно храниться в админ-панели.**

## 7.3. Telegram Notifications

События: новый match, новый объект, снижение цены, ответ партнера, cooperation request, подтверждение просмотра, изменение сделки, просроченная задача, изменение объекта, истечение договора и важные системные изменения.

## 7.4. Co-broking

Платформа поддерживает 50/50, 70/30, 80/20 и Custom. Это условия между участниками сделки, а не обязательная комиссия Binor. Условия должны быть видны до передачи чувствительных данных и фиксироваться в Cooperation / Deal.

## 7.5. CRM и Today Workspace

Целевая рабочая модель: `Client + Requirement + Activity + Next Action`, а главная — не графический dashboard, а Action Feed / Today Workspace.

## 7.6. Property Database и MLS

Property Database хранит физические объекты и листинги; MLS — профессиональный workspace сотрудничества между агентами, общую базу, buyer requests, cooperation, сделки и историю взаимодействий.

## 7.7. Transaction Room

Связывает договоры, согласия, документы, проверки, показы, offers, переговоры, commission terms, act и закрытие сделки.

---

# 8. Сквозной пользовательский путь

## 8.1. Публичный пятишаговый путь

1. Регистрация через Telegram Bot.
2. Добавление объектов и заказов клиентов.
3. Автоматический поиск совпадений.
4. Telegram-уведомление о потенциальном партнере.
5. Контакт, согласование комиссии и совместная сделка.

## 8.2. Целевой end-to-end путь

```text
Lead
→ Deduplication
→ Assignment
→ Client
→ Requirement
→ Matching / Search
→ Shortlist
→ Property / Listing
→ Viewing
→ Feedback
→ Offer
→ Negotiation
→ Verification
→ Deal
→ Documents
→ Closing
→ Act / Commission
→ Archive / Analytics
```

## 8.3. Ключевые flows

### Flow 1. Новый входящий звонок

Unknown Number → Call → AI transcription → Create Client → Extract Requirement → Auto Match → Send Properties → Follow-up.

### Flow 2. Новый lead из Telegram

Telegram message → Lead Inbox → Deduplication → Assign Agent → Contact → Qualified → Client → Requirement → Matching.

### Flow 3. Новый собственник

Owner → Property → Duplicate Check → Contract → Consent → Documents → Verification → Listing → MLS → Reverse Matching.

### Flow 4. Клиент ищет объект

Client → Requirement → Auto Matching → Search → Shortlist → Send → Viewing → Feedback → Offer → Deal.

### Flow 5. MLS cooperation

Partner Listing → Match with Client → Cooperation Request → Terms → Accepted → Viewing → Offer → Joint Deal → Commission Split → Close.

### Flow 6. Telegram Radar

New TG Post → Parsing → Match → Notification → Open → Save → Duplicate Check → Convert to Property или Send to Client.

### Flow 7. Price Drop

Price changed → Affected clients detected → Agent notification → Select clients → Send update → Follow-up.

### Flow 8. Contract Expiry

Expiring contract → Notification → Contact owner → Renew или Withdraw Listing → MLS update.

### Flow 9. Viewing

Client + Property → Schedule → Confirm client → Confirm owner/partner → Viewing → Feedback → Next Action.

### Flow 10. Offer negotiation

Viewing successful → Buyer Offer → Owner Counteroffer → Negotiation Timeline → Accepted → Deal.

### Flow 11. Closing

Deal → Documents → Verification → Final Price → Closing → Act → Commission → MLS Update → Archive.

### Flow 12. Duplicate

New Property → Potential Duplicate → Compare → Existing Property → Create new Listing или Merge.

### Flow 13. Data Conflict

External update → Conflict detected → Compare values and sources → Resolve → Audit.

---

# 9. Информационная архитектура и навигация

## 9.1. Mobile navigation

Рекомендуемая гипотеза:

```text
Главная | CRM | Поиск | MLS | Ещё
```

В некоторых вариантах навигации «Клиенты», «Объекты» и «Сделки» могут быть вынесены в нижнюю панель; итоговый вариант должен проверяться usability-тестом при ограничении 4–5 основных пунктов.

Глобальная кнопка `+` открывает Quick Create:

- Клиент;
- Лид;
- Собственник;
- Объект;
- Задача;
- Просмотр;
- Сделка;
- Заметка.

## 9.2. CRM

CRM содержит Leads, Clients, Owners, Properties и Deals с сегментированной навигацией и едиными сущностями.

## 9.3. Глобальный поиск

Один Smart Search ищет по телефону, ФИО, объекту, ID, адресу, ЖК, району, кадастровому номеру, заметкам, клиентам, собственникам и агентам.

Поддерживаются бытовые запросы: «Чиланзар 2 комнаты до 70 000», «квартира у метро Космонавтов», «клиент +99890…», «объект Азиза», «новостройка 3 комнаты Юнусабад».

## 9.4. Today Workspace

Приоритет главного экрана:

- клиенты, ожидающие ответа;
- просмотры сегодня;
- договоры, которые заканчиваются;
- новые matches;
- cooperation requests;
- устаревшие объекты;
- price drops;
- сделки и отсутствующие документы;
- ближайшее следующее действие.

## 9.5. Public site sitemap

| Страница | Содержание |
|---|---|
| `/` | Hero, преимущества, CTA в Telegram |
| `/how-it-works` | Регистрация, добавление данных, matching, уведомление, сотрудничество, сделка |
| `/about` | Миссия, проблема, решение, ценности, аудитории |
| `/contacts` | Телефон, Instagram, Telegram, регион, часы поддержки |

---

# 10. Каноническая модель данных

## 10.1. Критическое различие

`Property ≠ Listing ≠ Advertisement`.

Одна физическая квартира — один Property. По ней могут существовать несколько Listing разных агентов, Telegram Advertisement и объявления на внешних площадках. Дубли не должны превращать одну квартиру в несколько физических объектов.

## 10.2. Сущности

| Сущность | Назначение |
|---|---|
| Person | Физическое лицо |
| Organization | Агентство, юридическое лицо или филиал |
| User | Учетная запись профессионального участника |
| Lead | Необработанное обращение |
| Client | Клиент CRM |
| Owner | Собственник объекта |
| Household / Related Parties | Супруги, семья, совладельцы, доверенные лица, представители компании |
| Requirement | Формализованный запрос клиента |
| Property | Физический объект недвижимости |
| Listing | Коммерческое предложение по Property от конкретного агента/организации |
| Advertisement | Публичное или внешнее объявление |
| Contract | Договор оказания услуг или договор с собственником |
| Consent | Согласия клиента/собственника |
| Verification | Результат проверки факта или документа |
| Match | Совпадение Requirement ↔ Listing/Property/TG Listing |
| Cooperation Request | Предложение совместной работы |
| Viewing | Просмотр объекта |
| Offer | Коммерческое предложение и переговорная версия цены |
| Deal | Сделка и ее жизненный цикл |
| Document | Документ, файл или подтверждение |
| Task | Следующее действие |
| Communication | Звонок, Telegram, WhatsApp, Instagram, email и другие коммуникации |
| Telegram Source | Канал или источник Telegram |
| Telegram Message | Сырой пост источника |
| Telegram Listing | Нормализованная версия объявления |
| Notification | Системное уведомление |
| Audit Log | Неподменяемая история значимых действий |

## 10.3. Связи

```text
Organization 1 — N Users
Organization 1 — N Properties
Organization 1 — N Listings
Client 1 — N Requirements
Owner 1 — N Properties
Property 1 — N Listings
Property 1 — N Advertisements
Requirement N — N Listings через Match
Listing 1 — N Cooperation Requests
Client 1 — N Viewings / Offers / Deals
Property 1 — N Viewings / Offers / Deals
Deal 1 — N Documents / Tasks / Communications
```

## 10.4. Household / Related Parties

Client — не всегда один человек. Система должна поддерживать супругов, членов семьи, доверенных лиц, совладельцев, юридические лица и представителей компании. Пример: Purchase Group из покупателя, супруги и доверенного лица.

## 10.5. Минимальные поля сущностей

### User

`id`, `telegram_id`, `telegram_username`, `first_name`, `last_name`, `phone`, `language`, `role`, `organization_id`, `status`, `professional_status`, `certificate`, `certificate_expiry`, `territory`, `specialization`, `created_at`, `updated_at`.

### Organization

`id`, `name`, `logo`, `phone`, `telegram`, `address`, `owner_user_id`, `branch_id`, `registry_status`, `insurance_status`, `status`, `created_at`, `updated_at`.

### Property

`id`, `owner_user_id`, `organization_id`, `deal_type`, `property_type`, `city`, `district`, `area_name`, `address`, `geo_lat`, `geo_lng`, `rooms`, `area_total`, `floor`, `floors_total`, `price`, `currency`, `description`, `photos`, `source`, `published_at`, `last_confirmed_at`, `expires_at`, `freshness_score`, `status`, `created_at`, `updated_at`.

### Listing

`id`, `property_id`, `listing_agent_id`, `organization_id`, `contract_id`, `publication_status`, `confidentiality_level`, `cooperation_terms`, `price`, `currency`, `source`, `verified_status`, `created_at`, `updated_at`.

### Requirement

`id`, `client_id`, `realtor_user_id`, `organization_id`, `deal_type`, `property_type`, `locations`, `rooms_min`, `rooms_max`, `area_min`, `area_max`, `budget_min`, `budget_max`, `currency`, `floor_preferences`, `condition`, `new_building`, `mortgage`, `additional_requirements`, `natural_language_input`, `status`, `created_at`, `updated_at`.

### Match

`id`, `property_id`, `listing_id`, `requirement_id`, `property_owner_user_id`, `order_owner_user_id`, `score`, `matched_fields`, `mismatched_fields`, `explanation`, `source_priority`, `status`, `created_at`, `notified_at`, `viewed_at`.

### Telegram Listing

`id`, `source_id`, `message_id`, `raw_text`, `raw_media`, `source_url`, `parsed_fields`, `confidence`, `published_at`, `normalized_at`, `freshness_score`, `duplicate_group_id`, `status`, `created_at`, `updated_at`.

---

# 11. Статусы и жизненные циклы

## 11.1. Property / Listing

```text
Draft
→ Contract Signed
→ Verification Pending
→ Verified
→ Active MLS
→ Offer
→ Under Contract
→ Closed
→ Archived
```

Отдельные исходы: Expired, Withdrawn, Suspended, Verification Failed, Disputed.

В пользовательском интерфейсе используются понятные названия: «Ожидается проверка», «Опубликован в MLS», «Снят», «Есть спор».

## 11.2. Lead

`New → Assigned → Contacted → Qualified → Converted → Lost`.

## 11.3. Client

`New → Contacted → подбор → Viewing → Negotiation → Deal → Deferred → Lost`.

## 11.4. Match

`New → Notified → Viewed → Contacted → Negotiation → Accepted → Deal in progress → Won`.

Альтернативы: Rejected, Expired, Duplicate, Cancelled.

## 11.5. Cooperation

`Draft → Sent → Viewed → Negotiation → Accepted → Viewing → Offer → Deal → Closed`.

Альтернативы: Declined, Expired, Cancelled, Disputed.

## 11.6. Verification

- Подтверждено;
- Ожидается;
- Не удалось проверить;
- Обнаружена проблема.

Нужно различать «со слов собственника» и «подтверждено официальным источником».

## 11.7. Deal

```text
Lead / Match
→ Qualification
→ Viewing
→ Offer
→ Negotiation
→ Under Contract
→ Verification
→ Closing
→ Act
→ Commission
→ Archived
```

---

# 12. Matching Engine

## 12.1. Подтвержденное поведение

Новый объект сравнивается с активными заказами; новый заказ сравнивается с активными объектами; при совпадении стороны получают возможность связаться.

## 12.2. Hard filters

Match невозможен или не показывается автоматически при критическом несовпадении:

- тип сделки;
- город/регион;
- тип недвижимости;
- бюджет вне допустимого диапазона;
- неактивный или истекший источник.

## 12.3. Soft filters и score

Учитываются район, количество комнат, площадь, цена, этаж, тип дома, расстояние, состояние, новостройка/вторичка и дополнительные требования.

Пример начальных весов:

| Критерий | Вес |
|---|---:|
| География | 25% |
| Цена | 25% |
| Тип недвижимости | 15% |
| Комнаты | 15% |
| Площадь | 10% |
| Этаж/дом | 5% |
| Дополнительные параметры | 5% |

Весы и пороги должны быть конфигурируемыми.

## 12.4. Confidence bands

| Диапазон | Отображение |
|---:|---|
| 90–100% | Отличное совпадение |
| 75–89% | Хорошее совпадение |
| 60–74% | Возможно подходит |
| <60% | Не показывать автоматически |

Не показывать искусственный «AI Score 87.43» без объяснения. Показывать: «Подходит по району, бюджету и комнатам» или «На $8 000 дороже бюджета».

## 12.5. Reverse Matching

По Property система показывает: «Подходит 14 вашим клиентам», с возможностью отфильтровать клиентов по статусу, бюджету, privacy и ответственному агенту.

## 12.6. Feedback loop

Собирать `match_opened`, `match_rejected`, `match_accepted`, `property_sent`, `viewing_created`, `deal_created` и причины отказа для улучшения ranking.

---

# 13. TG / Telegram Radar: требования

## 13.1. Пайплайн

```text
Telegram source
→ raw message capture
→ parser / NLP
→ field normalization
→ entity resolution
→ duplicate detection
→ freshness calculation
→ indexing
→ matching
→ notification
```

## 13.2. Нормализация

Из поста извлекать адрес, район, тип, цену, валюту, комнаты, площадь, этаж, описание, медиа, контакт, source URL, время публикации и confidence.

## 13.3. Источник истины

Приоритет доверия:

1. Verified Binor property.
2. Active realtor-confirmed property.
3. Agency property.
4. Parsed Telegram listing.
5. Old/unconfirmed external listing.

## 13.4. Freshness

Каждый источник хранит `published_at`, `last_confirmed_at`, `updated_at`, `expires_at`, `freshness_score`.

Ориентиры: 0–3 дня — fresh; 4–7 — normal; 8–14 — aging; 15+ — требует подтверждения. Сроки калибруются на реальных данных.

## 13.5. Deduplication

Сравнивать географию, цену, характеристики, медиа, текст, телефоны, кадастровые/внутренние идентификаторы и историю публикаций. При неопределенности не сливать автоматически, а показывать Duplicate Resolution Center.

## 13.6. Действия пользователя

Open original, Save, Link to Client, Convert to Property, Mark duplicate, Hide, Report stale, Subscribe to similar.

---

# 14. CRM и операционная работа

## 14.1. Unified Lead Inbox

Источники: Phone, Telegram, WhatsApp, Instagram, Website, Referral, Advertising, Portal, MLS, Manual.

Карточка лида показывает имя/телефон, источник, потребность, время поступления, ответственного и SLA.

Перед созданием клиента проверяются телефон, Telegram, WhatsApp, email и похожее имя. При совпадении: «Похоже, этот человек уже есть в CRM» с действиями Открыть, Объединить, Создать всё равно.

## 14.2. Lead Routing

Поддержать manual assignment, round-robin, район, тип недвижимости, источник, specialization, workload, team и branch.

## 14.3. Client Profile

Верхний блок: имя, статус, requirement summary, ответственный. Sticky actions: Позвонить, Написать, Задача, Еще.

Разделы: Overview, Requirements, Matches, Sent Properties, Viewings, Offers, Communications, Documents, Deals, Timeline.

## 14.4. Natural Language Requirement

Разрешить ввести: «2–3 комнаты, Мирзо-Улугбек, ремонт, до 100 тысяч». AI предлагает структурированные параметры; пользователь подтверждает.

## 14.5. AI Client Memory

Сохранять предпочтения, историю отказов, чувствительность к цене, важные фразы и изменения запроса. Пользователь должен видеть источник вывода и иметь возможность исправить его.

## 14.6. Owner CRM

Профиль собственника связывает Person/Organization, Property, Contract, Consent, Documents, Verification, Communications и историю изменения листинга.

## 14.7. Calls и коммуникации

Неизвестный звонок должен позволять создать lead/client, сохранить контекст и создать follow-up. AI-транскрипция и summary являются помощниками, а не окончательной юридической записью.

## 14.8. Tasks, Calendar, Route, Viewing

Поддержать tasks, дедлайны, повторения, календарь, планирование маршрута, viewing confirmation и feedback. После просмотра обязателен Next Action.

---

# 15. MLS и профессиональное сотрудничество

## 15.1. MLS как workspace

MLS не должен выглядеть как еще одна публичная доска. Основные разделы: Общая база, Мои листинги, Запросы покупателей, Предложения, Сотрудничество, Сделки, История взаимодействий.

## 15.2. MLS Search

Быстрые фильтры: продажа/аренда, тип, район, цена, комнаты. Advanced filters: площадь, этаж, этажность, состояние, новостройка, вторичка, год, кадастровый статус, verified, exclusive, дата обновления, агентство, источник, цена за м².

Показывать количество результата и основную CTA: «Показать 186». Фильтры сохраняются; доступно «Сохранить поиск» и «Уведомлять о новых объектах».

## 15.3. Cooperation Request

Запрос должен содержать listing, client/requirement в пределах разрешенного disclosure, предлагаемые terms, desired action, сроки ответа и audit history.

Статусы: Sent, Viewed, Accepted, Declined, Negotiation, Expired, Cancelled, Disputed.

## 15.4. Commission rule engine

Фиксировать:

`object owner = A → buyer brought by B → agreed split = 50/50 → viewing → closing → payout recorded`.

Поддержать 50/50, 70/30, 80/20 и Custom. Не считать автоматически, что платформа имеет право на процент сделки.

## 15.5. Conflict detection

Обнаруживать duplicate claim, already-contacted client, overlapping listing, competing cooperation request, expired contract, disputed ownership и conflict of source. Все конфликты имеют понятный workflow разрешения и аудит.

---

# 16. Verification, документы и доверие

## 16.1. Verification Center

Проверки могут включать право собственности, кадастровые данные, договор, согласие, ограничения, задолженности и дополнительные источники.

Для каждого результата: источник, дата, статус, scope, исполнитель и срок актуальности.

## 16.2. Документы и AI extraction

Документы загружаются в контекст Property, Contract, Client или Deal. AI может извлекать поля, но пользователь подтверждает результат; юридически значимые поля не должны изменяться бесконтрольно.

## 16.3. Confidentiality levels

```text
PUBLIC
→ минимальные данные для поиска и публикации
PROFESSIONAL
→ контакты и рабочие данные для проверенных участников
RESTRICTED
→ документы, sensitive data, ownership, transaction room
```

Публикация должна начинаться с preview: куда публикуется, какие данные уйдут, какие остаются скрытыми.

## 16.4. Trust layer

Хранить verified status агента, freshness, source, owner confirmation, complaints, history, reputation и audit. Не выдавать «verified», если источник недоступен: `source unavailable ≠ verified`.

---

# 17. Правовая модель MLS в Узбекистане

## 17.1. Состояние на 30 сентября 2026 года

Закон Республики Узбекистан № ЗРУ-1163 принят, но по материалам корпуса еще не вступил в силу; указанная дата вступления — 8 ноября 2026 года. Для юридически значимых решений необходимо сверяться с официальным узбекским текстом и подзаконными актами.

## 17.2. Смысл MLS в законе

MLS определяется как электронная информационная система, позволяющая осуществлять сделки с объектами недвижимости путем сбора, хранения и обмена информацией и предложениями рынка.

Закон связывает MLS с:

- электронным обменом;
- риэлторскими запросами;
- проверяемыми сведениями;
- принципом «единого окна»;
- возможными договорными интеграциями с государственными информационными системами;
- операционной инфраструктурой сделки.

## 17.3. Статья 30: практический смысл

- MLS организуется частным сектором.
- Работа предполагается по принципу «единого окна».
- Достоверная информация должна обмениваться электронно в реальном времени.
- Обмен с государственными органами возможен на договорной основе.
- Закон не назначает единственного частного оператора.
- Конкретные API, схему данных и SLA должен определить национальный стандарт; в исходном исследовании опубликованный стандарт не был найден.

## 17.4. Риэлторский запрос и due diligence

Риэлторский запрос может быть связан с объектом и договором с клиентом. В зависимости от статуса участника возможны проверки регистрации юридических лиц, прав на недвижимость, договоров долевого участия, налогов, регистрации граждан по адресу, нотариальных ограничений, коммунальных задолженностей и других сведений.

Доступ агента по недвижимости уже и не должен автоматически считаться равным доступу риэлторской организации. Государственный орган может отказать в предоставлении сведений, если раскрытие нарушает права третьих лиц или касается персональных данных.

## 17.5. Договор и акт

Письменный или электронный договор должен содержать вид услуги, сведения о сертификате, членстве, страховании, сроках, вознаграждении, правах, ответственности, расторжении и возврате. Акт или иной документ исполнения должен быть связан с записью сделки; для услуг через MLS материалы указывают срок внесения сведений не позднее трех рабочих дней.

## 17.6. Архитектурные последствия

Готовить CRM по модели:

`CRM → Integration/API layer → MLS → Government systems`.

Публичные, профессиональные и чувствительные данные должны быть разделены. Все запросы, ответы, цели доступа, договоры, согласия, версии документов и действия пользователя должны иметь audit trail.

---

# 18. Безопасность, privacy и anti-abuse

## 18.1. Security by design

- least privilege;
- role-based permissions;
- organization and branch boundaries;
- purpose limitation;
- consent management;
- audit log;
- session management;
- sensitive data reveal only when needed;
- version history;
- destructive action confirmation;
- export controls;
- conflict and fraud monitoring.

## 18.2. Privacy by stage

До подтверждения интереса не раскрывать избыточные контакты и документы. После согласования сотрудничества раскрывать только необходимый минимум. В transaction room использовать отдельные права и журнал доступа.

## 18.3. Anti-abuse

Защищать от спама, массового копирования, fake listings, повторной регистрации, захвата лидов, обхода комиссии, жалоб и неактуальных объявлений. Порог уведомлений должен быть настраиваемым.

## 18.4. Regulatory-sensitive features

Не hardcode предполагаемые будущие правила MLS или государственные API. Использовать feature flags, configurable workflows, configurable fields, permission-based modules и integration adapters.

---

# 19. Роли и матрица прав

Условные уровни: `Own` — собственные записи; `Team` — записи команды; `Agency` — агентство; `Partner` — опубликованная профессиональная область; `Restricted` — чувствительные данные; `Admin` — системное управление.

| Область | Individual | Agent | Team Lead | Agency Owner | Admin | Partner |
|---|---|---|---|---|---|---|
| Свои leads/clients | Own | Own/assigned | Team | Agency | All | Shared only |
| Team leads | — | По назначению | Team | Agency | All | — |
| Свои properties | Own | Own/assigned | Team | Agency | All | Shared |
| Агентская база | — | Read/allowed edit | Team | Full | All | Published only |
| Sensitive owner data | Own/approved | Permission | Permission | Approved | All audited | Restricted |
| Verification | Own/allowed | Permission | Permission | Authorized | All | Result only |
| MLS search | Professional | Professional | Professional | Full | All | Professional |
| Cooperation | Full own | Allowed | Team | Agency | Moderation | Own requests |
| Deals | Own | Assigned | Team | Agency | All | Participating |
| Reports | Own | Own | Team | Agency | Global | — |
| Roles/permissions | — | — | Limited | Full org | All | — |
| Audit | Own history | Own history | Team | Agency | Full | Own interactions |

Недоступность действия должна сопровождаться объяснением причины, требуемого разрешения и возможного следующего шага.

---

# 20. UX-принципы и дизайн-система

## 20.1. Приоритеты

1. Скорость основной задачи.
2. Понятность.
3. Минимизация ошибок.
4. Data integrity.
5. Privacy и security.
6. Автоматизация.
7. Количество функций.
8. Визуальная красота.

## 20.2. Mobile-first

Начинать с 375–430 px. One-thumb UX: touch targets минимум 44×44 px, предпочтительно 48×48 px. Частые CTA размещать в нижней ergonomic zone; использовать bottom sheets, sticky actions и FAB.

## 20.3. Progressive disclosure

При создании объекта сначала запросить тип, адрес, цену, базовые характеристики и фото. Собственника, договор, документы, verification и MLS добавлять после создания по мере необходимости.

## 20.4. Минимум ручного ввода

Autocomplete, smart defaults, recently used values, геолокация, chips, AI extraction, импорт, повторное использование уже известных телефона, адреса, организации и валюты.

## 20.5. Визуальный язык

Современный, спокойный, технологичный, профессиональный, минималистичный. Фиолетово-пурпурная бренд-идентичность допустима как accent, но рабочий интерфейс не должен превращаться в бесконечный градиент. Семантические цвета использовать по смыслу.

## 20.6. Базовые design tokens

- spacing: 4/8pt grid;
- radius scale: 8, 12, 16, 24;
- единая шкала Display, H1, H2, Body, Small, Caption;
- WCAG AA;
- явный focus, labels, screen reader support;
- состояния не передавать только цветом;
- RU/UZ, USD/UZS, +998, локальные районы, махалли, ЖК, метро и кадастровые форматы.

## 20.7. Компоненты

Button, Icon Button, FAB, Input, Phone Input, Currency Input, Price Input, Autocomplete, Select, Combobox, Date Picker, Time Picker, Segmented Control, Tabs, Chips, Filter Chips, Status Badge, Property Card, Client Card, Owner Card, Lead Card, Match Card, Deal Card, Viewing Card, Offer Card, Task Card, Agent Card, Notification Card, Telegram Post Card, Verification Item, Document Item, Timeline Item, Bottom Sheet, Modal, Drawer, Toast, Snackbar, Tooltip, Empty State, Error State, Skeleton, Map Marker, Avatar, Table, Pagination, Infinite Scroll, Bottom Navigation, Sidebar, Command Palette.

---

# 21. Screen inventory и приоритеты

## 21.1. P0 — ядро

Onboarding, Home/Today, Lead Inbox, Client, Requirement, Property, Search, Matching, Telegram Radar, MLS, Cooperation, Calls, Tasks, Viewing, Offer, Deal.

## 21.2. P1 — следующий слой

Contracts, Consent, Verification, Documents, Team, Analytics, Import, Integrations, Permissions, Audit.

## 21.3. P2 — advanced

Route optimization, Market Analytics, Automation Builder, Advanced AI, Custom Workflows, Developer Network, Government Integrations.

## 21.4. Полный перечень экранов

1. Splash; 2. Login; 3. OTP; 4. Telegram authentication; 5. Onboarding; 6. Language; 7. Individual/Agency; 8. Agency onboarding; 9. Professional Profile; 10. Home/Action Feed; 11. Global Search; 12. Smart Actions; 13. Notifications; 14. Lead Inbox; 15. Lead Profile; 16. Assign Lead; 17. Client List; 18. Client Filters; 19. New Client; 20. Client Profile; 21. Requirement; 22. Client Matches; 23. Sent Properties; 24. Owner List; 25. Owner Profile; 26. New Owner; 27. Property List; 28. Property Map; 29. Property Filters; 30. Saved Searches; 31. Saved Views; 32. New Property; 33. Duplicate Check; 34. Duplicate Resolution; 35. Property Profile; 36. Media; 37. Location; 38. Listing; 39. Contract; 40. Consent; 41. Verification; 42. Documents; 43. Property Matches; 44. Price History; 45. Property Timeline; 46. Telegram Radar; 47. Telegram Search; 48. Telegram Post; 49. Telegram → Property; 50. MLS Home; 51. MLS Search; 52. MLS Listing; 53. Buyer Requests; 54. Cooperation Requests; 55. Cooperation Detail; 56. Commission Terms; 57. Partners; 58. Calls; 59. Call Detail; 60. AI Call Summary; 61. Communication Timeline; 62. Tasks; 63. Calendar; 64. Route; 65. Viewing List; 66. Viewing Detail; 67. Viewing Feedback; 68. Offers; 69. Offer Detail; 70. Negotiation; 71. Deal List; 72. Deal Pipeline; 73. Deal Profile; 74. Deal Checklist; 75. Deal Documents; 76. Deal Financials; 77. Deal Closing; 78. Team; 79. Agent Profile; 80. Branches; 81. Lead Routing; 82. Agency Analytics; 83. Agent Analytics; 84. MLS Analytics; 85. Telegram Analytics; 86. Import; 87. Import Mapping; 88. Import Validation; 89. Export; 90. Integrations; 91. Integration Status; 92. Sync Conflicts; 93. Roles; 94. Permissions; 95. Custom Fields; 96. Tags; 97. Security; 98. Sessions; 99. Audit Log; 100. Profile; 101. Language Settings; 102. Notification Preferences; 103. Billing/Subscription, если применимо.

## 21.5. Требования к спецификации каждого экрана

Для каждого экрана определить Goal, Primary Action, Secondary Actions, Information Hierarchy, Components, Default/Loading/Empty/Error/Offline/Disabled/Permission denied/Syncing/Conflict states и Navigation.

Для каждого сложного workflow определить trigger, entry point, happy path, alternative paths, edge cases, validation, permissions, loading, failure, recovery, audit, notification и next best action.

---

# 22. Подробные спецификации P0-экранов

## 22.1. Home / Today Workspace

**Цель:** сразу показать, что требует внимания сегодня.  
**Primary action:** открыть следующее критическое действие.  
**Компоненты:** приветствие, action feed, задачи, новые matches, price drops, deal attention, быстрые действия.  
**Состояния:** новый пользователь — onboarding checklist; нет задач — позитивный empty state; offline — cached feed с отметкой времени.

## 22.2. Lead Inbox

**Цель:** не потерять входящее обращение.  
**Primary action:** связаться или назначить ответственного.  
**Обязательно:** источник, SLA, время поступления, dedup warning, owner, next action.  
**Ошибки:** не удалось импортировать канал — сохранить raw lead и показать retry.

## 22.3. Client Profile

**Цель:** удержать контекст клиента.  
**Primary action:** выполнить следующее действие.  
**Верх:** имя, статус, потребность, ответственный, call/message/task.  
**Секции:** Requirements, Matches, Sent Properties, Viewings, Offers, Communications, Documents, Deals, Timeline.

## 22.4. Requirement

**Цель:** записать спрос минимальным числом действий.  
**Primary action:** сохранить requirement и запустить matching.  
**Поддержка:** структурированные поля, диапазоны, natural language input, AI suggestions с подтверждением, pause/resume.

## 22.5. Property List / Search

**Цель:** найти релевантное предложение менее чем за 10 секунд.  
**Primary action:** открыть или отправить property.  
**Карточка:** фото, цена, комнаты, площадь, этаж, район, source, freshness, status, verification, badges.  
**Views:** List, Map, Saved Views.

## 22.6. Property Profile

**Цель:** принять решение по объекту и сделать следующий шаг.  
**Hero:** фото, цена, адрес, параметры, status, verification.  
**Sticky actions:** позвонить, клиент, еще.  
**Секции:** Main, Location, Owner, Contract, Consent, Verification, MLS, Clients, Matches, Viewings, Offers, Documents, History.

## 22.7. Match Card

**Цель:** понять релевантность и выбрать действие.  
**Показывать:** client/property, объяснение совпадения, mismatches, source trust, freshness, partner, cooperation terms.  
**Actions:** открыть, связаться, отправить, reject, save, cooperation request.

## 22.8. Telegram Post / Radar

**Цель:** быстро превратить внешний сигнал в полезное действие.  
**Actions:** open source, save, link client, convert property, mark duplicate, report stale, subscribe.  
**Обязательно:** source URL, timestamp, parse confidence, raw vs normalized data.

## 22.9. MLS Listing / Cooperation

**Цель:** безопасно начать сотрудничество.  
**Показывать:** listing, agent/agency, verification, confidentiality, commission terms, response deadline.  
**Actions:** request cooperation, negotiate, accept, decline, view history.

## 22.10. Viewing

**Цель:** назначить, подтвердить и завершить просмотр.  
**Содержит:** участники, объект, дата/время, локация, подтверждения, feedback, next action.

## 22.11. Offer / Negotiation

**Цель:** сохранить версии цены и условия переговоров.  
**Содержит:** offer, counteroffer, timeline, actor, timestamp, status, acceptance, link to deal.

## 22.12. Deal Workspace

**Цель:** довести сделку до закрытия и не потерять документы.  
**Секции:** parties, property, financials, stage, checklist, next action, documents, verification, commission, audit.

---

# 23. Состояния интерфейса

## 23.1. Empty states

Не оставлять пустой экран. Объяснять, что здесь будет, показывать первый шаг и CTA: «Добавьте первого клиента», «Импортируйте объект из Telegram», «Сохраните поиск».

## 23.2. Loading

Использовать skeleton и progressive loading. Не блокировать весь экран, если можно показать cached data и загрузить остальное.

## 23.3. Errors

Человеческий текст: «Сервис проверки временно недоступен. Данные объекта сохранены. Повторить позже». Не показывать пользователю голый `503`.

## 23.4. Offline / плохой интернет

Показывать cached data, локально сохранять ввод, обозначать pending sync и разрешать retry. Конфликты синхронизации должны показывать сравнение версий, источник и выбор пользователя.

## 23.5. Permission denied

Объяснять, какое право нужно, кто может выдать и какое безопасное действие доступно сейчас.

---

# 24. API и техническая архитектура

## 24.1. Рекомендуемая архитектура

```text
Telegram Bot / Mini App
→ Backend API
→ Auth / Organization / Permissions
→ PostgreSQL
→ Search Index
→ Redis / Cache
→ Queue Workers
→ Matching Engine
→ Telegram Collector / Parser / NLP
→ Notification Service
→ Admin Panel
→ External integrations / MLS / government adapters
```

## 24.2. API domains

- Auth and sessions;
- Users and professional identity;
- Organizations, branches, teams, roles;
- Leads, clients, owners, households;
- Requirements;
- Properties, media, listings, contracts;
- Verification, consent, documents;
- Search, saved searches, saved views;
- Matches and feedback;
- Telegram sources, messages, listings;
- Cooperation and commission terms;
- Viewings, offers, deals, checklists;
- Tasks, calendar, communications;
- Notifications and preferences;
- Imports, exports, integrations, sync conflicts;
- Analytics and audit.

## 24.3. Минимальные capabilities

`create/update/archive property`, `create/pause/close requirement`, `search`, `create/read match`, `send notification`, `save Telegram listing`, `convert Telegram listing`, `send/accept cooperation`, `create viewing`, `create offer`, `create/update deal`, `upload document`, `run verification`, `write audit event`.

## 24.4. Non-functional requirements

- поиск и основной shortlist — практически мгновенно;
- target «найти объект» — менее 10 секунд;
- buyer request → shortlist — менее 60 секунд для пилота;
- create lead — менее 15 секунд;
- basic property — 30–60 секунд;
- viewing — менее 20 секунд;
- высокая доступность notification pipeline;
- горизонтальное масштабирование collector/matching/indexing;
- идемпотентность событий и дедупликация уведомлений;
- observability, audit и traceability.

---

# 25. Аналитика и метрики

## 25.1. Product North Star

На ранней стадии — количество закрытых сделок в месяц, в которых Binor участвовал от появления объекта или buyer request до transaction room. Не использовать количество регистраций как главный показатель.

## 25.2. Product metrics

### Acquisition

Registrations, source, invite/referral, activation rate.

### Activation

Time to first value, first imported object, first requirement, first match, first shortlist.

### Matching

Match precision, match acceptance, match → action, match → viewing, match → deal, rejection reasons.

### Telegram

Source freshness, parse precision, open rate, save rate, convert rate, duplicate precision, stale reports.

### Retention

WAU/MAU, weekly active agents, return after first match, active inventory, active requirements.

### Revenue

Trial → paid, agent ARPU, agency ARPA, churn, CAC payback, commission/transaction revenue only after legal validation.

## 25.3. Рекомендуемые пилотные ориентиры

| KPI | Целевой ориентир |
|---|---:|
| Time-to-first-value | <15 минут |
| WAU/MAU | >60% |
| Objects created by bot/import | >70% |
| Fresh inventory share | >70% |
| Owner-confirmed listings | 40% → 70% |
| Duplicate detection precision | >90% |
| Buyer request → shortlist | <60 секунд |
| Median first response | <5 минут |
| Trial → paid | 20–30%+ |
| Paid agent ARPU | 150–250 тыс. сум/мес. как гипотеза |
| Agency ARPA | 0,8–2 млн сум/мес. как гипотеза |
| Monthly logo churn | <3–4% как ориентир |
| CAC payback | <4 месяцев как ориентир |

Цели из этого раздела являются рабочими гипотезами, а не текущими фактами продукта.

## 25.4. События

`lead_created`, `lead_assigned`, `client_created`, `requirement_created`, `property_created`, `listing_created`, `search_performed`, `filter_applied`, `match_created`, `match_opened`, `match_rejected`, `property_sent`, `call_completed`, `viewing_created`, `viewing_completed`, `offer_created`, `cooperation_sent`, `cooperation_accepted`, `deal_created`, `deal_closed`, `telegram_post_opened`, `telegram_post_saved`, `telegram_post_converted`, `verification_completed`, `document_uploaded`, `conflict_resolved`.

---

# 26. Бизнес-модель, GTM и moat

## 26.1. Что подтверждено

Сайт публично описывает только разделение комиссии между риэлторами. Тарифы, подписка, комиссия Binor, бесплатные лимиты и платный период не раскрыты.

## 26.2. Возможные модели

- подписка Individual Pro;
- тарифы для агентств;
- платный доступ к TG Radar и безлимитному matching;
- premium verification/compliance;
- developer distribution subscription;
- transaction fee только после отдельного юридического анализа;
- API/data products после появления достаточного качества данных.

## 26.3. GTM

Начальный рынок: 8–12 агентств по 5–30 агентов. Входной оффер — не «CRM», а импорт Telegram-объектов, очистка дублей, актуальная база и автоматические matches.

Для регионов — партнерства с локальными Telegram-сообществами, branded submission bot и backend. Для профессиональных объединений — digital identity, стандарты и MLS-инфраструктура. Для застройщиков — Broker Distribution OS с live availability, access, reservation, attribution и analytics.

## 26.4. Product moat

1. Граф активных риэлторов.
2. Нормализованная база объектов.
3. База реального спроса.
4. История актуальности и цены.
5. Качественный matching.
6. Telegram intelligence.
7. Trust/reputation.
8. Данные фактических сделок.

---

# 27. Roadmap

## M0 / 0–3 месяца: Foundation и instant value

- Telegram auth, RU/UZ;
- user/agency;
- importer из Telegram: forward message/photo/link → structured listing;
- property и buyer requirements;
- deduplication и freshness;
- basic matching и shortlist;
- Telegram notifications;
- pilot 5–10 агентств, 50–100 активных агентов, 3–5 тыс. нормализованных объектов как рабочая цель.

## M1 / 3–6 месяцев: Agency workspace

- owner confirmation;
- team inventory;
- roles and permissions;
- object owner;
- price history;
- viewing calendar;
- lead ownership;
- co-broker beta;
- commission rule engine;
- возможно, пилот интеграции с OLX при подтверждении доступа к API.

## M2 / 6–9 месяцев: Compliance moat

- verified agent identity;
- e-contracts;
- consent center;
- compliance room;
- verification checklist;
- документы и акт;
- MLS pilots;
- сохранение audit trail.

## M3 / 9–12 месяцев: Network business

- shared MLS;
- government/API integrations по договорам;
- developer inventory;
- broker distribution;
- regional rollout;
- network analytics.

## Дальше

Market intelligence, price history, liquidity indexes, supply/demand analytics, district trends, agent performance, data/API business и B2C-слой для поиска проверенных агентов.

---

# 28. Риски и меры снижения

| Риск | Последствие | Мера |
|---|---|---|
| Нерелевантные matches | Notification fatigue и потеря доверия | Hard filters, explainability, feedback, configurable thresholds |
| Устаревшие объекты | Плохой клиентский опыт | Expiration, confirmation, freshness score |
| Дубли | Ложное ощущение supply и ошибки | Duplicate Center, entity resolution, precision metric |
| Утечка контактов | Потеря доверия и обход условий | Confidentiality levels, reveal controls, audit |
| Telegram dependency | Сбой канала и изменения платформы | Decouple data model, own index, multiple channels |
| Cold start | Недостаток matches | TG Radar, pilot agencies, regional communities |
| Споры по комиссии | Конфликты партнеров | Terms before reveal, cooperation record, dispute workflow |
| Непонятная legal position | Регуляторный риск | SaaS-first, legal review, configurable compliance |
| AI hallucination | Ошибки в данных/документах | Human confirmation, source and confidence |
| Сложный UX | Низкая активация | Mobile-first, quick create, progressive disclosure |

---

# 29. Открытые продуктовые решения

До реализации критических модулей необходимо принять решения:

1. Что является основной единицей ценности: match, контакт, показ или закрытая сделка?
2. Кто видит контакт собственника и клиента на разных стадиях?
3. Как создается и верифицируется агентство?
4. Кто выбирает 50/50, 70/30, 80/20 и Custom?
5. Фиксируется ли комиссия как binding agreement или только как намерение?
6. Как решается спор за клиента и первоисточник объекта?
7. Как обрабатываются дубли и конфликтующие значения?
8. Как определяется актуальность и частота подтверждения?
9. Какова монетизация Binor?
10. Разрешены ли собственники без риэлтора?
11. Что именно видит partner в MLS?
12. Какова юридическая роль оператора Binor: SaaS, MLS operator, marketplace или intermediary?
13. Какие государственные интеграции доступны по договору?
14. Какие данные должны храниться в Узбекистане?
15. Какие поля являются обязательными для национального стандарта после его публикации?

---

# 30. Definition of Product Success

Binor успешен, если риэлтор регулярно получает через систему возможности, которые он не нашел бы вручную или нашел бы значительно позже, а команда может провести путь от первого сигнала до сделки с понятным контекстом, свежими данными и доказуемой историей.

Минимальный тест нового риэлтора без обучения:

- зарегистрироваться;
- добавить клиента;
- записать потребность;
- добавить объект;
- найти объект;
- увидеть match и понять его причину;
- отправить объект клиенту;
- назначить просмотр;
- восстановить контекст после звонка;
- найти партнера;
- отправить cooperation request;
- согласовать условия;
- создать offer;
- начать deal;
- увидеть недостающие документы;
- закрыть сделку.

Каждый экран должен помогать хотя бы одной из пяти задач:

1. Не потерять клиента.
2. Быстрее найти объект.
3. Быстрее найти покупателя.
4. Быстрее договориться с другим агентом.
5. Быстрее довести сделку до закрытия.

---

# 31. Источники и границы применимости

Master объединяет весь переданный корпус `0.md`–`9.md`. Источники имеют разный жанр: наблюдение публичного сайта, продуктовые паспорта, UX-задания, аналитические записки и рекомендации. Это не делает сведения автоматически взаимоисключающими; сначала нужно учитывать дату, предмет утверждения и степень уверенности.

Публичное описание подтверждает наличие заявления на сайте, но не заменяет проверку поведения внутри Mini App. Оценка рынка не является фактом о пользователях Binor. Целевая UX-функция не доказывает, что она уже реализована. Рекомендуемая архитектура не является описанием текущего backend.

Правовой срез приведён на 30 сентября 2026 года. Закон № ЗРУ-1163 принят 7 августа 2026 года и, согласно LexUZ, должен вступить в силу 8 ноября 2026 года. Основной официальный первичный источник — [LexUZ, Закон № ЗРУ-1163 «О риэлторской деятельности»](https://www.lex.uz/en/docs/8385395?ONDATE=08.11.2026). Русский текст LexUZ может быть переводом; юридически значимые решения принимаются после сверки с официальным узбекским текстом, опубликованными стандартами, подзаконными актами и юристом в Узбекистане.

Внешние рыночные цифры привязаны к периоду публикации и не должны использоваться как вечные константы. Например, [Центральный банк Узбекистана, обзор рынка недвижимости за I квартал 2026 года](https://cbu.uz/en/press_center/releases/4116350/) сообщает 110,1 тыс. сделок, 5,7 трлн сумов ипотечных кредитов и ввод 3,3 млн м² жилья за квартал. Более поздние показатели января–августа 2026 года сохранены как сообщённые в источнике S9; они относятся к отдельному исследовательскому срезу рынка.

## 31.1. Реестр исходных документов

| ID | Файл | Основной предмет | Как использовать |
|---|---|---|---|
| S0 | `0.md` | Закон № ЗРУ-1163, MLS, due diligence, интеграционная модель, международные модели и правовые ограничения | Основной аналитический источник по MLS; юридические утверждения сверять с LexUZ |
| S1 | `1.md` | Master prompt для mobile-first UX: сущности, сценарии, состояния, роли, поиск, CRM, сделки и экранный каталог | Источник целевой UX-функциональности; не подтверждение существующих экранов |
| S2 | `2.md` | Детализированная UX-архитектура и требования к интерфейсу, данным, доступам и workflow | Дополняет S1; использовать для продуктового проектирования и acceptance criteria |
| S3 | `3.md` | Наблюдение публичного сайта Binor на RU/UZ, страницы, контакты, контент, SEO и терминология | Источник публичных фактов на дату исследования; интерфейс Mini App исследователем не изучен |
| S4 | `4.md` | Детальный паспорт проекта, бизнес-модель, текущие/целевые показатели и технические предположения | Сохранять явно заявленные данные; числа без методики и backend-стек помечать как сведения S4/предположение |
| S5 | `5.md` | Product Passport: доменная модель, роли, Telegram Radar, matching, API domains, NFR, roadmap и data quality | Главный источник целевой продуктовой и технической модели |
| S6 | `6.md` | Паспорт продукта и сведения о Telegram-каналах, продуктовой подаче и связанной экосистеме | Дополняет публичное описание; правовую связь компаний не считать доказанной без документов |
| S7 | `7.md` | Паспорт Binor и связь с ASTOR COMPANY/Biding.uz | Сохраняет заявленную в источнике экосистемную связь; юридическое владение/операторство требует подтверждения |
| S8 | `8.md` | Подробный публичный Product Passport, сайт, функция matching, Telegram Radar и продуктовые детали | Дополняет S3; количество источников Telegram указывается с исходным охватом |
| S9 | `9.md` | Рынок, боли, TAM-сценарии, цены-конкуренты, GTM, закон, roadmap и коммерческие гипотезы | Исследовательская записка; цены и TAM-сценарии — именно предположения автора, а рыночная статистика имеет дату |

## 31.2. Приоритет источников при проверке

Для публичного позиционирования ориентиром служит текущий сайт/бот и зафиксированные наблюдения S3/S8; для правовой нормы — официальный текст LexUZ и последующие акты; для целевой функциональности — согласованное требование из S1/S2/S5; для рыночной гипотезы — датированный первоисточник и прозрачные предпосылки расчёта. Ни один документ не должен молча «переопределять» остальные: при расхождении применяется реестр §41.

Проверенные первичные/прямые ссылки для основных правовых и рыночных утверждений: [Закон № ЗРУ-1163 на LexUZ](https://www.lex.uz/en/docs/8385395?ONDATE=08.11.2026); [обзор Центрального банка за I квартал 2026 года](https://cbu.uz/en/press_center/releases/4116350/). Показатели января–августа 2026 года в S9 приписаны исследованием обзору Центра экономических исследований и реформ; доступная публикация: [срез рынка за январь–август 2026 года](https://review.uz/en/post/rnok-jilya-uzbekistana-soxranyaet-vsokuyu-aktivnost). Перед повторным использованием цифр проверить дату, редакцию, единицы и первичную таблицу.

---

# 32. Итоговая модель

```text
Telegram / External Sources
        ↓
Structured Inventory + Demand
        ↓
Entity Resolution + Freshness + Trust
        ↓
Matching + Search + Reverse Matching
        ↓
Client / Partner Action
        ↓
Viewing + Offer + Cooperation
        ↓
Verification + Documents + Deal
        ↓
Closing + Commission + Audit
        ↓
Network Intelligence
```

Итоговая продуктовая формула:

> Binor — Telegram-first профессиональная сеть для риэлторов Ташкента и Узбекистана, которая превращает разрозненные объекты, клиентские запросы и Telegram-объявления в проверяемые совпадения, сотрудничество и сделки.

# 33. Операционная модель продукта

## 33.1. Три уровня зрелости

Binor описан в исходниках сразу на трёх уровнях. Их нельзя смешивать в roadmap, презентации инвестору или сообщениях пользователю.

| Уровень | Что относится | Доказательство/артефакт |
|---|---|---|
| Публично заявленное ядро | Telegram Bot/Mini App, регистрация профессионала, ввод объектов и заказов, автоматическое сопоставление, уведомления, варианты разделения комиссии, «Вкладка ТГ» с заявленными 10 000+ объявлениями из Telegram | Сайт и публичные паспорта S3/S6/S8 |
| Внутренние показатели и описания | 500+ активных пользователей, 10 000+ объектов, 120 сделок, средний чек комиссии $150, retention 75%; оценки доходного микса и тарифы из S4 | Источник S4; в публичном сайте не опубликованы, методики и период расчёта не раскрыты |
| Целевая профессиональная платформа | CRM, verified inventory, агентские команды, глубокая дедупликация, privacy levels, календарь, просмотры, предложения, transaction room, audit, compliance, MLS и аналитика | S1/S2/S5/S9; это продуктовые требования и предложения, не подтверждение production |

## 33.2. Ценность по типам участников

| Участник | Задача | Ценность сегодня/целевая | Риск принятия |
|---|---|---|---|
| Индивидуальный риэлтор | Найти объект под клиента или клиента под объект, не теряя время на ручной мониторинг | Match и Telegram Radar; далее — личный workspace, история контакта, напоминания и прозрачное сотрудничество | Страх раскрыть клиента/собственника; недоверие к точности и актуальности |
| Агентство | Объединить инвентарь и спрос команды, маршрутизировать входящие и отслеживать результат | Team inventory, роли, распределение лидов, SLA, аналитика и внешняя сеть | Сложность миграции из текущей CRM; риск утечки клиентской базы |
| Руководитель/тимлид | Видеть SLA, нагрузку, качество базы и движение сделок | Панель исключений и действий, а не просто отчётные графики | Сотрудники не ведут данные, если обновление не даёт оперативной ценности |
| Внешний партнёр | Получить предложение о co-broker сотрудничестве на заранее понятных условиях | Поэтапное раскрытие данных, запрос сотрудничества, фиксация согласованных условий | Конфликт за клиента/объект, изменение комиссии после передачи контактов |
| Собственник/заказчик | Получать услугу от надлежащего профессионала и понимать статус поручения | В целевой модели — согласия, договор, подтверждение объекта, документированная история | Не подтверждён отдельный B2C-портал; повышенная чувствительность персональных данных |
| Администратор Binor | Обеспечить работу источников, модерации, качества и безопасности | Управляемые очереди, аудит, обратимые блокировки, метрики парсинга | Ошибочная модерация или массовое раскрытие данных имеют системный эффект |
| Застройщик | Распространять остатки новостройки через брокерскую сеть | Отдельная целевая вертикаль: live inventory, резерв, атрибуция лида, доступ партнёров | Нельзя обещать синхронизацию с застройщиком без фактической интеграции/SLA |

## 33.3. Продуктовый контур как система записей

Целевая цепочка спроса:

1. Lead фиксирует первичное обращение и канал.
2. Client объединяет профиль, участников домохозяйства, предпочтения и историю взаимодействий.
3. Requirement представляет конкретный поиск с бюджетом, географией и ограничениями.
4. Match объясняет, почему предложение подходит, что не совпало и насколько свежи данные.
5. Viewing, Offer и Deal фиксируют работу после подбора.

Целевая цепочка предложения:

1. Owner/правообладатель связан с объектом и подтверждением полномочий.
2. Property описывает физическую недвижимость независимо от публикаций.
3. Contract и Consent задают основание и разрешённые цели обработки/представления.
4. Listing описывает конкретное предложение одного агента/организации, цену и условия сотрудничества.
5. Verification содержит проверяемые факты, источники и дату проверки.
6. Cooperation связывает листинг с партнёром; Deal — фактический ход сделки.

Telegram-контур:

1. Telegram Source задаёт публичный канал и правила обработки.
2. Telegram Message сохраняет идентификатор/URL и сырой исходный контент в пределах разрешённого хранения.
3. Parser предлагает нормализованные поля с confidence и происхождением каждого значения.
4. Telegram Listing является обнаруженной публикацией, но не автоматически проверенным объектом.
5. Resolve/Dedup связывает публикацию с возможным Property или существующим Listing; человек разрешает сомнительные совпадения.

# 34. Доменная модель и требования к данным

## 34.1. Общие правила схемы

**[РЕКОМЕНДАЦИЯ]** Для каждой бизнес-сущности хранить неизменяемый внутренний идентификатор, время создания/изменения, создателя, организационный контекст, источник данных, состояние архивирования и версию. Отдельно хранить время события и время его получения: публикация в Telegram может быть старше момента импорта.

Каждое значение, имеющее коммерческую или юридическую значимость, должно по возможности нести provenance: кто его сообщил, из какого документа/сообщения оно извлечено, когда проверено, кем подтверждено, какой метод использовался и можно ли показать основание пользователю. Не перезаписывать спорное значение молча: сохранить конфликт, обе версии, автора и итоговое решение.

Денежные значения хранить как точную десятичную сумму вместе с ISO-кодом валюты и исходной строкой; не использовать плавающую точку. Площадь хранить в канонической единице с сохранением исходного значения/единицы. Телефон нормализовать для поиска, но исходное написание держать отдельно; маскировать при недостаточном уровне доступа. Время хранить в UTC и отображать по Asia/Tashkent.

## 34.2. Словарь сущностей

| Сущность | Канонический смысл | Важные отношения и ограничения |
|---|---|---|
| Person | Человек, независимо от его ролей | Может быть Client, Owner, представитель, пользователь или участник домохозяйства; не создавать копии только из-за разных ролей |
| User | Учётная запись входа/работы в Binor | Имеет статус, язык, Telegram identity, профессиональный статус и членство в организации |
| Organization | Агентство/профессиональная организация | Содержит филиалы, команды, пользователей, права и общие записи; юридический статус не выводить из названия |
| Lead | Первое обращение до квалификации | Содержит источник, received_at, согласие/основание обработки, ответственного, SLA и дедуп-статус |
| Client | Квалифицированный профиль клиента | Связан с Person/Household, ответственным агентом, источником, каналами связи и lifecycle |
| Household / Related Party | Группа связанных участников поиска или сделки | Отдельные согласия и роли; не раскрывать одному участнику данные другого автоматически |
| Requirement | Версионируемый спрос клиента | Может включать исходную фразу, структурированные поля, обязательность полей и альтернативы |
| Owner | Роль правообладателя/контакт собственника | Связь с Person и Property; контакт виден только при наличии прав/согласия |
| Property | Физический объект недвижимости | Может иметь несколько Listing, Advertisement, документов, проверок и исторических записей |
| Listing | Предложение по объекту от конкретной стороны | Имеет владельца записи, организацию, срок актуальности, цену и cooperative terms |
| Advertisement | Публикация Listing на внешнем канале | Хранит площадку, URL/идентификатор, дату публикации и статус синхронизации |
| Telegram Source / Message | Публичный источник и исходный пост | Источник содержит канал и правила ingestion; Message — сырой текст/медиа и URL |
| Telegram Listing | Нормализованная интерпретация объявления | Не получает автоматически статус Verified или Active Property |
| Contract | Договор с заказчиком/собственником/партнёром | Содержит вид услуги, стороны, срок, вознаграждение, версию шаблона, подписи/события |
| Consent | Разрешение на конкретное действие/цель | Субъект, purpose, scope, channel, timestamp, текст/версия, отзыв и источник доказательства |
| Verification | Проверка отдельного утверждения | Тип проверки, объект проверки, метод, источник, полномочия исполнителя, результат и expiry |
| Match | Предложение соответствия между спросом и предложением | Не является обещанием сделки; содержит причины, score, версии входов и статус реакции |
| Cooperation Request | Переговоры между профессионалами | Содержит стороны, Listing/Requirement, split proposal, срок действия и журнал согласования |
| Viewing | Запланированный/прошедший просмотр | Объект, клиенты, участники, адрес с нужным уровнем доступа, время, исход и follow-up |
| Offer | Версия ценового/условного предложения | Сумма, валюта, автор, адресат, срок, состояние принятия/отклонения и журнал версий |
| Deal | Сводный рабочий процесс сделки | Стороны, Property, договоры, checklist, этап, риски, документы, следующий шаг и закрытие |
| Task / Communication | Следующее действие или факт коммуникации | Тип, срок, исполнитель, канал, результат; коммуникация не должна сливаться с юридическим согласием |
| Document | Файл/запись о документе | Класс чувствительности, владелец, связь с сущностью, доступ, срок хранения и audit events |
| Audit Event | История значимого действия | Append-only лог: actor, scope, action, target, time, request/session и причина/основание |

## 34.3. Минимальные атрибуты и валидация

| Контур | Минимум для рабочего процесса | Валидация/примечание |
|---|---|---|
| User | Внутренний ID, Telegram ID при TG-входе, отображаемое имя, телефон при наличии, язык, статус, роль, организация/филиал | Не считать Telegram username проверенной юридической идентичностью |
| Professional Identity | Тип участника, сертификат/номер/срок при наличии, членство, статус страхования, реестровый статус и источник проверки | Различать введённое пользователем и проверенное по реестру |
| Organization | Название, legal form/регистрационные данные если применимо, руководитель, участники, филиалы, страхование и единый реестр | Реестровые поля могут быть неизвестны или не синхронизированы; не создавать фиктивный статус |
| Lead/Client | Телефон/канал, имя при наличии, источник, ответственное лицо, consent basis, дата последнего контакта | Дедуп по нормализованному телефону с осторожностью; семейный общий телефон не означает одного человека |
| Requirement | Цель сделки, тип объекта, локация/районы, бюджет и валюта, rooms/area, must-have, preferences, срок и исходная фраза | Поля могут быть неизвестными; запрос на естественном языке сохраняется дословно |
| Property | Тип, сделка, локация, геокоординаты с уровнем точности, комнаты, площадь, этажность, состояние, цена/валюта, источники | Адрес/точные координаты могут быть Restricted; цена предложения не является ценой закрытой сделки |
| Listing | Property, агент/организация, договор/основание, публикационный статус, цена/условия, visibility, дата подтверждения, истечение, комиссия/правило сотрудничества | Один Property может иметь разные цены/условия у разных листингов; сохранять отдельно |
| Document | Тип, связанная сущность, владелец, доступ, источник, дата загрузки, версия, expiry и audit | Не помещать паспорт/правоустанавливающий документ в общий каталог медиа |
| Match | Requirement/Listing, score, причины совпадения, несовпадения, freshness, текущие версии, статус и notified_at | Score воспроизводим и объясним; изменение входа может инвалидировать/пересчитать Match |
| Deal | Объект/стороны/ответственный, этап, следующий шаг, срок, договоры, просмотр/offer, условия комиссии и закрывающие документы | Не считать закрытой сделку без однозначного события и роли, которая его зафиксировала |

## 34.4. Разделение Property, Listing и Advertisement

| Пример | Property | Listing | Advertisement |
|---|---|---|---|
| Квартира продаётся у двух агентств | Одна запись физической квартиры | Две записи предложений от двух агентств, каждая со своими контактами, ценой и сроком | Два или больше размещения на Telegram/OLX/сайте |
| Цена изменилась у агента A | Не обязательно меняется физический объект | Новая версия цены Listing A с автором и временем | Публикация A может обновиться или потребовать нового размещения |
| Telegram-пост содержит похожую квартиру | Создание Property не автоматическое | До проверки — candidate Listing | Telegram Message остаётся исходной публикацией |
| Собственник снял предложение | Property может оставаться в базе как объект | Конкретный Listing переводится в Withdrawn/Expired | Публикации снимаются/помечаются, насколько позволяют интеграции |

## 34.5. Provenance, dedup и конфликты

**Иерархия источника факта** из S5 является рабочей рекомендацией, а не юридическим правилом:

1. Подтверждённый государственный источник через разрешённый договорный процесс.
2. Документ, проверенный уполномоченным участником и связанный с audit record.
3. Подтверждение собственника/правообладателя с журналом события.
4. Агентская карточка с подтверждённым автором и активным основанием.
5. Исходная публикация на внешней площадке или Telegram.
6. Непроверенный импорт/AI extraction/ручное сообщение.

Присвоение более высокой позиции не означает, что нижний источник уничтожается. Для конфликтов сохраняются все утверждения, и UI показывает: какие значения расходятся, кто/когда их сообщил и какое из них использовано для поиска.

Дедуп должен использовать несколько независимых сигналов: нормализованный телефон/контакт, адрес/гео, тип и параметры объекта, цена и валюта, текстовая похожесть, хэш/перцептивный хэш изображений, канал/автор и временной интервал. Совпадение телефонов или фото само по себе недостаточно для автоматического merge. Автоматическое объединение разрешено только при измеренной высокой precision; сомнительные пары идут в очередь Resolve. Отмена ошибочного объединения должна быть поддержана и аудироваться.

## 34.6. Свежесть данных и качество

**[РЕКОМЕНДАЦИЯ]** Свежесть хранится отдельно для разных фактов: актуальность предложения, цена, доступность просмотра, контакт собственника и результат юридической проверки имеют разные сроки действия.

| Сигнал | Пример поведения |
|---|---|
| Last confirmed | Кто и когда лично/по допустимому каналу подтвердил доступность |
| Source age | Сколько времени прошло с исходной публикации |
| Price age | Когда цена в последний раз подтверждена |
| Verification age | Когда и кем проверялся отдельный факт/документ |
| Conflict state | Есть ли нерешённые противоречия в цене, адресе, статусе или владельце |
| Freshness state | Fresh, Needs confirmation, Stale, Expired; конкретные пороги настраиваются и тестируются |

Система не должна показывать старый объект просто как Active без визуального предупреждения. Переход в Stale не стирает историю и сам по себе не утверждает, что объект продан.

# 35. Подробные пользовательские процессы

## 35.1. Единый шаблон workflow

Для каждого процесса продуктовая спецификация должна фиксировать: инициатора, предусловия, успешный путь, развилки, отказ/ошибку, права и видимость, уведомления, audit-события, восстановление и критерии завершения. Перечисленные ниже сценарии являются целевыми требованиями S1/S2/S5; фактическое покрытие действующего Mini App не исследовано.

## 35.2. Матрица end-to-end сценариев

| № | Сценарий/триггер | Успешный результат | Обязательные контроли и исключения |
|---|---|---|---|
| 1 | Новый входящий звонок/лид | Lead сохранён, найден/создан Client, назначен ответственный и следующий шаг | Разрешить дубликат-кандидат; не перезаписывать источник/историю; показать SLA |
| 2 | Новый лид из Telegram | Пересланный контент преобразован в черновик и связан с человеком/задачей | Редактируемое AI-извлечение; неизвестные поля не выдумывать; показать исходный пост |
| 3 | Новый собственник | Созданы Owner/Person, Property candidate, контакт и основание работы | Согласие/договор отдельно от простого импорта; ограничить раскрытие контакта |
| 4 | Покупатель/арендатор ищет объект | Созданы Client и структурированный Requirement | Сохранить исходную формулировку; уточнять неоднозначные бюджет/валюту/район |
| 5 | Соединение с партнёром (MLS) | Создан Cooperation Request с видимыми условиями до передачи чувствительных данных | Оба участника, владение лидами/объектом, expiry, аудит, отклонение и спор |
| 6 | TG Radar | Найдены релевантные посты с переходом к оригиналу и возможностью сохранить | Источник и время; dedup; жалоба/неактуально; лимиты и право обработки |
| 7 | Снижение цены | Историческая цена зафиксирована, поиск/подписчики пересчитаны и уведомлены по настройкам | Не спамить; не путать изменение текста в посте с подтверждённой ценой |
| 8 | Истечение договора/срока публикации | Ответственный получает задачу продлить, закрыть или приостановить Listing | Уведомление до и после дедлайна; безопасное поведение при отсутствии ответа |
| 9 | Просмотр | Согласованы дата/место/участники; результат и follow-up сохранены | Адрес показывать по правам; перенос/отмена и уведомления всем участникам |
| 10 | Переговоры по Offer | Каждая версия цены/условий имеет автора, время, expiry и решение сторон | Историю не переписывать; принятие требует явного действия |
| 11 | Закрытие сделки | Deal закрыта с подтверждённым результатом, расчётом согласованных условий и archive trail | Развести gross fee, доли сторон, выплаты и комиссию Binor; не считать начисленное выплаченным |
| 12 | Дубликат | Пользователь/модератор связывает или объединяет candidate records | Показать причину сходства; сохранить канонический ID и обратимость |
| 13 | Конфликт данных | Две версии сохранены; ответственному предложено разрешение конфликта | Не выбирать молча; записать решение, основание и автора |

## 35.3. Детальный поток: входящий Lead

1. **Вход:** ручное создание, звонок, Telegram, сайт, внешний marketplace или импорт. Source обязателен; неизвестный источник допустим как Unknown.
2. **Первичная фиксация:** дата получения, исходный контакт/сообщение, краткая причина обращения, язык и согласие/законное основание там, где применимо.
3. **Проверка дубля:** предложить существующие карточки по телефону, Telegram ID, имени и совпадающему контексту. Пользователь решает Link, Merge или Create separately.
4. **Назначение:** применить конфигурируемые правила распределения агенту/команде; ручное назначение не терять.
5. **SLA:** вычислить срок первого ответа по настройке организации и календарю; при пропуске — эскалация согласно роли.
6. **Квалификация:** превратить Lead в Client и/или Requirement, не удаляя исходный Lead.
7. **Следующее действие:** обязательная task/next step при квалифицированном лиде; напоминание может быть отложено с указанием причины.
8. **Закрытие:** Lost/Deferred требует причины или даты возврата; отчёт считает отдельными событиями получение, назначение, первый ответ и квалификацию.

## 35.4. Детальный поток: Buyer Request → Match → shortlist

1. Агент вводит свободный текст или поля формы. Система разбирает предложение в draft, показывает extracted values и confidence.
2. Пользователь подтверждает критичные для поиска поля: продажа/аренда, тип объекта, валюта и диапазон бюджета, локация, площадь/комнаты.
3. Поля делятся на hard constraints и preferences; пользователь видит и может поменять обязательность.
4. Matching выполняется по внутренним Listing и, отдельно, внешним Telegram Listings. Источники помечаются разными badges.
5. Карточка Match содержит причины: совпавшие поля, компромиссы, свежесть, источник и missing data. Score не заменяет объяснение.
6. Shortlist сортируется по релевантности с доступным переключением на свежесть/цену/расстояние.
7. Агент отправляет клиенту один/несколько вариантов через выбранный разрешённый канал, фиксирует sent_at и ответ.
8. Отклонение сохраняет reason (цена, район, состояние, устарело, другое) и, с согласия пользователя, улучшает предпочтения.
9. Изменение требования или закрытие объекта пересчитывает активные Match и уведомления с дедупликацией.

## 35.5. Детальный поток: Telegram Listing Copilot

1. Пользователь пересылает пост, ссылку, текст или фото в бот/форму.
2. Ingestion создаёт source event с channel/message ID, original URL, posted_at (если доступно), received_at и media refs.
3. Parser создаёт draft: тип сделки/объекта, район, комнаты, площадь, этаж, цена, валюта, контакт, описание и confidence для каждого поля.
4. Критически неопределённые значения отмечаются как Unknown; валюту/этаж/площадь нельзя молча угадывать.
5. Система показывает duplicate candidates с причинами и позволяет создать новый listing, связать с существующим или оставить необработанным.
6. При сохранении создаётся TG Listing либо Listing draft; физический Property создаётся только после достаточного основания/проверки.
7. Пользователь выбирает: сохранить, связать с Requirement, проверить актуальность, отправить клиенту, пожаловаться на неверные данные.
8. Изменения исходного поста, удаление или жалоба обрабатываются согласно политике хранения и правам источника.
9. Monitoring dashboard отслеживает ingestion failures, parsing precision, новые типы шаблонов, задержку и источник.

## 35.6. Детальный поток: межагентское сотрудничество

1. До запроса показываются авторство Listing, статус активности, уровень проверки, базовые условия и доступный объём данных.
2. Инициатор выбирает роль своей стороны (владелец Listing, агент клиента, направляющий партнёр и т. п.), формулу и базу расчёта.
3. Формула содержит проценты/суммы, получателей, базу (gross commission или иная согласованная сумма), валюту, условия выплаты и крайний срок. Нельзя ограничиться одной надписью «70/30».
4. Получатель может принять, отклонить или предложить изменение; каждое предложение — новая версия.
5. До принятия условия чувствительные контакты могут быть маскированы; конкретный этап раскрытия настраивается правилами и согласием.
6. После принятия система создаёт cooperation agreement/event record. Юридическая обязательность определяется отдельной формой и применимым договором, а не самим UI.
7. Показы, offers, deal outcome и фактическая выплата записываются раздельно.
8. Спор открывает workflow с приложением событий/документов; Binor не объявляет себя арбитром без отдельной роли и правового основания.

## 35.7. Детальный поток: проверка и закрытие

1. Проверка начинается только после выбора типа, цели и субъекта запроса; UI сообщает требуемые полномочия и документы.
2. Система собирает checklist, согласия, договор, необходимые сведения и версию шаблона.
3. Пользователь вручную отмечает выполненную проверку либо запускает разрешённый integration adapter; каждый результат имеет источник, timestamp и срок актуальности.
4. Недоступность реестра не преобразуется в «проверено»; показывается Pending/Unavailable.
5. Deal room объединяет стороны, Property, текущие terms, viewing, offers, documents, checklist, риски и next action.
6. Closing требует явного outcome, даты и исполнителя; факт завершения не выводится из бездействия.
7. Completion act и сведения, которые должны поступить в MLS, готовятся по требованиям закона/стандарта; событие отправки и квитанция/ошибка фиксируются.
8. Архив сохраняет доказуемую последовательность действий и применённые сроки хранения; удаление чувствительных данных выполняется политикой retention и legal hold.

# 36. UX и экранные требования

## 36.1. Глобальные принципы взаимодействия

- **Mobile-first и one-thumb:** основные действия доступны в нижней зоне; плотные списки имеют устойчивые высоты строк и быстрые фильтры.
- **Action-oriented:** главный экран отвечает «что требует внимания и что сделать следующим», а не просто показывает статические KPI.
- **Progressive disclosure:** сначала показываются критичные для решения поля, затем детали, история и юридические материалы.
- **Минимум ручного ввода:** пересылка контента, OCR/NLP, быстрый ввод и smart defaults; AI-поля остаются редактируемыми.
- **Стабильность и ясность:** loading/empty/error/offline/permission/duplicate/conflict states проектируются для каждого ключевого workflow.
- **RU/UZ parity:** одинаковая функциональность на русском и узбекском; хранить locale независимо от URL при Telegram-входе, но публичный SEO-контент требует отдельной локализованной структуры.
- **Доступность:** контраст, масштабируемый текст, состояния не только цветом, подписи controls, клавиатурная навигация для web и доступные touch targets.

## 36.2. Навигация и рабочее место

Целевая нижняя навигация из S1/S2: **Сегодня**, **CRM**, **Объекты**, **Совпадения/MLS**, **Профиль/Ещё**. Названия и состав — продуктовая гипотеза, которую следует проверить на частоте ежедневных задач.

Home / Today Workspace включает:

- имя/организация/язык и global search;
- очередь задач на сегодня, просроченные действия и SLA;
- быстрые действия: Lead, Client, Requirement, Property, звонок, просмотр;
- новые matches с причиной и свежестью;
- последние входящие и назначенные лиды;
- сделки, которым требуется действие;
- события команды только в пределах прав.

Каждый блок должен вести к списку с уже применённым фильтром. Пользователь может скрыть или изменить порядок блоков, но не критичные предупреждения о доступе/сроке.

## 36.3. P0 экранные спецификации

| Экран | Обязательные данные | Основные действия | Ошибки/пустые состояния |
|---|---|---|---|
| Lead Inbox | Контакт, канал/источник, получен, ответственный, статус, SLA, duplicate hint, следующий шаг | Открыть, назначить, связать с Client, квалифицировать, отложить/закрыть с причиной | Нет лидов: начать импорт/добавление; нет доступа: объяснить владельца/роль; дубль: Link/Merge/Create |
| Client Profile | Контакты и consent, ответственный, timeline, Requirements, показы/offers/deals, заметки и связанные лица | Позвонить/написать, создать Requirement/task, сменить ответственного, объединить записи | Частично заполненный профиль должен явно маркировать Unknown; Restricted поля маскировать |
| Requirement Editor | Тип сделки/объекта, география, бюджет и валюта, rooms/area, must-have, preferences, срок и исходная фраза | Сохранить, найти варианты, pause/close, duplicate request | Показывать незаполненные критерии и влияние на качество поиска; не блокировать необязательными полями |
| Property Search / Map | Тип/цена/статус/freshness/verification, район, видимость списка/карты, фильтры и сохранённый поиск | Открыть, сохранить фильтр, выбрать на карте, reverse match, сообщить о дубле | Нет результатов: показать снятие фильтров; ошибки гео — предоставить list view |
| Property / Listing Detail | Разделённые карточки физического объекта и конкретного предложения, цена/история, источник, владелец, freshness, договор, verification, доступность | Подтвердить актуальность, изменить/архивировать Listing, открыть документы по правам, запросить cooperation | Конфликтующие значения не скрывать; Restricted поля объясняют запрос доступа |
| Match Card | Score/band, совпавшие и не совпавшие параметры, источник, дата, свежесть, контактный уровень | Открыть, принять/отклонить с reason, сохранить, отправить клиенту, начать cooperation | Stale/expired match не выглядит активным; уведомления можно настроить |
| Telegram Radar | Текст/фото, источник и время поста, extracted fields/confidence, duplicate hints, ссылка на оригинал | Фильтровать, сохранить, связать с клиентом, создать draft listing, открыть пост, пожаловаться | Parser failure не теряет исходный пост; неизвестные каналы помечаются |
| Cooperation Workspace | Участники, роли, автор записи, terms/split, этап, timeline, контакты по access | Отправить, принять/изменить/отклонить, запланировать viewing, открыть dispute | Условия не исчезают после принятия; новая версия сохраняет прежнюю |
| Viewing Calendar | Дата/время/часовой пояс, объект, участники, место с правами, статус и результат | Создать, перенести, отменить, отметить outcome, создать follow-up | Конфликт расписания, недоступный адрес, отмена — уведомить участников |
| Deal Workspace | Этап, стороны, объект, цена и версии offer, договор/verification checklist, документы, next action, terms | Продвинуть этап, приложить документ, зафиксировать outcome/платёж, сформировать акт | Переход с missing prerequisite показывает конкретное условие, доступную альтернативу и аудит |

## 36.4. Поиск, карта и фильтры

Общий поиск должен находить по людям, телефонам, ID/адресам, объектам, клиентским потребностям, Telegram-постам и сделкам с соблюдением access control до выдачи результатов. Для геопоиска поддержать город/район/микрорайон, список и карту, radius и polygon selection. Геокоординаты показываются с точностью, соответствующей confidentiality level.

Фильтры не смешивают бизнес-статус с качеством данных: Active, Freshness, Verification, source, deal type, property type, price range/currency, district, rooms, area, agent/agency и cooperation terms — отдельные измерения. Сохранённый поиск версионируется; push/email/Telegram-оповещения имеют частоту, quiet hours и порог совпадений.

## 36.5. Уведомления, команда и коммуникации

Центр уведомлений группирует items по смыслу: **нужно действие**, **клиенты**, **совпадения/MLS**, **сделки**, **системные события**. В карточке видны причина, срок, сущность, действие и возможность отложить/отписаться; системные/security-события нельзя выключить там, где они обязательны.

Командное распределение включает правила по району/языку/специализации, ручное назначение, очередь, round-robin как опцию, capacity и отсутствие сотрудника. Изменение владельца клиента/объекта сопровождается reason и audit event; исходный автор записи сохраняется.

Звонки могут создавать follow-up и timeline event, но не должны автоматически записывать разговор без отдельного согласия и правового основания. Для коммуникации хранить канал, время, участников, краткий итог, next step и ссылку на оригинал, если допустимо.

## 36.6. Состояния и microcopy

Для каждого критичного экрана обязательны:

- **Loading:** skeleton стабильных размеров, отдельно initial load и refresh.
- **Empty:** причина отсутствия данных и конкретное первичное действие.
- **Error:** понятная проблема, retry, сохранение уже введённого.
- **Offline/poor network:** локальный черновик, очередь синхронизации, метка Pending; не показывать неподтверждённую операцию как завершённую.
- **Permission denied:** какое действие недоступно, кому запросить доступ и какой безопасный шаг разрешён.
- **Conflict/duplicate:** сравнение полей, источник каждой версии, варианты решения и отмена ошибочного действия.
- **Stale:** дата последнего подтверждения и команда обновить статус; не трактовать молчание как подтверждение.
- **Destructive action:** явное название последствий, затрагиваемые записи, право отмены/срок восстановления.

# 37. Рынок, сегменты и конкурентная среда

## 37.1. Рыночный snapshot из S9

Показатели ниже — исторический срез исследования S9 и не постоянные параметры продукта.

| Показатель | Значение из S9 | Период/оговорка |
|---|---:|---|
| Жилищные сделки купли-продажи | 222,5 тыс. | Январь–август 2026; +18,4% год к году |
| Сделки в августе | 25,1 тыс. | 2026; +0,2% к августу прошлого года |
| Рост сделок в Ташкенте | +27,5% | Январь–август 2026 |
| Рост в Сырдарьинской области | +25,4% | Январь–август 2026 |
| Рост в Андижанской области | +23,8% | Январь–август 2026 |
| Сделки за I квартал | 110,1 тыс. | +48,4% год к году; Central Bank Q1 2026 |
| Ипотечные кредиты за I квартал | 5,7 трлн сумов | +29% год к году; Central Bank Q1 2026 |
| Введённая площадь жилья за I квартал | 3,3 млн м² | +6,6% год к году; Central Bank Q1 2026 |
| Цены в марте 2026, первичный рынок | +8,1% USD; +1,8% UZS | Год к году, значения из обзора ЦБ |
| Цены в марте 2026, вторичный рынок | +9,4% USD; +3,0% UZS | Год к году, значения из обзора ЦБ |
| Ввод жилья за 2025 год | 15,9 млн м² | Республика; показатель относится к предложению, не к продажам |
| Формальный сектор | 285 организаций, 684 риэлтора | Числа S9; ориентир формального сегмента, не полный TAM |
| Объём услуг риэлторов | 50 млрд сумов | 2024, по сообщению, цитируемому S9 |
| Выявленные неформальные посредники | 108 человек, около 19 тыс. сделок/3,9 трлн сумов | Не полный размер теневого рынка; только выявленная выборка |

Отдельная методологическая оговорка: статистика сделок — это сделки по жилью, не число уникальных покупателей, брокерских услуг, профессиональных сделок или доступных подписчиков. Рост объёма сделок не переводится напрямую в потенциальную выручку SaaS.

## 37.2. Beachhead и региональная стратегия

**[РЕКОМЕНДАЦИЯ S9]** Ташкент — стартовый B2B-beachhead из-за концентрации агентств, сделок, новостроек и цифровой активности. Это не означает, что остальные регионы не важны: S9 отмечает заметную Telegram-инфраструктуру в Андижане, Намангане и других городах.

| Параметр | Ташкент | Регионы |
|---|---|---|
| Первое предложение | Import/cleanup базы, быстрый matching, командная работа, co-broker | Простое mobile intake, Uzbek-first, доверие и локальные источники |
| GTM | Пилоты с 8–12 агентствами по 5–30 агентов как предложение S9 | Партнёрства с администраторами локальных Telegram-сообществ и агентствами |
| Монетизация-гипотеза | Per-seat Pro, agency plan, compliance add-on | Freemium/низкий Pro/usage при проверенном value |
| Критический сигнал | Активные объекты + поведение команды + закрываемые сделки | Плотность локальных объектов и реальный матчинг в пределах города |

## 37.3. Конкуренты и позиционирование

| Игрок/категория | Сильная сторона из S9 | Различимое пространство для Binor | Ограничение сравнения |
|---|---|---|---|
| OLX.uz | Классифайд-трафик, продвижение и профессиональные пакеты публикации | Verified workflow, совместное сотрудничество, работа с buyer request и сделкой | Нельзя строить зависимость от непроверенного scraping/API |
| Uybor / Domtut | Поиск объявлений, карты, агентские профили/new-build inventory | Профессиональный системный слой и workflow MLS | Функциональность конкурентов динамична, сверять при GTM |
| Realting / RPT | Каталог, developer ecosystem, referral/CRM-related tooling | Telegram-first intake, локальные compliance/data processes | География/пакеты продуктов различаются |
| REDREAM | Локальная AI-ориентация, данные, valuation и правовые ответы | История проверок, инвентарь, доверие и transaction graph | Не заявлять уникальность AI как moat |
| Innosoft Systems | CRM/catalog, viewing calendar, live developer inventory, документы, комиссии | Мультитенантная сеть и совместимый verified inventory | Конкретные возможности указаны в S9; подтверждать конкурентным discovery |
| amoCRM | Зрелая generic CRM, pipeline, коммуникации, API/AI | Realtor-specific Property/Listing/MLS/legal workflow | Цены и feature set из S9 относятся к исследовательскому срезу |
| Bitrix24 | Универсальная CRM/командная инфраструктура | Вертикальная модель и быстрый mobile workflow | Выбор клиента может зависеть от существующего корпоративного стека |
| Follow Up Boss / Propertybase | Международный опыт real-estate CRM | RU/UZ, локальные источники, право, рынок и Telegram workflow | Не сравнивать без актуального продуктового бенчмарка |

Конкурентный тезис: не пытаться победить портал по consumer traffic или generic CRM по широте. Дифференциация должна строиться вокруг графа доверия и операций: Property ↔ Owner ↔ Listing ↔ Agent ↔ Requirement ↔ Viewing ↔ Deal ↔ Verification/History.

## 37.4. Сценарии TAM из S9

Это расчётные ceilings, а не validated TAM/SAM/SOM.

| Сценарий | Формула S9 | Результат | Что не учитывать повторно |
|---|---|---:|---|
| Подписка официальных риэлторов | 684 × 180 000 сум × 12 | ≈1,48 млрд сум/год | Агентства частично включают этих же специалистов |
| Подписка официальных организаций | 285 × 1 000 000 сум × 12 | ≈3,42 млрд сум/год | Не складывать с риэлторским сценарием |
| Проверка каждой сделки, потолок | 222,5 тыс. за 8 мес., annualized ≈333,8 тыс. × 50 000 сум | ≈16,7 млрд сум/год | 100% attach неправдоподобен и annualization предполагает неизменный темп |
| Проверка при 10% penetration | ≈33,4 тыс. × 50 000 сум | ≈1,67 млрд сум/год | Не сумма подписочной выручки; условная attach rate |
| Developer module | 20 клиентов × 8 млн сум MRR | 160 млн сум MRR / 1,92 млрд ARR | Иллюстрация чувствительности, не количество найденных девелоперов |

Условные 3–6% software-spend от 50 млрд сум услуг формального рынка, приведённые S9, дают 1,5–3 млрд сум в год, но сам процент — допущение автора. Число 31 тыс. предприятий строительства не использовать как количество потенциальных жилых девелоперов: категория включает подрядчиков и другие организации.

## 37.5. Прайсинг и экономика

| Пакет/модель | Цена из S9 | Статус | Проверяемая ценность |
|---|---:|---|---|
| Free Agent | 0; лимит до 20 объектов описан в предложении | Гипотеза | Быстрое получение первого импорта/совпадения, органическое привлечение |
| Agent Pro | 149 тыс. сум/мес. | Гипотеза | Безлимитный инвентарь, dedup, matching, reminders, publisher |
| Agent Pro+ | 249 тыс. сум/мес. | Гипотеза | Verification, аналитика, price history, co-broker |
| Agency | 790 тыс.–1,5 млн сум/мес. | Гипотеза | Team inventory, lead ownership, роли и аналитика |
| Agency Compliance | 1,5–3 млн сум/мес. | Гипотеза | Договоры, compliance room, audit и registry workflow |
| Проверка объекта/deal packet | 30–150 тыс. сум | Гипотеза | Дополнительный revenue, если проверка юридически и операционно поддержана |
| Developer | 5–15 млн сум за проект/мес. | Гипотеза | Live inventory, broker access, reservation/attribution |
| Enterprise/API | Custom | Гипотеза | Интеграции, white-label, SSO, data feeds |

S9 использует для comparison S4/market research с amoCRM 79/179/259 тыс. сумов за seat/month и OLX пакетом 4 объявления за 64 тыс. сумов и Premium на 1000 размещений за 12,99 млн сумов/30 дней (срез цен, указанный источником на сентябрь 2026). Это показывает потенциальный бюджет, но не доказывает willingness-to-pay за Binor.

# 38. Правовая и MLS-модель

## 38.1. Статус регулирования на дату среза

**[ПРАВО]** Закон Республики Узбекистан № ЗРУ-1163 принят 7 августа 2026 года; на дату документа 30 сентября 2026 года LexUZ указывает вступление в силу 8 ноября 2026 года. Закон предусматривает Единый реестр, новые определения профессиональных участников, риэлторский запрос, договоры и частные MLS. Требования к MLS и качество соответствующего API нельзя считать полностью определёнными, пока не опубликован/не изучен применимый национальный стандарт и сопутствующие акты.

## 38.2. Участники: не объединять юридические роли

| Роль | Опорное положение из S9/LexUZ | Продуктовое следствие |
|---|---|---|
| Риэлтор | Физическое лицо с квалификационным сертификатом; оказывает услуги в составе одной риэлторской организации | В профиле хранить сертификат/срок/организацию и источник статуса |
| Риэлторская организация | Включается в Единый реестр; руководитель имеет сертификат; минимум два сертифицированных работника; руководитель работает в ней как на основном месте; страхование гражданской ответственности; по определению закона — членство в профессиональном объединении | Профиль организации, сотрудники/роли, insurance/registry status, документы и reminders |
| Агент по недвижимости | Самозанятый или индивидуальный предприниматель, включённый в Единый реестр и имеющий страхование; отдельный правовой статус, не эквивалентен сертифицированному риэлтору. По статьям 25–26 может оказывать информационные, консультационные и рекламные услуги; посредничество при заключении сделок относится к риэлторской организации. Не может быть непосредственной стороной сделки, кроме собственных нужд | Отдельный тип участника и capability matrix; не выдавать агенту все права организации |
| Профессиональное объединение | Профессиональная организация со стандартами/реестром членов и ролью в профессиональной инфраструктуре | Возможный партнёр и участник процесса стандартизации; Binor не подменяет полномочия объединения |
| Оператор Binor/MLS | Статус и обязанности оператора в исходниках не подтверждены | Отдельное юридическое заключение о границе SaaS, marketplace, информационной услуги и MLS-оператора |

Внутри UI надпись «проверен» должна описывать строго один проверенный факт. Нельзя объединять в один badge проверку личности, сертификата, участия организации в реестре, страхования, полномочия собственника, наличие договора и юридическую чистоту объекта.

## 38.3. MLS по статье 30

В исследовании S0 и тексте LexUZ MLS описана как система частного сектора, обеспечивающая электронный сбор/хранение/обмен достоверной информацией по принципу «единого окна» в режиме реального времени и работу по срочным договорам в формулировке русской версии LexUZ. Общие и специальные требования должны определяться национальным стандартом, разрабатываемым уполномоченным органом совместно с профессиональными объединениями. Интеграция с государственными системами строится на договорной основе.

Отсюда следуют продуктовые выводы:

- Закон не означает автоматического права платформы на любой государственный API или bulk access.
- «Реальное время» в законе не даёт числового SLA для API; SLA, доступность, retry и freshness должны быть определены стандартом/договором.
- Закон не доказывает обязательную монопольную MLS или конкретную архитектуру федерации нескольких платформ.
- MVP должен давать ценность без госинтеграции; интеграцию вводить через отдельные адаптеры после договора, разрешений и согласования схемы.
- Не кодировать предполагаемую национальную схему как единственную внутреннюю модель: использовать versioned mappings и audit.

## 38.4. Риэлторский запрос и границы доступа

S0/S9 описывают запрос как письменное или электронное обращение риэлторской организации/агента к государственному органу или другой организации для получения сведений, необходимых по договору с клиентом; отправка может проходить через MLS. Запрос должен быть связан с конкретным заказчиком, предметом услуги и требуемым объектом; приложениями могут быть договор оказания услуг и документы о правах/полномочиях.

По статье 31 государственные органы и организации самостоятельно проверяют включение организации/агента в Единый реестр. Это отдельная проверка полномочий участника, а не первый пункт перечня сведений статьи 32. Перечень статьи 32 начинается со сведений из государственного реестра юридических лиц, затем идут сведения из государственного реестра прав на недвижимость и связанных открытых баз. Закон отдельно ограничивает выдачу агенту сведениями из этих первых двух пунктов.

| Информационный блок | Пример сведений в материалах | Ограничение реализации |
|---|---|---|
| Реестр юридических лиц | Данные о компании-стороне | Доступ по законному процессу; не считать любой поиск открытым |
| Государственный реестр прав на недвижимость | Зарегистрированные права, открытые базы и сведения о регистрации договоров долевого строительства | Объём зависит от роли, договора, цели и ответа органа |
| Налоговые органы | Задолженность по объекту/сделке | Более широкий перечень по статье 32; проверять полномочия участника |
| Органы внутренних дел | Регистрация граждан по адресу | Высокочувствительные персональные данные; purpose limitation и отдельные права |
| Нотариат | Запрет отчуждения, арест и предусмотренные сведения о долевом строительстве | Фиксировать время ответа; отсутствие данных не означает отсутствие ограничений |
| Коммунальные организации/управление домом | Задолженность за коммунальные услуги и общедомовые платежи | Интеграция, договор и набор полей требуют подтверждения |
| Прочие указанные в правовом исследовании госисточники | Сведения, предусмотренные законом для отдельных категорий правообладателей, а также данные ЗАГС | Не реализовывать запрос без проверки категории доступа и основания |

В S0/S9 и статье 32 отмечено, что доступ агента по недвижимости уже, чем у риэлторской организации: только сведения из реестра юридических лиц и реестра прав на недвижимость/связанных открытых баз. Конкретную матрицу доступа нужно закрепить по статьям 31–33, официальному тексту и стандартам; UI/API обязаны учитывать роль участника до отправки запроса и до выдачи результата. Государственный отказ или недоступность должны оставаться явным результатом, а не превращаться в зелёный badge.

## 38.5. Договоры, акты и compliance

**[ПРАВО/по S0 и S9]** Материалы указывают, что договор риэлторских услуг допускается в письменной или электронной форме и должен фиксировать, среди прочего:

- вид услуги и описание поручения;
- сведения о квалификационном сертификате/членстве/страховании, если применимо;
- стороны, права и обязанности;
- срок оказания услуги;
- размер, порядок и срок выплаты вознаграждения;
- ответственность, расторжение и возврат средств;
- условия обработки конфиденциальных сведений и документов.

Перечень нужно финально сверить с применимой формой договора и текстом статьи 35 перед выпуском шаблона. Нельзя считать простое нажатие кнопки эквивалентом квалифицированной электронной подписи, если способ не прошёл юридическую проверку.

По статье 37 договор на услуги по объекту нельзя заключать без согласия лиц, имеющих права на этот объект. В продукте нужно хранить перечень правообладателей/представителей, основание полномочий и отдельное доказательство согласия; согласие одного участника не считать согласием остальных.

Документ, подтверждающий исполнение договора, — подписанный акт или иной предусмотренный документ. По статье 36 его подписывают руководитель риэлторской организации либо агент и заказчик; относящиеся к услуге документы передаются заказчику. Если услуга оказывалась через MLS, сведения из акта должны быть внесены в систему не позднее трёх рабочих дней. Нужны reminders, overdue queue, подтверждение отправки/сохранения и exception с reason.

Закон требует соблюдения AML/CFT применимыми профессиональными участниками. Платформа должна предоставить configurable checklist, restricted access, audit, удержание истории и экспорт доказательств, но конкретное обязательство, набор процедур, срок хранения и признаки риска определяются юристом/compliance owner, а не AI.

## 38.6. Персональные данные и конфиденциальность

S0/S9 требуют privacy-by-design и ссылаются на изменения режима персональных данных 2026 года. Архитектурный вывод: место размещения данных и трансграничная обработка проверяются по категории данных и применимому закону; универсальное утверждение «всё можно хранить за рубежом» или «всё обязано быть локально» не использовать.

Обязательные продуктовые меры:

1. Data inventory: тип данных, субъект, цель, источник, владелец и срок хранения.
2. Consent/contract registry: текст и версия, канал, timestamp, область разрешения, отзыв.
3. Access by organization, role, record ownership, purpose and sensitivity; минимум привилегий.
4. Раздельное хранение обычного листинга и sensitive документов/контактов.
5. Encryption in transit and at rest; ключи/секреты не хранить в коде; резервное копирование и восстановление.
6. Экспорт, исправление и удаление по применимым требованиям с сохранением legal hold, если он обязателен.
7. Audit просмотра/экспорта sensitive данных, смены прав, раскрытия контакта и выдачи документа.
8. Incident response: классификация, локализация, уведомления и восстановление.

## 38.7. Международная практика MLS: что переносить, а что нет

S0 описывает американские, европейские и региональные модели как примеры закрытого профессионального обмена, кооперации, стандартизированных данных и локальных правил доступа. Полезно переносить принципы: единая схема, статус авторства, права на публикацию, сроки актуальности, кооперация, дисциплина качества и аудит.

Не следует механически переносить эксклюзивный листинг, размер commission offer, обязательное членство, национальную федеративную топологию или иностранные API: закон и рынок Узбекистана задают свои роли, договорные основания и будущий национальный стандарт. Любой международный пример в S0 — comparator, не правовое предписание Binor.

# 39. Техническая модель, API и нефункциональные требования

## 39.1. Границы между наблюдаемым стеком и предложением

| Компонент | Статус по корпусу |
|---|---|
| Публичный сайт | S3/S8 сообщают наблюдаемый Next.js App Router/React, Tailwind, Inter и Lucide; это стек сайта, не Mini App/backend |
| Telegram Mini App/бот | Публично заявленный интерфейс и точка входа |
| Backend, БД, matching services | Production stack не подтверждён |
| React/Vue, Django/Node, PostgreSQL/Mongo, Scrapy и т. п. | В S4 явно предположительный стек; не выдавать за фактическую архитектуру |
| PostgreSQL/PostGIS, очередь, Redis, поисковый индекс | В S5/S0 — варианты рекомендуемой архитектуры |

## 39.2. Рекомендуемая логическая архитектура

1. **Client surfaces:** Telegram Bot/Mini App, responsive web workspace и admin.
2. **Identity/API gateway:** сессии, Telegram login validation, организация, роли, rate limit.
3. **Domain services:** identity, CRM, inventory, matching, cooperation/deals, documents/verification, notification, analytics.
4. **Operational data:** реляционное хранилище с транзакционными связями; геопространственные индексы для карты; object storage для media/documents.
5. **Async processing:** queue/workers для parsing, matching, imports, notifications, expiry/freshness и integration sync.
6. **Search:** полнотекстовый + структурированные фильтры + геопоиск; search index является проекцией, не единственным источником истины.
7. **Adapters:** Telegram, marketplace, CRM, MLS/government; каждый со своим consent, credentials, contract scope, retry и observability.
8. **Admin/control plane:** управление источниками, модерации, dictionaries, feature flags, incidents, integration health и access audits.

Начинать допустимо с модульного монолита и изолированных очередей; делить на микросервисы только при измеренной потребности масштабирования/ownership. Обязательны единый audit contract, versioned schema и идемпотентная обработка событий.

## 39.3. API-контракты и минимальные операции

| Домен | Примеры capability | Требования к контракту |
|---|---|---|
| Auth/Identity | login, session refresh, Telegram init validation, profile | Validate подписи Telegram на сервере; revoke; device/session audit |
| Organizations | organizations, branches, memberships, roles, invitations | Tenant isolation, membership state, scoped permissions |
| CRM | leads, clients, related parties, assignment | Idempotency keys на импорте; duplicate candidates; audit |
| Requirements | CRUD, pause/close, natural-language parse | Сохранять исходный текст и редакции параметров |
| Inventory | properties, listings, owners, media, availability | Раздельные IDs/permissions/statuses; concurrency/version |
| Search/Matching | search, saved views, matches, feedback | Explainable reasons, filters, cursor pagination, access filtering before response |
| Telegram | sources, messages, parse jobs, normalized listings | Source URL, timestamps, retry, terms/policy status, idempotent upsert |
| Cooperation | propose, counter, accept, decline, expire | Версионированные terms; actor/recipient; explicit confirmation |
| Transaction | viewings, offers, deals, checklist, acts | Transition rules, required fields, idempotent actions |
| Verification | request, evidence, result, expiry | Purpose, authority, source, result status, deny/unavailable distinction |
| Documents | upload/download/share/revoke | Signed access links with short lifetime, malware scan, scoped audit |
| Notifications | preferences, outbox, delivery attempts | Outbox pattern, dedup key, retry/backoff, quiet hours |
| Imports/Exports | CSV/XLSX, bulk import, export | Preview, field mapping, dry run, validation report, permission and export audit |
| Audit/Analytics | event query, reports, event ingestion | PII minimization, retention, event versioning and access control |

**[РЕКОМЕНДАЦИЯ]** Для всех изменяющих операций предусмотреть actor, organization context, idempotency key (где применимо), optimistic version/ETag, валидируемые transitions, audit event и human-readable error code. Для списков — cursor pagination; для событий — event ID, schema version, occurred_at и received_at.

## 39.4. Telegram collector и parser

- Поддерживать реестр источников: URL/channel ID, тип, владелец/контакт при наличии, разрешённый режим доступа, дата проверки и enabled/paused.
- Различать ingest mode (public channel, forwarded post, user-provided link), не обходить ограничения доступа.
- Сохранять canonical URL и ID публикации; контент/медиа — согласно применимым правилам и retention policy.
- Обрабатывать edited/deleted posts, сообщения без текста, альбомы/видео, пересланные копии, rate limit, временную недоступность и bot/API restrictions.
- Queue jobs должны иметь retry с backoff и dead-letter/review queue; повторная обработка идемпотентна.
- Парсер хранит поля, confidence, parser/model version, raw span/evidence и нормализованный вариант.
- Новая структура объявления тестируется на representative наборе перед выкладкой; контролировать precision/recall для полей цены, района, комнаты, валюты и контакта.
- Система не должна обещать исчерпывающий охват «сотен каналов» без актуального source registry и телеметрии.

## 39.5. Нефункциональные требования — рекомендуемые стартовые цели

Все значения ниже — **предлагаемые SLO/targets**, а не требования закона и не подтверждённые текущие показатели Binor.

| Область | Стартовая цель | Измерение/оговорка |
|---|---:|---|
| Доступность основных API | 99,9% в месяц после стабилизации | Считать успешные запросы и плановые окна отдельно |
| Структурированный поиск | p95 <500 мс без внешнего провайдера | Для заранее ограниченного набора фильтров и warmed index |
| Первая полезная отрисовка списка | <2 с p75 на поддерживаемом мобильном соединении | Разделить клиентское время, API и внешние вызовы |
| Delivery Telegram notification | p95 <60 с от подтверждённого события | Внешняя задержка Telegram учитывается отдельно |
| Создание draft Property через parser | <15 с p95 для типового текста | Большие media/очереди должны давать статус выполнения |
| Потеря подтверждённых операций | RPO ≤15 минут для критичных данных | Требует проверяемых backup/restore процедур |
| Восстановление критичного сервиса | RTO ≤4 часа | Уточнить на уровне бизнеса и инфраструктуры |
| Audit log | Append-only, доступность записи 99,9%+ | Критичные операции fail closed при невозможности audit |
| Data export | Проверка прав до запуска и полный event audit | Экспортный объём/TTL управляются политикой |
| Accessibility/localization | Полное RU/UZ покрытие P0 | Проверять длинные строки, числовые форматы и Unicode |

## 39.6. Security и эксплуатация

Обязательные для целевой платформы контроли: multi-tenant isolation тестами; RBAC плюс record-level access; MFA для привилегированных ролей при поддержке; server-side validation; rate limiting и anti-enumeration; CSRF/CSP где применимо; секреты в secret manager; защита загрузки файлов; журнал входов/экспорта/выдачи sensitive документов; резервные копии с регулярным restore test; мониторинг очередей и источников; incident playbooks; feature flag для внешних интеграций и быстрый kill switch.

Нельзя логировать полные паспортные документы, телефонные базы или чувствительные query params в общую телеметрию. Операционные логи имеют собственную схему редактирования/retention.

# 40. Roadmap, GTM и продуктовые метрики

## 40.1. Последовательность развития

| Этап | Ориентир из S5/S9 | Основная поставка | Exit criteria до следующего слоя |
|---|---|---|---|
| M0 — Foundation | До запуска/первые недели | Роли и организация, базовая схема, consent/privacy, import, audit, source registry, измерения событий | Импорт и восстановление проверены; нет критичных cross-tenant утечек; ключевые события измеряются |
| M1 — Daily matching | Около 0–3 месяцев | Telegram Listing Copilot, Requirement, Property/Listing, dedup, shortlist, match reasons, notifications | Time-to-first-value и точность подтверждены пилотом; активная база обновляется |
| M2 — Agency workspace | Около 3–6 месяцев | Team inventory, lead routing, roles, owner confirmation, freshness, календарь и publisher pilot | Руководитель и агент ежедневно используют систему; ownership/conflict процессы работают |
| M3 — Cooperation and compliance | Около 6–9 месяцев | Cooperation Request, versioned commission terms, договорные шаблоны, verification checklist, deal room | Юридическая проверка форм/ролей завершена; акт и audit workflow протестированы |
| M4 — MLS pilots | Около 9–12 месяцев | Shared MLS по понятным правилам, профессиональные профили, integration adapters | Национальный стандарт/договорные условия учтены; quality/freshness и dispute SLA доступны |
| M5 — Network/data/developer | После доказанного core | Developer inventory, market analytics, regional network, API/data products | Достаточная точность и permission lineage; asking prices не выдаются за цены сделок |

В S4 есть отдельный календарный roadmap (2026 Q1–2027 Q1) с iOS/Android, офлайн-режимом, AI-рекомендациями, VR, blockchain и ипотечными интеграциями. Это сохранённые предложения того документа, но не подтверждённый или принятый roadmap. Сопоставлять календарные кварталы с M0–M5 только после определения фактического состояния продукта и ресурсов.

## 40.2. Пилотный GTM

**Ташкентский пилот из S9:** 8–12 агентств по 5–30 агентов как целевая выборка, а не факт подписанных клиентов. Входной оффер: импорт существующих Telegram-объектов, очистка дублей и актуализация базы с демонстрацией первых релевантных совпадений за неделю.

Порядок land-and-expand:

1. Forward/import — single-player value даже при небольшой сети.
2. Agent Pro — повседневный личный workflow и сохранённые поиски.
3. Agency workspace — общие объекты, права, routing и отчёты.
4. Compliance/transaction room — управляемые договоры и доказуемая история.
5. MLS/network — сотрудничество между организациями при достаточной плотности.
6. Developer/data — отдельная B2B-вертикаль после подтверждения спроса и качества.

Региональный GTM может использовать партнёрства с администраторами Telegram-сообществ и Uzbek-first onboarding. Партнёрский брендированный бот не должен означать передачу владения клиентскими данными каналу; роли и границы tenancy документируются.

## 40.3. Метрики и определения

| Метрика | Определение, которое нужно закрепить | Какое решение поддерживает |
|---|---|---|
| Activated agent | Сделал минимум один значимый объект/запрос и получил/обработал Match в заданное окно | Понять, получает ли новый пользователь ценность |
| WAU/MAU | Уникальный профессиональный пользователь с qualifying event; не просто вход | Оценить привычку и реальную работу |
| Fresh inventory share | Активные Listing с актуальным подтверждением / все отображаемые активные Listing | Управлять качеством предложения |
| Owner-confirmed share | Listing с датированным подтверждением полномочий/доступности / eligible Listing | Оценить доверие и свежесть |
| Match precision | Пользователь подтвердил релевантность / выборочно проверенные Match | Настроить ранжирование и пороги |
| Match-to-action | Match с открытием/контактом/cooperation / показанные Match | Отличить уведомление от полезного действия |
| Match-to-viewing | Match, приведшие к состоявшемуся показу / согласованная cohort | Связать matching с прогрессом сделки |
| Match-to-deal | Закрытые сделки с доказуемой связью с Match / соответствующая cohort | North Star после появления transaction layer |
| Import share | Объекты, созданные через bot/import / все новые Listing | Проверить снижение ручного ввода |
| Duplicate precision/recall | TP/(TP+FP) и TP/(TP+FN) на размеченной выборке | Выбирать уровень автоматического merge |
| First response time | Время от полученного Lead до первого реального контактного события | Измерить routing/SLA |
| Net revenue retention/churn | Закреплённые определения платящего аккаунта и выручки | Оценить устойчивость коммерческой модели |

## 40.4. Сохранённые показатели и цели S4/S9

| Показатель | Значение из источника | Статус и пробел измерения |
|---|---:|---|
| Активные пользователи | 500+ | S4 называет текущим; дата, active definition и analytics evidence не указаны |
| Объекты в базе | 10 000+ | S4 называет текущим; неясно, это активные Property, Listings или агрегированные посты |
| Совершённые сделки | 120 | S4 называет текущим; не указаны период, атрибуция к Binor и источник подтверждения |
| Средний чек комиссии | $150 | S4; неясно, gross commission, доля агента или доход платформы |
| Retention | 75% | S4; отсутствует определение периода и когорт |
| Цель активных пользователей | 5 000 за 3 месяца | S4 target; отсчётная дата/ресурсный план отсутствуют |
| Цель базы объектов | 50 000 за 6 месяцев | S4 target; требуется уточнить тип и статус записей |
| Цель закрытых сделок | 1 000 за год | S4 target; нужно определить attribution и период |
| Цель среднего чека | $300 за 6 месяцев | S4 target; значение не согласовано с моделью выручки Binor |
| Цель retention | 85% | S4 target; методика не задана |
| Trial → paid | 20–30%+ | S9 ориентир-гипотеза |
| Paid agent ARPU | 150–250 тыс. сум/мес. | S9 гипотеза |
| Agency ARPA | 0,8–2 млн сум/мес. | S9 гипотеза |
| Monthly logo churn | <3–4% | S9 ориентир, не подтверждённый forecast |
| CAC payback | <4 месяцев | S9 ориентир, зависит от CAC/LTV модели |

Перед публичным использованием чисел S4 требуется data dictionary, период, выгрузка из источника, owner метрики и повторный расчёт.

# 41. Реестр расхождений и открытых решений

Этот реестр не пытается выбрать удобную версию; он показывает статус, риск и следующий проверочный шаг.

| ID | Тема | Формулировки/сведения корпуса | Консолидированная трактовка | Что закрыть |
|---|---|---|---|---|
| D1 | Охват Telegram | S3/S5/S6/S8: сотни каналов; S7: 77–100+ публичных каналов; источники датированы по-разному; 10 000+ объявлений встречается несколько раз | 10 000+ — заявленный объём; точное количество каналов динамическое и зависит от определения источника/периода. 77–100+ не противоречит «сотням» при различном охвате, но единого числа нет | Source registry, активные/архивные каналы, дата snapshot, уникальные сообщения vs listing |
| D2 | Доли 50/50, 70/30, 80/20 | Публичное описание: 50/50 равные; 70/30 больше стороне, приведшей клиента; 80/20 максимум владельцу заказа. Другие формулировки связывают долю с владельцем объекта/эксклюзивным клиентом/заказом | Поддержка набора вариантов заявлена; экономический смысл пропорции, роли стороны и basis расчёта не унифицированы | Зафиксировать role labels, направление процентов, gross/net commission, кто согласует, обязательность, валюту/момент выплаты |
| D3 | Тарифы/монетизация | Сайт не публикует цены; S4: Basic free, Pro $29/mo, Corporate custom; S9: цены в UZS как продуктовые гипотезы | Публичной монетизации не раскрыто. S4 и S9 являются отдельными внутренними моделями/предложениями; не объединять в текущий price list | Текущий billing, legal entity, валюты, лимиты, тесты готовности платить |
| D4 | Текущие метрики | S4 сообщает 500+ users, 10k+ objects, 120 deals, $150 average commission, 75% retention; S3 публичных метрик не обнаружил | Сохранить как сведения S4, но не публиковать до подтверждения метрики/периода/источника | Analytics export, active definition, cohort, deal attribution, denominator |
| D5 | Доходный mix | S4: 70% сделки, 20% подписка, 10% реклама; сайт не раскрывает revenue model | Внутренний показатель/описание S4; не подтверждён публичными данными и не означает, что комиссия взимается Binor | Финансовая отчётность/owner, доля выручки vs GMV, период и legal analysis |
| D6 | Текущий технологический стек | S3/S8 наблюдают Next.js/React для сайта; S4 backend stack «предположительно» React/Vue, Django/Node, PostgreSQL/Mongo, Scrapy и др.; S5 предлагает архитектуру | Подтверждён только наблюдаемый публичный web stack; Mini App/backend неизвестны. Остальное — варианты/гипотезы | Architecture inventory, repository/cloud diagrams, security review |
| D7 | ASTOR и Biding.uz | S7 описывает ASTOR COMPANY как связанную компанию/оператора и партнёрскую связь с Biding.uz; публичные страницы S3 не показывают юридическое лицо/оператора | Сохранять как reported ecosystem relationship; не утверждать юридическое владение, управление или операторство без подтверждения | Выписка/договор/официальная disclosure, назначение контакта @astor_rieltor |
| D8 | Имя MulkOS | В S9 используется MulkOS как рабочее имя предлагаемой концепции | Официальное имя продукта остаётся Binor; MulkOS — название концепции/аналитической модели S9 | Отдельное branding decision, если планируется переименование |
| D9 | Устройство рынка и доли | S4: традиционные агентства 60%, онлайн-платформы 30%, Binor 10%; методика/знаменатель не указан | Не использовать как market share. Это оценка S4 без обоснованной базы | Удалить из внешних материалов либо подкрепить исследованием и точной метрикой |
| D10 | Коммерческая комиссия и комиссия Binor | Публичные 50/50–80/20 описывают распределение между риэлторами; S4 описывает доход Binor от успешных сделок | Это два разных денежных потока; нельзя называть долю партнёров «комиссией платформы» | Юридическая роль оператора, платёжный процесс, договорная конструкция |
| D11 | Название/канал продукта | S3: сайт — лендинг, вход ведёт в Telegram; некоторые документы называют B2B web platform/SaaS | Канонический публичный клиентский интерфейс — Bot + Mini App; веб-кабинет присутствует как целевая модель, но не подтверждён сайтом | Проверить доступный продукт внутри Telegram и фактический web URL |
| D12 | Тип рынка/услуг | Документы называют продукт matching, CRM, агрегатор, MLS, SaaS и иногда brokerage | Эти понятия относятся к разным слоям и юридическим ролям; базовая позиция — технологический workflow, MLS-функции и внешние интеграции требуют отдельного статуса | Утвердить продуктовую taxonomy и legal perimeter |
| D13 | Команда, юридическое лицо, оператор | На публичном сайте S3 не обнаружены; S7 упоминает связанный бизнес | Публичное отсутствие раскрытия не доказывает отсутствие юридического лица или команды | Добавить утверждённое публичное описание, реквизиты и responsible owner |
| D14 | Статус «проверено» | В S5/S9 предлагаются Verified Agent/Listing/Owner/Document; S3 не видит деталей проверки | Ни один «verified» badge не является подтверждённым публичным feature; будущие badges должны иметь точный scope и evidence | Taxonomy, процедуры, полномочия, сроки и тексты disclaimers |
| D15 | География | Сайт указывает Ташкент; разные паспорта расширяют до Ташкентской области; стратегия — далее Узбекистан | Public beachhead: Ташкент; расширенный заявленный/проектный охват включает область; национальная экспансия — целевая | Проверить доступность по каждому городу и источник объявлений |
| D16 | Национальный стандарт и API | S0/S9 отмечают отсутствие выявленного детального MLS standard на дату исследования; закон допускает договорные госинтеграции | Не обещать доступ/схему API до стандарта и договора; проектировать адаптерно | Мониторинг нормативных актов, ответственный compliance, проверка после 08.11.2026 |
| D17 | Веб-сайт и legal pages | S3 фиксирует четыре страницы; /privacy, /terms, /pricing, /faq, /login, /app, /admin и sitemap.xml — 404/отсутствуют на дату исследования | Факт относится к проверенному публичному сайту на дату S3; не утверждает, что закрытые документы/потоки внутри продукта отсутствуют | Проверить актуальную live-версию и опубликовать обязательные disclosures |
| D18 | Стадия продукта | S3 описывает действующий продукт, S4 — активную разработку, S1/S2 — будущую UX-платформу | Сайт/бот активны по исследованию; зрелость каждого модуля отдельно не установлена | Feature inventory с environment, release, usage и owner |

## 41.1. Решения, необходимые до реализации чувствительных модулей

| Решение | Владелец решения | До какого этапа |
|---|---|---|
| Направление и база split 50/50, 70/30, 80/20; статус договорённости | Product + Legal + представители агентств | Cooperation beta |
| Видимость контактов/точного адреса и этап раскрытия | Product + Security + Legal | До shared inventory/MLS |
| Типы профессионального статуса и проверка реестра/страховки | Legal/Compliance + Operations | До Verified badge |
| Пределы роли Binor: SaaS, MLS operator, marketplace, referral, payment | Юридический советник и руководство | До договоров/комиссии/госинтеграций |
| Хранение, трансграничная обработка, consent, retention и deletion | Privacy/Legal + Security | До широкого импорта персональных данных |
| Официальные Definition of Metrics и источник данных S4 | Product Analytics + Finance | До внешнего заявления о traction |
| Точный Telegram coverage/список источников и правила копирования | Data/Ops + Legal | До маркетинга объёма Radar |
| Фактический web/backend stack и владельцы компонентов | Engineering | До архитектурного roadmap |
| Актуальные тарифы, billing и бесплатные лимиты | Product + Finance | До paywall/публичного pricing |

# 42. Публичный сайт, коммуникация и словарь

## 42.1. Публичная структура сайта по S3

На дату исследования сайт binor.uz имел четыре публичные страницы на русском и узбекском:

| Путь | Содержание |
|---|---|
| / | Позиционирование, преимущества, Telegram CTA |
| /how-it-works | Пять шагов, объекты/заказы, matching, сотрудничество |
| /about | Миссия, причина создания, ценности и аудитория |
| /contacts | Телефон, Instagram, Telegram, география и режим поддержки |

S3 указывает, что отдельные страницы /privacy, /terms, /pricing, /faq, /blog, /login, /app, /admin, /uz, /ru и sitemap.xml на момент проверки возвращали 404/отсутствовали. Это snapshot сайта, а не утверждение о внутренних документах продукта.

## 42.2. Наблюдения сайта и редакторские улучшения

**Наблюдаемые факты S3:** Next.js App Router/React, Tailwind, Inter, Lucide; локализация через клиентский словарь RU/UZ без отдельных URL; одинаковые title/description на страницах; русская meta description; нет sitemap/hreflang и систем аналитики из списка проверенного аудита; нет публичных privacy/terms/pricing/FAQ на проверенных URL. S4 не должен использоваться для вывода о backend из этих признаков.

**[РЕКОМЕНДАЦИЯ S3]** Приоритеты редакторского и публичного trust backlog:

1. Опубликовать privacy notice и условия, описывающие реальные потоки обработки данных.
2. Чётко объяснить, какие данные видны другим риэлторам и когда открываются контакты.
3. Переписать проценты комиссии с обозначением стороны, базы расчёта и примера.
4. Добавить скриншоты/короткую демонстрацию Mini App, чтобы сайт не обещал неизвестную глубину.
5. Развести публичные тарифы, если они утверждены, и внутренние гипотезы, если нет.
6. Добавить FAQ по дубликатам, stale listings, приватности, партнёрству, Telegram Radar.
7. Развести RU/UZ URL, hreflang, уникальные metadata и sitemap при необходимости SEO.
8. Уточнить юридический оператор, контакты поддержки и экосистемные связи.
9. Настроить аналитику перехода «landing → bot → onboarding → activation» с privacy controls.
10. Вести единый RU/UZ-глоссарий; юридические термины и формы вычитывать с носителем языка и юристом.

## 42.3. Канонические публичные утверждения и контакты

| Поле | Значение из публичных материалов |
|---|---|
| Бренд | Binor |
| Домен | https://binor.uz/ |
| Telegram Bot | @binor2030_bot |
| Публичный телефон | +998 90 174 54 55 |
| Instagram | @astor_rieltor |
| Регион | Ташкент; в отдельных страницах/паспортах также Ташкентская область |
| Языки | Русский и узбекский (латиница) |
| Бот | Указан как доступный 24/7 |
| Телефонная поддержка | 09:00–20:00 по Ташкенту |

S7 сообщает о связи Binor с ASTOR COMPANY и Biding.uz. Публичный сайт, изученный в S3, не раскрывает юридическое лицо/ownership; формулировать это как «S7 сообщает об экосистемной/партнёрской связи», пока не подтверждены официальный оператор и правовая конструкция.

## 42.4. RU ↔ UZ продуктовый глоссарий

| Русский | Узбекский из исходника | Редакторское примечание |
|---|---|---|
| Платформа для риэлторов | Rieltorlar uchun platforma | Публичный слоган |
| Объект недвижимости | Ob'yekt (ko'chmas mulk) | Нормализовать написание и терминологию |
| Заказ клиента | Buyurtma (mijoz) | Для Requirement уточнять как «запрос клиента» |
| Совпадение | Moslik | Название пользовательского результата matching |
| Автоматический поиск | Avtomatik qidiruv | |
| Уведомление | Bildirishnoma | |
| Риэлтор-партнёр | Rieltor-hamkor | |
| Условия сотрудничества | Hamkorlik shartlari | |
| Комиссия | Komissiya | Всегда указывать, чья комиссия и как делится |
| Сделка | Bitim | |
| Агентство недвижимости | Ko'chmas mulk agentligi | |
| Индивидуальный риэлтор | Individual rieltor | Юридически не смешивать с «агентом по недвижимости» |
| Вкладка ТГ | TG bo'limi | Название текущей публичной функции |
| Объявление | E'lon | Различать Advertisement и Listing в доменной модели |
| Сообщество | Hamjamiyat | |
| Регистрация | Ro'yxatdan o'tish | |
| Новое | YANGI | Публичная метка функции |
