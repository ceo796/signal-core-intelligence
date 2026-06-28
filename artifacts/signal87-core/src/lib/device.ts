/** True when the viewport matches the mobile shell breakpoint (< md / 768px). */
export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

/** iOS / iPadOS — native PDF embed is more reliable than pdf.js canvas here. */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isClassicIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isClassicIOS || isIPadOS;
}

/** Prefer the browser's built-in PDF renderer on small screens and iOS. */
export function prefersNativePdfViewer(): boolean {
  return isMobileViewport() || isIOSDevice();
}