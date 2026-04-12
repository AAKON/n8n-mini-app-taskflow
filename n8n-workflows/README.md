# TaskFlow n8n workflows

Import each `*.json` file in n8n: **Workflows → Import from File**.

## Environment variables (n8n)

Set these on your n8n instance (or in the host environment):

| Variable | Example | Purpose |
|----------|---------|---------|
| `N8N_SECRET` | Same value as `N8N_SECRET` in TaskFlow `.env.local` | Sent as header `x-n8n-secret` to internal APIs |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` | Mini App URL for Web App buttons |

## Telegram

1. Create a **Telegram credential** in n8n (Bot API token from BotFather).
2. Open each workflow that uses Telegram nodes and **attach that credential** to:
   - **Telegram Trigger** (workflows 01–02)
   - **Telegram** “Send message” nodes (all workflows that send chat messages)

After import, **re-link credentials** if n8n shows “missing credential”.

## HTTP Request nodes

All calls to TaskFlow internal routes use:

- Header: `x-n8n-secret` = `{{ $env.N8N_SECRET }}`
- Base URL: `{{ $env.NEXT_PUBLIC_APP_URL }}` (no trailing slash in expressions)

If your n8n build nests the response body (e.g. under `body`), adjust expressions (`$json.isNew` vs `$json.body.isNew`) in **IF** / **Set** nodes.

## Workflow overview

| File | Purpose |
|------|---------|
| `01-start-command.json` | `/start` → register user → welcome vs returning → Web App button |
| `02-tasks-command.json` | `/tasks` → task summary → Web App button |
| `03-task-assigned-notification.json` | Webhook from app → DM assignee → log notification |
| `04-due-reminders.json` | Daily schedule → due in 24h → DM → log each |
| `05-daily-digest.json` | Daily schedule → list users → digest if open tasks |

## `GET /api/users` (workflow 05)

TaskFlow allows **`GET /api/users`** with header `x-n8n-secret` (no JWT) for automation: returns all users including `telegramId`. See root `ROUTES.md` for other internal routes.

## Webhook payload (workflow 03)

Your app should `POST` to the n8n webhook URL with JSON like:

```json
{
  "taskId": "mongoObjectId",
  "taskTitle": "Fix bug",
  "assigneeTelegramId": 123456789,
  "assigneeUserId": "mongoObjectIdOfAssignee",
  "assignedByName": "Alex",
  "dueDate": "2026-04-15T12:00:00.000Z"
}
```

- **Telegram** uses `assigneeTelegramId` as `chatId`.
- **`POST /api/internal/notifications`** needs Mongo `taskId`, `userId` (`assigneeUserId`), and `type: "assigned"`.

## Schedules (workflows 04–05)

Open the **Schedule Trigger** node after import and confirm **timezone** and **cron / time** (defaults: 08:00 and 09:00). **Activate** the workflow for schedules to run.

## Activating

Turn each workflow **Active** in n8n after credentials and env vars are set. Telegram Trigger workflows need the bot to receive updates (often via webhook registered by n8n).
