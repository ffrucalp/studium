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

  // List folders only (for folder picker)
  if (action === "listFolders") {
    const parentQ = folderId ? `'${folderId}' in parents and ` : ``;
    const q = `${parentQ}mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=name&pageSize=100`,
      { headers: { "Authorization": `Bearer ${access_token}` } }
    );
    const data = await res.json();
    if (data.error) return json({ error: data.error.message }, data.error.code || 400, env);
    return json({ folders: data.files || [] }, 200, env);
  }

  // Create a new folder
  if (action === "createFolder") {
    const metadata = {
      name: body.folderName || "Nueva carpeta",
      mimeType: "application/vnd.google-apps.folder",
      parents: folderId ? [folderId] : undefined,
    };
    const res = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });
    const data = await res.json();
    if (data.error) return json({ error: data.error.message }, data.error.code || 400, env);
    return json({ folder: { id: data.id, name: data.name } }, 200, env);
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
  const url = `${base}/webservice/rest/server.php`;

  // Build form data - Moodle expects POST with form-encoded params
  const formData = new URLSearchParams();
  formData.set("wstoken", token);
  formData.set("wsfunction", wsfunction);
  formData.set("moodlewsrestformat", "json");

  if (params) {
    const flatten = (obj, prefix = "") => {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}[${k}]` : k;
        if (Array.isArray(v)) {
          v.forEach((item, i) => {
            if (typeof item === "object" && item !== null) flatten(item, `${key}[${i}]`);
            else formData.append(`${key}[${i}]`, String(item));
          });
        } else if (typeof v === "object" && v !== null) {
          flatten(v, key);
        } else {
          formData.append(key, String(v));
        }
      }
    };
    flatten(params);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
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

/**
 * Download a Moodle file and extract text content
 */
async function moodleExtract(body, env) {
  const { token, fileurl } = body;
  if (!token || !fileurl) return json({ error: "Faltan token o fileurl" }, 400, env);

  // Convert pluginfile.php to webservice/pluginfile.php for token auth
  let url = fileurl;
  if (url.includes("/pluginfile.php/") && !url.includes("/webservice/pluginfile.php/")) {
    url = url.replace("/pluginfile.php/", "/webservice/pluginfile.php/");
  }
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}token=${token}`);
  if (!res.ok) return json({ error: "No se pudo descargar" }, res.status, env);

  const contentType = res.headers.get("content-type") || "";
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let text = "";

  if (contentType.includes("pdf")) {
    text = extractPDFText(bytes);
  } else if (contentType.includes("text") || contentType.includes("html")) {
    const decoder = new TextDecoder("utf-8");
    let raw = decoder.decode(bytes);
    // Strip HTML tags if HTML
    if (contentType.includes("html")) {
      raw = raw.replace(/<script[\s\S]*?<\/script>/gi, "")
               .replace(/<style[\s\S]*?<\/style>/gi, "")
               .replace(/<[^>]+>/g, " ")
               .replace(/&nbsp;/g, " ")
               .replace(/&amp;/g, "&")
               .replace(/&lt;/g, "<")
               .replace(/&gt;/g, ">")
               .replace(/&quot;/g, '"')
               .replace(/&aacute;/gi, "á")
               .replace(/&eacute;/gi, "é")
               .replace(/&iacute;/gi, "í")
               .replace(/&oacute;/gi, "ó")
               .replace(/&uacute;/gi, "ú")
               .replace(/&ntilde;/gi, "ñ")
               .replace(/&Aacute;/g, "Á")
               .replace(/&Eacute;/g, "É")
               .replace(/&Iacute;/g, "Í")
               .replace(/&Oacute;/g, "Ó")
               .replace(/&Uacute;/g, "Ú")
               .replace(/&Ntilde;/g, "Ñ")
               .replace(/&uuml;/gi, "ü")
               .replace(/&Uuml;/g, "Ü")
               .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
               .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
               .replace(/\s+/g, " ");
    }
    text = raw.trim();
  } else {
    // For other types (docx, pptx etc), try as text
    try {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      text = decoder.decode(bytes).replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
    } catch {
      text = "";
    }
  }

  return json({
    text: text.substring(0, 50000), // Cap at ~50k chars
    contentType,
    size: buf.byteLength,
    chars: text.length,
  }, 200, env);
}

/**
 * Improved PDF text extraction
 * Handles FlateDecode compressed streams, hex strings, ToUnicode CMaps
 */
function extractPDFText(bytes) {
  // Convert to string for regex processing (latin1 to preserve bytes)
  let raw = "";
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);

  const textParts = [];

  // ── Step 1: Try to decompress FlateDecode streams ──
  // Find all stream positions and try to inflate them
  const decompressedStreams = [];
  const streamPositions = findStreamPositions(raw, bytes);

  for (const sp of streamPositions) {
    // Check if the object has FlateDecode filter
    const objHeader = raw.substring(Math.max(0, sp.objStart), sp.streamStart);
    const isFlateDecode = /\/Filter\s*\/FlateDecode/i.test(objHeader);

    if (isFlateDecode) {
      try {
        const inflated = inflateSync(bytes.slice(sp.dataStart, sp.dataEnd));
        if (inflated) {
          let decoded = "";
          for (let i = 0; i < inflated.length; i++) decoded += String.fromCharCode(inflated[i]);
          decompressedStreams.push({ content: decoded, objHeader });
        }
      } catch {}
    } else {
      // Non-compressed stream
      const content = raw.substring(sp.dataStart, sp.dataEnd);
      decompressedStreams.push({ content, objHeader });
    }
  }

  // ── Step 2: Parse ToUnicode CMaps from decompressed streams ──
  const unicodeMaps = {};
  for (const ds of decompressedStreams) {
    if (ds.content.includes("beginbfchar") || ds.content.includes("beginbfrange")) {
      const fontName = extractFontName(ds.objHeader, raw);
      const map = parseCMap(ds.content);
      if (Object.keys(map).length > 0 && fontName) {
        unicodeMaps[fontName] = map;
      }
      // Also store as a generic map if we only have one
      if (Object.keys(map).length > 0) {
        unicodeMaps["_last"] = { ...unicodeMaps["_last"], ...map };
      }
    }
  }

  // ── Step 3: Extract text from all streams (decompressed + raw) ──
  for (const ds of decompressedStreams) {
    const content = ds.content;
    if (!content.includes("BT") && !content.includes("Tj") && !content.includes("TJ")) continue;

    const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let match;
    while ((match = btEtRegex.exec(content)) !== null) {
      const block = match[1];
      let currentFont = null;
      const parts = extractTextFromBlock(block, unicodeMaps, currentFont);
      textParts.push(...parts);
      // Add newline between BT/ET blocks (each block is typically a line or paragraph)
      textParts.push("\n");
    }
  }

  // ── Step 4: Fallback - try uncompressed streams from raw ──
  if (textParts.length === 0) {
    const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let match;
    while ((match = btEtRegex.exec(raw)) !== null) {
      const block = match[1];
      const parts = extractTextFromBlock(block, unicodeMaps, null);
      textParts.push(...parts);
      textParts.push("\n");
    }
  }

  let result = textParts.join("")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // Remove isolated garbled characters (replacement chars, control chars, lone non-Latin symbols)
    .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    // Remove lines that are only garbled/non-readable (boxes, CJK without context)
    .replace(/^[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]{1,}$/gm, "")
    .trim();

  return result;
}

