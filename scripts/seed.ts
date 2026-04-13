/**
 * Seed script — populates MongoDB with sample data for local development.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Set MONGODB_URI in .env.local (loaded automatically via dotenv).
 * Set SEED_ADMIN_TELEGRAM_ID to use a specific Telegram ID for the admin user
 * (defaults to 999000001, same as the dev sign-in user).
 */

import "dotenv/config";
import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Inline models (avoids Next.js module issues when running outside the app)
// ---------------------------------------------------------------------------

const UserSchema = new mongoose.Schema(
  {
    telegramId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    username: String,
    avatarUrl: String,
    role: {
      type: String,
      enum: ["admin", "department_head", "manager", "member"],
      default: "member",
    },
    departmentPath: { type: String, default: "" },
  },
  { timestamps: true },
);

const DepartmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    path: { type: String, required: true, unique: true },
    parentPath: { type: String, default: "" },
    headId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "done"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    departmentPath: { type: String, required: true },
    dueDate: Date,
    estimatedHours: Number,
    steps: [
      {
        title: { type: String, required: true },
        done: { type: Boolean, default: false },
        assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    tags: [String],
  },
  { timestamps: true },
);

const CommentSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true },
  },
  { timestamps: true },
);

const User =
  mongoose.models.User || mongoose.model("User", UserSchema);
const Department =
  mongoose.models.Department || mongoose.model("Department", DepartmentSchema);
const Task =
  mongoose.models.Task || mongoose.model("Task", TaskSchema);
