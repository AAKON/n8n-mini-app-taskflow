import type { WebApp } from "@twa-dev/types";

export {};

declare global {
  interface Window {
    Telegram?: { WebApp: WebApp };
  }
}
