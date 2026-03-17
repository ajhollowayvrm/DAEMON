/** ── Theme Definition ─────────────────────────────────────────────
 *  Describes every configurable aspect of a D.A.E.M.O.N. theme.
 *  CSS variables cascade automatically; non-CSS values (boot lines,
 *  ticker messages, HUD labels) are exposed via React context.
 * ──────────────────────────────────────────────────────────────── */

// ── Boot sequence ──

export interface BootLine {
  text: string;
  /** 1 = always shown, 2 = medium+ duration, 3 = long only */
  tier: 1 | 2 | 3;
}

export interface BootSequenceConfig {
  /** Lines displayed during the POST/boot text phase */
  lines: BootLine[];
  /** Path to the logo image shown after boot text clears */
  logoPath: string;
  /** CSS color of normal boot text */
  textColor: string;
  /** CSS color for lines that contain status keywords like OK / LINKED */
  okColor: string;
  /** CSS color for warning/failure lines */
  warnColor: string;
  /** CSS color for the "ONLINE" banner line */
  readyColor: string;
}

// ── HUD decorations ──

export interface HudStatLabel {
  label: string;
  base: number;
  range: number;
}

export interface HudConfig {
  /** Corner bracket style — reserved for future visual variants */
  cornerStyle: "bracket" | "angle" | "none";
  /** Four stat readouts: top-left, top-right, bottom-left, bottom-right */
  stats: [HudStatLabel, HudStatLabel, HudStatLabel, HudStatLabel];
  /** Characters used to generate data-stream columns */
  streamCharacters: string;
  /** Number of data-stream columns (split evenly left/right) */
  streamColumnCount: number;
  /** Number of floating particles */
  particleCount: number;
  /** Particle color templates — use "VAR_OPACITY" as placeholder */
  particleColors: string[];
}

// ── Status bar ──

export interface StatusBarConfig {
  /** Left-side HUD tag (e.g. "SYS_ACTIVE") */
  leftTag: string;
  /** Right-side HUD tag (e.g. "UPLINK_OK") */
  rightTag: string;
  /** Ticker messages that scroll across the status bar */
  tickerMessages: string[];
}

// ── Animation flags ──

export interface AnimationFlags {
  /** Glitch/distortion effects on text */
  glitch: boolean;
  /** CRT scanline overlay */
  scanlines: boolean;
  /** Animated border trace around panels */
  borderTrace: boolean;
  /** Floating ambient particles */
  particles: boolean;
  /** Vertical data-stream columns (Matrix rain) */
  dataStreams: boolean;
  /** RGB split / chromatic aberration on hover */
  chromaticAberration: boolean;
}

// ── CSS variable map ──

export interface ThemeCSSVariables {
  // Background palette
  "--bg-deepest": string;
  "--bg-deep": string;
  "--bg-base": string;
  "--bg-raised": string;
  "--bg-surface": string;
  "--bg-hover": string;

  // Neon accent colors
  "--neon-magenta": string;
  "--neon-cyan": string;
  "--neon-purple": string;
  "--neon-green": string;
  "--neon-orange": string;
  "--neon-yellow": string;
  "--neon-red": string;

  // RGB versions for rgba() usage
  "--neon-magenta-rgb": string;
  "--neon-cyan-rgb": string;
  "--neon-purple-rgb": string;
  "--neon-green-rgb": string;

  // Dimmed accents
  "--neon-magenta-dim": string;
  "--neon-cyan-dim": string;
  "--neon-purple-dim": string;
  "--neon-green-dim": string;

  // Text colors
  "--text-primary": string;
  "--text-secondary": string;
  "--text-muted": string;
  "--text-bright": string;

  // Glow shadows
  "--glow-magenta": string;
  "--glow-cyan": string;
  "--glow-purple": string;
  "--glow-green": string;

  // Panel glow
  "--panel-glow": string;

  // Typography
  "--font-display": string;
  "--font-body": string;
  "--font-mono": string;
}

// ── Full theme definition ──

export interface ThemeDefinition {
  /** Unique theme identifier (kebab-case) */
  id: string;
  /** Human-readable theme name */
  name: string;
  /** Short description shown in the theme selector */
  description: string;
  /** Preview colors shown in the theme card (3-5 hex colors) */
  previewColors: string[];
  /** All CSS custom properties this theme sets on :root */
  cssVariables: ThemeCSSVariables;
  /** Boot sequence configuration */
  bootSequence: BootSequenceConfig;
  /** HUD overlay configuration */
  hud: HudConfig;
  /** Status bar configuration */
  statusBar: StatusBarConfig;
  /** Which animations are enabled */
  animations: AnimationFlags;
}
