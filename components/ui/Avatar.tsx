import clsx from "clsx";

/** Minimal user fields for avatars (list views, comments, etc.). */
export type AvatarUser = {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
};

const SIZES = {
  sm: { box: "h-8 w-8 min-h-8 min-w-8 text-xs" },
  md: { box: "h-10 w-10 min-h-10 min-w-10 text-sm" },
  lg: { box: "h-12 w-12 min-h-12 min-w-12 text-base" },
} as const;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  const single = parts[0] ?? "?";
  return single.slice(0, 2).toUpperCase();
}

function hueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
}

export type AvatarProps = {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  className?: string;
};

export function Avatar({ user, size = "md", className }: AvatarProps) {
  const { box } = SIZES[size];
  const label = initialsFromName(user.name);
  const hue = hueFromName(user.name);
  const bg = `hsl(${hue} 42% 42%)`;

  if (user.avatarUrl) {
    return (
      <span
        className={clsx(
          "relative inline-block overflow-hidden rounded-full ring-1 ring-[var(--tg-border)]",
          box,
          className,
        )}
      >
        {/* External Telegram avatar URLs — avoid next/image domain allowlist */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full font-semibold text-white ring-1 ring-[var(--tg-border)]",
        box,
        className,
      )}
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {label}
    </span>
  );
}
