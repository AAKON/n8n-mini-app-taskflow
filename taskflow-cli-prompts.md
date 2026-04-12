# TaskFlow Telegram Mini App — Claude Code CLI Prompt Sequence

> **Usage:** Run each prompt in order. Wait for completion + tests pass before moving to the next. Each prompt is self-contained and references prior work.

---

## Stack

```
Next.js 14 (App Router) + TypeScript + MongoDB (Mongoose) + Tailwind CSS
Telegram Mini App SDK (@twa-dev/sdk) + Zustand + n8n
```

---

## Phase Summary

| Phase | Prompts | Output |
|---|---|---|
| 1 — Scaffold | 01–02 | Project + Types |
| 2 — Database | 03–04 | MongoDB + Models |
| 3 — Auth | 05–06 | JWT + RBAC |
| 4 — API | 07–08 | All REST routes |
| 5 — Frontend Foundation | 09–10 | TMA init + UI kit |
| 6 — Core Screens | 11–13 | List, Detail, Create |
| 7 — Management | 14–15 | Departments + Admin |
| 8 — n8n | 16–17 | Webhooks + Workflows |
| 9 — Polish & Deploy | 18–19 | Error handling + Docker |

---

## PHASE 1 — Project Scaffold

---

### PROMPT 01 — Initialize Project

```
Create a new Next.js 14 project called "taskflow-miniapp" with the following setup:

- Use App Router (not pages router)
- TypeScript strict mode
- Tailwind CSS
- ESLint
- src/ directory: NO (use root app/)
- Install additional dependencies:
  mongoose, jsonwebtoken, @types/jsonwebtoken,
  @twa-dev/sdk, zustand, dayjs, clsx, lucide-react

Create a .env.local file with these placeholder variables:
MONGODB_URI=mongodb://localhost:27017/taskflow
JWT_SECRET=your_jwt_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
BOT_TOKEN=your_bot_token_here

Create the base folder structure:
app/
  api/
lib/
models/
components/
  ui/
types/
hooks/

Print the final folder tree when done.
```

---

### PROMPT 02 — TypeScript Types

```
In the taskflow-miniapp project, create types/index.ts with all shared TypeScript interfaces:

- Role: "admin" | "department_head" | "manager" | "member"
- TaskStatus: "todo" | "in_progress" | "review" | "done"
- TaskPriority: "low" | "medium" | "high" | "urgent"

Interfaces:
- IUser: _id, telegramId (number), name, username?, avatarUrl?,
  role (Role), departmentPath (string), createdAt, updatedAt
- IDepartment: _id, name, path (string), parentPath (string),
  headId (string), memberCount?, createdAt
- IStep: _id, title, done (boolean), assigneeId?
- ITask: _id, title, description?, status, priority,
  assigneeId, assignedById, departmentPath,
  dueDate?, estimatedHours?,
  steps (IStep[]), tags (string[]),
  createdAt, updatedAt
- IComment: _id, taskId, userId, text, createdAt
- IActivityLog: _id, taskId, userId, action (string), meta (any), createdAt

Also create types/api.ts with:
- ApiResponse<T>: { success: boolean, data?: T, error?: string }
- PaginatedResponse<T>: extends ApiResponse with pagination meta
```

---

## PHASE 2 — Database Layer

---

### PROMPT 03 — MongoDB Connection

```
In taskflow-miniapp, create lib/mongodb.ts:

- Use mongoose for MongoDB connection
- Implement a singleton pattern with a cached connection
  (store on global object to survive Next.js hot reload in dev)
- Export a default connectDB() async function
- Log "MongoDB connected" on first connection,
  "Using cached MongoDB connection" on reuse
- Throw a clear error if MONGODB_URI is not set

Follow the standard Next.js + Mongoose connection pattern.
```

---

### PROMPT 04 — Mongoose Models