/**
 * Find byte positions of all stream/endstream pairs
 */
function findStreamPositions(raw, bytes) {
  const positions = [];
  const streamRe = /stream\r?\n/g;
  let m;
  while ((m = streamRe.exec(raw)) !== null) {
    const dataStart = m.index + m[0].length;
    // Find endstream
    const endIdx = raw.indexOf("endstream", dataStart);
    if (endIdx === -1) continue;
    // Trim trailing \r\n before endstream
    let dataEnd = endIdx;
    if (raw[dataEnd - 1] === "\n") dataEnd--;
    if (raw[dataEnd - 1] === "\r") dataEnd--;

    // Find the object start (look backwards for "obj")
    let objStart = raw.lastIndexOf(" obj", m.index);
    if (objStart === -1) objStart = raw.lastIndexOf("\nobj", m.index);
    if (objStart === -1) objStart = Math.max(0, m.index - 500);
    else objStart = raw.lastIndexOf("\n", objStart - 1) + 1;

    positions.push({ objStart, streamStart: m.index, dataStart, dataEnd });
  }
  return positions;
}

/**
 * Simple zlib inflate (deflate decompression) for Cloudflare Workers
 * Uses raw inflate since PDF FlateDecode uses zlib (header + deflate + checksum)
 */
function inflateSync(data) {
  // PDF FlateDecode uses zlib format: 2-byte header + deflate data + 4-byte checksum
  // Skip zlib header (usually 0x78 0x9C or 0x78 0x01 or 0x78 0xDA)
  if (data.length < 6) return null;
  if (data[0] !== 0x78) return null; // Not zlib

  const deflateData = data.slice(2, -4); // Strip header and checksum

  try {
    return tinf_uncompress(deflateData);
  } catch {
    return null;
  }
}

