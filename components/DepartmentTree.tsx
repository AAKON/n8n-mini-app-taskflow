"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import type { DepartmentNode } from "@/lib/department-utils";
import { getDepth } from "@/lib/department-utils";

export type DepartmentTreeProps = {
  nodes: DepartmentNode[];
  onSelect?: (node: DepartmentNode) => void;
  onAddChild?: (node: DepartmentNode) => void;
  onEdit?: (node: DepartmentNode) => void;
  showAdminActions?: boolean;
  headName: (headId?: string) => string;
  memberCount: (path: string) => number;
};

function collectPaths(nodes: DepartmentNode[]): string[] {
  const out: string[] = [];
  function walk(list: DepartmentNode[]) {
    for (const n of list) {
      out.push(n.path);
      walk(n.children);
    }
  }
  walk(nodes);
  return out;
}

export function DepartmentTree({
  nodes,
  onSelect,
  onAddChild,
  onEdit,
  showAdminActions,
  headName,
  memberCount,
}: DepartmentTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const p of collectPaths(nodes)) {
        if (next[p] === undefined) next[p] = true;
      }
      return next;
    });
  }, [nodes]);

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const cur = prev[path] !== false;
      return { ...prev, [path]: !cur };
    });
  }, []);

  if (nodes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--tg-hint)]">
        No departments in your scope.
      </p>
    );
  }

  return (
    <div className="divide-y divide-black/5 dark:divide-white/10">
      {nodes.map((n) => (
        <TreeRows
          key={n.path}
          node={n}
          expanded={expanded}
          toggle={toggle}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onEdit={onEdit}
          showAdminActions={showAdminActions}
          headName={headName}
          memberCount={memberCount}
        />
      ))}
    </div>
  );
}

function TreeRows({
  node,
  expanded,
  toggle,
  onSelect,
  onAddChild,
  onEdit,
  showAdminActions,
  headName,
  memberCount,
}: {
  node: DepartmentNode;
  expanded: Record<string, boolean>;
  toggle: (path: string) => void;
  onSelect?: (node: DepartmentNode) => void;
  onAddChild?: (node: DepartmentNode) => void;
  onEdit?: (node: DepartmentNode) => void;
  showAdminActions?: boolean;
  headName: (headId?: string) => string;
  memberCount: (path: string) => number;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded[node.path] !== false;
  const depth = Math.max(0, getDepth(node.path) - 1);
  const pad = 10 + depth * 14;

  const onRowClick = () => {
    if (hasChildren) toggle(node.path);
    onSelect?.(node);
  };

  return (
    <>
      <div
        className="flex min-h-[52px] items-start gap-1 py-2"
        style={{ paddingLeft: pad }}
      >
        <div className="mt-0.5 flex h-9 w-9 shrink-0 justify-center">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.path);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--tg-hint)]"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onRowClick}
        >
          <p className="font-medium text-[var(--tg-text)]">{node.name}</p>
          <p className="mt-0.5 text-xs text-[var(--tg-hint)]">{node.path}</p>
          <p className="mt-1 text-xs text-[var(--tg-text)]">
            <span className="text-[var(--tg-hint)]">Head </span>
            {headName(node.headId)}
            <span className="mx-2 text-[var(--tg-hint)]">·</span>
            <span className="text-[var(--tg-hint)]">Members </span>
            {memberCount(node.path)}
          </p>
        </button>

        {showAdminActions ? (
          <div className="flex shrink-0 gap-1 pr-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(node);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]"
              aria-label="Edit department"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild?.(node);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]"
              aria-label="Add child department"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {hasChildren && isExpanded
        ? node.children.map((c) => (
            <TreeRows
              key={c.path}
              node={c}
              expanded={expanded}
              toggle={toggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onEdit={onEdit}
              showAdminActions={showAdminActions}
              headName={headName}
              memberCount={memberCount}
            />
          ))
        : null}
    </>
  );
}
