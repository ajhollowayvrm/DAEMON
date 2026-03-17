import type { ThemeDefinition } from "./types";

/** ── Star Trek: The Next Generation Theme ────────────────────────
 *  LCARS interface — the iconic orange/tan/blue/purple rounded
 *  panel system from TNG's computer displays. Enterprise-D bridge
 *  aesthetics with warm orange glows and smooth data streams.
 * ──────────────────────────────────────────────────────────────── */

export const trekTngTheme: ThemeDefinition = {
  id: "trek-tng",
  name: "Star Trek: TNG",
  description: "LCARS interface — orange, tan & purple panels from the Enterprise-D",
  previewColors: ["#ff9933", "#cc99cc", "#9999ff", "#0a0a12", "#33cc99"],

  cssVariables: {
    // Background palette
    "--bg-deepest": "#0a0a12",
    "--bg-deep": "#0f0f1a",
    "--bg-base": "#161622",
    "--bg-raised": "#1e1e30",
    "--bg-surface": "#262640",
    "--bg-hover": "#30304e",

    // Neon accent colors (mapped to LCARS palette)
    "--neon-magenta": "#cc6699",     // LCARS Tan/Peach
    "--neon-cyan": "#9999ff",        // LCARS Blue
    "--neon-purple": "#9966cc",      // LCARS Purple
    "--neon-green": "#33cc99",       // LCARS Teal-green
    "--neon-orange": "#ff9933",      // LCARS Orange (primary)
    "--neon-yellow": "#ffcc00",      // LCARS Yellow
    "--neon-red": "#cc3333",         // LCARS Red

    // RGB versions for rgba() usage
    "--neon-magenta-rgb": "204, 102, 153",
    "--neon-cyan-rgb": "153, 153, 255",
    "--neon-purple-rgb": "153, 102, 204",
    "--neon-green-rgb": "51, 204, 153",

    // Dimmed accents
    "--neon-magenta-dim": "rgba(204, 102, 153, 0.15)",
    "--neon-cyan-dim": "rgba(153, 153, 255, 0.12)",
    "--neon-purple-dim": "rgba(153, 102, 204, 0.15)",
    "--neon-green-dim": "rgba(51, 204, 153, 0.12)",

    // Text colors
    "--text-primary": "#fff2cc",
    "--text-secondary": "#ccbb99",
    "--text-muted": "#9988aa",
    "--text-bright": "#ffffff",

    // Glow shadows (warm orange tones)
    "--glow-magenta":
      "0 0 5px rgba(255, 153, 51, 0.4), 0 0 20px rgba(255, 153, 51, 0.2), 0 0 40px rgba(255, 153, 51, 0.1)",
    "--glow-cyan":
      "0 0 5px rgba(153, 153, 255, 0.4), 0 0 20px rgba(153, 153, 255, 0.2), 0 0 40px rgba(153, 153, 255, 0.1)",
    "--glow-purple":
      "0 0 5px rgba(153, 102, 204, 0.4), 0 0 20px rgba(153, 102, 204, 0.2), 0 0 40px rgba(153, 102, 204, 0.1)",
    "--glow-green":
      "0 0 5px rgba(51, 204, 153, 0.4), 0 0 20px rgba(51, 204, 153, 0.2), 0 0 40px rgba(51, 204, 153, 0.1)",

    // Panel glow (warm LCARS orange)
    "--panel-glow":
      "0 0 1px rgba(255, 153, 51, 0.6), 0 0 4px rgba(255, 153, 51, 0.3), 0 0 12px rgba(255, 153, 51, 0.15), inset 0 0 8px rgba(255, 153, 51, 0.05)",

    // Typography
    "--font-display": '"Orbitron", sans-serif',
    "--font-body": '"Rajdhani", sans-serif',
    "--font-mono": '"JetBrains Mono Variable", monospace',
  },

  bootSequence: {
    lines: [
      { text: "╔══════════════════════════════════════════════════════════╗", tier: 1 },
      { text: "║  LCARS ACCESS 47-ALPHA — AUTHORIZED PERSONNEL ONLY     ║", tier: 1 },
      { text: "║  UNITED FEDERATION OF PLANETS                          ║", tier: 1 },
      { text: "║  USS ENTERPRISE NCC-1701-D                             ║", tier: 1 },
      { text: "╚══════════════════════════════════════════════════════════╝", tier: 1 },
      { text: "", tier: 1 },
      { text: "LCARS BUILD 47218.3 — ISOLINEAR OPTICAL CORE", tier: 1 },
      { text: "Copyright (C) 2364 United Federation of Planets", tier: 2 },
      { text: "", tier: 1 },
      { text: "Initializing isolinear computer core:", tier: 1 },
      { text: "  Primary core ........................................ ONLINE", tier: 1 },
      { text: "  Secondary core ...................................... STANDBY", tier: 2 },
      { text: "  Isolinear chip array: 2,048 modules ................. VERIFIED", tier: 2 },
      { text: "  Bio-neural gel packs ................................ N/A (that's Voyager)", tier: 3 },
      { text: "", tier: 1 },
      { text: "Main power systems:", tier: 1 },
      { text: "  Warp core: Matter/antimatter reaction ............... STABLE", tier: 1 },
      { text: "  Dilithium crystal matrix ............................ ALIGNED", tier: 2 },
      { text: "  EPS power grid ...................................... BALANCED", tier: 2 },
      { text: "  Maximum sustainable cruise: Warp 9.6 ................ CONFIRMED", tier: 2 },
      { text: "  Main power output: 12.75 billion GW ................. NOMINAL", tier: 3 },
      { text: "", tier: 1 },
      { text: "Tactical systems:", tier: 1 },
      { text: "  Deflector shields ................................... ONLINE", tier: 1 },
      { text: "  Phaser arrays (11 strips) ........................... CHARGED", tier: 2 },
      { text: "  Photon torpedo bays ................................. LOADED", tier: 1 },
      { text: "  Worf's readiness level .............................. ALWAYS MAXIMUM", tier: 3 },
      { text: "", tier: 1 },
      { text: "Sensor systems:", tier: 2 },
      { text: "  Long-range array .................................... ONLINE", tier: 2 },
      { text: "  Lateral array ....................................... ONLINE", tier: 2 },
      { text: "  Main deflector dish ................................. ACTIVE", tier: 2 },
      { text: "  (Can be modified to do literally anything) .......... TRUE", tier: 3 },
      { text: "", tier: 2 },
      { text: "Bridge stations:", tier: 1 },
      { text: "  Conn / Ops / Tactical ............................... READY", tier: 1 },
      { text: "  Science I & II ..................................... ONLINE", tier: 2 },
      { text: "  Engineering station ................................. LINKED", tier: 2 },
      { text: "", tier: 2 },
      { text: "Engineering diagnostics:", tier: 2 },
      { text: "  Structural integrity field .......................... 100%", tier: 2 },
      { text: "  Power relay alpha-1 through alpha-47 ................ PASS", tier: 3 },
      { text: "  Geordi's VISOR calibration .......................... SYNCHRONIZED", tier: 3 },
      { text: "  Geordi's dating subroutine .......................... ERROR 404", tier: 3 },
      { text: "", tier: 2 },
      { text: "Crew services:", tier: 2 },
      { text: "  Life support ....................................... NOMINAL", tier: 1 },
      { text: "  Replicator systems .................................. ONLINE", tier: 2 },
      { text: "  Ten Forward replicators ............................. GUINAN APPROVED", tier: 3 },
      { text: "  Holodeck 1 ......................................... AVAILABLE", tier: 2 },
      { text: "  Holodeck 2 ......................................... IN USE (Barclay again)", tier: 3 },
      { text: "  Holodeck 4 ......................................... MALFUNCTION (tradition)", tier: 3 },
      { text: "", tier: 2 },
      { text: "Senior staff diagnostics:", tier: 3 },
      { text: "  Data's positronic net ............................... SYNCED", tier: 3 },
      { text: "  Data's emotion chip ................................. DEACTIVATED (thank god)", tier: 3 },
      { text: "  Troi empathic readings .............................. ELEVATED — as always", tier: 3 },
      { text: "  Riker's chair lean angle ............................ OPTIMAL (115°)", tier: 3 },
      { text: "  Wesley's bridge access .............................. DENIED", tier: 3 },
      { text: "", tier: 2 },
      { text: "Communications:", tier: 1 },
      { text: "  Subspace transceiver ................................ ONLINE", tier: 2 },
      { text: "  Starfleet Command relay ............................. CONNECTED", tier: 2 },
      { text: "", tier: 1 },
      { text: "Establishing secure uplinks:", tier: 1 },
      { text: "  ├─ Slack    ⟶ starfleet.slack.com ................... LINKED", tier: 1 },
      { text: "  ├─ GitLab   ⟶ gitlab.federation.gov ................ LINKED", tier: 1 },
      { text: "  ├─ Linear   ⟶ linear.app/enterprise-d .............. LINKED", tier: 1 },
      { text: "  └─ Claude   ⟶ /usr/local/bin/claude ................ STANDBY", tier: 1 },
      { text: "", tier: 1 },
      { text: "Crew complement: 1,014 ................................ ABOARD", tier: 1 },
      { text: '  Picard\'s tea ........................................ EARL GREY, HOT', tier: 3 },
      { text: "  Picard's fish (Livingston) .......................... FED", tier: 3 },
      { text: "", tier: 2 },
      { text: "D.A.E.M.O.N. integration .............................. COMPLETE", tier: 1 },
      { text: "LCARS interface ....................................... READY", tier: 1 },
      { text: "", tier: 1 },
      { text: "╔══════════════════════════════════════════════════════════╗", tier: 1 },
      { text: "║  NCC-1701-D — LCARS INTERFACE ACTIVE                    ║", tier: 1 },
      { text: "║  D.A.E.M.O.N. — All Systems Operational                ║", tier: 2 },
      { text: "║                                                         ║", tier: 2 },
      { text: '║  "Make it so."  — Capt. Jean-Luc Picard                 ║', tier: 1 },
      { text: "╚══════════════════════════════════════════════════════════╝", tier: 1 },
    ],
    logoPath: "/assets/daemon-logo.png?v=5",
    textColor: "#ff9933",
    okColor: "#33cc99",
    warnColor: "#cc3333",
    readyColor: "#9999ff",
  },

  hud: {
    cornerStyle: "angle",
    stats: [
      { label: "DECK", base: 1.0, range: 42 },
      { label: "POWER", base: 98.7, range: 5 },
      { label: "LIFE", base: 100.0, range: 3 },
      { label: "CREW", base: 1014.0, range: 30 },
    ],
    streamCharacters: "▏▎▍▌▋▊▉█░▒▓",
    streamColumnCount: 8,
    particleCount: 6,
    particleColors: [
      "rgba(255, 153, 51, VAR_OPACITY)",    // LCARS orange
      "rgba(153, 102, 204, VAR_OPACITY)",   // LCARS purple
      "rgba(153, 153, 255, VAR_OPACITY)",   // LCARS blue
    ],
  },

  statusBar: {
    leftTag: "LCARS_47",
    rightTag: "ENGAGE",
    tickerMessages: [
      "// NCC-1701-D USS ENTERPRISE //",
      "LCARS INTERFACE NOMINAL //",
      "ALL DECKS REPORTING //",
      "WARP CORE EFFICIENCY 98.7% //",
      "SUBSPACE COMM CHANNEL OPEN //",
      "NO BORG ACTIVITY DETECTED (probably) //",
      "HOLODECK MALFUNCTIONS TODAY: 2 //",
      "PICARD'S TEA: REPLICATED //",
    ],
  },

  animations: {
    glitch: false,
    scanlines: false,
    borderTrace: true,
    particles: false,
    dataStreams: true,
    chromaticAberration: false,
  },
};