```
In taskflow-miniapp, create the following Mongoose models using the types defined in types/index.ts:

1. models/User.ts
   - telegramId: Number, unique, required
   - name: String, required
   - username: String
   - avatarUrl: String
   - role: enum ["admin","department_head","manager","member"], default "member"
   - departmentPath: String, default ""
   - timestamps: true

2. models/Department.ts
   - name: String, required
   - path: String, required, unique  (materialized path e.g. "eng.backend")
   - parentPath: String, default ""
   - headId: ObjectId ref User
   - timestamps: true
   - Index on path

3. models/Task.ts
   - title: String, required
   - description: String
   - status: enum, default "todo"
   - priority: enum, default "medium"
   - assigneeId: ObjectId ref User
   - assignedById: ObjectId ref User, required
   - departmentPath: String, required
   - dueDate: Date
   - estimatedHours: Number
   - steps: [{ title: String, done: Boolean, assigneeId: ObjectId }]
   - tags: [String]
   - timestamps: true
   - Indexes: status, assigneeId, departmentPath

4. models/Comment.ts
   - taskId: ObjectId ref Task, required
   - userId: ObjectId ref User, required
   - text: String, required
   - timestamps: true

5. models/ActivityLog.ts
   - taskId: ObjectId ref Task, required
   - userId: ObjectId ref User, required
   - action: String, required
   - meta: Mixed
   - createdAt: Date, default Date.now (no updatedAt needed)

Each model should check if it's already compiled (handle Next.js hot reload):
  export default mongoose.models.User || mongoose.model("User", UserSchema)
```

---

## PHASE 3 — Auth & Middleware

---

### PROMPT 05 — Telegram Auth & JWT

```
In taskflow-miniapp, create the following auth utilities:

1. lib/telegram.ts
   - validateTelegramInitData(initData: string): boolean
     Implements the official Telegram WebApp initData HMAC-SHA256 validation:
     - Parse initData as URLSearchParams
     - Extract and remove "hash" field
     - Sort remaining keys alphabetically
     - Build data_check_string as "key=value\n..." joined string
     - HMAC-SHA256 with key = HMAC-SHA256("WebAppData", BOT_TOKEN)
     - Compare computed hex with extracted hash
   - parseTelegramUser(initData: string): { id, first_name, last_name?, username?, photo_url? }
     Parse the "user" field from initData

2. lib/auth.ts
   - signJWT(payload: { userId: string, telegramId: number, role: string }): string
     Sign with JWT_SECRET, expires "7d"
   - verifyJWT(token: string): payload | null
     Returns null on any error
   - getAuthUser(request: Request): payload | null
     Extract Bearer token from Authorization header, verify, return payload

3. app/api/auth/telegram/route.ts — POST handler
   - Accept body: { initData: string }
   - Validate initData using validateTelegramInitData()
   - Return 401 if invalid
   - Parse user from initData
   - Upsert user in MongoDB (findOneAndUpdate by telegramId, upsert true)
   - Sign and return JWT with user _id, telegramId, role
   - Return: { token, user }

Use Node.js built-in crypto module (no external crypto packages).
```

---

### PROMPT 06 — RBAC Middleware

```
In taskflow-miniapp, create lib/rbac.ts:

Define role hierarchy:
const ROLE_HIERARCHY = { admin: 4, department_head: 3, manager: 2, member: 1 }

Export these functions:

1. hasRole(userRole: Role, requiredRole: Role): boolean
   - Returns true if userRole level >= requiredRole level

2. canAccessDepartment(userDeptPath: string, targetDeptPath: string, role: Role): boolean
   - admin: always true
   - department_head/manager: true if targetDeptPath starts with userDeptPath
   - member: true only if exact match

3. canModifyTask(user: IUser, task: ITask): boolean
   - admin: always true
   - department_head/manager: if canAccessDepartment passes
   - member: only if task.assigneeId === user._id

Also create lib/api-helpers.ts with:

1. withAuth(handler): wraps a route handler, extracts + verifies JWT,
   fetches full user from MongoDB, injects into handler as second arg
   Returns 401 if no valid token or user not found

2. apiResponse<T>(data: T, status = 200): NextResponse
3. apiError(message: string, status = 400): NextResponse

Usage pattern for route handlers:
  export const GET = withAuth(async (req, user) => { ... })
```

---

## PHASE 4 — API Routes

---

### PROMPT 07 — Users & Departments API

