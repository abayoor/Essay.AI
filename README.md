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
