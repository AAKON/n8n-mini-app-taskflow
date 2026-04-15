"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import dayjs from "dayjs";
import clsx from "clsx";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Props = {
  value: dayjs.Dayjs; // start-of-month
  onChange: (m: dayjs.Dayjs) => void;
};

export function MonthYearNav({ value, onChange }: Props) {
  const [picking, setPicking] = useState(false);
  const [pickYear, setPickYear] = useState(value.year());

  const go = (m: dayjs.Dayjs) => { onChange(m.startOf("month")); };

  if (picking) {
    return (
      <div className="flex flex-col gap-2 px-1">
        {/* Year row */}
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => setPickYear((y) => y - 1)}
            className="tf-icon-btn flex h-8 w-8 items-center justify-center rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-sm font-semibold">{pickYear}</span>
          <button
            type="button"
            onClick={() => setPickYear((y) => y + 1)}
            className="tf-icon-btn flex h-8 w-8 items-center justify-center rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-4 gap-1">
          {MONTHS.map((m, i) => {
            const selected = i === value.month() && pickYear === value.year();
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  go(dayjs().year(pickYear).month(i));
                  setPicking(false);
                }}
                className={clsx(
                  "rounded-lg py-1.5 text-xs font-medium transition",
                  selected
                    ? "bg-[var(--tg-button)] text-[var(--tg-button-text)]"
                    : "bg-[var(--tg-secondary-bg)] text-[var(--tg-text)]",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setPicking(false)}
          className="text-center text-xs text-[var(--tg-hint)] underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-1">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => { go(value.subtract(1, "year")); }}
          className="tf-icon-btn flex h-9 w-9 items-center justify-center rounded-full"
          aria-label="Previous year"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => { go(value.subtract(1, "month")); }}
          className="tf-icon-btn flex h-9 w-9 items-center justify-center rounded-full"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => { setPickYear(value.year()); setPicking(true); }}
        className="rounded-lg px-3 py-1.5 text-sm font-semibold transition hover:bg-[var(--tg-secondary-bg)] active:scale-95"
      >
        {value.format("MMMM YYYY")}
      </button>

      <div className="flex items-center">
        <button
          type="button"
          onClick={() => { go(value.add(1, "month")); }}
          className="tf-icon-btn flex h-9 w-9 items-center justify-center rounded-full"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => { go(value.add(1, "year")); }}
          className="tf-icon-btn flex h-9 w-9 items-center justify-center rounded-full"
          aria-label="Next year"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