const Comment =
  mongoose.models.Comment || mongoose.model("Comment", CommentSchema);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function log(msg: string) {
  console.log(`  ✓ ${msg}`);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌  MONGODB_URI is not set. Add it to .env.local");
    process.exit(1);
  }

  console.log("\n🌱  Connecting to MongoDB…");
  await mongoose.connect(uri);
  console.log("   Connected.\n");

  // ── Clean existing seed data (idempotent) ──────────────────────────────
  console.log("🧹  Clearing existing collections…");
  await Promise.all([
    User.deleteMany({}),
    Department.deleteMany({}),
    Task.deleteMany({}),
    Comment.deleteMany({}),
  ]);
  log("Collections cleared");

  // ── Departments ────────────────────────────────────────────────────────
  console.log("\n🏢  Creating departments…");

  const departments = await Department.insertMany([
    { name: "Engineering", path: "engineering", parentPath: "" },
    { name: "Backend",     path: "engineering.backend",  parentPath: "engineering" },
    { name: "Frontend",    path: "engineering.frontend", parentPath: "engineering" },
    { name: "Design",      path: "design",   parentPath: "" },
    { name: "Product",     path: "product",  parentPath: "" },
  ]);

  const deptByPath = Object.fromEntries(
    departments.map((d) => [d.path, d]),
  );
  log(`${departments.length} departments created`);

  // ── Users ──────────────────────────────────────────────────────────────
  console.log("\n👥  Creating users…");

  const ADMIN_TG_ID = Number(process.env.SEED_ADMIN_TELEGRAM_ID) || 999_000_001;

  const [admin, deptHead, manager, alice, bob, carol] = await User.insertMany([
    {
      telegramId: ADMIN_TG_ID,
      name: "Admin User",
      username: "admin",
      role: "admin",
      departmentPath: "",
    },
    {
      telegramId: ADMIN_TG_ID + 1,
      name: "Dana Head",
      username: "danahead",
      role: "department_head",
      departmentPath: "engineering",
    },
    {
      telegramId: ADMIN_TG_ID + 2,
      name: "Max Manager",
      username: "maxmgr",
      role: "manager",
      departmentPath: "engineering.backend",
    },
    {
      telegramId: ADMIN_TG_ID + 3,
      name: "Alice Dev",
      username: "alicedev",
      role: "member",
      departmentPath: "engineering.backend",
    },
    {
      telegramId: ADMIN_TG_ID + 4,
      name: "Bob Frontend",
      username: "bobfe",
      role: "member",
      departmentPath: "engineering.frontend",
    },
    {
      telegramId: ADMIN_TG_ID + 5,
      name: "Carol Designer",
      username: "caroldesign",
      role: "member",
      departmentPath: "design",
    },
  ]);

  // Assign department heads
  await Department.updateOne(
    { path: "engineering" },
    { headId: deptHead._id },
  );

  log(`6 users created`);
  log(`Admin telegramId: ${ADMIN_TG_ID} (matches dev sign-in)`);

  // ── Tasks ──────────────────────────────────────────────────────────────
  console.log("\n📋  Creating tasks…");

  const tasks = await Task.insertMany([
    {
      title: "Set up CI/CD pipeline",
      description: "Configure GitHub Actions for automated testing and deployment to production.",
      status: "done",
      priority: "high",
      assigneeId: alice._id,
      assignedById: manager._id,
      departmentPath: "engineering.backend",
      dueDate: daysFromNow(-5),
      estimatedHours: 8,
      tags: ["devops", "infrastructure"],
      steps: [
        { title: "Create GitHub Actions workflow file", done: true },
        { title: "Add test step", done: true },
        { title: "Add deploy step", done: true },
        { title: "Test on staging", done: true },
      ],
    },
    {
      title: "Implement user authentication API",
      description: "Build JWT-based auth endpoints including login, refresh, and logout.",
      status: "in_progress",
      priority: "urgent",
      assigneeId: alice._id,
      assignedById: manager._id,
      departmentPath: "engineering.backend",
      dueDate: daysFromNow(2),
      estimatedHours: 12,
      tags: ["auth", "api"],
      steps: [
        { title: "Design token schema", done: true },
        { title: "Implement login endpoint", done: true },
        { title: "Implement refresh endpoint", done: false },
        { title: "Write tests", done: false },
      ],
    },
    {
      title: "Database query optimisation",
      description: "Profile slow queries and add missing indexes. Target < 50ms p95.",
      status: "todo",
      priority: "medium",
      assigneeId: alice._id,
      assignedById: manager._id,
      departmentPath: "engineering.backend",
      dueDate: daysFromNow(7),
      estimatedHours: 6,
      tags: ["performance", "database"],
      steps: [
        { title: "Run EXPLAIN on top 10 slow queries", done: false },
        { title: "Add indexes", done: false },
        { title: "Benchmark before/after", done: false },
      ],
    },
    {
      title: "Redesign dashboard UI",
      description: "Refresh the main dashboard with updated Figma designs. Mobile-first.",
      status: "review",
      priority: "high",
      assigneeId: bob._id,
      assignedById: deptHead._id,
      departmentPath: "engineering.frontend",
      dueDate: daysFromNow(1),
      estimatedHours: 16,
      tags: ["ui", "redesign"],
      steps: [
        { title: "Implement new layout", done: true },
        { title: "Responsive breakpoints", done: true },
        { title: "Cross-browser testing", done: false },
        { title: "Accessibility audit", done: false },
      ],
    },
    {
      title: "Create onboarding illustrations",
      description: "Design 5 illustrations for the new user onboarding flow.",
      status: "in_progress",
      priority: "medium",
      assigneeId: carol._id,
      assignedById: admin._id,
      departmentPath: "design",
      dueDate: daysFromNow(10),
      estimatedHours: 20,
      tags: ["design", "onboarding"],
      steps: [
        { title: "Sketch concepts", done: true },
        { title: "Get feedback from product", done: true },
        { title: "Final illustrations (x5)", done: false },
        { title: "Export assets", done: false },
      ],
    },
    {
      title: "Fix payment checkout bug",
      description: "Users report duplicate charges on retry. Reproduce and fix.",
      status: "todo",
      priority: "urgent",
      assigneeId: alice._id,
      assignedById: manager._id,
      departmentPath: "engineering.backend",
      dueDate: daysFromNow(-1), // overdue
      estimatedHours: 4,
      tags: ["bug", "payments"],
      steps: [
        { title: "Reproduce bug", done: false },
        { title: "Identify root cause", done: false },
        { title: "Apply fix + add idempotency key", done: false },
        { title: "QA sign-off", done: false },
      ],
    },
  ]);

  log(`${tasks.length} tasks created (various statuses + 1 overdue)`);

  // ── Comments ───────────────────────────────────────────────────────────
  console.log("\n💬  Adding sample comments…");

  const authTask = tasks[1]; // "Implement user authentication API"
  await Comment.insertMany([
    {
      taskId: authTask._id,
      userId: manager._id,
      text: "Make sure we use RS256 for the JWT algorithm, not HS256.",
    },
    {
      taskId: authTask._id,
      userId: alice._id,
      text: "Good call — I'll update the token signing config.",
    },
    {
      taskId: tasks[3]._id, // dashboard UI
      userId: deptHead._id,
      text: "Looking good! Just needs the accessibility fixes before we merge.",
    },
  ]);

  log("3 comments added");

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("\n✅  Seed complete!\n");
  console.log("   Users:");
  console.log(`     Admin (telegramId ${ADMIN_TG_ID})  — role: admin`);
  console.log(`     Dana Head (telegramId ${ADMIN_TG_ID + 1}) — role: department_head, dept: engineering`);
  console.log(`     Max Manager (telegramId ${ADMIN_TG_ID + 2}) — role: manager, dept: engineering.backend`);
  console.log(`     Alice Dev (telegramId ${ADMIN_TG_ID + 3}) — role: member, dept: engineering.backend`);
  console.log(`     Bob Frontend (telegramId ${ADMIN_TG_ID + 4}) — role: member, dept: engineering.frontend`);
  console.log(`     Carol Designer (telegramId ${ADMIN_TG_ID + 5}) — role: member, dept: design`);
  console.log("\n   Tip: 'Dev sign-in' in the browser logs you in as the Admin user.\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("\n❌  Seed failed:", err);
  process.exit(1);
});
