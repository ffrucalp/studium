import { CONFIG } from "../config";

const API_BASE = CONFIG.API_BASE;

/**
 * Login to Zona Interactiva via Worker proxy.
 * Returns session cookie + student basic info.
 */
export async function zonaLogin(username, password) {
  const res = await fetch(`${API_BASE}/api/zona/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { session, student }
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
