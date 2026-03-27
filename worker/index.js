/**
 * Studium API Worker - Cloudflare Worker
 * 
 * Endpoints:
 *   POST /api/moodle/token     → Get Moodle auth token
 *   POST /api/moodle/call      → Proxy Moodle Web Service calls
 *   POST /api/moodle/file      → Proxy file downloads
 *   POST /api/ai               → Proxy AI via OpenRouter
 *   POST /api/zona/login       → Login to Zona Interactiva
 *   POST /api/zona/scrape      → Scrape a Zona page
 *   POST /api/zona/profile     → Get student profile + academic data
 *   POST /api/google/token     → Exchange OAuth code for tokens
 *   POST /api/google/refresh   → Refresh access token
 *   POST /api/google/calendar  → Create/list calendar events
 *   POST /api/google/gmail     → Send email reminders
 *   POST /api/google/drive     → Upload/list files in Drive
 * 
 * Required secrets: OPENROUTER_API_KEY, GOOGLE_CLIENT_SECRET
 * Env vars: MOODLE_URL, ALLOWED_ORIGIN, AI_MODEL, GOOGLE_CLIENT_ID
 */

const MOODLE_URL = "https://campus.ucalp.edu.ar";
const ZONA_URL = "https://zona.ucalp.edu.ar";
const DEFAULT_MODEL = "arcee-ai/trinity-large-preview:free";
const ALLOWED_EMAIL_DOMAIN = "@ucalpvirtual.edu.ar";

// ─── Zona page keys ──────────────────────────────────────────────
const ZONA_PAGES = {
  inicio: "aW5pY2lv", analitico: "YW5hbGl0aWNv", planEstudios: "dmVyUGxhbg==",
  cursadasActuales: "Y29uc3VsdGFDdXJzYWRhcw==", cursadasAnteriores: "aGN1cnNhZGFz",
  inscripcionFinales: "aW5zY3JpcGNpb25GaW5hbGVzMg==", datosAlumno: "ZGF0b3NBbHVtbm8=",
  boletas: "Ym9sZXRhcw==", constancias: "Y29uc3RhbmNpYXNMaXN0",
  calendario: "Y2FsZW5kYXJpb0FjYWRlbWljbw==", cursadasInscripcion: "Y3Vyc2FkYXNJbnNjcmlwY2lvbg==",
};

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env?.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status = 200, env = {}) {
  return Response.json(data, { status, headers: cors(env) });
}


// ═══════════════════════════════════════════════════════════════════
// GOOGLE OAUTH & APIs
// ═══════════════════════════════════════════════════════════════════

/**
 * Exchange authorization code for tokens
 */
async function googleToken(body, env) {
  const { code, redirect_uri } = body;
  if (!code) return json({ error: "Falta el code" }, 400, env);

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return json({ error: "Google credentials no configuradas" }, 500, env);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect_uri || env.ALLOWED_ORIGIN || "https://studium-6hw.pages.dev",
      grant_type: "authorization_code",
    }),
  });

  const data = await res.json();
  if (data.error) return json({ error: data.error_description || data.error }, 400, env);

  // Get user info to verify domain
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { "Authorization": `Bearer ${data.access_token}` },
  });
  const user = await userRes.json();

  // Verify email domain
  if (!user.email?.endsWith(ALLOWED_EMAIL_DOMAIN)) {
    return json({
      error: `Solo se permite acceso con cuentas ${ALLOWED_EMAIL_DOMAIN}`,
      email: user.email,
    }, 403, env);
  }

  return json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    user: {
      email: user.email,
      name: user.name,
      picture: user.picture,
      given_name: user.given_name,
      family_name: user.family_name,
    },
  }, 200, env);
}

/**
 * Refresh access token
 */
async function googleRefresh(body, env) {
  const { refresh_token } = body;
  if (!refresh_token) return json({ error: "Falta refresh_token" }, 400, env);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (data.error) return json({ error: data.error_description || data.error }, 400, env);

  return json({
    access_token: data.access_token,
    expires_in: data.expires_in,
  }, 200, env);
}

