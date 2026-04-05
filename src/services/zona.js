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
 * Scrape a specific Zona page (raw HTML).
 * page: one of: inicio, analitico, planEstudios, cursadasActuales, 
 *               cursadasAnteriores, inscripcionFinales, datosAlumno,
 *               boletas, constancias, calendario, cursadasInscripcion
 */
export async function zonaScrape(session, page, params = {}) {
  const res = await fetch(`${API_BASE}/api/zona/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, page, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { html, url }
}