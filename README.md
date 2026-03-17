<p align="center">
  <img src="public/assets/daemon-logo.png" alt="D.A.E.M.O.N." height="80" />
</p>

<h3 align="center">Distributed Autonomous Engineering Management Orchestration Node</h3>

<p align="center">
  A Cyberpunk 2077-themed productivity dashboard that unifies Slack, GitLab, Linear, and AI agent teams into a single command center.
</p>

<p align="center">
  Built with <strong>Tauri v2</strong> · <strong>React 18</strong> · <strong>TypeScript</strong> · <strong>Rust</strong>
</p>

---

## What is D.A.E.M.O.N.?

D.A.E.M.O.N. is a native macOS desktop app that replaces tab-switching between Slack, GitLab, Linear, and your terminal. Everything you need to manage a dev team lives in one synthwave-themed HUD.

### Panels

| Panel | What it does |
|-------|-------------|
| **Slack** | Monitors specific channels, searches for comms-related messages in #engineering and #customer-issues, shows @mentions. Unread highlighting with read-on-click. |
| **GitLab MRs** | Team / Needs Your Approval / Mentions / My MRs tabs. Click into full MR detail view with pipeline visualization, approval status, discussions, merge button, and job play/retry. |
| **Linear** | Mine / Team / Ready tabs. Click into full ticket detail view with rendered markdown descriptions, comments, and inline commenting. |
| **Agent Teams** | 6 organized command teams that launch Claude Code skills directly. Research & Ask chat box for freeform questions. Streaming output. |

### Features

- **Native macOS notifications** for new team MRs, approval requests, and @mentions
- **Closeable/reopenable panels** via header bar toggles
- **Full MR detail view** — pipeline stages (hover for jobs, click to play/retry), approval rules, threaded discussions, merge button, comment input
- **Full ticket detail view** — markdown rendering, comments, inline commenting to Linear
- **Boot sequence** — configurable dramatic Cyberpunk terminal startup (3-15 seconds, or skip entirely)
- **Cyberpunk HUD effects** — animated border traces, glitch text, data streams, floating particles, scanlines, vignette, scrolling data ticker
- **Slack credential extraction** — auto-extracts tokens from the Slack desktop app (no OAuth setup needed)
- **Settings via Cmd+,** — configure API keys, test connections, adjust boot animation
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
2. API keys from `.env` are stored in `~/.config/neondash/credentials.json`
3. Slack credentials are auto-extracted from your Slack desktop app
4. All 4 panels load data from their respective APIs
5. Reconfigure keys anytime via **D.A.E.M.O.N.** → **Settings** (or `Cmd+,`)

### Building the .app Bundle

```bash
npm run tauri build
```

This produces `DAEMON.app` in `src-tauri/target/release/bundle/macos/`. Drag it to `/Applications` — it appears in Launchpad and the Dock like any native app (~15MB).

---

## Configuration

### Environment Variables (`.env`)

```bash
GITLAB_PAT=glpat-your-token-here
LINEAR_API_KEY=lin_api_your-key-here
```

### Settings UI (`Cmd+,`)

- **API Credentials** — View masked keys, update, test connections
- **Boot Sequence** — Enable/disable, adjust duration slider (3-15 seconds)
- **Slack** — Auto-configured from desktop app (no manual setup)

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
│  │              TanStack Query (polling + cache)           │  │
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
│  Credentials: ~/.config/neondash/credentials.json             │
└───────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Desktop runtime | Tauri v2 | Native, ~15MB (vs Electron's 150MB+) |
| Frontend | React 18 + TypeScript + Vite | Standard, sub-second HMR |
| Data fetching | TanStack Query | Built-in polling, caching, deduplication |
| Styling | CSS Modules + Custom Properties | Synthwave needs custom glows, not utility CSS |
| Fonts | Orbitron + Rajdhani + JetBrains Mono | Self-hosted via @fontsource, zero network calls |
| Rust HTTP | reqwest | All API calls through Rust for security |
| Slack auth | Python + cryptography | Decrypts tokens from Slack's local storage |
| AI | Claude CLI | Spawned as subprocess, output streamed via Tauri events |

### Security Model

- **API tokens** stored in a local JSON file (`~/.config/neondash/credentials.json`), never in the webview
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
│   ├── components/
│   │   ├── layout/               # TitleBar, StatusBar, Panel, DashboardGrid, ScanlineOverlay, EmptySlot
│   │   └── ui/                   # GlowCard, NeonButton, RetroLoader, BootSequence, SettingsModal, HudDecorations
│   ├── panels/
│   │   ├── slack/                # SlackPanel — channel sections, unread tracking, message resolution
│   │   ├── gitlab/               # GitLabPanel + MRDetailView — pipeline, merge, comments
│   │   ├── linear/               # LinearPanel — detail view, markdown, commenting
│   │   └── agents/               # AgentsPanel — command teams, Claude CLI runner
│   ├── hooks/                    # TanStack Query hooks (useSlackSections, useMergeRequests, etc.)
│   ├── services/                 # tauri-bridge.ts (typed invoke wrappers), notifications.ts
│   └── types/                    # TypeScript interfaces matching Rust models
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── commands/             # slack.rs, gitlab.rs, linear.rs, agent.rs, settings.rs
│   │   ├── services/             # credentials.rs, gitlab.rs, linear.rs, slack.rs
│   │   └── models/               # Rust types with serde Serialize/Deserialize
│   ├── scripts/slack_creds.py    # Slack credential extractor
│   └── Cargo.toml
├── public/assets/                # Logo images
├── .env                          # API keys (gitignored)
└── package.json
```

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

- [ ] Reminders & to-dos from Slack messages and MRs
- [ ] AI-suggested action items from unread messages
- [ ] Drag-and-drop panel arrangement
- [ ] Additional panel types (Calendar, Datadog, etc.)
- [ ] Anthropic API integration for in-app AI (no CLI dependency)
- [ ] Custom channel/team configuration via Settings UI
- [ ] Keyboard shortcuts for panel navigation
- [ ] Custom app icon with transparent background

---

## Credits

Built by [AJ Holloway](https://github.com/ajhollowayvrm) with [Claude Code](https://claude.ai/claude-code).

---

<p align="center">
  <em>"It's not a bug, it's a feature."</em>
</p>