/**
 * Google Calendar - Create event or list events
 */
async function googleCalendar(body, env) {
  const { access_token, action, event, timeMin, timeMax } = body;
  if (!access_token) return json({ error: "Falta access_token" }, 400, env);

  if (action === "create" && event) {
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description || "",
        start: { dateTime: event.startDateTime, timeZone: "America/Argentina/Buenos_Aires" },
        end: { dateTime: event.endDateTime, timeZone: "America/Argentina/Buenos_Aires" },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "email", minutes: 60 },
          ],
        },
        colorId: event.colorId || undefined,
      }),
    });
    const data = await res.json();
    if (data.error) return json({ error: data.error.message }, data.error.code || 400, env);
    return json({ success: true, event: { id: data.id, htmlLink: data.htmlLink, summary: data.summary } }, 200, env);
  }

  if (action === "list") {
    const params = new URLSearchParams({
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { "Authorization": `Bearer ${access_token}` },
    });
    const data = await res.json();
    if (data.error) return json({ error: data.error.message }, data.error.code || 400, env);
    return json({ events: data.items || [] }, 200, env);
  }

  return json({ error: "Action no válida. Usar 'create' o 'list'" }, 400, env);
}

/**
 * Gmail - Send email
 */
async function googleGmail(body, env) {
  const { access_token, to, subject, htmlBody } = body;
  if (!access_token || !to || !subject) return json({ error: "Faltan campos" }, 400, env);

  // Build MIME message
  const message = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody || subject,
  ].join("\r\n");

  const raw = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  const data = await res.json();
  if (data.error) return json({ error: data.error.message }, data.error.code || 400, env);
  return json({ success: true, messageId: data.id }, 200, env);
}

/**
 * Google Drive - Upload file or list files
 */
