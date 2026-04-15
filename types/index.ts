export type Role = "admin" | "department_head" | "manager" | "member";

export type TaskStatus = "todo" | "in_progress" | "review" | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface IUser {
  _id: string;
  telegramId: number;
  name: string;
  username?: string;
  avatarUrl?: string;
  role: Role;
  departmentPath: string;
  isBlocked?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IDepartment {
  _id: string;
  name: string;
  path: string;
  parentPath: string;
  headId?: string;
  memberCount?: number;
  createdAt: Date | string;
}

export interface IStep {
  _id: string;
  title: string;
  done: boolean;
  assigneeId?: string;
}

export interface ITask {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  assignedById: string;
  departmentPath: string;
  startDate?: Date | string;
  dueDate?: Date | string;
  estimatedHours?: number;
  steps: IStep[];
  tags: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface IComment {
  _id: string;
  taskId: string;
  userId: string;
  text: string;
  createdAt: Date | string;
}

export interface IActivityLog {
  _id: string;
  taskId: string;
  userId: string;
  action: string;
  meta: any;
  createdAt: Date | string;
}
