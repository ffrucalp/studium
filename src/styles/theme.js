// ─── UCALP Blue Institutional Palette ──────────────────────────────────

const LIGHT = {
  primary: "#1A5276", primaryLight: "#2471A3", primaryDark: "#154360",
  primarySoft: "#D4E6F1", primaryMuted: "#85C1E9", primaryAccent: "#2E86C1",
  // Legacy aliases (used throughout codebase)
  red: "#1A5276", redLight: "#2471A3", redDark: "#154360",
  redSoft: "#D4E6F1", redMuted: "#85C1E9", redAccent: "#2E86C1",
  cream: "#F7FBFE",
  bg: "#F8FAFB", card: "#FFFFFF",
  border: "#DCE8F0", borderLight: "#EAF2F8",
  text: "#1A1A1A", textSec: "#4A5568", textMuted: "#8E9EAD",
  sidebar: "#154360", sidebarHover: "rgba(255,255,255,0.08)", sidebarActive: "rgba(46,134,193,0.25)",
};

const DARK = {
  primary: "#2E86C1", primaryLight: "#3498DB", primaryDark: "#1A5276",
  primarySoft: "#1C3045", primaryMuted: "#4A7A9B", primaryAccent: "#5DADE2",
  red: "#2E86C1", redLight: "#3498DB", redDark: "#1A5276",
  redSoft: "#1C3045", redMuted: "#4A7A9B", redAccent: "#5DADE2",
  cream: "#1A2530",
  bg: "#0F1419", card: "#1A2332",
  border: "#2A3A4A", borderLight: "#1E2D3D",
  text: "#E8EDF2", textSec: "#A8B8C8", textMuted: "#6B7D8D",
  sidebar: "#0D1B2A", sidebarHover: "rgba(255,255,255,0.08)", sidebarActive: "rgba(46,134,193,0.3)",
};

const stored = typeof localStorage !== "undefined" ? localStorage.getItem("studium_dark") === "true" : false;
export const P = { ...(stored ? DARK : LIGHT) };

export function isDarkMode() {
  return localStorage.getItem("studium_dark") === "true";
}

export function setDark(v) {
  localStorage.setItem("studium_dark", String(v));
  Object.assign(P, v ? DARK : LIGHT);
}

export const ff = {
  heading: "'Inter', 'Calibri', sans-serif",
  body: "'Inter', 'Calibri', sans-serif",
};