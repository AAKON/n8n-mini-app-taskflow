import mongoose, { Schema } from "mongoose";

const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const TaskSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    status: { type: String, enum: TASK_STATUSES, default: "todo" },
    priority: { type: String, enum: TASK_PRIORITIES, default: "medium" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    assignedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    departmentPath: { type: String, required: true },
    dueDate: Date,
    estimatedHours: Number,
    steps: [
      {
        title: { type: String, required: true },
        done: { type: Boolean, default: false },
        assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
    tags: [String],
  },
  { timestamps: true },
);

TaskSchema.index({ status: 1 });
TaskSchema.index({ assigneeId: 1 });
TaskSchema.index({ departmentPath: 1 });

export default mongoose.models.Task || mongoose.model("Task", TaskSchema);
