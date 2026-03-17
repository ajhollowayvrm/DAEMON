import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { ThemeDefinition, ThemeCSSVariables } from "./types";
import { getTheme, themeIds, defaultThemeId } from "./index";

// ── Context shape ──

interface ThemeContextValue {
  /** The full theme definition currently active */
  theme: ThemeDefinition;
  /** ID of the active theme */
  themeId: string;
  /** Switch to a different theme by ID */
  setThemeId: (id: string) => void;
  /** List of all available theme IDs */
  availableThemes: string[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── Local storage key ──

const STORAGE_KEY = "daemon_theme_id";

function readStoredThemeId(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && themeIds.includes(stored)) return stored;
  } catch {
    // localStorage not available — fall through
  }
  return defaultThemeId;
}

// ── Apply CSS variables to :root ──

function applyCSSVariables(vars: ThemeCSSVariables) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

// ── Provider ──

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(readStoredThemeId);
  const theme = getTheme(themeId);

  // Apply CSS variables whenever theme changes
  useEffect(() => {
    applyCSSVariables(theme.cssVariables);
  }, [theme]);

  const setThemeId = useCallback((id: string) => {
    const resolved = themeIds.includes(id) ? id : defaultThemeId;
    setThemeIdState(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, resolved);
    } catch {
      // localStorage not available — ignore
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, themeId, setThemeId, availableThemes: themeIds }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ──

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme() must be used within a <ThemeProvider>");
  }
  return ctx;
}
