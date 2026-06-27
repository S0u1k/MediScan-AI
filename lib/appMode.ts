export function isAppMode(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor || window.location.search.includes("app=true");
}
