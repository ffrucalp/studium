import { CONFIG } from "../config";

const API_BASE = CONFIG.API_BASE;

/**
 * Login to Zona Interactiva via Worker proxy.
 * Returns session cookie + student basic info + dual role info.
 * 
 * @param {string} username - DNI
 * @param {string} password
 * @param {string} zonaRole - "A" (alumno) | "D" (docente) | null (default: alumno)
 * @returns {{ session, student, zonaHasDualRole, zonaActiveRole }}
 */
export async function zonaLogin(username, password, zonaRole = null) {
  const res = await fetch(`${API_BASE}/api/zona/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, zonaRole }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { session, student, zonaHasDualRole, zonaActiveRole }
}

/**
 * Switch Zona Interactiva role mid-session.
 * Navigates back to role selection page and picks the new role.
 * 
 * @param {string} session - Zona session cookies
 * @param {string} role - "A" (alumno) | "D" (docente)
 * @returns {{ session, student, zonaActiveRole, success }}
 */
export async function zonaSwitchRole(session, role) {
  const res = await fetch(`${API_BASE}/api/zona/switch-role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, role }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { session, student, zonaActiveRole, success }
}

/**
 * Get full student academic profile from Zona.
 * Returns: perfil, analitico, cursadasActuales, planEstudios, cursadasAnteriores
 */
export async function zonaGetProfile(session, idCliente = null) {
  const res = await fetch(`${API_BASE}/api/zona/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, id_cliente: idCliente }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * Get liquidacion data for a period
 * Uses obtenerLiquidaciones.php (special endpoint, not index.php?m=)
 */
export async function zonaLiquidacion(session, idPeriodo, idPersona) {
  const res = await fetch(`${API_BASE}/api/zona/liquidacion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, id_periodo: idPeriodo, idPersona }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { html }
}

/**
 * Scrape a specific Zona page (raw HTML).
 * Supports GET (default) and POST (for form submissions like select changes).
 * page: page key or raw base64
 * params: URL query parameters
 * method: "GET" (default) or "POST"
 * postData: form data object for POST requests
 */
export async function zonaScrape(session, page, params = {}, method = null, postData = null) {
  const res = await fetch(`${API_BASE}/api/zona/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, page, params, method, postData }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { html, url }
}