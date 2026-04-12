import type { ITask, TaskPriority, TaskStatus } from "@/types";

type LeanStep = {
  _id: unknown;
  title: string;
  done: boolean;
  assigneeId?: unknown;
};

type LeanTaskDoc = {
  _id: unknown;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: unknown;
  assignedById: unknown;
  departmentPath: string;
  dueDate?: Date;
  estimatedHours?: number;
  steps?: LeanStep[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
};

export function leanToITask(doc: LeanTaskDoc): ITask {
  return {
    _id: String(doc._id),
    title: doc.title,
    description: doc.description,
    status: doc.status,
    priority: doc.priority,
    assigneeId: doc.assigneeId ? String(doc.assigneeId) : "",
    assignedById: String(doc.assignedById),
    departmentPath: doc.departmentPath,
    dueDate: doc.dueDate,
    estimatedHours: doc.estimatedHours,
    steps: (doc.steps ?? []).map((s) => ({
      _id: String(s._id),
      title: s.title,
      done: s.done,
      assigneeId: s.assigneeId ? String(s.assigneeId) : undefined,
    })),
    tags: doc.tags ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
