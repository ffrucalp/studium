import { CONFIG } from "../config";

const API_BASE = CONFIG.API_BASE;

// ─── OAuth ────────────────────────────────────────────────────────

const SCOPES = [
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

/**
 * Build Google OAuth URL and redirect
 */
export function startGoogleLogin() {
  const clientId = CONFIG.GOOGLE_CLIENT_ID;
  if (!clientId) {
    alert("Google Client ID no configurado");
    return;
  }

  const redirectUri = `${window.location.origin}/auth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    hd: "ucalpvirtual.edu.ar", // restrict to institutional domain
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Exchange auth code for tokens (called from callback page)
 */
export async function exchangeCode(code) {
  const redirectUri = `${window.location.origin}/auth/callback`;
  const res = await fetch(`${API_BASE}/api/google/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { access_token, refresh_token, expires_in, user }
}

/**
 * Refresh access token
 */
export async function refreshToken(refreshToken) {
  const res = await fetch(`${API_BASE}/api/google/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { access_token, expires_in }
}

// ─── Calendar ─────────────────────────────────────────────────────

/**
 * Create a calendar event
 */
export async function createCalendarEvent(accessToken, { summary, description, startDateTime, endDateTime, colorId }) {
  const res = await fetch(`${API_BASE}/api/google/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: accessToken,
      action: "create",
      event: { summary, description, startDateTime, endDateTime, colorId },
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * List calendar events for a date range
 */
export async function listCalendarEvents(accessToken, timeMin, timeMax) {
  const res = await fetch(`${API_BASE}/api/google/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, action: "list", timeMin, timeMax }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.events;
}

/**
 * Create study plan events for a full week
 */
export async function syncStudyPlanToCalendar(accessToken, plannerData) {
  const dayMap = { "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6 };
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1); // next Monday
  if (today.getDay() >= 1) monday.setDate(monday.getDate() + 7); // if already past Monday, next week

  const results = [];
  for (const day of plannerData.days || []) {
    const offset = dayMap[day.day] || 0;
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset - 1);
    const dateStr = date.toISOString().split("T")[0];

    for (const block of day.blocks || []) {
      const [startH, startM] = (block.time?.split("-")[0] || "09:00").split(":");
      const [endH, endM] = (block.time?.split("-")[1] || "10:00").split(":");
      try {
        const result = await createCalendarEvent(accessToken, {
          summary: `📚 ${block.course}`,
          description: `${block.task || ""}\n\n📌 Técnica: ${block.technique || "Libre"}\n\nCreado por Studium UCALP`,
          startDateTime: `${dateStr}T${startH.padStart(2, "0")}:${(startM || "00").padStart(2, "0")}:00-03:00`,
          endDateTime: `${dateStr}T${endH.padStart(2, "0")}:${(endM || "00").padStart(2, "0")}:00-03:00`,
        });
        results.push(result);
      } catch (err) {
        console.error("Error creating event:", err);
      }
    }
  }
  return results;
}

// ─── Gmail ────────────────────────────────────────────────────────

/**
 * Send a study reminder email
 */
export async function sendStudyReminder(accessToken, { to, courseName, task, day, time }) {
  const subject = `📚 Recordatorio de estudio: ${courseName}`;
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: #B71C1C; color: white; padding: 16px 20px; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">📚 Studium · UCALP</h2>
      </div>
      <div style="border: 1px solid #eee; border-top: none; padding: 20px; border-radius: 0 0 12px 12px;">
        <h3 style="color: #B71C1C; margin-top: 0;">${courseName}</h3>
        <p><strong>📅 ${day}</strong> a las <strong>${time}</strong></p>
        <p>${task || "Sesión de estudio programada"}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
        <p style="color: #999; font-size: 12px;">Enviado desde Studium · Tutor IA para la Lic. en Gobernanza de Datos</p>
      </div>
    </div>
  `;

  const res = await fetch(`${API_BASE}/api/google/gmail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, to, subject, htmlBody }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ─── Drive ────────────────────────────────────────────────────────

/**
 * Ensure the Studium folder exists in Drive
 */
export async function ensureDriveFolder(accessToken) {
  const res = await fetch(`${API_BASE}/api/google/drive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, action: "ensureFolder" }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.folderId;
}

/**
 * Upload a Moodle file directly to Google Drive
 */
export async function uploadMoodleFileToDrive(accessToken, { fileUrl, fileName, moodleToken, folderId }) {
  const res = await fetch(`${API_BASE}/api/google/drive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: accessToken,
      action: "uploadFromMoodle",
      fileUrl, fileName, moodleToken, folderId,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.file; // { id, name, link }
}

/**
 * List files in Drive folder
 */
export async function listDriveFiles(accessToken, folderId) {
  const res = await fetch(`${API_BASE}/api/google/drive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, action: "list", folderId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.files;
}

/**
 * List only folders in Drive (for folder picker)
 */
export async function listDriveFolders(accessToken, folderId = null) {
  const res = await fetch(`${API_BASE}/api/google/drive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, action: "listFolders", folderId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.folders;
}

/**
 * Create a new folder in Drive
 */
export async function createDriveFolder(accessToken, folderName, parentFolderId = null) {
  const res = await fetch(`${API_BASE}/api/google/drive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, action: "createFolder", folderName, folderId: parentFolderId }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.folder;
}