```
In taskflow-miniapp, create the following API route handlers.
Use withAuth and apiResponse/apiError from lib/api-helpers.ts.
Connect to MongoDB via connectDB() at the start of each handler.

1. app/api/users/route.ts — GET
   - Query params: departmentPath?, role?
   - admin: fetch all users matching filters
   - department_head/manager: only users whose departmentPath starts with theirs
   - member: 403
   - Populate with select: _id name username avatarUrl role departmentPath

2. app/api/users/[id]/route.ts
   - PATCH: update role and/or departmentPath (admin only)
   - Return updated user

3. app/api/departments/route.ts
   - GET: return all departments as flat array, client builds tree
     - admin: all departments
     - others: departments matching their departmentPath prefix
   - POST (admin only): create department
     - body: { name, parentPath? }
     - auto-generate path: parentPath ? parentPath + "." + slug(name) : slug(name)
     - slug = lowercase, spaces to underscores

4. app/api/departments/[id]/route.ts
   - PATCH (admin/dept_head): update name or headId
   - DELETE (admin only): only if no child departments exist (check path prefix)
```

---

### PROMPT 08 — Tasks API

```
In taskflow-miniapp, create the tasks API routes.
Use withAuth, apiResponse, apiError, canAccessDepartment, canModifyTask from lib/.

1. app/api/tasks/route.ts
   GET:
   - Query params: status?, priority?, assigneeId?, departmentPath?, page (default 1), limit (default 20)
   - Build MongoDB filter based on user role using canAccessDepartment
   - member: filter to assigneeId === user._id only
   - Sort by: dueDate asc (nulls last), createdAt desc
   - Return paginated result with total count

   POST:
   - Body: { title, description?, priority?, assigneeId?, departmentPath, dueDate?, estimatedHours?, tags? }
   - manager+ only
   - assignedById = authenticated user._id
   - Log activity: action "created"
   - Return created task

2. app/api/tasks/[id]/route.ts
   GET:
   - Fetch task, verify canAccessDepartment
   - Populate assigneeId and assignedById (name, username, avatarUrl)

   PATCH:
   - Body: partial task fields (title, description, status, priority, dueDate, assigneeId, tags)
   - Verify canModifyTask
   - If status changed: log activity action "status_changed" with meta { from, to }
   - If assigneeId changed: log activity action "reassigned"
   - Return updated task

   DELETE:
   - admin/manager only, verify canAccessDepartment
   - Hard delete task + its comments + activity logs

3. app/api/tasks/[id]/steps/route.ts
   POST:
   - Body: { title, assigneeId? }
   - Push new step to task.steps
   - Return updated steps array

   PATCH (for toggling):
   - Body: { stepId, done }
   - Update specific step by _id using positional operator
   - Return updated steps array

4. app/api/tasks/[id]/comments/route.ts
   GET: fetch all comments for task (populated with user name/avatar), sorted asc
   POST: body { text }, create comment, log activity "commented", return comment
```

---

## PHASE 5 — Frontend Foundation

---

### PROMPT 09 — TMA Init & Global State

```
In taskflow-miniapp, set up the Telegram Mini App foundation:

1. lib/tma.ts
   - isTMA(): boolean — checks if window.Telegram?.WebApp exists
   - getTelegramWebApp(): returns window.Telegram.WebApp or null
   - getInitData(): string — returns Telegram.WebApp.initData
   - setMainButton(text: string, onClick: () => void): void
   - hideMainButton(): void
   - showBackButton(onClick: () => void): void
   - hideBackButton(): void
   - haptic(type: "light"|"medium"|"heavy"|"success"|"error"): void
   - All functions gracefully no-op if not in TMA context

2. lib/store.ts — Zustand store with these slices:
   auth slice:
   - token: string | null
   - user: IUser | null
   - setAuth(token, user): void
   - clearAuth(): void

   ui slice:
   - isLoading: boolean
   - setLoading(v: boolean): void

3. app/layout.tsx
   - Import @twa-dev/sdk
   - Client component wrapper that on mount:
     a. Calls Telegram.WebApp.ready() and Telegram.WebApp.expand()
     b. Gets initData, POSTs to /api/auth/telegram
     c. On success: stores token + user in zustand
     d. Sets Telegram.WebApp color scheme from themeParams
   - Show a full-screen loading spinner until auth completes
   - Wrap children in the store provider
   - Apply Tailwind base styles respecting TMA dark/light theme

4. hooks/useAuth.ts — returns { user, token, isAuthenticated } from store
5. hooks/useApi.ts — returns a fetch wrapper that:
   - Automatically attaches Authorization: Bearer <token> header
   - Returns { data, error, loading }
   - Has get(url), post(url, body), patch(url, body), del(url) methods
```

