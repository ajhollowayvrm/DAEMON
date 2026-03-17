import type { ThemeDefinition } from "./types";

/** ── Cyberpunk 2077 Theme ────────────────────────────────────────
 *  The original D.A.E.M.O.N. aesthetic — deep purples, neon cyan,
 *  magenta glows, Orbitron display type, and a retro-futuristic
 *  boot sequence dripping with dev humor.
 * ──────────────────────────────────────────────────────────────── */

export const cyberpunkTheme: ThemeDefinition = {
  id: "cyberpunk",
  name: "Cyberpunk",
  description: "The original Night City aesthetic — neon cyan & magenta on deep purple",
  previewColors: ["#0a0a0f", "#b026ff", "#00fff5", "#ff2cf1", "#39ff14"],

  cssVariables: {
    // Background palette
    "--bg-deepest": "#0a0a0f",
    "--bg-deep": "#0e0c1a",
    "--bg-base": "#12101f",
    "--bg-raised": "#1a1730",
    "--bg-surface": "#221e3a",
    "--bg-hover": "#2a2545",

    // Neon accent colors
    "--neon-magenta": "#ff2cf1",
    "--neon-cyan": "#00fff5",
    "--neon-purple": "#b026ff",
    "--neon-green": "#39ff14",
    "--neon-orange": "#ff6b2b",
    "--neon-yellow": "#ffe600",
    "--neon-red": "#ff1744",

    // RGB versions for rgba() usage
    "--neon-magenta-rgb": "255, 44, 241",
    "--neon-cyan-rgb": "0, 255, 245",
    "--neon-purple-rgb": "176, 38, 255",
    "--neon-green-rgb": "57, 255, 20",

    // Dimmed accents
    "--neon-magenta-dim": "rgba(255, 44, 241, 0.15)",
    "--neon-cyan-dim": "rgba(0, 255, 245, 0.12)",
    "--neon-purple-dim": "rgba(176, 38, 255, 0.15)",
    "--neon-green-dim": "rgba(57, 255, 20, 0.12)",

    // Text colors
    "--text-primary": "#e8e0ff",
    "--text-secondary": "#a89cc8",
    "--text-muted": "#6b5f8a",
    "--text-bright": "#ffffff",

    // Glow shadows
    "--glow-magenta":
      "0 0 5px rgba(255, 44, 241, 0.4), 0 0 20px rgba(255, 44, 241, 0.2), 0 0 40px rgba(255, 44, 241, 0.1)",
    "--glow-cyan":
      "0 0 5px rgba(0, 255, 245, 0.4), 0 0 20px rgba(0, 255, 245, 0.2), 0 0 40px rgba(0, 255, 245, 0.1)",
    "--glow-purple":
      "0 0 5px rgba(176, 38, 255, 0.4), 0 0 20px rgba(176, 38, 255, 0.2), 0 0 40px rgba(176, 38, 255, 0.1)",
    "--glow-green":
      "0 0 5px rgba(57, 255, 20, 0.4), 0 0 20px rgba(57, 255, 20, 0.2), 0 0 40px rgba(57, 255, 20, 0.1)",

    // Panel glow
    "--panel-glow":
      "0 0 1px rgba(0, 255, 245, 0.6), 0 0 4px rgba(0, 255, 245, 0.3), 0 0 12px rgba(0, 255, 245, 0.15), inset 0 0 8px rgba(0, 255, 245, 0.05)",

    // Typography
    "--font-display": '"Orbitron", sans-serif',
    "--font-body": '"Rajdhani", sans-serif',
    "--font-mono": '"JetBrains Mono Variable", monospace',
  },

  bootSequence: {
    lines: [
      { text: "NectarCorp BIOS v4.20.69 — Unified Firmware Interface", tier: 1 },
      { text: "Copyright (C) 2026 NectarCorp Industries. All rights reserved.", tier: 2 },
      { text: "", tier: 1 },
      { text: "POST: Power-On Self Test...", tier: 1 },
      { text: "CPU: AMD Ryzen 9 9950X @ 5.7GHz .................... OK", tier: 1 },
      { text: "RAM: Testing 131072 MB DDR5-6400 ECC ............... OK", tier: 1 },
      { text: "  Bank 0: 32768 MB @ 6400 MHz ...................... PASS", tier: 3 },
      { text: "  Bank 1: 32768 MB @ 6400 MHz ...................... PASS", tier: 3 },
      { text: "  Bank 2: 32768 MB @ 6400 MHz ...................... PASS", tier: 3 },
      { text: "  Bank 3: 32768 MB @ 6400 MHz ...................... PASS", tier: 3 },
      { text: "GPU: NVIDIA RTX 5090 Ti (48GB VRAM) ................ OK", tier: 1 },
      { text: "NVMe: Samsung 990 PRO 4TB .......................... OK", tier: 2 },
      { text: "NEURAL_LINK: Arasaka Mk.IV Cortical Interface ...... CONNECTED", tier: 1 },
      { text: "  Bandwidth: 847 Gbps .............................. NOMINAL", tier: 3 },
      { text: "  Latency: 0.003ms ................................. NOMINAL", tier: 3 },
      { text: "USB: 12 devices detected ........................... OK", tier: 3 },
      { text: "NET: 10GbE eth0 link ............................... UP", tier: 2 },
      { text: "", tier: 1 },
      { text: "Loading D.A.E.M.O.N. kernel v0.1.0...", tier: 1 },
      { text: "  [████████████████████████████████████] 100%", tier: 1 },
      { text: "", tier: 1 },
      { text: "Starting system services:", tier: 2 },
      { text: "  systemd[1]: Starting D.A.E.M.O.N. core...", tier: 2 },
      { text: "  systemd[1]: Started syslog-ng.service", tier: 3 },
      { text: "  systemd[1]: Started NetworkManager.service", tier: 3 },
      { text: "  systemd[1]: Started quantum-mesh.service", tier: 3 },
      { text: "", tier: 2 },
      { text: "Mounting filesystems:", tier: 2 },
      { text: "  /dev/sda1 on / ................................... OK", tier: 2 },
      { text: "  /dev/sda2 on /mnt/corporate-overlord ............. OK", tier: 3 },
      { text: "  /dev/nvme0n1p1 on /var/cache/node_modules ........ OK (429,817 packages)", tier: 2 },
      { text: "", tier: 2 },
      { text: "Initializing subsystems:", tier: 1 },
      { text: "  Quantum entanglement resolver .................... OK", tier: 2 },
      { text: "  Predictive meeting cancellation engine ........... ARMED", tier: 3 },
      { text: '  Stack Overflow scraper ........................... DEPRECATED (use Claude)', tier: 2 },
      { text: "  todo_list.txt (WARNING: 847 items found) ......... LOADED", tier: 1 },
      { text: "  Works on my machine? ............................. YES", tier: 2 },
      { text: "  Compiling 441 Rust crates ........................ OK", tier: 1 },
      { text: "  rm -rf node_modules && npm install ............... SKIPPED", tier: 2 },
      { text: "  Verifying left-pad is not deprecated ............. UNCERTAIN", tier: 2 },
      { text: "  Checking if semicolons matter .................... DEPENDS WHO YOU ASK", tier: 3 },
      { text: "  Loading .env (praying it's not in git) ........... OK", tier: 2 },
      { text: "", tier: 1 },
      { text: "Establishing secure uplinks:", tier: 1 },
      { text: "  ├─ Slack    ⟶ nectar-hr.slack.com ................ LINKED", tier: 1 },
      { text: "  ├─ GitLab   ⟶ gitlab.com/nectarhr ............... LINKED", tier: 1 },
      { text: "  ├─ Linear   ⟶ linear.app/nectar ................. LINKED", tier: 1 },
      { text: "  └─ Claude   ⟶ /usr/local/bin/claude ............. STANDBY", tier: 1 },
      { text: "", tier: 1 },
      { text: "Deploying countermeasures:", tier: 2 },
      { text: "  ├─ Unnecessary meetings .......................... BLOCKED", tier: 2 },
      { text: "  ├─ Scope creep .................................. DETECTED (ironic)", tier: 2 },
      { text: '  ├─ "Quick question" DMs .......................... QUEUED', tier: 3 },
      { text: "  ├─ Tabs vs spaces debate ......................... TABS (fight me)", tier: 3 },
      { text: "  ├─ PR with 4000+ lines changed .................. NOPE", tier: 3 },
      { text: "  └─ Production incidents on Friday at 4:59pm ...... INEVITABLE", tier: 2 },
      { text: "", tier: 2 },
      { text: "Final diagnostics:", tier: 2 },
      { text: "  Caffeine-to-productivity ratio ................... 1:0.03", tier: 3 },
      { text: "  Imposter syndrome module ......................... FAILED (as expected)", tier: 2 },
      { text: "  git blame anxiety level .......................... ELEVATED", tier: 3 },
      { text: "  Rubber duck availability ......................... 1 (on desk)", tier: 3 },
      { text: "  All systems ...................................... GREEN", tier: 1 },
      { text: "", tier: 1 },
      { text: "╔══════════════════════════════════════════════════════════╗", tier: 1 },
      { text: "║  D.A.E.M.O.N. ONLINE — ALL SYSTEMS OPERATIONAL         ║", tier: 1 },
      { text: "║  Distributed Autonomous Engineering Management          ║", tier: 2 },
      { text: "║  Orchestration Node v0.1.0                              ║", tier: 2 },
      { text: "║                                                         ║", tier: 2 },
      { text: '║  "It\'s not a bug, it\'s a feature."                      ║', tier: 1 },
      { text: "╚══════════════════════════════════════════════════════════╝", tier: 1 },
    ],
    logoPath: "/assets/daemon-logo.png?v=5",
    textColor: "#00fff5",
    okColor: "#39ff14",
    warnColor: "#ff6b2b",
    readyColor: "#ff2cf1",
  },

  hud: {
    cornerStyle: "bracket",
    stats: [
      { label: "MEM", base: 94.2, range: 4 },
      { label: "CPU", base: 23.5, range: 12 },
      { label: "NET", base: 87.0, range: 8 },
      { label: "BUF", base: 62.3, range: 10 },
    ],
    streamCharacters: '01/\\|-ABCDEFabcdef0123456789><{}[]',
    streamColumnCount: 8,
    particleCount: 10,
    particleColors: [
      "rgba(0, 255, 245, VAR_OPACITY)",   // cyan
      "rgba(255, 44, 241, VAR_OPACITY)",   // magenta
      "rgba(176, 38, 255, VAR_OPACITY)",   // purple
    ],
  },

  statusBar: {
    leftTag: "SYS_ACTIVE",
    rightTag: "UPLINK_OK",
    tickerMessages: [
      "// DAEMON v0.1.0 //",
      "ALL SYSTEMS NOMINAL //",
      "UPLINK SECURE //",
      "LATENCY 12ms //",
      "ENCRYPTION AES-256 //",
      "QUANTUM MESH ACTIVE //",
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
