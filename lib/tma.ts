let mainButtonHandler: (() => void) | null = null;
let backButtonHandler: (() => void) | null = null;

export function isTMA(): boolean {
  return typeof window !== "undefined" && !!window.Telegram?.WebApp;
}

export function getTelegramWebApp() {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? "";
}

export function setMainButton(text: string, onClick: () => void): void {
  const wa = getTelegramWebApp();
  if (!wa) return;
  const mb = wa.MainButton;
  if (mainButtonHandler) {
    mb.offClick(mainButtonHandler);
    mainButtonHandler = null;
  }
  mainButtonHandler = onClick;
  mb.onClick(mainButtonHandler);
  mb.setParams({ text });
  mb.show();
}

export function hideMainButton(): void {
  const wa = getTelegramWebApp();
  if (!wa) return;
  const mb = wa.MainButton;
  if (mainButtonHandler) {
    mb.offClick(mainButtonHandler);
    mainButtonHandler = null;
  }
  mb.hide();
}

export function showBackButton(onClick: () => void): void {
  const wa = getTelegramWebApp();
  if (!wa) return;
  if (backButtonHandler) {
    wa.BackButton.offClick(backButtonHandler);
    backButtonHandler = null;
  }
  backButtonHandler = onClick;
  wa.BackButton.onClick(backButtonHandler);
  wa.BackButton.show();
}

export function hideBackButton(): void {
  const wa = getTelegramWebApp();
  if (!wa) return;
  if (backButtonHandler) {
    wa.BackButton.offClick(backButtonHandler);
    backButtonHandler = null;
  }
  wa.BackButton.hide();
}

export function haptic(
  type: "light" | "medium" | "heavy" | "success" | "error",
): void {
  const wa = getTelegramWebApp();
  if (!wa) return;
  const h = wa.HapticFeedback;
  if (type === "success" || type === "error") {
    h.notificationOccurred(type === "success" ? "success" : "error");
    return;
  }
  const style =
    type === "light"
      ? "light"
      : type === "heavy"
        ? "heavy"
        : "medium";
  h.impactOccurred(style);
}