---

### PROMPT 10 — UI Component Library

```
In taskflow-miniapp, create a Telegram-native UI component library in components/ui/.
Style with Tailwind. Use Telegram themeParams CSS variables for colors so
components automatically adapt to dark/light mode.

Add this to app/globals.css to map TMA theme vars:
:root {
  --tg-bg: var(--tg-theme-bg-color, #ffffff);
  --tg-text: var(--tg-theme-text-color, #000000);
  --tg-hint: var(--tg-theme-hint-color, #999999);
  --tg-link: var(--tg-theme-link-color, #2481cc);
  --tg-button: var(--tg-theme-button-color, #2481cc);
  --tg-button-text: var(--tg-theme-button-text-color, #ffffff);
  --tg-secondary-bg: var(--tg-theme-secondary-bg-color, #f1f1f1);
}

Create these components:

1. components/ui/Badge.tsx
   - Props: status (TaskStatus) | priority (TaskPriority) | custom label+color
   - Color-coded: todo=gray, in_progress=blue, review=amber, done=green
   - Priority: low=slate, medium=blue, high=orange, urgent=red
   - Small pill with dot indicator

2. components/ui/Avatar.tsx
   - Props: user (IUser), size?: "sm"|"md"|"lg"
   - Show avatarUrl if present, else initials from name
   - Colored background based on name hash

3. components/ui/BottomSheet.tsx
   - Props: isOpen, onClose, title?, children
   - Slides up from bottom with backdrop
   - Drag handle at top
   - Traps focus, closes on backdrop click or swipe down

4. components/ui/Spinner.tsx — centered loading spinner

5. components/ui/EmptyState.tsx
   - Props: icon, title, description, action?
   - Centered placeholder for empty lists

6. components/ui/PriorityIcon.tsx
   - Props: priority (TaskPriority)
   - Renders colored lucide-react icon per priority level
```

---

## PHASE 6 — Core Screens

---

### PROMPT 11 — Task List Screen

```
In taskflow-miniapp, build the main task list screen.

1. components/TaskCard.tsx
   - Props: task (ITask), onClick: () => void
   - Show: title, priority badge, status badge, due date (colored red if overdue),
     assignee avatar, step progress (e.g. "3/5 steps"), department path (small, muted)
   - Compact card with clear visual hierarchy
   - Tap calls onClick

2. app/page.tsx (Home screen)
   - Client component
   - Tabs at top: "My Tasks" | "Team" (manager+) | "All" (admin/dept_head)
   - Filter bar: status filter chips (All, Todo, In Progress, Review, Done)
   - Fetch tasks from /api/tasks with appropriate filters
   - Render TaskCard list with pull-to-refresh (re-fetch on scroll to top)
   - Empty state when no tasks
   - FAB (floating action button) bottom-right for creating task (manager+ only)
   - On mount: hide Telegram BackButton, set page title via Telegram.WebApp.setHeaderColor

3. hooks/useTasks.ts
   - useTasks(filters): { tasks, isLoading, error, refetch, loadMore }
   - Fetches from /api/tasks with pagination
   - Appends on loadMore (infinite scroll)
   - Exposes refetch for pull-to-refresh
```

---

### PROMPT 12 — Task Detail Screen

```
In taskflow-miniapp, build the task detail screen at app/tasks/[id]/page.tsx.

Layout: scrollable page with sticky header showing task title + status badge.

Sections (in order):
1. Header: title (editable inline for manager+), status badge, priority badge
2. Meta row: assignee avatar+name, due date, department
3. Description: show/edit textarea (manager+ can edit)
4. Steps / Checklist:
   - List of steps with checkbox toggle (calls PATCH /api/tasks/[id]/steps)
   - Progress bar showing X/Y complete
   - "Add step" input at bottom (manager+)
   - Optimistic UI: toggle immediately, revert on error
5. Comments section:
   - List of comments with avatar, name, timestamp
   - Text input at bottom with send button
   - POST to /api/tasks/[id]/comments on submit
   - Append optimistically

TMA integration:
- Show Telegram BackButton → navigates to home
- For manager+: show MainButton "Save Changes" when edits are pending
- On save: PATCH /api/tasks/[id], hide MainButton, show haptic success

Create components/TaskDetail.tsx and components/StepList.tsx as sub-components.
```

