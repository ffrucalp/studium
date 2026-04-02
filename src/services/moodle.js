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

// ─── Forum & Announcements ──────────────────────────────────────

/**
 * Get all forums in a course (includes announcements/news forum)
 */
export async function getForumsByCourse(token, courseId) {
  try {
    return await moodleCall(token, "mod_forum_get_forums_by_courses", { courseids: [courseId] });
  } catch {
    return [];
  }
}

/**
 * Get discussions in a forum (paginated)
 */
export async function getForumDiscussions(token, forumId, page = 0, perPage = 25) {
  try {
    const result = await moodleCall(token, "mod_forum_get_forum_discussions", {
      forumid: forumId,
      sortorder: -1,
      page,
      perpage: perPage,
    });
    return result?.discussions || [];
  } catch {
    // Fallback to older API
    try {
      const result = await moodleCall(token, "mod_forum_get_forum_discussions_paginated", {
        forumid: forumId,
        sortby: "timemodified",
        sortdirection: "DESC",
        page,
        perpage: perPage,
      });
      return result?.discussions || [];
    } catch {
      return [];
    }
  }
}

/**
 * Get all posts in a discussion
 */
export async function getDiscussionPosts(token, discussionId) {
  try {
    const result = await moodleCall(token, "mod_forum_get_forum_discussion_posts", {
      discussionid: discussionId,
      sortby: "created",
      sortdirection: "ASC",
    });
    return result?.posts || [];
  } catch {
    return [];
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

/**
 * Extract text from a Moodle file (PDF, HTML, text)
 */
export async function extractFileText(token, fileurl) {
  const res = await fetch(`${API_BASE}/api/moodle/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, fileurl }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data; // { text, contentType, size, chars }
}

// ─── Color assignment for courses ─────────────────────────────────
const COURSE_COLORS = [
  "#2563eb", "#7c3aed", "#059669", "#d97706", "#0891b2",
  "#dc2626", "#4f46e5", "#0d9488", "#c2410c", "#7c2d12",
];

export function assignCourseColor(index) {
  return COURSE_COLORS[index % COURSE_COLORS.length];
}

// ─── Grades ──────────────────────────────────────────────────────

/**
 * Get user grades for a course
 */
export async function getUserGrades(token, courseId, userId) {
  try {
    return await moodleCall(token, "gradereport_user_get_grade_items", {
      courseid: courseId, userid: userId,
    });
  } catch { return null; }
}

// ─── Assignments ─────────────────────────────────────────────────

/**
 * Get assignments for courses
 */
export async function getAssignments(token, courseIds) {
  try {
    return await moodleCall(token, "mod_assign_get_assignments", {
      courseids: courseIds,
    });
  } catch { return null; }
}

// ─── Calendar & Upcoming Events ──────────────────────────────────

/**
 * Get upcoming action events (deadlines, due dates)
 */
export async function getUpcomingEvents(token) {
  try {
    return await moodleCall(token, "core_calendar_get_action_events_by_timesort", {
      timesortfrom: Math.floor(Date.now() / 1000),
      limitnum: 20,
    });
  } catch { return null; }
}

/**
 * Get calendar events for a date range
 */
export async function getCalendarEvents(token) {
  try {
    const now = Math.floor(Date.now() / 1000);
    return await moodleCall(token, "core_calendar_get_calendar_events", {
      events: { courseids: [], groupids: [] },
      options: { timestart: now - 86400 * 7, timeend: now + 86400 * 30, userevents: 1, siteevents: 1 },
    });
  } catch { return null; }
}

/**
 * Get notifications
 */
export async function getNotifications(token, userId) {
  try {
    return await moodleCall(token, "message_popup_get_popup_notifications", {
      useridto: userId, limit: 10,
    });
  } catch { return null; }
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