async function googleDrive(body, env) {
  const { access_token, action, fileName, fileContent, mimeType, folderId, fileUrl, moodleToken } = body;
  if (!access_token) return json({ error: "Falta access_token" }, 400, env);

  // Create Studium folder if needed
  if (action === "ensureFolder") {
    // Search for existing folder
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='Studium UCALP' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
      { headers: { "Authorization": `Bearer ${access_token}` } }
    );
    const searchData = await searchRes.json();
    if (searchData.files?.length > 0) {
      return json({ folderId: searchData.files[0].id }, 200, env);
    }

    // Create folder
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Studium UCALP",
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    const folder = await createRes.json();
    return json({ folderId: folder.id }, 200, env);
  }

  // Upload a file (base64 content)
  if (action === "upload" && fileName && fileContent) {
    const metadata = {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
    };

    // Use multipart upload
    const boundary = "studium_upload_boundary";
    const binaryContent = atob(fileContent);
    const bytes = new Uint8Array(binaryContent.length);
    for (let i = 0; i < binaryContent.length; i++) bytes[i] = binaryContent.charCodeAt(i);

    const multipart = [
      `--${boundary}`,
      `Content-Type: application/json; charset=UTF-8`,
      ``,
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${mimeType || "application/octet-stream"}`,
      `Content-Transfer-Encoding: base64`,
      ``,
      fileContent,
      `--${boundary}--`,
    ].join("\r\n");

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    });

    const data = await res.json();
    if (data.error) return json({ error: data.error.message }, data.error.code || 400, env);
    return json({ success: true, file: { id: data.id, name: data.name, link: data.webViewLink } }, 200, env);
  }

  // Upload from Moodle URL (download from Moodle, upload to Drive)
  if (action === "uploadFromMoodle" && fileUrl && moodleToken && fileName) {
    // Download from Moodle
    const sep = fileUrl.includes("?") ? "&" : "?";
    const moodleRes = await fetch(`${fileUrl}${sep}token=${moodleToken}`);
    if (!moodleRes.ok) return json({ error: "No se pudo descargar de Moodle" }, 400, env);

    const contentType = moodleRes.headers.get("content-type") || "application/octet-stream";
    const buf = await moodleRes.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    // Upload to Drive
    const metadata = { name: fileName, parents: folderId ? [folderId] : undefined };
    const boundary = "studium_moodle_boundary";
    const multipart = [
      `--${boundary}`,
      `Content-Type: application/json; charset=UTF-8`,
      ``,
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${contentType}`,
      `Content-Transfer-Encoding: base64`,
      ``,
      base64,
      `--${boundary}--`,
    ].join("\r\n");

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    });

    const data = await res.json();
    if (data.error) return json({ error: data.error.message }, data.error.code || 400, env);
    return json({ success: true, file: { id: data.id, name: data.name, link: data.webViewLink } }, 200, env);
  }

  // List files in folder
  if (action === "list") {
    const q = folderId ? `'${folderId}' in parents and trashed=false` : `trashed=false`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,size,modifiedTime)&orderBy=modifiedTime desc&pageSize=50`,
      { headers: { "Authorization": `Bearer ${access_token}` } }
    );
    const data = await res.json();
    if (data.error) return json({ error: data.error.message }, data.error.code || 400, env);
    return json({ files: data.files || [] }, 200, env);
  }

  return json({ error: "Action no válida" }, 400, env);
}


// ═══════════════════════════════════════════════════════════════════
// MOODLE
// ═══════════════════════════════════════════════════════════════════

async function moodleTokenFn(body, env) {
  const { username, password } = body;
  if (!username || !password) return json({ error: "Faltan usuario o contraseña" }, 400, env);
  const base = env.MOODLE_URL || MOODLE_URL;
  const res = await fetch(`${base}/login/token.php`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password, service: "moodle_mobile_app" }),
  });
  const data = await res.json();
  if (data.error) return json({ error: data.error }, 401, env);
  return json({ token: data.token }, 200, env);
}

async function moodleCall(body, env) {
  const { token, wsfunction, params } = body;
  if (!token || !wsfunction) return json({ error: "Faltan token o wsfunction" }, 400, env);
  const base = env.MOODLE_URL || MOODLE_URL;
  const url = new URL(`${base}/webservice/rest/server.php`);
  url.searchParams.set("wstoken", token);
  url.searchParams.set("wsfunction", wsfunction);
  url.searchParams.set("moodlewsrestformat", "json");
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.exception) return json({ error: data.message || data.exception }, 400, env);
  return json(data, 200, env);
}

async function moodleFile(body, env) {
  const { token, fileurl } = body;
  if (!token || !fileurl) return json({ error: "Faltan token o fileurl" }, 400, env);
  const sep = fileurl.includes("?") ? "&" : "?";
  const res = await fetch(`${fileurl}${sep}token=${token}`);
  if (!res.ok) return json({ error: "No se pudo descargar" }, res.status, env);
  const contentType = res.headers.get("content-type") || "";
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return json({ content: btoa(binary), contentType, size: buf.byteLength }, 200, env);
}


// ═══════════════════════════════════════════════════════════════════
// AI (OpenRouter)
// ═══════════════════════════════════════════════════════════════════

async function aiProxy(body, env) {
  const { prompt, systemPrompt, model } = body;
  if (!prompt) return json({ error: "Falta el prompt" }, 400, env);
  if (!env.OPENROUTER_API_KEY) return json({ error: "API key no configurada" }, 500, env);
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": env.ALLOWED_ORIGIN || "https://studium-6hw.pages.dev",
      "X-Title": "Studium UCALP",
    },
    body: JSON.stringify({
      model: model || env.AI_MODEL || DEFAULT_MODEL,
      max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt || "Sos un tutor universitario experto de la Lic. en Gobernanza de Datos de la UCALP. Respondé en español rioplatense con voseo." },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = await res.json();
  if (data.error) return json({ error: data.error.message || "Error de IA" }, 500, env);
  return json({ response: data.choices?.[0]?.message?.content || "" }, 200, env);
}


// ═══════════════════════════════════════════════════════════════════
// ZONA INTERACTIVA
// ═══════════════════════════════════════════════════════════════════

async function zonaLogin(body, env) {
  const { username, password } = body;
  if (!username || !password) return json({ error: "Faltan usuario o contraseña" }, 400, env);
  try {
    const initResp = await fetch(`${ZONA_URL}/index.php`, { redirect: "manual" });
    let cookies = extractCookies(initResp);
    const loginResp = await fetch(`${ZONA_URL}/index.php`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": cookies },
      body: new URLSearchParams({ usuario: username, cla: password, m: "bG9naW4=" }), redirect: "manual",
    });
    cookies = mergeCookies(cookies, extractCookies(loginResp));
    const checkResp = await fetch(`${ZONA_URL}/index.php?m=${ZONA_PAGES.inicio}`, { headers: { "Cookie": cookies }, redirect: "manual" });
    cookies = mergeCookies(cookies, extractCookies(checkResp));
    const html = await checkResp.text();
    if (!html.includes("selectCarrera") && !html.includes("Mis carreras")) {
      return json({ error: "Credenciales inválidas o no se pudo acceder" }, 401, env);
    }
    return json({ session: cookies, student: parseStudentInfo(html) }, 200, env);
  } catch (err) { return json({ error: "Error conectando a Zona", details: err.message }, 500, env); }
}

async function zonaScrape(body, env) {
  const { session, page, params } = body;
  if (!session) return json({ error: "Falta la sesión" }, 400, env);
  const pageKey = ZONA_PAGES[page];
  try {
    let url = `${ZONA_URL}/index.php?m=${pageKey || page}`;
    if (params) for (const [k, v] of Object.entries(params)) url += `&${k}=${encodeURIComponent(v)}`;
    const resp = await fetch(url, { headers: { "Cookie": session } });
    return json({ html: await resp.text(), url }, 200, env);
  } catch (err) { return json({ error: err.message }, 500, env); }
}

async function zonaProfile(body, env) {
  const { session, id_cliente } = body;
  if (!session) return json({ error: "Falta la sesión" }, 400, env);
  try {
    const results = {};
    if (id_cliente) {
      await fetch(`${ZONA_URL}/index.php?m=${ZONA_PAGES.inicio}`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": session },
        body: new URLSearchParams({ id_cliente }),
      });
    }
    const pages = [
      { key: "perfil", page: "datosAlumno", suffix: "&s=1", parser: parseProfile },
      { key: "analitico", page: "analitico", parser: parseAnalitico },
      { key: "cursadasActuales", page: "cursadasActuales", parser: parseCursadas },
      { key: "planEstudios", page: "planEstudios", parser: parsePlanEstudios },
      { key: "cursadasAnteriores", page: "cursadasAnteriores", parser: parseCursadas },
    ];
    for (const p of pages) {
      const resp = await fetch(`${ZONA_URL}/index.php?m=${ZONA_PAGES[p.page]}${p.suffix || ""}`, { headers: { "Cookie": session } });
      if (resp.ok) results[p.key] = p.parser(await resp.text());
    }
    return json(results, 200, env);
  } catch (err) { return json({ error: err.message }, 500, env); }
}

// ─── HTML Parsers ────────────────────────────────────────────────
function parseStudentInfo(html) {
  const info = {};
  const m = (r) => { const match = html.match(r); return match ? match[1].trim() : null; };
  info.nombre = m(/<h3[^>]*>([^<]+)<\/h3>/);
  info.legajo = m(/Legajo:\s*<\/small>\s*([^<]*)/);
  info.email = m(/([A-Za-z0-9._%+-]+@ucalpvirtual\.edu\.ar)/);
  info.campusUser = m(/Tu usuario en el campus virtual es\s*<b>([^<]+)<\/b>/);
  const careers = []; const cr = /<option[^>]*value="(\d+)"[^>]*>([^<]+)<\/option>/g; let cm;
  while ((cm = cr.exec(html)) !== null) careers.push({ id: cm[1], nombre: cm[2].trim() });
  if (careers.length) info.carreras = careers;
  info.carreraActual = m(/<option[^>]*selected[^>]*>([^<]+)<\/option>/);
  return info;
}

function parseProfile(html) {
  const data = {}; const r = /<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/g; let m;
  while ((m = r.exec(html)) !== null) { const k = m[1].trim(), v = m[2].trim(); if (k && v && !/^\d+$/.test(k)) data[k] = v; }
  return data;
}

function parseAnalitico(html) {
  const materias = []; const r = /<tr[^>]*>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g; let m;
  while ((m = r.exec(html)) !== null) {
    const mat = m[1].trim();
    if (mat && !/^(Materia|Asignatura|#)/i.test(mat)) materias.push({ materia: mat, nota: m[2].trim(), fecha: m[3].trim(), estado: m[4].trim() });
  }
  return materias;
}

function parseCursadas(html) {
  const c = []; const r = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g; let m;
  while ((m = r.exec(html)) !== null) {
    const mat = m[1].replace(/<[^>]+>/g, "").trim();
    if (mat && !/^(Materia|Asignatura|#|Nombre)/i.test(mat)) c.push({ materia: mat, info: m[2].replace(/<[^>]+>/g, "").trim() });
  }
  return c;
}

function parsePlanEstudios(html) {
  const p = []; const r = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g; let m;
  while ((m = r.exec(html)) !== null) {
    const mat = m[1].replace(/<[^>]+>/g, "").trim();
    if (mat && !/^(Materia|Asignatura|Código|#)/i.test(mat)) p.push({ materia: mat, anio: m[2].replace(/<[^>]+>/g, "").trim(), estado: m[3].replace(/<[^>]+>/g, "").trim() });
  }
  return p;
}

function extractCookies(response) {
  const cookies = [];
  const setCookies = response.headers.getAll ? response.headers.getAll("set-cookie") : [];
  if (setCookies.length === 0) {
    const s = response.headers.get("set-cookie");
    if (s) { s.split(/,(?=\s*\w+=)/).forEach(c => { const v = c.split(";")[0].trim(); if (v) cookies.push(v); }); return cookies.join("; "); }
  }
  setCookies.forEach(c => { const p = c.split(";")[0].trim(); if (p) cookies.push(p); });
  return cookies.join("; ");
}

function mergeCookies(a, b) {
  if (!b) return a; if (!a) return b;
  const map = {};
  a.split("; ").forEach(c => { const [k] = c.split("="); if (k) map[k.trim()] = c; });
  b.split("; ").forEach(c => { const [k] = c.split("="); if (k) map[k.trim()] = c; });
  return Object.values(map).join("; ");
}


// ═══════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, env);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400, env); }

    const path = new URL(request.url).pathname;
    try {
      switch (path) {
        case "/api/moodle/token":    return await moodleTokenFn(body, env);
        case "/api/moodle/call":     return await moodleCall(body, env);
        case "/api/moodle/file":     return await moodleFile(body, env);
        case "/api/ai":              return await aiProxy(body, env);
        case "/api/zona/login":      return await zonaLogin(body, env);
        case "/api/zona/scrape":     return await zonaScrape(body, env);
        case "/api/zona/profile":    return await zonaProfile(body, env);
        case "/api/google/token":    return await googleToken(body, env);
        case "/api/google/refresh":  return await googleRefresh(body, env);
        case "/api/google/calendar": return await googleCalendar(body, env);
        case "/api/google/gmail":    return await googleGmail(body, env);
        case "/api/google/drive":    return await googleDrive(body, env);
        default: return json({ error: "Not found" }, 404, env);
      }
    } catch (err) {
      return json({ error: "Internal error", details: err.message }, 500, env);
    }
  },
};
