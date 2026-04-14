# TaskFlow — Improvement Plan

A phased roadmap to strip out n8n, modernize the UI, and add the features that turn TaskFlow from a demo-grade Telegram Mini App into a product people actually want to use every day.

> **Guiding constraint from the owner:** `#i_dont_need_n8n_in_this_project`. All automation (notifications, reminders, daily digests, bot commands) must move into the Next.js app itself.

---

## Phase 0 — Audit & Baseline (½ day)

**Goal:** know exactly what we're touching before we touch it.

1. Run the app locally (`npm run dev`) and confirm the current happy path works: Telegram auth → list tasks → create → detail → comments.
2. List every place `n8n`, `N8N_SECRET`, `x-n8n-secret`, or `/api/internal/*` is referenced. Use:
   - `lib/n8n-auth.ts`
   - `app/api/internal/*`
   - `app/api/users/route.ts` (has an n8n bypass branch)
   - `ROUTES.md`, `.env.example`, `n8n-workflows/`
3. Take a screenshot of every screen on mobile width (375px) — these become the "before" reference for the UI refresh in Phase 3.

**Done when:** the dev server runs and you have a written list of every n8n touch-point.

---

## Phase 1 — Remove n8n Completely (1–2 days)

**Goal:** every automation that n8n used to run now runs inside the Next.js app. No external workflow engine.

### 1.1 Pick a replacement stack

- **Bot commands (`/start`, `/tasks`)** → a single Next.js webhook route (`app/api/bot/webhook/route.ts`) that handles Telegram updates directly.
- **Scheduled jobs (due reminders, daily digest)** → Vercel Cron (if deploying on Vercel) or a Next.js route hit by any cron service (GitHub Actions, cron-job.org, EasyCron). Both hit `app/api/cron/*` routes guarded by a `CRON_SECRET` header.
- **Outgoing Telegram messages** → one thin wrapper in `lib/telegram-bot.ts` that wraps `https://api.telegram.org/bot<TOKEN>/sendMessage`. No SDK needed — it's a single `fetch`.

### 1.2 Delete n8n code & config

Delete in this order (tests the app still builds after each step):

1. `n8n-workflows/` — the whole folder.
2. `lib/n8n-auth.ts`.
3. `app/api/internal/` — all four routes. Their logic moves into `lib/` helpers (see 1.3) and new cron/bot routes.
4. In `app/api/users/route.ts`, remove the `validateN8nSecret` early-return branch; the route becomes JWT-only.
5. From `.env.example` remove `N8N_SECRET`; add `CRON_SECRET` and `TELEGRAM_WEBHOOK_SECRET`.
6. Remove the entire "Internal API routes (n8n)" section from `ROUTES.md` — replace with the new cron/bot section in 1.4.
7. Search & delete any lingering references in `taskflow-cli-prompts.md` and `.idea/modules.xml`.

### 1.3 Extract the reusable business logic

Move the pure data logic out of the deleted routes into `lib/`:

- `lib/task-summary.ts` — `getTaskSummaryForTelegramUser(telegramId)` (was `/api/internal/task-summary`).
- `lib/due-reminders.ts` — `getDueRemindersNext24h()` (was `/api/internal/due-reminders`).
- `lib/user-upsert.ts` — `upsertUserByTelegramId(...)` (was `/api/internal/user-register`).
- `lib/activity.ts` — `logNotificationSent({ taskId, userId, type })` (was `/api/internal/notifications`).

These become plain functions called from the bot webhook and cron routes — no HTTP hop, no shared secret.

### 1.4 Build the replacements

