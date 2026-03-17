import type { ThemeDefinition } from "./types";

/** ── Star Trek: The Original Series Theme ────────────────────────
 *  1960s retro-futurism. Bright primary colors on dark backgrounds.
 *  Command Gold, Science Blue, Engineering Red — the Enterprise
 *  bridge brought to your productivity dashboard.
 * ──────────────────────────────────────────────────────────────── */

export const trekTosTheme: ThemeDefinition = {
  id: "trek-tos",
  name: "Star Trek: TOS",
  description: "1960s retro-futurism — Command Gold & Science Blue on dark navy",
  previewColors: ["#f7a41d", "#5b9bd5", "#c0392b", "#0a0c14", "#27ae60"],
  layoutStyle: "trek-tos",

  cssVariables: {
    // Background palette
    "--bg-deepest": "#0a0c14",
    "--bg-deep": "#0e1018",
    "--bg-base": "#141824",
    "--bg-raised": "#1c2030",
    "--bg-surface": "#242838",
    "--bg-hover": "#2e3248",

    // Neon accent colors (mapped to Trek palette)
    "--neon-magenta": "#c0392b",    // Engineering Red
    "--neon-cyan": "#5b9bd5",       // Science Blue
    "--neon-purple": "#8e44ad",     // Dress uniform purple
    "--neon-green": "#27ae60",      // Life signs green
    "--neon-orange": "#f7a41d",     // Command Gold
    "--neon-yellow": "#f1c40f",     // Alert yellow
    "--neon-red": "#e74c3c",        // Red alert

    // RGB versions for rgba() usage
    "--neon-magenta-rgb": "192, 57, 43",
    "--neon-cyan-rgb": "91, 155, 213",
    "--neon-purple-rgb": "142, 68, 173",
    "--neon-green-rgb": "39, 174, 96",

    // Dimmed accents
    "--neon-magenta-dim": "rgba(192, 57, 43, 0.15)",
    "--neon-cyan-dim": "rgba(91, 155, 213, 0.12)",
    "--neon-purple-dim": "rgba(142, 68, 173, 0.15)",
    "--neon-green-dim": "rgba(39, 174, 96, 0.12)",

    // Text colors
    "--text-primary": "#e8e2d0",
    "--text-secondary": "#b0a890",
    "--text-muted": "#8a8470",
    "--text-bright": "#fff8e8",

    // Glow shadows (warm gold tones)
    "--glow-magenta":
      "0 0 5px rgba(247, 164, 29, 0.4), 0 0 20px rgba(247, 164, 29, 0.2), 0 0 40px rgba(247, 164, 29, 0.1)",
    "--glow-cyan":
      "0 0 5px rgba(91, 155, 213, 0.4), 0 0 20px rgba(91, 155, 213, 0.2), 0 0 40px rgba(91, 155, 213, 0.1)",
    "--glow-purple":
      "0 0 5px rgba(142, 68, 173, 0.4), 0 0 20px rgba(142, 68, 173, 0.2), 0 0 40px rgba(142, 68, 173, 0.1)",
    "--glow-green":
      "0 0 5px rgba(39, 174, 96, 0.4), 0 0 20px rgba(39, 174, 96, 0.2), 0 0 40px rgba(39, 174, 96, 0.1)",

    // Panel glow (warm gold)
    "--panel-glow":
      "0 0 1px rgba(247, 164, 29, 0.6), 0 0 4px rgba(247, 164, 29, 0.3), 0 0 12px rgba(247, 164, 29, 0.15), inset 0 0 8px rgba(247, 164, 29, 0.05)",

    // Typography
    "--font-display": '"Orbitron", sans-serif',
    "--font-body": '"Rajdhani", sans-serif',
    "--font-mono": '"JetBrains Mono Variable", monospace',
  },

  bootSequence: {
    lines: [
      { text: "╔══════════════════════════════════════════════════════════╗", tier: 1 },
      { text: "║  UNITED FEDERATION OF PLANETS — STARFLEET COMMAND       ║", tier: 1 },
      { text: "╚══════════════════════════════════════════════════════════╝", tier: 1 },
      { text: "", tier: 1 },
      { text: "LCARS OPERATING SYSTEM v47.3 — DUOTRONIC INTERFACE", tier: 1 },
      { text: "Copyright (C) 2267 United Federation of Planets", tier: 2 },
      { text: "", tier: 1 },
      { text: "Initializing duotronic computer core .................... OK", tier: 1 },
      { text: "  Primary isolinear matrix ............................. ONLINE", tier: 2 },
      { text: "  Memory banks 1-94 ................................... VERIFIED", tier: 3 },
      { text: "  Duotronic processor clock: 847 THz .................. NOMINAL", tier: 3 },
      { text: "", tier: 1 },
      { text: "Warp core initialization:", tier: 1 },
      { text: "  Matter/antimatter intermix chamber ................... STABLE", tier: 1 },
      { text: "  Dilithium crystal alignment .......................... OPTIMAL", tier: 2 },
      { text: "  Warp plasma conduits ................................. PRESSURIZED", tier: 2 },
      { text: "  Maximum rated speed: Warp 8 ......................... CONFIRMED", tier: 2 },
      { text: "  (Warp 10+ not recommended by Engineering) ........... NOTED", tier: 3 },
      { text: "", tier: 1 },
      { text: "Defense systems:", tier: 1 },
      { text: "  Deflector shields ................................... CHARGED", tier: 1 },
      { text: "  Forward/aft phaser banks ............................. ARMED", tier: 2 },
      { text: "  Photon torpedo bays (fore/aft) ...................... LOADED", tier: 1 },
      { text: "  Torpedo inventory: 200 .............................. CONFIRMED", tier: 2 },
      { text: "", tier: 1 },
      { text: "Sensor array boot:", tier: 2 },
      { text: "  Long-range sensors .................................. CALIBRATING", tier: 2 },
      { text: "  Short-range sensors ................................. ONLINE", tier: 2 },
      { text: "  Anomaly detection filters ........................... SET", tier: 3 },
      { text: "  (Sensors always find anomalies. Always.) ............ ACKNOWLEDGED", tier: 3 },
      { text: "", tier: 2 },
      { text: "Navigation systems:", tier: 1 },
      { text: "  Helm control ........................................ RESPONSIVE", tier: 2 },
      { text: "  Navigational deflector dish ......................... ONLINE", tier: 2 },
      { text: "", tier: 2 },
      { text: "Communications array:", tier: 1 },
      { text: "  Hailing frequencies ................................. OPEN", tier: 1 },
      { text: "  Universal translator ................................ ACTIVE", tier: 2 },
      { text: "  Klingon language pack ............................... LOADED (Qapla'!)", tier: 3 },
      { text: "  Romulan decryption module ........................... CLASSIFIED", tier: 3 },
      { text: "", tier: 2 },
      { text: "Life support:", tier: 2 },
      { text: "  Atmospheric processors .............................. NOMINAL", tier: 2 },
      { text: "  Temperature: 22°C (per McCoy's complaints) ......... ADJUSTED", tier: 3 },
      { text: "", tier: 2 },
      { text: "Transporter systems:", tier: 2 },
      { text: "  Heisenberg compensators ............................. COMPENSATING", tier: 2 },
      { text: "  Redshirt survival rate in buffer .................... DO NOT ASK", tier: 3 },
      { text: "", tier: 2 },
      { text: "Crew complement: 430 .................................. ABOARD", tier: 1 },
      { text: "  Redshirts remaining: 74 ............................. (down from 200)", tier: 3 },
      { text: "  Kirk's shirt status ................................. INTACT (for now)", tier: 3 },
      { text: "  Spock's eyebrow .................................... RAISED", tier: 3 },
      { text: "  McCoy's medical degree .............................. HE'S A DOCTOR", tier: 3 },
      { text: "  Scotty's miracle ETA ................................ 4 HRS (actual: 20 min)", tier: 3 },
      { text: "  Dramatic pause generator ............................ CALIBRATED", tier: 3 },
      { text: "", tier: 1 },
      { text: "Establishing secure uplinks:", tier: 1 },
      { text: "  ├─ Slack    ⟶ starfleet.slack.com ................... LINKED", tier: 1 },
      { text: "  ├─ GitLab   ⟶ gitlab.federation.gov ................ LINKED", tier: 1 },
      { text: "  ├─ Linear   ⟶ linear.app/enterprise ................ LINKED", tier: 1 },
      { text: "  └─ Claude   ⟶ /usr/local/bin/claude ................ STANDBY", tier: 1 },
      { text: "", tier: 2 },
      { text: "Stardate: 2267.42 ..................................... COMPUTED", tier: 3 },
      { text: "  (Nobody understands how stardates work) ............. TRUE", tier: 3 },
      { text: "", tier: 3 },
      { text: "All stations report ready ............................. CONFIRMED", tier: 1 },
      { text: "D.A.E.M.O.N. integration .............................. COMPLETE", tier: 1 },
      { text: "", tier: 1 },
      { text: "╔══════════════════════════════════════════════════════════╗", tier: 1 },
      { text: "║  NCC-1701 — USS ENTERPRISE — ALL SYSTEMS OPERATIONAL    ║", tier: 1 },
      { text: "║  D.A.E.M.O.N. Interface Active                         ║", tier: 2 },
      { text: "║                                                         ║", tier: 2 },
      { text: '║  "Fascinating."  — Spock                                ║', tier: 1 },
      { text: "╚══════════════════════════════════════════════════════════╝", tier: 1 },
    ],
    logoPath: "/assets/daemon-logo-trek.png",
    textColor: "#f7a41d",
    okColor: "#27ae60",
    warnColor: "#c0392b",
    readyColor: "#5b9bd5",
  },

  hud: {
    cornerStyle: "angle",
    stats: [
      { label: "WARP", base: 0.0, range: 9 },
      { label: "SHIELDS", base: 100.0, range: 15 },
      { label: "HULL", base: 100.0, range: 5 },
      { label: "CREW", base: 430.0, range: 20 },
    ],
    streamCharacters: "▲△▽▼◇◆○●□■",
    streamColumnCount: 6,
    particleCount: 10,
    particleColors: [
      "rgba(247, 164, 29, VAR_OPACITY)",   // command gold
      "rgba(91, 155, 213, VAR_OPACITY)",    // science blue
    ],
  },

  statusBar: {
    leftTag: "STARFLEET",
    rightTag: "ALL DECKS NOMINAL",
    tickerMessages: [
      "// NCC-1701 USS ENTERPRISE //",
      "ALL STATIONS REPORT READY //",
      "WARP CORE NOMINAL //",
      "SHIELDS AT MAXIMUM //",
      "NO ANOMALIES DETECTED (suspicious) //",
      "HAILING FREQUENCIES OPEN //",
      "STARFLEET COMMAND UPLINK SECURE //",
      "REDSHIRT AWAY TEAM STATUS: GOOD LUCK //",
    ],
  },

  animations: {
    glitch: false,
    scanlines: false,
    borderTrace: true,
    particles: true,
    dataStreams: false,
    chromaticAberration: false,
  },
};