// ── Minimal DEFLATE decompressor ──
// Based on tinf by Joergen Ibsen, ported to JS
function tinf_uncompress(source) {
  const MAXBITS = 15;
  const MAXLCODES = 286;
  const MAXDCODES = 30;
  const FIXLCODES = 288;

  let srcPos = 0;
  let bitBuf = 0;
  let bitCount = 0;
  const dest = [];

  function readBits(num) {
    while (bitCount < num) {
      if (srcPos >= source.length) throw new Error("Unexpected end");
      bitBuf |= source[srcPos++] << bitCount;
      bitCount += 8;
    }
    const val = bitBuf & ((1 << num) - 1);
    bitBuf >>= num;
    bitCount -= num;
    return val;
  }

  function buildTree(lengths, num) {
    const offs = new Uint16Array(MAXBITS + 1);
    const count = new Uint16Array(MAXBITS + 1);
    const symbols = new Uint16Array(num);
    for (let i = 0; i < num; i++) if (lengths[i]) count[lengths[i]]++;
    offs[1] = 0;
    for (let i = 1; i < MAXBITS; i++) offs[i + 1] = offs[i] + count[i];
    for (let i = 0; i < num; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
    return { count, symbols };
  }

  function decode(tree) {
    let sum = 0, cur = 0, len = 0;
    do {
      cur = 2 * cur + readBits(1);
      len++;
      sum += tree.count[len];
      cur -= tree.count[len];
    } while (cur >= 0);
    return tree.symbols[sum + cur];
  }

  // Fixed Huffman trees
  const fixedLenLengths = new Uint8Array(FIXLCODES);
  for (let i = 0; i < 144; i++) fixedLenLengths[i] = 8;
  for (let i = 144; i < 256; i++) fixedLenLengths[i] = 9;
  for (let i = 256; i < 280; i++) fixedLenLengths[i] = 7;
  for (let i = 280; i < FIXLCODES; i++) fixedLenLengths[i] = 8;
  const fixedLenTree = buildTree(fixedLenLengths, FIXLCODES);

  const fixedDistLengths = new Uint8Array(MAXDCODES);
  for (let i = 0; i < MAXDCODES; i++) fixedDistLengths[i] = 5;
  const fixedDistTree = buildTree(fixedDistLengths, MAXDCODES);

  const lenBits = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const lenBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const distBits = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const clOrder = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

  function inflateBlock(lt, dt) {
    let sym;
    while ((sym = decode(lt)) !== 256) {
      if (sym < 256) {
        dest.push(sym);
      } else {
        sym -= 257;
        const length = lenBase[sym] + readBits(lenBits[sym]);
        const distSym = decode(dt);
        const offset = distBase[distSym] + readBits(distBits[distSym]);
        for (let i = 0; i < length; i++) dest.push(dest[dest.length - offset]);
      }
    }
  }

  let bfinal;
  do {
    bfinal = readBits(1);
    const btype = readBits(2);
    if (btype === 0) {
      // Stored
      bitBuf = 0; bitCount = 0;
      const len = source[srcPos] | (source[srcPos + 1] << 8); srcPos += 4;
      for (let i = 0; i < len; i++) dest.push(source[srcPos++]);
    } else if (btype === 1) {
      inflateBlock(fixedLenTree, fixedDistTree);
    } else if (btype === 2) {
      const hlit = readBits(5) + 257;
      const hdist = readBits(5) + 1;
      const hclen = readBits(4) + 4;
      const clLengths = new Uint8Array(19);
      for (let i = 0; i < hclen; i++) clLengths[clOrder[i]] = readBits(3);
      const clTree = buildTree(clLengths, 19);
      const lengths = new Uint8Array(hlit + hdist);
      let idx = 0;
      while (idx < hlit + hdist) {
        const s = decode(clTree);
        if (s < 16) { lengths[idx++] = s; }
        else if (s === 16) { const r = readBits(2) + 3; const prev = lengths[idx - 1]; for (let i = 0; i < r; i++) lengths[idx++] = prev; }
        else if (s === 17) { const r = readBits(3) + 3; for (let i = 0; i < r; i++) lengths[idx++] = 0; }
        else { const r = readBits(7) + 11; for (let i = 0; i < r; i++) lengths[idx++] = 0; }
      }
      const lt = buildTree(lengths.subarray(0, hlit), hlit);
      const dt = buildTree(lengths.subarray(hlit), hdist);
      inflateBlock(lt, dt);
    } else { throw new Error("Invalid block type"); }
  } while (!bfinal);

  return new Uint8Array(dest);
}

/**
 * Extract text operators from a BT..ET block
 */
function extractTextFromBlock(block, unicodeMaps, currentFont) {
  const parts = [];
  // Track font changes within block: /F1 12 Tf
  const lines = block.split("\n");
  let font = currentFont;
  let lastY = null;
  let lastFontSize = null;

  for (const line of lines) {
    const tfMatch = line.match(/\/(F\d+|[A-Za-z][A-Za-z0-9+,.-]*)\s+([\d.]+)\s+Tf/);
    if (tfMatch) {
      font = tfMatch[1];
      const newSize = parseFloat(tfMatch[2]);
      // Font size change often means new section/heading
      if (lastFontSize && Math.abs(newSize - lastFontSize) > 2) parts.push("\n");
      lastFontSize = newSize;
    }

    // Handle Td/TD (text positioning) - Y jumps = newline
    const tdMatch = line.match(/([-\d.]+)\s+([-\d.]+)\s+T[dD]/);
    if (tdMatch) {
      const tx = parseFloat(tdMatch[1]);
      const ty = parseFloat(tdMatch[2]);
      if (Math.abs(ty) > 0.5) parts.push("\n");
      else if (tx > 5) parts.push(" ");
    }

    // Handle Tm (text matrix): a b c d tx ty Tm
    const tmMatch = line.match(/([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm/);
    if (tmMatch) {
      const ty = parseFloat(tmMatch[6]);
      if (lastY !== null && Math.abs(ty - lastY) > 1) {
        parts.push("\n");
        // Larger Y jump = paragraph break (double newline)
        if (Math.abs(ty - lastY) > 15) parts.push("\n");
      }
      lastY = ty;
    }

    // T* = new line
    if (/\bT\*/.test(line)) parts.push("\n");

    // Tj operator: (text) Tj
    const tjRegex = /(\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f]+>)\s*Tj/g;
    let tm;
    while ((tm = tjRegex.exec(line)) !== null) {
      parts.push(decodePDFTextOperand(tm[1], unicodeMaps, font));
    }

    // TJ operator: [...] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    while ((tm = tjArrayRegex.exec(line)) !== null) {
      const inner = tm[1];
      // Extract strings and numbers
      const elemRegex = /(\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f]+>)|([-]?\d{3,})/g;
      let em;
      while ((em = elemRegex.exec(inner)) !== null) {
        if (em[1]) {
          parts.push(decodePDFTextOperand(em[1], unicodeMaps, font));
        } else if (em[2]) {
          // Large negative number = word space
          const kern = parseInt(em[2]);
          if (kern < -100) parts.push(" ");
        }
      }
    }

    // ' operator (move to next line and show text)
    const quoteRegex = /(\((?:[^()\\]|\\.)*\)|<[0-9A-Fa-f]+>)\s*'/g;
    while ((tm = quoteRegex.exec(line)) !== null) {
      parts.push("\n");
      parts.push(decodePDFTextOperand(tm[1], unicodeMaps, font));
    }
  }

  return parts;
}

/**
 * Decode a PDF text operand - either (literal string) or <hex string>
 */
function decodePDFTextOperand(operand, unicodeMaps, font) {
  if (operand.startsWith("<") && operand.endsWith(">")) {
    // Hex string
    const hex = operand.slice(1, -1);
    // Try ToUnicode map first
    const map = (font && unicodeMaps[font]) || unicodeMaps["_last"] || {};
    if (Object.keys(map).length > 0) {
      let result = "";
      // Try 4-digit codes first, then 2-digit
      for (let i = 0; i < hex.length; ) {
        if (i + 4 <= hex.length) {
          const code4 = hex.substring(i, i + 4).toUpperCase();
          if (map[code4]) { result += map[code4]; i += 4; continue; }
        }
        if (i + 2 <= hex.length) {
          const code2 = hex.substring(i, i + 2).toUpperCase();
          if (map[code2]) { result += map[code2]; i += 2; continue; }
          // Fallback: treat as char code
          const charCode = parseInt(code2, 16);
          if (charCode >= 32 && charCode < 127) result += String.fromCharCode(charCode);
          else if (charCode > 127) result += String.fromCharCode(charCode);
          i += 2;
        } else { i++; }
      }
      return result;
    }
    // No map: treat as raw byte pairs
    let result = "";
    for (let i = 0; i + 1 < hex.length; i += 2) {
      const code = parseInt(hex.substring(i, i + 2), 16);
      if (code >= 32) result += String.fromCharCode(code);
    }
    return result;
  }

  if (operand.startsWith("(") && operand.endsWith(")")) {
    // Literal string - decode escape sequences
    return decodePDFLiteralString(operand.slice(1, -1), unicodeMaps, font);
  }

  return operand;
}

