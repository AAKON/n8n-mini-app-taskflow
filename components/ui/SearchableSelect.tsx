"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { haptic } from "@/lib/tma";

export type SelectOption = {
  value: string;
  label: string;
  prefix?: React.ReactNode;
};

type Props = {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  tabIndex?: number;
};

export function SearchableSelect({ placeholder, value, onChange, options, tabIndex }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) { setQuery(""); return; }
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        tabIndex={tabIndex}
        onClick={() => { haptic("light"); setOpen((v) => !v); }}
        className={clsx(
          "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition",
          open || value
            ? "border-[var(--tg-button)] bg-[var(--tg-button)]/10 text-[var(--tg-text)]"
            : "border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] text-[var(--tg-hint)]",
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {selected?.prefix ? <span className="shrink-0">{selected.prefix}</span> : null}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value ? (
            <span
              role="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.stopPropagation();
                haptic("light");
                onChange("");
                setOpen(false);
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full text-[var(--tg-hint)] hover:text-[var(--tg-text)]"
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
          <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[90] overflow-hidden rounded-xl border border-[var(--tg-border)] bg-[var(--tg-card-bg)] shadow-[var(--shadow-lg)]">
          <div className="border-b border-[var(--tg-border)] px-2 py-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--tg-hint)]" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="tf-input w-full rounded-lg py-1.5 pl-7 pr-2 text-xs"
              />
            </div>
          </div>

          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-[var(--tg-hint)]">No results</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value || "__all__"}>
                  <button
                    type="button"
                    onClick={() => {
                      haptic("light");
                      onChange(o.value === value ? "" : o.value);
                      setOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2 px-3 py-2 text-xs transition",
                      o.value === value
                        ? "bg-[var(--tg-button)]/10 font-semibold text-[var(--tg-text)]"
                        : "text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)]",
                    )}
                  >
                    {o.prefix ? <span className="shrink-0">{o.prefix}</span> : null}
                    <span className="flex-1 truncate text-left">{o.label}</span>
                    {o.value === value ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--tg-button)]" /> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
