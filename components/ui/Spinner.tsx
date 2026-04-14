import clsx from "clsx";

export type SpinnerProps = {
  className?: string;
  label?: string;
};

export function Spinner({ className, label = "Loading" }: SpinnerProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-3 p-6 text-[var(--tg-hint)]",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--tg-border-strong)] border-t-[var(--tg-button)]"
        aria-hidden
      />
      <span className="text-xs">{label}</span>
    </div>
  );
}