function decodePDFLiteralString(s, unicodeMaps, font) {
  let result = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      if (i >= s.length) break;
      switch (s[i]) {
        case "n": result += "\n"; break;
        case "r": result += "\r"; break;
        case "t": result += "\t"; break;
        case "(": result += "("; break;
        case ")": result += ")"; break;
        case "\\": result += "\\"; break;
        default:
          // Octal escape \ddd
          if (s[i] >= "0" && s[i] <= "7") {
            let oct = s[i];
            if (i + 1 < s.length && s[i + 1] >= "0" && s[i + 1] <= "7") { oct += s[++i]; }
            if (i + 1 < s.length && s[i + 1] >= "0" && s[i + 1] <= "7") { oct += s[++i]; }
            const charCode = parseInt(oct, 8);
            // Try unicode map
            const map = (font && unicodeMaps[font]) || unicodeMaps["_last"];
            const hexKey = charCode.toString(16).toUpperCase().padStart(2, "0");
            if (map && map[hexKey]) { result += map[hexKey]; }
            else { result += String.fromCharCode(charCode); }
          } else {
            result += s[i];
          }
      }
    } else {
      result += s[i];
    }
  }
  return result;
}

/**
 * Parse a CMap (ToUnicode) stream
 */
function parseCMap(content) {
  const map = {};

  // beginbfchar: <srcCode> <dstCode>
  const bfcharRe = /beginbfchar\s*([\s\S]*?)\s*endbfchar/g;
  let m;
  while ((m = bfcharRe.exec(content)) !== null) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let pm;
    while ((pm = pairRe.exec(m[1])) !== null) {
      const src = pm[1].toUpperCase();
      const dst = pm[2];
      map[src] = hexToUnicode(dst);
    }
  }

  // beginbfrange: <start> <end> <dstStart> or <start> <end> [<dst1> <dst2> ...]
  const bfrangeRe = /beginbfrange\s*([\s\S]*?)\s*endbfrange/g;
  while ((m = bfrangeRe.exec(content)) !== null) {
    const rangeBlock = m[1];
    // Pattern: <start> <end> <dstStart>
    const rangeRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let rm;
    while ((rm = rangeRe.exec(rangeBlock)) !== null) {
      const start = parseInt(rm[1], 16);
      const end = parseInt(rm[2], 16);
      let dstStart = parseInt(rm[3], 16);
      const srcLen = rm[1].length;
      for (let i = start; i <= end; i++) {
        map[i.toString(16).toUpperCase().padStart(srcLen, "0")] = String.fromCodePoint(dstStart++);
      }
    }
    // Pattern: <start> <end> [<dst1> <dst2> ...]
    const arrayRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g;
    while ((rm = arrayRe.exec(rangeBlock)) !== null) {
      const start = parseInt(rm[1], 16);
      const srcLen = rm[1].length;
      const dsts = [];
      const dstRe = /<([0-9A-Fa-f]+)>/g;
      let dm;
      while ((dm = dstRe.exec(rm[3])) !== null) dsts.push(dm[1]);
      for (let i = 0; i < dsts.length; i++) {
        map[(start + i).toString(16).toUpperCase().padStart(srcLen, "0")] = hexToUnicode(dsts[i]);
      }
    }
  }

  return map;
}

function hexToUnicode(hex) {
  // Convert hex pairs to Unicode characters
  let result = "";
  for (let i = 0; i + 3 < hex.length; i += 4) {
    result += String.fromCodePoint(parseInt(hex.substring(i, i + 4), 16));
  }
  if (result) return result;
  // Fallback for 2-digit hex
  if (hex.length === 2) return String.fromCharCode(parseInt(hex, 16));
  // If odd-length or other
  return String.fromCodePoint(parseInt(hex, 16));
}

/**
 * Try to extract font name from the object header referencing a ToUnicode CMap
 */
function extractFontName(objHeader, fullRaw) {
  // This CMap is referenced by a font object. Try to find which font.
  // Look for /BaseFont /Name pattern
  const bfMatch = objHeader.match(/\/BaseFont\s*\/([A-Za-z0-9+,.-]+)/);
  if (bfMatch) return bfMatch[1];
  // Look for object number and find font references
  const objMatch = objHeader.match(/(\d+)\s+\d+\s+obj/);
  if (objMatch) {
    const objNum = objMatch[1];
    // Search for /ToUnicode objNum 0 R in font definitions
    const fontRe = new RegExp(`/(F\\d+)\\s+\\d+\\s+\\d+\\s+R`, "g");
    // Simple: just return the object number as fallback key
    return `_obj${objNum}`;
  }
  return null;
}

function decodePDFString(s) {
  // Handle PDF escape sequences (legacy compatibility)
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}


// ═══════════════════════════════════════════════════════════════════
// AI (OpenRouter)
// ═══════════════════════════════════════════════════════════════════