---

### PROMPT 13 — Create / Edit Task

```
In taskflow-miniapp, build the create/edit task flow as a BottomSheet
(not a separate page, to keep navigation native-feeling).

1. components/CreateTaskSheet.tsx
   - Props: isOpen, onClose, onCreated(task), editTask? (for edit mode)
   - Fields:
     a. Title (required, text input)
     b. Priority (segmented control: Low / Medium / High / Urgent)
     c. Status (only in edit mode, segmented control)
     d. Assignee (searchable user picker, fetches /api/users)
     e. Department (dropdown from /api/departments, filtered by user access)
     f. Due date (date picker input)
     g. Description (textarea, optional)
   - Validation: title required, department required
   - On submit: POST /api/tasks or PATCH /api/tasks/[id]
   - Use Telegram MainButton as the submit button ("Create Task" / "Save Task")
   - On success: call onCreated, close sheet, haptic success feedback

2. Wire it into app/page.tsx:
   - FAB click opens CreateTaskSheet with isOpen=true
   - On onCreated: prepend task to list (optimistic) and refetch

3. Wire it into app/tasks/[id]/page.tsx:
   - Edit button (manager+) opens CreateTaskSheet with editTask=currentTask
   - On save: refresh task detail data
```

---

## PHASE 7 — Management Screens

---

### PROMPT 14 — Department Tree Screen

```
In taskflow-miniapp, build the departments screen at app/departments/page.tsx.
Visible to admin and department_head roles only (redirect member/manager to home).

1. lib/department-utils.ts
   - buildTree(departments: IDepartment[]): DepartmentNode[]
     Converts flat array with materialized paths into nested tree structure
   - DepartmentNode: IDepartment & { children: DepartmentNode[] }
   - getDepth(path: string): number (count of dots + 1)

2. components/DepartmentTree.tsx
   - Props: nodes (DepartmentNode[]), onSelect, onAddChild, onEdit
   - Recursive component rendering indented tree
   - Each node shows: name, path (muted), head name, member count
   - Expand/collapse children on tap
   - Admin sees edit + add child buttons per node

3. app/departments/page.tsx
   - Fetch /api/departments, build tree
   - Render DepartmentTree
   - "Add Department" button at top (admin only) opens a small BottomSheet
     with fields: name, parent department (optional dropdown)
   - POST /api/departments on submit, refetch tree

4. Navigation: add "Departments" tab or link from home screen
   (visible only to admin and department_head)
```

---

### PROMPT 15 — Admin Panel

```
In taskflow-miniapp, build the admin panel at app/admin/page.tsx.
Redirect non-admin users to home.

Tabs:
1. Users tab:
   - Fetch all users from /api/users
   - Table/list: avatar, name, username, role badge, department
   - Tap user → opens UserEditSheet

2. components/UserEditSheet.tsx
   - Props: user, isOpen, onClose, onSaved
   - Fields: Role (dropdown), Department (dropdown from /api/departments)
   - On save: PATCH /api/users/[id]
   - Cannot change own role (disable if user._id === authUser._id)

3. Stats tab (read-only dashboard):
   - Fetch summary counts from /api/tasks (no pagination, just meta)
   - Show: Total tasks, by status breakdown (progress bars),
     Tasks overdue, Active members
   - Simple visual cards, no charts needed

4. Add a bottom navigation bar in app/layout.tsx (client component):
   - Show different tabs based on role:
     - member: Home
     - manager: Home, Team
     - dept_head: Home, Team, Departments
     - admin: Home, Team, Departments, Admin
   - Use lucide-react icons
   - Highlight active route
   - Fixed at bottom, above Telegram's bottom safe area
```

---

## PHASE 8 — n8n Integration

