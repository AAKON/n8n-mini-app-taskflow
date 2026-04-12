import { useAppStore } from "@/lib/store";

export function useAuth() {
  const token = useAppStore((s) => s.token);
  const user = useAppStore((s) => s.user);

  return {
    token,
    user,
    isAuthenticated: !!token && !!user,
  };
}
