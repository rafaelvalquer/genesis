export function getPlatformInfo() {
  if (typeof window === "undefined") {
    return { isNative: false, isAndroid: false, isTouch: false, isDesktop: true };
  }

  const capacitor = window.Capacitor;
  const userAgent = navigator.userAgent || "";
  const isAndroid = /Android/i.test(userAgent);
  const capacitorNative = Boolean(capacitor?.isNativePlatform?.());
  const androidWebView = isAndroid && (/; wv\)/i.test(userAgent) || /Version\/\d+\.\d+ Chrome\//i.test(userAgent));
  const isNative = capacitorNative || androidWebView;
  const isTouch = navigator.maxTouchPoints > 0 || window.matchMedia?.("(pointer: coarse)")?.matches === true;

  return {
    isNative,
    isAndroid,
    isTouch,
    isDesktop: !isTouch,
  };
}

export const Platform = getPlatformInfo();

export function applyPlatformClasses(root = document.documentElement) {
  if (!root) return;
  root.classList.toggle("is-native", Platform.isNative);
  root.classList.toggle("is-android", Platform.isAndroid);
  root.classList.toggle("is-touch", Platform.isTouch);
  root.classList.toggle("is-desktop", Platform.isDesktop);
}
