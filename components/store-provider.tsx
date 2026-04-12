"use client";

/**
 * Zustand state lives in the module; this marks the client subtree that may
 * call hooks backed by the store (and keeps a stable place to nest providers).
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  return children;
}
