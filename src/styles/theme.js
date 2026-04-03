// ─── UCALP Institutional Palette ──────────────────────────────────────

const LIGHT = {
  red: "#B71C1C", redLight: "#D32F2F", redDark: "#7f1212",
  redSoft: "#FFEBEE", redMuted: "#EF9A9A", redAccent: "#E53935",
  cream: "#FFF8F6",
  bg: "#FAFAFA", card: "#FFFFFF",
  border: "#F0E6E4", borderLight: "#F5EFED",
  text: "#1A1A1A", textSec: "#5C5555", textMuted: "#9E9494",
  sidebar: "#4E2527", sidebarHover: "rgba(255,255,255,0.08)", sidebarActive: "rgba(239,83,80,0.2)",
};

const DARK = {
  red: "#E53935", redLight: "#EF5350", redDark: "#B71C1C",
  redSoft: "#3D1C1C", redMuted: "#8B4444", redAccent: "#FF5252",
  cream: "#2A2222",
  bg: "#121212", card: "#1E1E1E",
  border: "#333333", borderLight: "#2A2A2A",
  text: "#E8E4E4", textSec: "#B0A8A8", textMuted: "#7A7070",
  sidebar: "#1A1010", sidebarHover: "rgba(255,255,255,0.08)", sidebarActive: "rgba(239,83,80,0.25)",
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
  heading: "'Crimson Pro', serif",
  body: "'Source Sans 3', sans-serif",
};