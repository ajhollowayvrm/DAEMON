<p align="center">
  <img src="public/assets/daemon-logo.png" alt="D.A.E.M.O.N." height="80" />
</p>

<h3 align="center">Distributed Autonomous Engineering Management Orchestration Node</h3>

<p align="center">
  A themeable productivity dashboard that unifies Slack, GitLab, Linear, and AI agent teams into a single command center — with swappable visual themes from Cyberpunk 2077 to Star Trek LCARS.
</p>

<p align="center">
  Built with <strong>Tauri v2</strong> · <strong>React 18</strong> · <strong>TypeScript</strong> · <strong>Rust</strong>
</p>

---

## What is D.A.E.M.O.N.?

D.A.E.M.O.N. is a native macOS desktop app that replaces tab-switching between Slack, GitLab, Linear, and your terminal. Everything you need to manage a dev team lives in one interface — styled however you want.

### Themes

Switch the entire visual experience on the fly via Settings (`Cmd+,`):

| Theme | Style | Boot Animation |
|-------|-------|----------------|
| **Cyberpunk 2077** | Neon glows, scanlines, glitch text, data streams, floating particles | Terminal BIOS POST → logo grow → fade to dashboard |
| **Star Trek: TNG** | LCARS panels with L-frames, curved elbows, segmented colored bars, flat/clean | Starfield → LCARS boot text → bars assemble from edges |
| **Star Trek: TOS** | Command gold, science blue, engineering red on dark navy | Starfield → Federation boot sequence |

Themes change **everything** — colors, layout structure, fonts, boot animation, HUD decorations, status bar, panel shapes, and logos. See [THEMES.md](THEMES.md) for how to create your own.

### Panels

| Panel | What it does |
|-------|-------------|
| **Slack** | Monitors specific channels, searches for comms-related messages, shows @mentions. Unread highlighting with read-on-click. Auto-resolves user IDs to names. |
| **GitLab MRs** | Team / Needs Your Approval / Mentions / My MRs tabs. Full MR detail view with pipeline visualization (hover for jobs, click to play/retry), approval rules, threaded discussions, merge button, and commenting. |
| **Linear** | Mine / Team / Ready tabs. Full ticket detail with rendered markdown, comments, and inline commenting back to Linear. |
| **Agent Teams** | 6 command teams launching Claude Code skills. Research & Ask chat box for freeform questions. Streaming output from `claude --print`. |

All panels are **closeable and reopenable** via the header bar toggle buttons.

### Features

- **Theme engine** — swap entire visual identity on the fly (Cyberpunk, Star Trek TNG, Star Trek TOS)
- **Native macOS notifications** for new team MRs, approval requests, and @mentions
- **Configurable boot sequence** — dramatic startup animation (3-15 seconds, adjustable per theme, or skip entirely)
- **Replay boot** — `Cmd+Shift+B` to rewatch the boot animation anytime
- **Slack credential extraction** — auto-extracts tokens from the Slack desktop app (no OAuth setup needed)
- **Settings via Cmd+,** or macOS menu bar — API keys, theme selection, boot animation settings
- **Native macOS window controls** — traffic lights, fullscreen to its own Space, minimize to Dock

---

## Getting Started

### Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| **Rust** | 1.70+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) or `brew install node` |
| **Slack Desktop** | Any | Must be signed in to your workspace |
| **Python 3** | 3.9+ | Needed for Slack credential extraction |
| **cryptography** (Python) | Any | `pip3 install cryptography` |

### API Keys

You'll need:

