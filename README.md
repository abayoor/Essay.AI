# Slipstream

Slipstream — платформа для велосипедного сообщества: личный гараж, обслуживание велосипедов и маршруты для поездок.

## Текущая версия

- регистрация через Supabase (email и Google);
- профиль райдера;
- гараж с пробегом и напоминаниями об обслуживании;
- создание и просмотр маршрутов на интерактивной карте;
- GPS-запись поездки в реальном времени на `/record`;
- общая лента, публикации и личные сообщения;
- адаптивный интерфейс для телефона и компьютера.

## Запуск

```bash
npm install
npm run dev
```

Для проверки перед публикацией:

```bash
npm run build
```

## Данные и публикация

Данные хранятся только в Supabase. Любое изменение схемы базы делается через новую миграцию в `supabase/migrations/` и `npm run db:push`.

После `git push` Vercel автоматически собирает и публикует сайт. Ежедневный workflow keep-alive поддерживает активность Supabase-проекта.

## Внешние сервисы

Для построения маршрутов по велодорогам создай ключ в [OpenRouteService](https://openrouteservice.org/dev/#/signup) и добавь `ORS_API_KEY` в переменные окружения Vercel. Для локальной проверки через `vercel dev` его можно хранить в `.env.local`; файл уже игнорируется Git.

Для Strava нужны `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI` и `STRAVA_STATE_SECRET` в переменных окружения Vercel. Callback URL: `https://твой-домен/api/strava/callback`.

Для функций Gemini добавь `GEMINI_API_KEY` в переменные окружения Vercel для Production, Preview и Development, затем запусти новый deployment. Секрет Supabase не доступен обработчикам `api/ai/assist.ts` и `api/coach/analyze.ts`, потому что они выполняются в Vercel. Локальную связку ключа и модели можно безопасно проверить командой `npm run ai:check`.

## Slipstream Pro и выплаты

Веб-версия подготовлена для Lemon Squeezy: тариф `Slipstream Pro` стоит $5 USD в месяц, а доступ проверяется сервером. Карточные данные в Slipstream не попадают. Пока платёжный аккаунт не настроен, `VITE_BILLING_ENABLED=false` оставляет безопасный preview без списаний.

1. Активируй магазин Lemon Squeezy и пройди проверку владельца и способа выплаты. Если владельцу ещё нет 18 лет, аккаунт, налоговые данные и выплаты должен оформить родитель или другой законный представитель.
2. Установи валюту магазина `USD`. Создай продукт с ежемесячной подпиской ровно `$5`, периодом `1 month` и без trial.
3. Добавь в Vercel только серверные значения `LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_STORE_ID`, `LEMON_SQUEEZY_VARIANT_ID` и канонический `APP_URL=https://твой-домен`. Один настоящий контакт поддержки укажи в `SUPPORT_EMAIL` и `VITE_SUPPORT_EMAIL`: без него и сервер, и кнопка оплаты специально остаются выключенными. Для production оставь `LEMON_SQUEEZY_ALLOW_TEST_MODE=false`.
4. Добавь `GEMINI_API_KEY`, `SUPABASE_URL` и `SUPABASE_ANON_KEY`. Затем примени миграции:

```bash
npm run db:push -- --dry-run
npm run db:push -- --yes
npm run keep-awake:setup
```

5. Для Vercel Preview временно используй тестовые Lemon IDs, `LEMON_SQUEEZY_ALLOW_TEST_MODE=true`, `BILLING_ENABLED=true` и `VITE_BILLING_ENABLED=true`, затем проверь покупку. Код не разрешает test-mode entitlement в Production.
6. После проверки укажи в Production живые IDs, оставь `LEMON_SQUEEZY_ALLOW_TEST_MODE=false`, поставь `BILLING_ENABLED=true` и `VITE_BILLING_ENABLED=true`, затем создай новый deployment. Два независимых флага не дают случайно открыть checkout только одной клиентской настройкой.

До включения Production проверь страницы `/legal/privacy`, `/legal/terms` и `/legal/refunds`, подставь настоящий email поддержки и укажи владельца сервиса там, где этого требуют правила твоей страны и платёжного партнёра.

Lemon Squeezy принимает оплату как Merchant of Record, рассчитывает применимые налоги и перечисляет доступный баланс на настроенный способ выплаты по своему графику. Базовая цена — $5; налог покупателя, если требуется, показывается до подтверждения заказа.

Текущая веб-версия проверяет подписку напрямую у Lemon Squeezy по подтверждённому email аккаунта Slipstream. Поэтому до добавления подписанного webhook не меняй email платящего аккаунта. Перед большим публичным запуском добавь отдельной задачей webhook `subscription_created/updated/expired` с неизменяемой привязкой к `meta.custom_data.user_id`; браузеру права записи подписок не выдавай.

## Мобильное приложение

Android-контейнер Capacitor уже находится в `android/`. Для обновления нативной сборки:

```bash
npm run cap:sync
npm run cap:android
```

В Android Studio создай подписанный Android App Bundle (`.aab`), включи Play App Signing и загрузи bundle в Google Play Console. Для нативной сборки укажи `VITE_API_BASE_URL=https://твой-домен`, чтобы карта, ИИ и авторизованные API-запросы шли на Vercel, а не на локальный адрес WebView.

Цифровую Pro-подписку в приложении из Google Play нужно продавать через Google Play Billing. Поэтому внешний веб-checkout внутри Capacitor намеренно отключён. Для iPhone понадобится Mac с Xcode, пакет `@capacitor/ios`, команда `npx cap add ios` и подписка через StoreKit/In-App Purchase. Веб и магазины приложений должны передавать единый статус entitlement в Supabase, не карточные данные.

Перед публикацией мобильной версии отдельно настрой ссылки входа: добавь production-домен в Redirect URLs Supabase, Android App Links/intent filter и обработку `appUrlOpen` через `@capacitor/app` (для внешнего OAuth также обычно нужен `@capacitor/browser`). Сейчас email/OAuth callback рассчитан на веб-домен; без этого вход из письма может открыться во внешнем браузере, а не вернуться в приложение. Не хардкодь временный домен — сначала выбери постоянный production URL.
