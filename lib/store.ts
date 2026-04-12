import { create } from "zustand";
import type { IUser } from "@/types";

type AuthSlice = {
  token: string | null;
  user: IUser | null;
  setAuth: (token: string, user: IUser) => void;
  clearAuth: () => void;
};

type UiSlice = {
  isLoading: boolean;
  setLoading: (v: boolean) => void;
};

export type AppStore = AuthSlice & UiSlice;

export const useAppStore = create<AppStore>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  clearAuth: () => set({ token: null, user: null }),
  isLoading: true,
  setLoading: (v) => set({ isLoading: v }),
}));
