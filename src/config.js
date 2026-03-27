const API_BASE = import.meta.env.VITE_API_URL || "";

export const CONFIG = {
  MOODLE_URL: "https://campus.ucalp.edu.ar",
  ALLOWED_DOMAIN: "@ucalpvirtual.edu.ar",
  API_BASE: API_BASE,
  AI_PROXY_URL: `${API_BASE}/api/ai`,
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
};
