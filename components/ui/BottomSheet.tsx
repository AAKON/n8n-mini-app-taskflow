"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export type BottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const dragStart = useRef<{ y: number; active: boolean }>({
    y: 0,
    active: false,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const trapFocus = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !sheetRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = sheetRef.current;
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", trapFocus);
    const t = window.setTimeout(() => {
      const root = sheetRef.current;
      const first = root?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      window.clearTimeout(t);
    };
  }, [isOpen, trapFocus]);

  const onPointerDownHandle = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    dragStart.current = { y: e.clientY, active: true };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMoveHandle = (e: ReactPointerEvent) => {
    if (!dragStart.current.active) return;
    const dy = e.clientY - dragStart.current.y;
    if (dy > 80) {
      dragStart.current.active = false;
      onClose();
    }
  };

  const onPointerUpHandle = () => {
    dragStart.current.active = false;
  };

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end"
      role="presentation"
    >
      <div
        className="absolute inset-0 cursor-pointer bg-black/40 transition-opacity"
        aria-hidden
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        role="presentation"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={clsx(
          "relative mt-auto max-h-[85vh] translate-y-0 overflow-hidden rounded-t-2xl bg-[var(--tg-bg)] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] transition-transform duration-200 ease-out",
          className,
        )}
        tabIndex={-1}
      >
        <div
          className="flex cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
          onPointerDown={onPointerDownHandle}
          onPointerMove={onPointerMoveHandle}
          onPointerUp={onPointerUpHandle}
          onPointerCancel={onPointerUpHandle}
        >
          <span className="h-1 w-10 rounded-full bg-[var(--tg-hint)]/50" />
        </div>
        {title ? (
          <h2
            id={titleId}
            className="border-b border-[var(--tg-secondary-bg)] px-4 pb-3 text-base font-semibold text-[var(--tg-text)]"
          >
            {title}
          </h2>
        ) : null}
        <div className="max-h-[min(70vh,calc(85vh-4rem))] overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
