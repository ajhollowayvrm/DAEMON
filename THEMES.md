# D.A.E.M.O.N. Theme Engine

The theme engine allows the entire visual identity of D.A.E.M.O.N. to be swapped at runtime. Themes control CSS custom properties, boot sequence text, HUD decorations, status bar content, and animation toggles.

## How It Works

1. **CSS Variables** — Each theme defines a complete set of CSS custom properties (colors, fonts, glows). The `ThemeProvider` applies these to `document.documentElement.style` on mount and whenever the theme changes. Because the entire app uses `var(--...)` references, all `.module.css` files automatically pick up the new values — no per-component changes needed.

2. **React Context** — Things that can't be expressed as CSS variables (boot text, ticker messages, HUD stat labels, particle colors) are exposed through the `useTheme()` hook. Consumer components read these values from context.

3. **Persistence** — The selected theme ID is stored in `localStorage` under the key `daemon_theme_id`. On next launch the provider reads it back.

## Architecture

```
src/themes/
  types.ts           — ThemeDefinition interface and sub-types
  cyberpunk.ts       — The original Cyberpunk 2077 theme
  ThemeProvider.tsx   — React context provider + useTheme() hook
  index.ts           — Theme registry, getTheme(), getAllThemes()
```

## ThemeDefinition Interface

### Top-level fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique kebab-case identifier (e.g. `"cyberpunk"`) |
| `name` | `string` | Human-readable name for the settings UI |
| `description` | `string` | One-line description shown on the theme card |
| `previewColors` | `string[]` | 3–5 hex colors rendered as a swatch strip in settings |

### `cssVariables: ThemeCSSVariables`

All CSS custom properties that cascade through the app. Key groups:

- **Background palette**: `--bg-deepest` through `--bg-hover` (darkest to lightest)
- **Neon accents**: `--neon-magenta`, `--neon-cyan`, `--neon-purple`, `--neon-green`, `--neon-orange`, `--neon-yellow`, `--neon-red`
- **RGB versions**: `--neon-magenta-rgb`, `--neon-cyan-rgb`, etc. — comma-separated R, G, B for use in `rgba(var(--neon-cyan-rgb), 0.3)`
- **Dimmed accents**: `--neon-*-dim` — low-opacity versions for subtle backgrounds/borders
- **Text colors**: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-bright`
- **Glow shadows**: `--glow-magenta`, `--glow-cyan`, `--glow-purple`, `--glow-green` — multi-layer box-shadow values
- **Panel glow**: `--panel-glow` — the glow effect around panel borders
- **Typography**: `--font-display`, `--font-body`, `--font-mono`

### `bootSequence: BootSequenceConfig`

| Field | Type | Description |
|-------|------|-------------|
| `lines` | `BootLine[]` | Array of `{ text, tier }`. Tier 1 = always shown, 2 = medium+ boot duration, 3 = long boot only |
| `logoPath` | `string` | Path to the logo image displayed after boot text |
| `textColor` | `string` | Default text color during boot |
| `okColor` | `string` | Color for lines containing OK / LINKED / PASS |
| `warnColor` | `string` | Color for lines containing FAILED / UNCERTAIN / INEVITABLE |
| `readyColor` | `string` | Color for the "ONLINE" banner line |

### `hud: HudConfig`

| Field | Type | Description |
|-------|------|-------------|
| `cornerStyle` | `"bracket" \| "angle" \| "none"` | Visual style of HUD corner marks |
| `stats` | `[HudStatLabel, HudStatLabel, HudStatLabel, HudStatLabel]` | Four stat readouts (TL, TR, BL, BR). Each has `label`, `base` value, and `range` for drift |
| `streamCharacters` | `string` | Character set for the Matrix-rain data streams |
| `streamColumnCount` | `number` | Number of vertical stream columns |
| `particleCount` | `number` | Number of floating ambient particles |
| `particleColors` | `string[]` | Color templates with `VAR_OPACITY` placeholder |

### `statusBar: StatusBarConfig`

| Field | Type | Description |
|-------|------|-------------|
| `leftTag` | `string` | Left-side HUD badge (e.g. `"SYS_ACTIVE"`) |
| `rightTag` | `string` | Right-side HUD badge (e.g. `"UPLINK_OK"`) |
| `tickerMessages` | `string[]` | Messages that scroll in the marquee ticker |

### `animations: AnimationFlags`

Boolean flags for each animation system:

| Flag | Description |
|------|-------------|
| `glitch` | Text glitch/distortion effects |
| `scanlines` | CRT scanline overlay |
| `borderTrace` | Animated neon trace around panel borders |
| `particles` | Floating ambient particles |
| `dataStreams` | Vertical Matrix-rain columns |
| `chromaticAberration` | RGB split effect on hover |

## How to Create a New Theme

### Step 1: Create the theme file

Create `src/themes/my-theme.ts`:

```ts
import type { ThemeDefinition } from "./types";

