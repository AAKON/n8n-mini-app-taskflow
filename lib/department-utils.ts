import type { IDepartment } from "@/types";

export type DepartmentNode = IDepartment & { children: DepartmentNode[] };

/** Depth from materialized path: `a` → 1, `a.b` → 2 */
export function getDepth(path: string): number {
  const t = path.trim();
  if (!t) return 0;
  return t.split(".").length;
}

export function buildTree(departments: IDepartment[]): DepartmentNode[] {
  const sorted = [...departments].sort((a, b) => a.path.localeCompare(b.path));
  const map = new Map<string, DepartmentNode>();

  for (const d of sorted) {
    map.set(d.path, { ...d, children: [] });
  }

  const roots: DepartmentNode[] = [];

  for (const d of sorted) {
    const node = map.get(d.path)!;
    const pp = (d.parentPath ?? "").trim();
    if (pp && map.has(pp)) {
      map.get(pp)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortChildren(n: DepartmentNode) {
    n.children.sort((a, b) => a.name.localeCompare(b.name));
    n.children.forEach(sortChildren);
  }

  roots.sort((a, b) => a.name.localeCompare(b.name));
  roots.forEach(sortChildren);

  return roots;
}