- **`app/api/bot/webhook/route.ts`**
  - POST handler, verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`.
  - Parses the update, dispatches on `message.text`:
    - `/start` → `upsertUserByTelegramId` + send welcome with a WebApp button that opens the mini app.
    - `/tasks` → `getTaskSummaryForTelegramUser` + send formatted Markdown response.
  - Returns 200 immediately.
- **`app/api/cron/due-reminders/route.ts`**
  - GET handler, verifies `Authorization: Bearer ${CRON_SECRET}`.
  - Calls `getDueRemindersNext24h()`, sends a Telegram DM per reminder, logs each via `logNotificationSent`.
- **`app/api/cron/daily-digest/route.ts`**
  - Same auth pattern. For each active user, builds their summary and DMs it.
- **`app/api/tasks/route.ts` (POST)** — when a task is created with an assignee, fire-and-forget a DM (wrapped in `try/catch`, never blocks the response).

### 1.5 Wire up the schedule

- If deploying on Vercel: add a `vercel.json` with two `crons` entries (due-reminders every 15 min, daily-digest at 08:00 server TZ).
- Otherwise: add a README section showing the two `curl` commands a user can drop into GitHub Actions or an external cron.

### 1.6 Register the webhook

One-time setup (document in README):

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<your-host>/api/bot/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

### 1.7 Rename the project

- `package.json` → `"name": "taskflow"`.
- Folder name → `taskflow` (optional but the `n8n-mini-app-taskflow` name is now misleading).
- Update `README.md` title and description to match.

**Done when:** a project-wide search for `n8n` returns zero hits, the bot still responds to `/start` and `/tasks`, a manually triggered cron route sends a real DM, and `npm run build` is clean.

---

## Phase 2 — Quality & Tooling Foundation (1 day)

Before piling on features, put the safety net in place.

1. **Testing** — add Vitest + React Testing Library. First three tests:
   - `lib/task-filters.ts` date math (overdue/today/week).
   - `lib/rbac.ts` role hierarchy.
   - A smoke render test for `TaskCard`.
2. **E2E smoke** — one Playwright test: auth-bypass dev login → create task → see it in list.
3. **Error tracking** — wire Sentry (or a lightweight alternative) behind an env var; no-op when unset.
4. **API rate limiting** — a small `lib/rate-limit.ts` (in-memory LRU per IP) applied to `/api/auth/*` and `/api/tasks` POST.
5. **Zod validation** at every API boundary. Today handlers trust shapes from `request.json()` — replace with Zod schemas and return 400 on parse failure.
6. **`npm run typecheck`** script (`tsc --noEmit`) + a `verify` script that chains `lint && typecheck && test` so one command validates the whole app locally.

**Done when:** `npm run verify` passes clean, and introducing a deliberate type error makes it fail.

---

## Phase 3 — UI / Design Refresh (2–3 days)

The app works but feels like a wireframe. This phase makes it feel premium on Telegram.

### 3.1 Design tokens

- Consolidate colors, spacing, radii, and shadows into CSS variables in `globals.css`, themed off the Telegram WebApp color scheme (`--tg-bg`, `--tg-button`, etc.).
- Add a subtle elevation system (`--shadow-sm/md/lg`) so cards, sheets, and the FAB share the same visual language.
- Define motion tokens (`--ease-out`, `--duration-fast/base/slow`) and use them everywhere instead of ad-hoc `transition` classes.

### 3.2 Task card redesign

- Priority shown as a colored left-border (not a pill), so the list scans faster.
- Due-date chip turns red when overdue, amber when due today, neutral otherwise.
- Assignee avatar (initials fallback) on the right.
- Checkbox on the left for one-tap complete — with haptic + a confetti burst on the final tap.
- **Swipe actions**: swipe-right to mark done, swipe-left to open the detail sheet. Use pointer events, not a library.

### 3.3 Task detail

- Redesign into clear sections: header (title + status + priority), meta grid (assignee/department/due/estimate), description, steps checklist, comments, activity timeline.
- Inline edit for title and description (tap-to-edit), not a separate modal.
- Sticky action bar at the bottom on mobile (Complete / Assign / Comment).

### 3.4 Home screen polish

- Collapsible filter chips row: scrolls horizontally, sticky under the tab bar.
- Replace the pull-to-refresh hack with a proper pull-to-refresh component using pointer events + a rubber-band animation.
- Section headers: "Overdue", "Today", "This week", "Later" — auto-grouped when "Any date" filter is active.
- Better skeletons: match the exact card height so there's no layout shift.

### 3.5 Empty states

Every empty state gets an illustration (inline SVG) and a primary CTA. Today they're just text + an icon.

### 3.6 Dark mode

- Audit every hard-coded color — there are a lot of `black/5` and `white/10` utilities. Replace with tokens.
- Verify on Telegram's dark theme (`tg://theme/dark`) as well as iOS/Android system dark.

**Done when:** a side-by-side of the Phase 0 screenshots vs. now clearly looks like a new product.

---

## Phase 4 — Features That Move the Needle (4–6 days, pick what you want)

Ordered by impact-to-effort. Ship them one at a time, behind a small internal feature flag if needed.

### 4.1 Real-time updates (½ day)
- Server-Sent Events route at `app/api/tasks/stream/route.ts`.
- Client hook `useTaskStream()` invalidates the Zustand store on `task.updated` events.
- Falls back to polling every 30 s if SSE disconnects.

### 4.2 Full-text search (½ day)
- MongoDB text index on `title`, `description`, `tags`.
- Search bar in the home header; debounced 250 ms; highlights matches in results.

### 4.3 Kanban board view (1 day)
- `/tasks/board` route with draggable columns (todo / in_progress / review / done).
- Uses native HTML5 drag + pointer events; no external DnD library.
- Drop updates status via the existing `PATCH /api/tasks/[id]`.

### 4.4 Calendar view (1 day)
- `/tasks/calendar` — month grid, each cell shows up to 3 task dots colored by priority.
- Tap a day to see the list. Tap a dot to open the task.

### 4.5 Bulk actions (½ day)
- Long-press a task card → enters multi-select mode.
- Bottom action bar: assign / set status / set due date / delete.

### 4.6 Task dependencies & subtasks (1 day)
- Add `blockedBy: ObjectId[]` and `parentTaskId: ObjectId` to the Task model.
- A task with open blockers shows a lock icon and can't be moved to `done` until blockers resolve.

### 4.7 Recurring tasks (½ day)
- New `recurrence` field on Task (`daily | weekly | monthly | null`).
- A cron route (runs hourly) clones completed recurring tasks with the next due date.

### 4.8 @mentions in comments (½ day)
- Parse `@username` in comment bodies; autocomplete from team members.
- DM the mentioned user via the Telegram bot.

### 4.9 Manager analytics (1 day)
- `/admin/analytics` — cards for open vs. done over last 30 days, avg. completion time, overdue rate per department.
- Built with lightweight inline SVG charts (no Chart.js dependency).

### 4.10 PWA / offline read (½ day)
- Add `manifest.json`, install prompt, and a service worker that caches the task list for read-only access when offline.

---

## Phase 5 — Polish & Ship (1 day)

1. Lighthouse pass: aim for ≥95 on the home route. Fix any CLS, LCP, or accessibility flags.
2. Accessibility sweep: every button has an `aria-label`, every input has a `<label>`, color contrast ≥ AA.
3. Keyboard navigation: tab order is sane, Escape closes sheets.
4. Bundle audit: check `next build` output; split or lazy-load anything over 40 KB that isn't on the initial route.
5. Update `README.md`: new architecture diagram (no n8n box), setup instructions, env var list, how to register the Telegram webhook.

---

## Suggested Execution Order

If you only have a weekend, do **Phase 1 + Phase 3.1/3.2/3.3**. That alone delivers a self-contained app with a real UI.

If you have a week, add **Phase 2, 3.4–3.6, and Phase 4.1 (real-time) + 4.2 (search)**.

Everything in Phase 4 after that is à la carte — pick based on which user complaint hurts most.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Cron provider downtime silently stops reminders | Cron routes log their last successful run to Mongo; `/admin` surfaces a "stale cron" warning if > 2× expected interval. |
| Telegram Bot API rate limits (30 msg/sec) | Outbound sends in cron routes are chunked with a 50 ms delay between messages. |
| Removing `/api/internal/*` breaks anything still calling them | Search the codebase and any deployment configs first; optionally keep a short-lived 410 Gone response on those paths while you migrate callers. |
| UI refresh regressions on older Telegram clients | Test on Telegram Desktop 4.x and Telegram iOS ≥ 9 before tagging. |

---

## Definition of Done (whole plan)

- No file or env var mentions n8n.
- Bot commands, reminders, and daily digests all work with only Next.js + MongoDB + Telegram.
- `npm run verify` (lint + typecheck + tests) passes, and one Playwright smoke test runs clean locally.
- The home, detail, and board screens look like a 2026 product, not a 2015 admin panel.
- `README.md` is accurate and a new contributor can get running in under 10 minutes.
