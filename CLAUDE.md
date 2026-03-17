# NeonDash

Synthwave-themed productivity dashboard built with Tauri v2 + React 18 + TypeScript.

## Quick Start

```bash
npm run tauri dev     # Start dev mode (Vite + Tauri)
npm run tauri build   # Build .app bundle
```

## Architecture

- **Frontend**: React 18 + TypeScript + Vite, CSS Modules with custom properties
- **Backend**: Tauri v2 Rust — all external API calls go through Rust IPC commands
- **State**: Zustand stores + TanStack Query for data fetching/polling
- **Styling**: Synthwave theme via CSS custom properties (no Tailwind)
- **Fonts**: Orbitron (display), Rajdhani (body), JetBrains Mono (mono) — self-hosted via @fontsource

## Project Structure

- `src/theme/` — CSS variables, fonts, animations, globals
- `src/components/layout/` — DashboardGrid, Panel, TitleBar, StatusBar, ScanlineOverlay
- `src/components/ui/` — NeonButton, GlowCard, GradientText, RetroLoader
- `src/panels/` — slack/, gitlab/, agents/, linear/ — each panel is self-contained
- `src-tauri/src/commands/` — Tauri IPC command handlers
- `src-tauri/src/models/` — Rust types (serde)
- `src-tauri/src/services/` — Credentials, HTTP client, polling

## Notes

- No native window decorations — custom title bar with drag region
- API tokens stored in OS keychain via `keyring` crate
- Cargo binary at `/Users/ajholloway/.cargo/bin/cargo`
