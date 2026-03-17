import type { ThemeDefinition } from "./types";
import { cyberpunkTheme } from "./cyberpunk";
import { trekTosTheme } from "./trek-tos";
import { trekTngTheme } from "./trek-tng";

// ── Theme registry ──

const themes: Record<string, ThemeDefinition> = {
  [cyberpunkTheme.id]: cyberpunkTheme,
  [trekTosTheme.id]: trekTosTheme,
  [trekTngTheme.id]: trekTngTheme,
};

/** All registered theme IDs */
export const themeIds: string[] = Object.keys(themes);

/** The default theme ID (used when nothing is stored) */
export const defaultThemeId = "cyberpunk";

/** Look up a theme by ID. Falls back to the default theme. */
export function getTheme(id: string): ThemeDefinition {
  return themes[id] ?? themes[defaultThemeId];
}

/** Get all registered themes as an array */
export function getAllThemes(): ThemeDefinition[] {
  return Object.values(themes);
}

// Re-export types for convenience
export type { ThemeDefinition } from "./types";
export { useTheme, ThemeProvider } from "./ThemeProvider";
