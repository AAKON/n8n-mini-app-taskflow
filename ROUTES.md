# Internal API routes (n8n)

All routes require the shared secret header:

| Header | Value |
|--------|--------|
| `x-n8n-secret` | Same as `N8N_SECRET` in `.env.local` |

If the secret is missing, wrong, or `N8N_SECRET` is unset, responses return **401 Unauthorized**.

Base URL: your app origin (e.g. `https://your-host` or `http://localhost:3000`).

---

## `GET /api/users` (n8n only, no JWT)

If the request includes a valid `x-n8n-secret` (same as internal routes above), **JWT is not required**. The handler returns **all** users (for digests / automation), including `telegramId`.

If the secret is absent or invalid, the route falls back to normal **JWT** behaviour (managers and above, scoped lists).

---

## `POST /api/internal/user-register`

Upserts a user by Telegram ID (same fields as Telegram WebApp auth).

**Body (JSON)**

| Field | Type | Required |
|-------|------|----------|
| `telegramId` | number | yes |
| `name` | string | yes |
| `username` | string | no |
| `avatarUrl` | string | no |

**200** — `{ "success": true, "user": { ... }, "isNew": boolean }`

`user` includes `_id` as a string and matches the `User` model shape.

---

## `POST /api/internal/task-summary`

Summary of tasks **assigned to** the user identified by `telegramId`.

**Body (JSON)**

| Field | Type | Required |
|-------|------|----------|
| `telegramId` | number | yes |

**200** — `{ "success": true, "data": { ... } }`

`data` fields:

| Field | Meaning |
|-------|---------|
| `name` | User display name |
| `totalOpen` | Count of tasks with `status !== "done"` |
| `byStatus` | Counts per status: `todo`, `in_progress`, `review`, `done` |
| `overdue` | Open tasks with `dueDate` before today (start of day, server local) |
| `upcomingDueToday` | Open tasks with `dueDate` on today’s calendar day |

**404** — user not found for `telegramId`.

---

## `GET /api/internal/due-reminders`

Cron-friendly list of reminders: tasks **not done**, with a **due date between now and the next 24 hours**, and a valid assignee `telegramId`.

**Headers:** `x-n8n-secret` (no body).

**200** — `{ "success": true, "data": Reminder[] }`

Each `Reminder`:

| Field | Type |
|-------|------|
| `telegramId` | number |
| `assigneeUserId` | string (Mongo id of assignee) |
| `taskTitle` | string |
| `taskId` | string (Mongo id) |
| `dueDate` | string (ISO 8601) |

---

## `POST /api/internal/notifications`

Logs that an external notification was sent (stored in `ActivityLog` with `action: "notification_sent"`).

**Body (JSON)**

| Field | Type | Required |
|-------|------|----------|
| `taskId` | string (Mongo id) | yes |
| `userId` | string (Mongo id) | yes |
| `type` | `"assigned"` \| `"reminder"` \| `"commented"` | yes |

**200** — `{ "success": true, "ok": true }`

---

## Example: curl

```bash
curl -sS -X POST "$APP_URL/api/internal/user-register" \
  -H "Content-Type: application/json" \
  -H "x-n8n-secret: $N8N_SECRET" \
  -d '{"telegramId":123456,"name":"Ada"}'
```

Replace `$APP_URL` and `$N8N_SECRET` with real values. In n8n, use an expression for the secret, e.g. `{{ $env.N8N_SECRET }}`, and set the same value in the environment where the Next.js app runs.
