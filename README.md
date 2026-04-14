# TaskFlow

A Telegram Mini App for tasks and teams. Built with Next.js 14, MongoDB, and the Telegram WebApp SDK. All automation (bot commands, reminders, daily digests) runs inside the Next.js app itself — no external workflow engine.

## Stack

- **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind CSS + Zustand
- **Backend:** Next.js API routes + Mongoose (MongoDB)
- **Auth:** Telegram Web App `initData` → JWT
- **Bot / automation:** direct Telegram Bot API calls from Next.js + cron routes

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
# then fill in MONGODB_URI, JWT_SECRET, BOT_TOKEN, NEXT_PUBLIC_APP_URL,
#                TELEGRAM_WEBHOOK_SECRET, CRON_SECRET

# 3. Seed the DB (optional but recommended for local)
npm run seed

# 4. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On desktop the app uses `/api/auth/dev` to sign in as a seeded user; on Telegram it uses `initData` validation.

## Environment variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Mongo connection string. |
| `JWT_SECRET` | Signs the session JWT returned by `/api/auth/telegram`. |
| `NEXT_PUBLIC_APP_URL` | Canonical origin for the mini app (used in bot buttons). |
| `BOT_TOKEN` | Telegram Bot API token from BotFather. |
| `TELEGRAM_WEBHOOK_SECRET` | Matched against Telegram's `X-Telegram-Bot-Api-Secret-Token` header on `/api/bot/webhook`. |
| `CRON_SECRET` | Bearer token required by `/api/cron/*` routes. |

## Bot & cron setup

See [`ROUTES.md`](./ROUTES.md) for:

- Registering the Telegram webhook (`setWebhook` curl command)
- How `/start` and `/tasks` are handled
- Scheduling the two cron routes (reminders + daily digest) on Vercel or any external cron
- Local testing examples

A ready-made `vercel.json` declares both crons if you deploy on Vercel.

## Project layout

```
app/
  api/
    auth/           Telegram + dev JWT issuance
    bot/webhook/    Telegram Bot update handler (/start, /tasks)
    cron/           due-reminders, daily-digest
    departments/    Department CRUD
    tasks/          Task CRUD + status transitions
    users/          User listing (JWT-only)
  admin/            Admin dashboard
  departments/      Department tree UI
  tasks/[id]/       Task detail
  team/             Team page
components/         React components (TaskHome, TaskCard, etc.)
hooks/              React hooks (useAuth, useTasks)
lib/                Server + client utilities
  task-summary.ts   /tasks + daily-digest data builder
  due-reminders.ts  Reminder query
  user-upsert.ts    /start upsert
  activity.ts       ActivityLog writes
  telegram.ts       Telegram Bot API wrapper + message formatters
models/             Mongoose schemas
scripts/            seed.ts
types/              Shared TS types
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server. |
| `npm run build` | Production build. |
| `npm run start` | Run the production build. |
| `npm run lint` | ESLint. |
| `npm run seed` | Seed the MongoDB with sample departments, users, and tasks. |

## Improvement roadmap

See [`IMPROVEMENT_PLAN.md`](./IMPROVEMENT_PLAN.md) for the phased plan (this refactor completes Phase 1).
