import { CONFIG } from "../config";

const API_BASE = CONFIG.API_BASE; // same worker, different paths

/**
 * Get Moodle authentication token via Worker proxy
 */
export async function getMoodleToken(username, password) {
  const res = await fetch(`${API_BASE}/api/moodle/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.token;
}

/**
 * Call a Moodle Web Service function via Worker proxy
 */
export async function moodleCall(token, wsfunction, params = {}) {
  const res = await fetch(`${API_BASE}/api/moodle/call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, wsfunction, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/**
 * Get site info (user id, name, etc.)
 */
export async function getSiteInfo(token) {
  return moodleCall(token, "core_webservice_get_site_info");
}

/**
 * Get user's enrolled courses
 */
export async function getUserCourses(token, userId) {
  return moodleCall(token, "core_enrol_get_users_courses", { userid: userId });
}

/**
 * Get course contents (sections, modules, resources)
 */
export async function getCourseContents(token, courseId) {
  return moodleCall(token, "core_course_get_contents", { courseid: courseId });
}

/**
 * Get course completion status
 */
export async function getCourseCompletion(token, courseId, userId) {
  try {
    return await moodleCall(token, "core_completion_get_activities_completion_status", {
      courseid: courseId,
      userid: userId,
    });
  } catch {
    return null;
  }
}

/**
 * Download a file from Moodle (returns base64 content)
 */
export async function downloadFile(token, fileurl) {
  const res = await fetch(`${API_BASE}/api/moodle/file`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, fileurl }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { content: base64, contentType, size }
}

// ─── Color assignment for courses ─────────────────────────────────
const COURSE_COLORS = [
  "#2563eb", "#7c3aed", "#059669", "#d97706", "#0891b2",
  "#dc2626", "#4f46e5", "#0d9488", "#c2410c", "#7c2d12",
];

export function assignCourseColor(index) {
  return COURSE_COLORS[index % COURSE_COLORS.length];
}

/**
 * Parse Moodle course contents into a flat list of materials
 */
export function parseCourseContents(sections) {
  const materials = [];
  for (const section of sections) {
    for (const mod of section.modules || []) {
      const mat = {
        id: mod.id,
        name: mod.name,
        type: mod.modname, // resource, page, assign, url, forum, etc.
        section: section.name || "General",
        url: mod.url,
        files: [],
      };
      // Extract file URLs from module contents
      if (mod.contents) {
        for (const file of mod.contents) {
          mat.files.push({
            filename: file.filename,
            fileurl: file.fileurl,
            filesize: file.filesize,
            mimetype: file.mimetype,
            type: file.type,
          });
        }
      }
      materials.push(mat);
    }
  }
  return materials;
}