---

### PROMPT 16 — Webhook API Routes for n8n

```
In taskflow-miniapp, create internal API routes that n8n will call.
These routes use a shared secret instead of user JWT for machine-to-machine auth.

Add to .env.local:
N8N_SECRET=your_n8n_secret_here

Create lib/n8n-auth.ts:
- validateN8nSecret(req: Request): boolean
  Checks header x-n8n-secret === process.env.N8N_SECRET

Create these routes:

1. app/api/internal/user-register/route.ts — POST
   - Called by n8n on /start bot command
   - Body: { telegramId, name, username?, avatarUrl? }
   - Upsert user (same logic as auth route)
   - Return { user, isNew }

2. app/api/internal/task-summary/route.ts — POST
   - Body: { telegramId }
   - Find user by telegramId
   - Fetch their tasks: group by status, get overdue count
   - Return formatted summary object:
     { name, totalOpen, byStatus: {...}, overdue, upcomingDueToday }

3. app/api/internal/due-reminders/route.ts — GET
   - No body needed, called by n8n cron
   - Find all tasks where dueDate is within next 24 hours and status != "done"
   - Populate assignee telegramId
   - Return array: [{ telegramId, taskTitle, taskId, dueDate }]

4. app/api/internal/notifications/route.ts — POST
   - Called by n8n when it needs to log that a notification was sent
   - Body: { taskId, userId, type: "assigned"|"reminder"|"commented" }
   - Just logs to ActivityLog with action = "notification_sent"
   - Returns { ok: true }

Document in a ROUTES.md file all internal routes with expected payloads
so n8n workflow builders can reference them.
```

---

### PROMPT 17 — n8n Workflow Configs

```
Create a file n8n-workflows/README.md and five n8n workflow JSON export files
in the n8n-workflows/ directory. Each should be a valid n8n workflow JSON
that can be imported directly into n8n.

1. n8n-workflows/01-start-command.json
   Trigger: Telegram Bot node (message = "/start")
   Steps:
   a. HTTP Request → POST /api/internal/user-register with telegramId, name, username
   b. IF node: isNew === true → send welcome message, else send returning message
   c. Send Telegram message with inline keyboard:
      [{ text: "📋 Open TaskFlow", web_app: { url: NEXT_PUBLIC_APP_URL } }]

2. n8n-workflows/02-tasks-command.json
   Trigger: Telegram Bot node (message = "/tasks")
   Steps:
   a. HTTP Request → POST /api/internal/task-summary
   b. Format message using task summary data
   c. Send formatted summary message + Open App button

3. n8n-workflows/03-task-assigned-notification.json
   Trigger: Webhook node (called by your app when task is assigned)
   Steps:
   a. Receive: { taskId, taskTitle, assigneeTelegramId, assignedByName, dueDate? }
   b. Send Telegram message to assigneeTelegramId:
      "📌 New task assigned by {assignedByName}: {taskTitle}"
      With inline button: Open Task (web_app URL with /tasks/{taskId})
   c. HTTP Request → POST /api/internal/notifications to log it

4. n8n-workflows/04-due-reminders.json
   Trigger: Schedule node (every day at 8:00 AM)
   Steps:
   a. HTTP Request → GET /api/internal/due-reminders
   b. SplitInBatches node: iterate each reminder
   c. Send Telegram message per user: "⏰ Task due soon: {taskTitle} — due {dueDate}"
   d. HTTP Request → POST /api/internal/notifications to log each

5. n8n-workflows/05-daily-digest.json
   Trigger: Schedule node (every day at 9:00 AM)
   Steps:
   a. HTTP Request → GET /api/users (with n8n secret header)
   b. SplitInBatches: for each user with telegramId
   c. HTTP Request → POST /api/internal/task-summary per user
   d. IF totalOpen > 0: send digest message
   e. Format: "Good morning {name}! You have {totalOpen} open tasks..."

All HTTP Request nodes should include header: x-n8n-secret: {{ $env.N8N_SECRET }}
Use n8n expressions for dynamic values.
```

---

## PHASE 9 — Polish & Deploy

---

### PROMPT 18 — Error Handling & Loading States