export const myTheme: ThemeDefinition = {
  id: "my-theme",
  name: "My Theme",
  description: "A brief description for the settings card",
  previewColors: ["#111111", "#3366ff", "#00ff88", "#ff3366", "#ffaa00"],

  cssVariables: {
    // ... all CSS variables (copy from cyberpunk.ts and modify)
  },

  bootSequence: {
    lines: [
      { text: "Booting My Theme...", tier: 1 },
      // ... more lines
    ],
    logoPath: "/assets/daemon-logo.png?v=5",
    textColor: "#3366ff",
    okColor: "#00ff88",
    warnColor: "#ff3366",
    readyColor: "#ffaa00",
  },

  hud: {
    cornerStyle: "bracket",
    stats: [
      { label: "MEM", base: 94.2, range: 4 },
      { label: "CPU", base: 23.5, range: 12 },
      { label: "NET", base: 87.0, range: 8 },
      { label: "BUF", base: 62.3, range: 10 },
    ],
    streamCharacters: "01ABCDEFabcdef",
    streamColumnCount: 8,
    particleCount: 10,
    particleColors: [
      "rgba(51, 102, 255, VAR_OPACITY)",
      "rgba(0, 255, 136, VAR_OPACITY)",
    ],
  },

  statusBar: {
    leftTag: "SYS_ACTIVE",
    rightTag: "UPLINK_OK",
    tickerMessages: [
      "// MY THEME //",
      "ALL SYSTEMS NOMINAL //",
    ],
  },

  animations: {
    glitch: true,
    scanlines: true,
    borderTrace: true,
    particles: true,
    dataStreams: true,
    chromaticAberration: true,
  },
};
```

### Step 2: Register it in the theme registry

Edit `src/themes/index.ts`:

```ts
import { myTheme } from "./my-theme";

const themes: Record<string, ThemeDefinition> = {
  [cyberpunkTheme.id]: cyberpunkTheme,
  [myTheme.id]: myTheme,          // <-- add here
};
```

That's it — the theme will automatically appear in the Settings modal.

### Step 3 (optional): Add custom fonts

1. Install the font package: `npm install @fontsource-variable/my-font`
2. Import it in `src/theme/fonts.css`
3. Reference it in your theme's `cssVariables["--font-display"]` (etc.)

## How Boot Lines Work (Tier System)

Boot lines have a `tier` property (1, 2, or 3) that controls which lines appear based on the boot animation duration the user has configured in Settings:

| Duration | Max Tier | Description |
|----------|----------|-------------|
| 3–6 seconds | 1 | Quick boot — only essential lines |
| 7–10 seconds | 2 | Medium boot — essential + detail lines |
| 11–15 seconds | 3 | Full boot — all lines shown |

Design your boot lines so that tier 1 tells a complete story on its own, tier 2 adds flavor, and tier 3 adds deep-cut jokes or technical detail.

## Example: Creating a Minimal "Clean" Theme

A "Clean" theme would strip away visual noise:

```ts
export const cleanTheme: ThemeDefinition = {
  id: "clean",
  name: "Clean",
  description: "Minimal, distraction-free — dark gray with soft blue accents",
  previewColors: ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#ffffff"],

  cssVariables: {
    "--bg-deepest": "#1a1a2e",
    "--bg-deep": "#16213e",
    "--bg-base": "#1a1a2e",
    "--bg-raised": "#222244",
    "--bg-surface": "#2a2a4a",
    "--bg-hover": "#333366",
    "--neon-magenta": "#e94560",
    "--neon-cyan": "#0f3460",
    "--neon-purple": "#533483",
    // ... etc
  },

  animations: {
    glitch: false,
    scanlines: false,
    borderTrace: false,
    particles: false,
    dataStreams: false,
    chromaticAberration: false,
  },

  // ... boot, hud, statusBar configs
};
```

Set all animation flags to `false` to disable the ambient effects. The HUD decorations, scanline overlay, and particle systems check these flags (or will in a future update) to conditionally render.