1. **GitLab Personal Access Token** — [Create one here](https://gitlab.com/-/user_settings/personal_access_tokens) with `read_api` scope
2. **Linear API Key** — Settings → API → Personal API keys in Linear

### Installation

```bash
# Clone the repo
git clone git@github.com:ajhollowayvrm/DAEMON.git
cd DAEMON

# Install frontend dependencies
npm install

# Create your .env file with API keys
cat > .env << EOF
GITLAB_PAT=glpat-xxxxxxxxxxxxxxxxxxxx
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxx
EOF

# Run in development mode
npm run tauri dev
```

The first build compiles ~450 Rust crates and takes 3-5 minutes. Subsequent builds are <1 second.

### First Run

1. The app opens with the boot sequence (configurable in Settings)
2. API keys from `.env` are stored in `~/.config/daemon/credentials.json`
3. Slack credentials are auto-extracted from your Slack desktop app
4. All 4 panels load data from their respective APIs
5. Reconfigure keys anytime via **D.A.E.M.O.N.** → **Settings** (or `Cmd+,`)

### Building the .app Bundle

```bash
npm run tauri build
```

This produces `D.A.E.M.O.N..app` in `src-tauri/target/release/bundle/macos/`. Drag it to `/Applications` — it appears in Launchpad and the Dock like any native app (~15MB).

---

## Configuration

### Environment Variables (`.env`)

```bash
GITLAB_PAT=glpat-your-token-here
LINEAR_API_KEY=lin_api_your-key-here
```

### Settings UI (`Cmd+,`)

- **Theme** — switch between Cyberpunk 2077, Star Trek TNG, Star Trek TOS
- **API Credentials** — view masked keys, update, test connections
- **Boot Sequence** — enable/disable, adjust duration slider (3-15 seconds)
- **Slack** — auto-configured from desktop app (no manual setup)

### Customization

These are currently hardcoded — edit the source to match your setup:

| What | File | Constant |
|------|------|----------|
| GitLab group ID | `src-tauri/src/commands/gitlab.rs` | `NECTARHR_GROUP_ID` |
| GitLab team usernames | `src-tauri/src/commands/gitlab.rs` | `TEAM_USERNAMES` |
| Linear team ID | `src-tauri/src/commands/linear.rs` | `COM_TEAM_ID` |
| Linear team members | `src-tauri/src/commands/linear.rs` | `TEAM_MEMBERS` |
| Watched Slack channels | `src-tauri/src/commands/slack.rs` | `WATCHED_CHANNELS` |
| Slack search queries | `src-tauri/src/commands/slack.rs` | Search strings in `get_slack_sections` |
| Agent command teams | `src/panels/agents/AgentsPanel.tsx` | `TEAMS` array |
| Poll intervals | `src/hooks/*.ts` | `refetchInterval` values |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                      │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────────┐ │
│  │  Slack   │ │  GitLab  │ │  Linear  │ │  Agent Teams    │ │
│  │  Panel   │ │  Panel   │ │  Panel   │ │  Panel          │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬─────────┘ │
│       │            │            │                │           │
│  ┌────┴────────────┴────────────┴────────────────┴────────┐  │
│  │     TanStack Query (polling + cache) + Theme Engine     │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │ invoke()                         │
├───────────────────────────┼──────────────────────────────────┤
│                    Tauri v2 IPC Bridge                        │
├───────────────────────────┼──────────────────────────────────┤
│                    Rust Backend (reqwest + tokio)             │
│                                                               │
│  Slack ──→ Python script (extract xoxc/xoxd from desktop)    │
│  GitLab ─→ REST API v4 (MRs, approvals, pipelines, jobs)    │
│  Linear ─→ GraphQL API (issues, comments, mutations)         │
│  Agents ─→ claude CLI subprocess (--print, streaming)        │
│                                                               │
│  Credentials: ~/.config/daemon/credentials.json             │
└───────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Desktop runtime | Tauri v2 | Native, ~15MB (vs Electron's 150MB+) |
| Frontend | React 18 + TypeScript + Vite | Standard, sub-second HMR |
| Data fetching | TanStack Query | Built-in polling, caching, deduplication |
| Styling | CSS Modules + Custom Properties | Theme engine swaps CSS vars at runtime |
| Fonts | Orbitron + Rajdhani + Antonio + JetBrains Mono | Self-hosted via @fontsource |
| Rust HTTP | reqwest | All API calls through Rust for security |
| Slack auth | Python + cryptography | Decrypts tokens from Slack's local storage |
| AI | Claude CLI | Spawned as subprocess, output streamed via Tauri events |

### Theme Engine

The theme engine supports complete visual overhauls — not just color swaps, but entirely different layouts:

- **CSS variables** applied to `:root` at runtime (colors, backgrounds, accents, glows, fonts)
- **Layout styles** (`cyberpunk`, `lcars`, `trek-tos`) change component structure via conditional rendering
- **Boot sequences** per theme with tiered text (short/medium/long), theme-specific animations
- **HUD decorations**, status bar text, and data stream characters per theme
- **Theme-specific logos** that swap in the title bar and boot screen

See [THEMES.md](THEMES.md) for the full guide to creating custom themes.

### Security Model

- **API tokens** stored in a local JSON file (`~/.config/daemon/credentials.json`), never in the webview
- **Slack credentials** extracted from the already-authenticated desktop app — no OAuth app registration needed
- **All external API calls** go through Rust — the frontend JavaScript never touches tokens directly
- `.env` and credential files are gitignored

### How Slack Auth Works

Instead of requiring a Slack app with OAuth scopes (which needs workspace admin approval), D.A.E.M.O.N. reads credentials directly from the Slack desktop app:

1. Reads `xoxc-` client tokens from Slack's LevelDB storage on disk
2. Decrypts the `xoxd-` cookie from Slack's SQLite Cookies database using the macOS Keychain (PBKDF2 with SHA-1, 1003 iterations → AES-128-CBC)
3. Caches credentials in memory
4. Uses both token + cookie to call Slack's Web API (`search.messages`, `conversations.history`, `users.info`)

**Requirement:** Slack desktop app must be installed and signed in.

---

## Project Structure

```
DAEMON/
├── src/                          # React frontend
│   ├── theme/                    # variables.css, globals.css, animations.css, fonts.css
│   ├── themes/                   # Theme engine
│   │   ├── types.ts              # ThemeDefinition interface
│   │   ├── ThemeProvider.tsx      # React context + CSS variable application
│   │   ├── cyberpunk.ts          # Cyberpunk 2077 theme
│   │   ├── trek-tng.ts           # Star Trek TNG (LCARS) theme
│   │   ├── trek-tos.ts           # Star Trek TOS theme
│   │   └── index.ts              # Theme registry
│   ├── components/
│   │   ├── layout/               # TitleBar, StatusBar, Panel, DashboardGrid, ScanlineOverlay, EmptySlot
│   │   └── ui/                   # GlowCard, NeonButton, RetroLoader, BootSequence, SettingsModal, HudDecorations
│   ├── panels/
│   │   ├── slack/                # SlackPanel — channel sections, unread tracking, message resolution
│   │   ├── gitlab/               # GitLabPanel + MRDetailView — pipeline, merge, comments
│   │   ├── linear/               # LinearPanel — detail view, markdown, commenting
│   │   └── agents/               # AgentsPanel — command teams, Claude CLI runner
│   ├── hooks/                    # TanStack Query hooks
│   ├── services/                 # tauri-bridge.ts, notifications.ts
│   └── types/                    # TypeScript interfaces
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # slack.rs, gitlab.rs, linear.rs, agent.rs, settings.rs
│   │   ├── services/             # credentials.rs, gitlab.rs, linear.rs, slack.rs
│   │   └── models/               # Rust types with serde
│   ├── scripts/slack_creds.py    # Slack credential extractor
│   └── Cargo.toml
├── public/assets/                # Theme logos and icons
├── .env                          # API keys (gitignored)
├── THEMES.md                     # Theme creation guide
└── package.json
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+,` | Open Settings |
| `Cmd+Shift+B` | Replay boot animation |
| `Cmd+Q` | Quit |

---

## Development

```bash
# Dev mode with hot reload
npm run tauri dev

# TypeScript check
npx tsc --noEmit

# Rust check
cd src-tauri && cargo check

# Build production .app
npm run tauri build
```

---

## Roadmap

- [ ] More themes (Star Wars, Retrowave, true Synthwave)
- [ ] Reminders & to-dos from Slack messages and MRs
- [ ] AI-suggested action items from unread messages
- [ ] Drag-and-drop panel arrangement
- [ ] Additional panel types (Calendar, Datadog, etc.)
- [ ] Anthropic API integration for in-app AI (no CLI dependency)
- [ ] Custom channel/team configuration via Settings UI
- [ ] Theme-specific macOS dock icons that swap with the theme
- [ ] Red Alert mode (Star Trek themes)

---

## Credits

Built by [AJ Holloway](https://github.com/ajhollowayvrm) with [Claude Code](https://claude.ai/claude-code).

---

<p align="center">
  <em>"It's not a bug, it's a feature."</em>
</p>