async function aiProxy(body, env) {
  const { prompt, systemPrompt, model, images } = body;
  if (!prompt) return json({ error: "Falta el prompt" }, 400, env);
  if (!env.OPENROUTER_API_KEY) return json({ error: "API key no configurada" }, 500, env);

  // Build user content (text-only or multimodal with images)
  let userContent;
  if (images && images.length > 0) {
    userContent = [
      { type: "text", text: prompt },
      ...images.map(img => ({ type: "image_url", image_url: { url: img } })),
    ];
  } else {
    userContent = prompt;
  }

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
        { role: "user", content: userContent },
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

/**
 * Read Zona response text with proper encoding (usually iso-8859-1 / windows-1252)
 */
async function readZonaText(response) {
  const buf = await response.arrayBuffer();
  const ct = response.headers.get("content-type") || "";
  const charsetMatch = ct.match(/charset=([^\s;]+)/i);
  const charset = charsetMatch ? charsetMatch[1].toLowerCase().replace(/^"|"$/g, "") : null;

  // If server declares a non-UTF-8 charset, use it
  if (charset && charset !== "utf-8") {
    try { return new TextDecoder(charset).decode(buf); } catch {}
  }

  // Try UTF-8 strictly; if it fails, fall back to windows-1252 (superset of iso-8859-1)
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

async function zonaLogin(body, env) {
  const { username, password } = body;
  if (!username || !password) return json({ error: "Faltan usuario o contraseña" }, 400, env);
  try {
    // Step 1: GET login.php with redirect to get session cookie
    const initResp = await fetch(`${ZONA_URL}/login.php?redirect=%2Finicio.php`, { redirect: "manual" });
    let cookies = extractCookies(initResp);
    if (initResp.status === 200) await readZonaText(initResp);
    // Follow any initial redirects
    let loc = initResp.headers.get("location");
    if (loc) {
      const r = await fetch(loc.startsWith("http") ? loc : `${ZONA_URL}/${loc.replace(/^\//, "")}`, {
        headers: { "Cookie": cookies }, redirect: "manual"
      });
      cookies = mergeCookies(cookies, extractCookies(r));
      if (r.status === 200) await readZonaText(r);
    }

    // Step 2: POST to login.php with redirect param and boton field
    const browserHeaders = {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookies,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      "Referer": `${ZONA_URL}/login.php?redirect=%2Finicio.php`,
      "Origin": ZONA_URL,
    };
    const loginResp = await fetch(`${ZONA_URL}/login.php?redirect=%2Finicio.php`, {
      method: "POST",
      headers: browserHeaders,
      body: new URLSearchParams({ usuario: username, cla: password, boton: "Ingresar" }),
      redirect: "manual",
    });
    cookies = mergeCookies(cookies, extractCookies(loginResp));

    // Step 3: Follow all redirects after login
    let html = "";
    loc = loginResp.headers.get("location");
    let attempts = 0;
    while (loc && attempts < 8) {
      const redirectUrl = loc.startsWith("http") ? loc : `${ZONA_URL}/${loc.replace(/^\//, "")}`;
      const redirectResp = await fetch(redirectUrl, { headers: { "Cookie": cookies }, redirect: "manual" });
      cookies = mergeCookies(cookies, extractCookies(redirectResp));
      loc = redirectResp.headers.get("location");
      if (!loc) html = await readZonaText(redirectResp);
      attempts++;
    }
    if (!html && loginResp.status === 200) html = await readZonaText(loginResp);

    // Step 4: Check if we're on role selection page
    if (html.includes("Elija el rol") || html.includes("indexElige") || html.includes("aW5kZXhFbGlnZQ==")) {
      // Select Alumno role
      const selectResp = await fetch(`${ZONA_URL}/index.php?m=aW5kZXhFbGlnZQ==`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": cookies },
        body: new URLSearchParams({ tipo: "A" }),
        redirect: "manual",
      });
      cookies = mergeCookies(cookies, extractCookies(selectResp));

      loc = selectResp.headers.get("location");
      html = "";
      let roleAttempts = 0;
      while (loc && roleAttempts < 5) {
        const r = await fetch(loc.startsWith("http") ? loc : `${ZONA_URL}/${loc.replace(/^\//, "")}`, {
          headers: { "Cookie": cookies }, redirect: "manual",
        });
        cookies = mergeCookies(cookies, extractCookies(r));
        loc = r.headers.get("location");
        if (!loc) html = await readZonaText(r);
        roleAttempts++;
      }
      if (!html) html = await readZonaText(selectResp);
    }

    // Step 5: Try fetching inicio if not on dashboard yet
    if (!html.includes("selectCarrera") && !html.includes("Mis carreras") && !html.includes("Legajo")) {
      const inicioResp = await fetch(`${ZONA_URL}/index.php?m=${ZONA_PAGES.inicio}`, {
        headers: { "Cookie": cookies }, redirect: "manual",
      });
      cookies = mergeCookies(cookies, extractCookies(inicioResp));
      loc = inicioResp.headers.get("location");
      if (loc && loc.includes("login")) {
        return json({ error: "Sesión no válida después del login", debug: { cookies: cookies.substring(0, 100) } }, 401, env);
      }
      if (!loc) html = await readZonaText(inicioResp);
    }

    // Success check
    if (html.includes("selectCarrera") || html.includes("Mis carreras") || html.includes("Legajo")) {
      return json({ session: cookies, student: parseStudentInfo(html) }, 200, env);
    }

    return json({
      error: "No se pudo acceder a Zona Interactiva",
      debug: {
        
        hasLoginForm: html.includes('name="usuario"'),
        hasRoleSelect: html.includes("Elija el rol"),
        bodyPreview: html.substring(0, 500),
      }
    }, 401, env);
  } catch (err) {
    return json({ error: "Error conectando a Zona", details: err.message }, 500, env);
  }
}

async function zonaScrape(body, env) {
  const { session, page, params } = body;
  if (!session) return json({ error: "Falta la sesión" }, 400, env);
  const pageKey = ZONA_PAGES[page];
  try {
    let url = `${ZONA_URL}/index.php?m=${pageKey || page}`;
    if (params) for (const [k, v] of Object.entries(params)) url += `&${k}=${encodeURIComponent(v)}`;
    const resp = await fetch(url, { headers: { "Cookie": session } });
    return json({ html: await readZonaText(resp), url }, 200, env);
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
      if (resp.ok) results[p.key] = p.parser(await readZonaText(resp));
    }
    return json(results, 200, env);
  } catch (err) { return json({ error: err.message }, 500, env); }
}

// ─── HTML Parsers ────────────────────────────────────────────────

/** Decode common HTML entities (Spanish chars, numeric refs) */
function decHtml(s) {
  if (!s) return s;
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&aacute;/gi, "á").replace(/&Aacute;/g, "Á")
    .replace(/&eacute;/gi, "é").replace(/&Eacute;/g, "É")
    .replace(/&iacute;/gi, "í").replace(/&Iacute;/g, "Í")
    .replace(/&oacute;/gi, "ó").replace(/&Oacute;/g, "Ó")
    .replace(/&uacute;/gi, "ú").replace(/&Uacute;/g, "Ú")
    .replace(/&ntilde;/gi, "ñ").replace(/&Ntilde;/g, "Ñ")
    .replace(/&uuml;/gi, "ü").replace(/&Uuml;/g, "Ü")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function parseStudentInfo(html) {
  const info = {};
  const m = (r) => { const match = html.match(r); return match ? decHtml(match[1].trim()) : null; };
  info.nombre = m(/<h3[^>]*>([^<]+)<\/h3>/);
  info.legajo = m(/Legajo:\s*<\/small>\s*([^<]*)/);
  info.email = m(/([A-Za-z0-9._%+-]+@ucalpvirtual\.edu\.ar)/);
  info.campusUser = m(/Tu usuario en el campus virtual es\s*<b>([^<]+)<\/b>/);
  const careers = []; const cr = /<option[^>]*value="(\d+)"[^>]*>([^<]+)<\/option>/g; let cm;
  while ((cm = cr.exec(html)) !== null) careers.push({ id: cm[1], nombre: decHtml(cm[2].trim()) });
  if (careers.length) info.carreras = careers;
  info.carreraActual = m(/<option[^>]*selected[^>]*>([^<]+)<\/option>/);
  return info;
}

