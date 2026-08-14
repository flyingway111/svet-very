const webApp = window.Telegram?.WebApp;

export function initTelegram() {
  webApp?.ready();
  webApp?.expand();
  return webApp;
}

export function initData() { return webApp?.initData || ''; }

export function haptic() { webApp?.HapticFeedback?.impactOccurred('light'); }
