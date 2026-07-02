export type Theme = "system" | "light" | "dark";

const media = window.matchMedia("(prefers-color-scheme: light)");
let systemListener: (() => void) | null = null;

/** Resolves the theme setting to a concrete data-theme attribute; in system
 *  mode, follows OS appearance changes live. */
export function applyTheme(theme: Theme) {
  if (systemListener) {
    media.removeEventListener("change", systemListener);
    systemListener = null;
  }
  const resolve = () => {
    document.documentElement.dataset.theme =
      theme === "system" ? (media.matches ? "light" : "dark") : theme;
  };
  resolve();
  if (theme === "system") {
    systemListener = resolve;
    media.addEventListener("change", systemListener);
  }
}
