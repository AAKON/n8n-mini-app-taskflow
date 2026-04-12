/** Escape a string for safe use inside a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Slug for department path segments: lowercase, spaces → underscores. */
export function slugifyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}
