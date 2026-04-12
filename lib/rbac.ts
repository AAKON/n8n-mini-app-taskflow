import type { IUser, ITask, Role } from "@/types";

export const ROLE_HIERARCHY = {
  admin: 4,
  department_head: 3,
  manager: 2,
  member: 1,
} as const;

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function canAccessDepartment(
  userDeptPath: string,
  targetDeptPath: string,
  role: Role,
): boolean {
  if (role === "admin") return true;
  if (role === "member") {
    return targetDeptPath === userDeptPath;
  }
  if (role === "department_head" || role === "manager") {
    if (!userDeptPath) return false;
    return targetDeptPath.startsWith(userDeptPath);
  }
  return false;
}

export function canModifyTask(user: IUser, task: ITask): boolean {
  if (user.role === "admin") return true;
  if (user.role === "department_head" || user.role === "manager") {
    return canAccessDepartment(
      user.departmentPath,
      task.departmentPath,
      user.role,
    );
  }
  if (user.role === "member") {
    return String(task.assigneeId) === String(user._id);
  }
  return false;
}

/** List/detail visibility: members only see tasks assigned to them; others use department scope. */
export function canViewTask(user: IUser, task: ITask): boolean {
  if (user.role === "member") {
    return String(task.assigneeId) === String(user._id);
  }
  return canAccessDepartment(
    user.departmentPath,
    task.departmentPath,
    user.role,
  );
}