```
In taskflow-miniapp, add global error handling and polish:

1. app/error.tsx — Next.js error boundary
   - Show friendly error message with retry button
   - Log error to console in dev

2. app/not-found.tsx — 404 page adapted for TMA

3. Add error handling to useApi.ts:
   - On 401: clear auth store, show re-auth prompt
   - On 500: show toast notification
   - On network error: show "No connection" state

4. Create components/ui/Toast.tsx:
   - Simple notification that slides in from top
   - Types: success (green), error (red), info (blue)
   - Auto-dismiss after 3 seconds
   - Add useToast() hook with show(message, type) function
   - Mount ToastContainer in app/layout.tsx

5. Add loading skeletons for:
   - TaskCard (pulsing placeholder)
   - Task detail page sections

6. Ensure all interactive elements have:
   - Disabled state during loading
   - Haptic feedback on tap (haptic("light"))
   - Proper touch target sizes (min 44px height)
```

---

### PROMPT 19 — Environment Config & Deployment

```
In taskflow-miniapp, prepare for production deployment:

1. Create next.config.ts:
   - Add security headers (X-Frame-Options, X-Content-Type-Options)
   - Note: Telegram Mini Apps are loaded in an iframe, so X-Frame-Options
     must be set to ALLOW-FROM or omitted for TMA to work correctly
   - Configure image domains if using external avatars

2. Create a production .env.example file with all required variables:
   MONGODB_URI=
   JWT_SECRET=
   NEXT_PUBLIC_APP_URL=
   BOT_TOKEN=
   N8N_SECRET=

3. Create Dockerfile:
   - Multi-stage build (node:20-alpine)
   - Stage 1: deps — install dependencies
   - Stage 2: builder — next build
   - Stage 3: runner — copy .next/standalone, minimal runtime
   - EXPOSE 3000, CMD ["node", "server.js"]

4. Create docker-compose.yml:
   - app service (this Next.js app)
   - mongo service (mongo:7, with volume for persistence)
   - n8n service (n8nio/n8n, with volume, env for DB and webhook URL)
   - All on same internal network

5. Create scripts/seed.ts:
   - Connects to MongoDB
   - Creates one admin user with a known telegramId (from env SEED_ADMIN_TELEGRAM_ID)
   - Creates root departments: Engineering, Design, Product
   - Creates 3 sample tasks in different statuses
   - Run with: npx tsx scripts/seed.ts

6. Update README.md with:
   - Prerequisites
   - Local setup steps
   - n8n setup steps (import workflows, set env vars)
   - Telegram bot setup (BotFather, set webhook, set menu button to web_app)
   - Docker deployment steps
```

---

## Quick Reference

### Role Permissions

| Action | member | manager | dept_head | admin |
|---|---|---|---|---|
| View own tasks | ✅ | ✅ | ✅ | ✅ |
| View team tasks | ❌ | ✅ | ✅ | ✅ |
| Create tasks | ❌ | ✅ | ✅ | ✅ |
| Assign tasks | ❌ | ✅ | ✅ | ✅ |
| Manage departments | ❌ | ❌ | ✅ | ✅ |
| Manage users/roles | ❌ | ❌ | ❌ | ✅ |

### API Route Map

```
POST   /api/auth/telegram
GET    /api/users
PATCH  /api/users/[id]
GET    /api/departments
POST   /api/departments
PATCH  /api/departments/[id]
DELETE /api/departments/[id]
GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/[id]
PATCH  /api/tasks/[id]
DELETE /api/tasks/[id]
POST   /api/tasks/[id]/steps
PATCH  /api/tasks/[id]/steps
GET    /api/tasks/[id]/comments
POST   /api/tasks/[id]/comments
POST   /api/internal/user-register
POST   /api/internal/task-summary
GET    /api/internal/due-reminders
POST   /api/internal/notifications
```

### n8n Workflows

| File | Trigger | Purpose |
|---|---|---|
| 01-start-command | /start command | Register user, show app button |
| 02-tasks-command | /tasks command | Send task summary |
| 03-task-assigned | Webhook | Notify assignee |
| 04-due-reminders | Cron 8:00 AM | Remind about due tasks |
| 05-daily-digest | Cron 9:00 AM | Morning summary per user |
