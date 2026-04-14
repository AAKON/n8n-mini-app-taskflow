# Automation routes

TaskFlow runs all automation inside the Next.js app. Two flavours of routes exist outside the normal JWT-authenticated API:

- **Bot webhook** — receives Telegram updates when users talk to the bot.
- **Cron routes** — hit by a scheduler (Vercel Cron, GitHub Actions, or any external cron service) to run reminders and digests.

Both are guarded by shared secrets set in the environment.

---

## `POST /api/bot/webhook`

Receives updates from Telegram and handles `/start` and `/tasks` commands.

**Headers**

| Header | Value |
|--------|-------|
| `X-Telegram-Bot-Api-Secret-Token` | Same as `TELEGRAM_WEBHOOK_SECRET` |

Register the webhook once after deploy:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-host>/api/bot/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

**Commands handled**

| Command | Behaviour |
|---------|-----------|
| `/start` | Upserts the sender as a TaskFlow user and replies with a welcome DM containing a WebApp button. |
| `/tasks` | Replies with the sender's open-task summary (totals + overdue + due today). Tells unknown users to send `/start` first. |

Unknown commands and non-command messages are silently acknowledged with `{ ok: true }` so Telegram doesn't retry.

---

## `GET /api/cron/due-reminders`

Sends a DM for every task that is **not done**, has a **due date in the next 24 hours**, and has an assignee with a Telegram ID. Each successful send writes an `ActivityLog` entry (`action: "notification_sent"`, `meta.type: "reminder"`).

**Headers**

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <CRON_SECRET>` |

**200 response**

```json
{ "success": true, "total": 7, "sent": 7, "failed": 0 }
```

**Recommended schedule:** once per day at 08:00.

---

## `GET /api/cron/daily-digest`

For every user with a Telegram ID that has at least one open task, sends a task-summary DM. Users with zero open tasks are skipped.

Same auth header as above.

**200 response**

```json
{ "success": true, "total": 42, "sent": 18, "skipped": 24, "failed": 0 }
```

**Recommended schedule:** once per day in the morning (e.g. 08:00).

---

## Wiring the schedule

### Vercel

`vercel.json` at the repo root declares both crons — Vercel hits the routes automatically with a bearer token it derives from the project. Set `CRON_SECRET` in the project's environment and add `Authorization: Bearer $CRON_SECRET` via the Vercel Cron project setting.

### External scheduler

Any cron service that can make an authenticated HTTP request works. Example with `curl`:

```bash
curl -fsSL "https://<your-host>/api/cron/due-reminders" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -fsSL "https://<your-host>/api/cron/daily-digest" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Schedule both routes at 08:00 daily.

---

## Local testing

With the dev server running and `.env.local` populated:

```bash
# Fake a /tasks command (webhook secret header required)
curl -X POST "http://localhost:3000/api/bot/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET" \
  -d '{"message":{"from":{"id":123456,"first_name":"Ada"},"text":"/tasks"}}'

# Trigger the reminder cron manually
curl "http://localhost:3000/api/cron/due-reminders" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Any DMs actually sent require `BOT_TOKEN` to be a real bot token and the target `telegramId` to correspond to a chat the bot has been started in.