function parseProfile(html) {
  const data = {}; const r = /<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/g; let m;
  while ((m = r.exec(html)) !== null) { const k = decHtml(m[1].trim()), v = decHtml(m[2].trim()); if (k && v && !/^\d+$/.test(k)) data[k] = v; }
  return data;
}

function parseAnalitico(html) {
  const materias = []; const r = /<tr[^>]*>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g; let m;
  while ((m = r.exec(html)) !== null) {
    const mat = decHtml(m[1].trim());
    if (mat && !/^(Materia|Asignatura|#)/i.test(mat)) materias.push({ materia: mat, nota: decHtml(m[2].trim()), fecha: decHtml(m[3].trim()), estado: decHtml(m[4].trim()) });
  }
  return materias;
}

function parseCursadas(html) {
  const c = []; const r = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g; let m;
  while ((m = r.exec(html)) !== null) {
    const mat = decHtml(m[1].replace(/<[^>]+>/g, "").trim());
    if (mat && !/^(Materia|Asignatura|#|Nombre)/i.test(mat)) c.push({ materia: mat, info: decHtml(m[2].replace(/<[^>]+>/g, "").trim()) });
  }
  return c;
}

function parsePlanEstudios(html) {
  const p = []; const r = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g; let m;
  while ((m = r.exec(html)) !== null) {
    const mat = decHtml(m[1].replace(/<[^>]+>/g, "").trim());
    if (mat && !/^(Materia|Asignatura|Código|#)/i.test(mat)) p.push({ materia: mat, anio: decHtml(m[2].replace(/<[^>]+>/g, "").trim()), estado: decHtml(m[3].replace(/<[^>]+>/g, "").trim()) });
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
// BIBLIO UCALP - Catálogo de Biblioteca
// ═══════════════════════════════════════════════════════════════════

const BIBLIO_URL = "https://biblio.ucalp.edu.ar";

/**
 * Search the UCALP library catalog (biblio.ucalp.edu.ar)
 * body: { query, page?, type?, field?, sucursal? }
 *   query: search term
 *   page: page number (default 1)
 *   type: "simple" | "avanzado" (default "simple")
 *   field: for advanced - "13" (titulo), "12" (apellido autor), "18" (nombre autor), "14" (tema)
 *   sucursal: library branch id (default "0" = all)
 */
async function biblioSearch(body, env) {
  const { query, page = 1, type = "simple", field = "13", sucursal = "0" } = body;
  if (!query || query.trim().length < 2) return json({ error: "Búsqueda muy corta" }, 400, env);

  // Build form data
  const params = new URLSearchParams();
  params.append("page", String(page));

  if (type === "simple") {
    params.append("filters[valor_simple]", query);
    params.append("filters[tipo_busqueda]", "simple");
  } else {
    params.append("filters[custom][0][caracteristica]", field);
    params.append("filters[custom][0][valor]", query);
    params.append("filters[custom][0][logico]", "INTERSECT");
    params.append("filters[sucursal]", sucursal);
    params.append("filters[tipo_doc]", "0");
    params.append("filters[formato]", "0");
    params.append("filters[tipo_busqueda]", "avanzado");
  }

  try {
    const res = await fetch(`${BIBLIO_URL}/index.php/ct_documento/buscar/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html, */*",
        "User-Agent": "Studium/1.0",
        "Referer": `${BIBLIO_URL}/`,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: params.toString(),
    });

    // The response is ISO-8859-1 encoded HTML
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("iso-8859-1");
    const html = decoder.decode(buffer);

    // Parse the HTML table to extract book results
    const books = parseBiblioResults(html);

    // Try to extract pagination info
    const totalMatch = html.match(/(\d+)\s*resultado/i);
    const total = totalMatch ? parseInt(totalMatch[1]) : books.length;

    return json({
      books,
      total,
      page,
      query,
      hasMore: books.length >= 10,
    }, 200, env);

  } catch (err) {
    return json({ error: "Error al consultar catálogo", details: err.message }, 500, env);
  }
}

/**
 * Parse the HTML response from biblio.ucalp.edu.ar
 * Extracts rows from the results table
 */
function parseBiblioResults(html) {
  const books = [];
  if (!html || html.trim().length === 0) return books;

  // The results come in a table with headers: Titulo, Autor, Datos publicacion, Signatura topografica, Cant. ej. disponibles
  // Match each <tr> that contains <td> elements (skip header <th> rows)
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;

  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const title = stripTags(match[1]).trim();
    const author = stripTags(match[2]).trim();
    const pubData = stripTags(match[3]).trim();
    const signature = stripTags(match[4]).trim();
    const available = stripTags(match[5]).trim();

    if (title && title !== "Titulo") {
      books.push({
        title,
        author,
        publicationData: pubData,
        signature,
        availableCopies: parseInt(available) || 0,
      });
    }
  }

  // Fallback: try simpler parsing if regex didn't match
  if (books.length === 0) {
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let m;
    while ((m = tdRegex.exec(html)) !== null) {
      cells.push(stripTags(m[1]).trim());
    }
    // Group in sets of 5 (the 5 columns)
    for (let i = 0; i + 4 < cells.length; i += 5) {
      if (cells[i] && cells[i] !== "Titulo" && cells[i] !== "") {
        books.push({
          title: cells[i],
          author: cells[i + 1],
          publicationData: cells[i + 2],
          signature: cells[i + 3],
          availableCopies: parseInt(cells[i + 4]) || 0,
        });
      }
    }
  }

  return books;
}

function stripTags(html) {
  if (!html) return "";
  // Common HTML named entities (especially Spanish accented chars)
  const entities = {
    "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
    "&aacute;": "á", "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú",
    "&Aacute;": "Á", "&Eacute;": "É", "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú",
    "&ntilde;": "ñ", "&Ntilde;": "Ñ", "&uuml;": "ü", "&Uuml;": "Ü",
    "&iquest;": "¿", "&iexcl;": "¡", "&mdash;": "—", "&ndash;": "–",
    "&laquo;": "«", "&raquo;": "»", "&deg;": "°", "&ordm;": "º", "&ordf;": "ª",
  };
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-zA-Z]+;/g, m => entities[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, " ");
}


// ═══════════════════════════════════════════════════════════════════
// SEMANTIC SCHOLAR API
// ═══════════════════════════════════════════════════════════════════

const S2_BASE = "https://api.semanticscholar.org";
const S2_PAPER_FIELDS = "title,year,authors,citationCount,tldr,url,openAccessPdf,abstract,venue,publicationTypes,externalIds,influentialCitationCount,referenceCount";
const S2_AUTHOR_FIELDS = "name,url,paperCount,citationCount,hIndex,affiliations";

function s2Headers(env) {
  const h = { "Accept": "application/json" };
  if (env.SEMANTIC_SCHOLAR_KEY) h["x-api-key"] = env.SEMANTIC_SCHOLAR_KEY;
  return h;
}

/**
 * Search papers
 * body: { query, offset?, limit? }
 */
async function scholarSearch(body, env) {
  const { query, offset = 0, limit = 10 } = body;
  if (!query) return json({ error: "Falta query" }, 400, env);

  const params = new URLSearchParams({ query, offset: String(offset), limit: String(Math.min(limit, 20)), fields: S2_PAPER_FIELDS });
  const res = await fetch(`${S2_BASE}/graph/v1/paper/search?${params}`, { headers: s2Headers(env) });
  if (!res.ok) return json({ error: "Error Semantic Scholar", status: res.status }, res.status, env);
  const data = await res.json();
  return json(data, 200, env);
}

/**
 * Get paper details + optional citations/references
 * body: { paperId, include?: "citations" | "references" | "both" }
 */
async function scholarPaper(body, env) {
  const { paperId, include } = body;
  if (!paperId) return json({ error: "Falta paperId" }, 400, env);

  const res = await fetch(`${S2_BASE}/graph/v1/paper/${paperId}?fields=${S2_PAPER_FIELDS}`, { headers: s2Headers(env) });
  if (!res.ok) return json({ error: "Paper no encontrado", status: res.status }, res.status, env);
  const paper = await res.json();

  const result = { paper };

  if (include === "citations" || include === "both") {
    const cRes = await fetch(`${S2_BASE}/graph/v1/paper/${paperId}/citations?fields=title,year,citationCount,authors,url&limit=10`, { headers: s2Headers(env) });
    if (cRes.ok) result.citations = (await cRes.json()).data || [];
  }

  if (include === "references" || include === "both") {
    const rRes = await fetch(`${S2_BASE}/graph/v1/paper/${paperId}/references?fields=title,year,citationCount,authors,url&limit=10`, { headers: s2Headers(env) });
    if (rRes.ok) result.references = (await rRes.json()).data || [];
  }

  return json(result, 200, env);
}

/**
 * Get paper recommendations
 * body: { paperId, limit? }
 */
async function scholarRecommend(body, env) {
  const { paperId, limit = 10 } = body;
  if (!paperId) return json({ error: "Falta paperId" }, 400, env);

  const res = await fetch(`${S2_BASE}/recommendations/v1/papers/forpaper/${paperId}?fields=${S2_PAPER_FIELDS}&limit=${Math.min(limit, 20)}`, { headers: s2Headers(env) });
  if (!res.ok) return json({ error: "Error al obtener recomendaciones", status: res.status }, res.status, env);
  const data = await res.json();
  return json(data, 200, env);
}

/**
 * Search or get author details
 * body: { query?, authorId? }
 */
async function scholarAuthor(body, env) {
  const { query, authorId } = body;

  if (authorId) {
    const res = await fetch(`${S2_BASE}/graph/v1/author/${authorId}?fields=${S2_AUTHOR_FIELDS}`, { headers: s2Headers(env) });
    if (!res.ok) return json({ error: "Autor no encontrado" }, res.status, env);
    const author = await res.json();

    // Get top papers
    const pRes = await fetch(`${S2_BASE}/graph/v1/author/${authorId}/papers?fields=title,year,citationCount,venue,url,openAccessPdf&limit=10&sort=citationCount:desc`, { headers: s2Headers(env) });
    const papers = pRes.ok ? (await pRes.json()).data || [] : [];

    return json({ author, papers }, 200, env);
  }

  if (query) {
    const res = await fetch(`${S2_BASE}/graph/v1/author/search?query=${encodeURIComponent(query)}&fields=${S2_AUTHOR_FIELDS}&limit=5`, { headers: s2Headers(env) });
    if (!res.ok) return json({ error: "Error buscando autor" }, res.status, env);
    return json(await res.json(), 200, env);
  }

  return json({ error: "Falta query o authorId" }, 400, env);
}


// ═══════════════════════════════════════════════════════════════════
// OPENALEX API
// ═══════════════════════════════════════════════════════════════════

const OA_BASE = "https://api.openalex.org";

function oaParams(env, extra = {}) {
  const p = new URLSearchParams(extra);
  if (env.OPENALEX_KEY) p.set("api_key", env.OPENALEX_KEY);
  else p.set("mailto", "biblioteca@ucalp.edu.ar");
  return p;
}

/** Reconstruct abstract from inverted index */
function reconstructAbstract(inverted) {
  if (!inverted) return "";
  const arr = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const pos of positions) arr[pos] = word;
  }
  return arr.join(" ");
}

/** Map OpenAlex work to simplified format */
function mapOAWork(w) {
  return {
    id: w.id,
    title: w.display_name || w.title || "",
    year: w.publication_year,
    authors: (w.authorships || []).map(a => ({
      name: a.author?.display_name || "",
      id: a.author?.id || "",
      institution: a.institutions?.[0]?.display_name || "",
    })),
    citedByCount: w.cited_by_count || 0,
    type: w.type || "",
    isOa: w.open_access?.is_oa || false,
    oaUrl: w.open_access?.oa_url || null,
    doi: w.doi || null,
    source: w.primary_location?.source?.display_name || "",
    sourceType: w.primary_location?.source?.type || "",
    abstract: reconstructAbstract(w.abstract_inverted_index),
    topics: (w.topics || []).slice(0, 3).map(t => t.display_name),
    language: w.language,
  };
}

/**
 * Search works
 * body: { query, page?, perPage?, filter? }
 */
async function openalexSearch(body, env) {
  const { query, page = 1, perPage = 10, filter } = body;
  if (!query) return json({ error: "Falta query" }, 400, env);

  const p = oaParams(env);
  p.set("search", query);
  p.set("page", String(page));
  p.set("per_page", String(Math.min(perPage, 25)));
  p.set("select", "id,display_name,publication_year,authorships,cited_by_count,type,open_access,doi,primary_location,abstract_inverted_index,topics,language");
  if (filter) p.set("filter", filter);

  const res = await fetch(`${OA_BASE}/works?${p}`);
  if (!res.ok) return json({ error: "Error OpenAlex", status: res.status }, res.status, env);
  const data = await res.json();

  return json({
    works: (data.results || []).map(mapOAWork),
    total: data.meta?.count || 0,
    page: data.meta?.page || page,
    perPage: data.meta?.per_page || perPage,
  }, 200, env);
}

/**
 * Search authors
 * body: { query }
 */
async function openalexAuthors(body, env) {
  const { query } = body;
  if (!query) return json({ error: "Falta query" }, 400, env);

  const p = oaParams(env);
  p.set("search", query);
  p.set("per_page", "5");
  p.set("select", "id,display_name,works_count,cited_by_count,summary_stats,affiliations,topics");

  const res = await fetch(`${OA_BASE}/authors?${p}`);
  if (!res.ok) return json({ error: "Error OpenAlex authors" }, res.status, env);
  const data = await res.json();

  return json({
    authors: (data.results || []).map(a => ({
      id: a.id, name: a.display_name, worksCount: a.works_count,
      citedByCount: a.cited_by_count, hIndex: a.summary_stats?.h_index,
      i10Index: a.summary_stats?.i10_index,
      affiliations: (a.affiliations || []).slice(0, 2).map(af => af.institution?.display_name || ""),
      topics: (a.topics || []).slice(0, 5).map(t => t.display_name),
    })),
  }, 200, env);
}


// ═══════════════════════════════════════════════════════════════════
// SERPAPI - GOOGLE SCHOLAR
// ═══════════════════════════════════════════════════════════════════

/**
 * Search Google Scholar via SerpApi
 * body: { query, start?, yearFrom?, yearTo?, sortBy? }
 */
async function serpScholarSearch(body, env) {
  const { query, start = 0, yearFrom, yearTo, sortBy } = body;
  if (!query) return json({ error: "Falta query" }, 400, env);
  if (!env.SERPAPI_KEY) return json({ error: "SerpApi key no configurada" }, 500, env);

  const p = new URLSearchParams({
    engine: "google_scholar",
    q: query,
    api_key: env.SERPAPI_KEY,
    start: String(start),
    num: "10",
    hl: "es",
  });
  if (yearFrom) p.set("as_ylo", String(yearFrom));
  if (yearTo) p.set("as_yhi", String(yearTo));
  if (sortBy === "date") p.set("scisbd", "1");

  try {
    const res = await fetch(`https://serpapi.com/search?${p}`);
    if (!res.ok) return json({ error: "Error SerpApi", status: res.status }, res.status, env);
    const data = await res.json();

    const results = (data.organic_results || []).map((r, i) => ({
      position: r.position || i,
      title: r.title || "",
      link: r.link || "",
      snippet: r.snippet || "",
      authors: r.publication_info?.summary?.split(" - ")?.[0] || "",
      publishedInfo: r.publication_info?.summary || "",
      citedBy: r.inline_links?.cited_by?.total || 0,
      citedByLink: r.inline_links?.cited_by?.link || "",
      relatedLink: r.inline_links?.related_pages_link || "",
      pdfLink: r.resources?.[0]?.link || null,
      pdfTitle: r.resources?.[0]?.title || null,
      type: r.type || "",
    }));

    return json({
      results,
      total: data.search_information?.total_results || 0,
      start,
      hasMore: results.length >= 10,
      searchTime: data.search_information?.time_taken_displayed || 0,
    }, 200, env);
  } catch (err) {
    return json({ error: "Error consultando Google Scholar", details: err.message }, 500, env);
  }
}


// ═══════════════════════════════════════════════════════════════════
// WOLFRAM ALPHA
// ═══════════════════════════════════════════════════════════════════

/**
 * Query Wolfram Alpha Short Answers API
 * body: { query }
 */
async function wolframQuery(body, env) {
  const { query } = body;
  if (!query) return json({ error: "Falta query" }, 400, env);
  if (!env.WOLFRAM_APPID) return json({ error: "Wolfram AppID no configurado" }, 500, env);

  try {
    // Short Answers API - returns plain text
    const p = new URLSearchParams({ appid: env.WOLFRAM_APPID, i: query, units: "metric" });
    const res = await fetch(`https://api.wolframalpha.com/v1/result?${p}`);
    const text = await res.text();

    if (!res.ok || text.startsWith("Wolfram|Alpha did not understand")) {
      return json({ answer: null, error: text, query }, 200, env);
    }

    return json({ answer: text, query }, 200, env);
  } catch (err) {
    return json({ error: "Error consultando Wolfram Alpha", details: err.message }, 500, env);
  }
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
        case "/api/moodle/extract":  return await moodleExtract(body, env);
        case "/api/ai":              return await aiProxy(body, env);
        case "/api/zona/login":      return await zonaLogin(body, env);
        case "/api/zona/scrape":     return await zonaScrape(body, env);
        case "/api/zona/profile":    return await zonaProfile(body, env);
        case "/api/google/token":    return await googleToken(body, env);
        case "/api/google/refresh":  return await googleRefresh(body, env);
        case "/api/google/calendar": return await googleCalendar(body, env);
        case "/api/google/gmail":    return await googleGmail(body, env);
        case "/api/google/drive":    return await googleDrive(body, env);
        case "/api/biblio/search":   return await biblioSearch(body, env);
        case "/api/scholar/search":     return await scholarSearch(body, env);
        case "/api/scholar/paper":      return await scholarPaper(body, env);
        case "/api/scholar/recommend":  return await scholarRecommend(body, env);
        case "/api/scholar/author":     return await scholarAuthor(body, env);
        case "/api/openalex/search":    return await openalexSearch(body, env);
        case "/api/openalex/authors":   return await openalexAuthors(body, env);
        case "/api/serpapi/scholar":     return await serpScholarSearch(body, env);
        case "/api/wolfram/query":       return await wolframQuery(body, env);
        default: return json({ error: "Not found" }, 404, env);
      }
    } catch (err) {
      return json({ error: "Internal error", details: err.message }, 500, env);
    }
  },
};