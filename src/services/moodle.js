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

/**
 * Get assignment submissions (TEACHER ONLY)
 */
export async function getAssignmentSubmissions(token, assignId) {
  try {
    return await moodleCall(token, "mod_assign_get_submissions", {
      "assignmentids[0]": assignId,
    });
  } catch { return null; }
}

/**
 * Grade a submission (TEACHER ONLY)
 */
export async function gradeSubmission(token, assignId, userId, grade, comment = "") {
  try {
    return await moodleCall(token, "mod_assign_save_grade", {
      assignmentid: assignId,
      userid: userId,
      grade: grade,
      attemptnumber: -1,
      addattempt: 0,
      workflowstate: "graded",
      "plugindata[assignfeedbackcomments_editor][text]": comment,
      "plugindata[assignfeedbackcomments_editor][format]": 1,
    });
  } catch (e) {
    throw new Error(e.message || "No se pudo calificar");
  }
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
export async function getCalendarEvents(token, courseIds = []) {
  try {
    const now = Math.floor(Date.now() / 1000);
    return await moodleCall(token, "core_calendar_get_calendar_events", {
      "events[courseids]": courseIds,
      "events[groupids]": [],
      "options[userevents]": 1,
      "options[siteevents]": 1,
      "options[timestart]": now - 86400 * 7,
      "options[timeend]": now + 86400 * 60,
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

// ─── Forum Write ─────────────────────────────────────────────────

/**
 * Reply to a forum discussion
 */
export async function addForumReply(token, postId, message) {
  try {
    return await moodleCall(token, "mod_forum_add_discussion_post", {
      postid: postId,
      subject: "Re:",
      message,
      "options[0][name]": "discussionsubscribe",
      "options[0][value]": "true",
    });
  } catch (e) {
    throw new Error(e.message || "No se pudo enviar la respuesta");
  }
}

/**
 * Create a new forum discussion
 */
export async function addForumDiscussion(token, forumId, subject, message) {
  try {
    return await moodleCall(token, "mod_forum_add_discussion", {
      forumid: forumId,
      subject,
      message,
      "options[0][name]": "discussionsubscribe",
      "options[0][value]": "true",
    });
  } catch (e) {
    throw new Error(e.message || "No se pudo crear la discusión");
  }
}

// ─── Assignments ─────────────────────────────────────────────────

/**
 * Get assignment submission status for a user
 */
export async function getSubmissionStatus(token, assignId, userId) {
  try {
    return await moodleCall(token, "mod_assign_get_submission_status", {
      assignid: assignId, userid: userId,
    });
  } catch { return null; }
}

// ─── Quizzes ─────────────────────────────────────────────────────

/**
 * Get quizzes for courses
 */
export async function getQuizzesByCourses(token, courseIds) {
  try {
    return await moodleCall(token, "mod_quiz_get_quizzes_by_courses", {
      courseids: courseIds,
    });
  } catch { return null; }
}

/**
 * Get user quiz attempts
 */
export async function getUserAttempts(token, quizId, userId) {
  try {
    return await moodleCall(token, "mod_quiz_get_user_attempts", {
      quizid: quizId, userid: userId, status: "all",
    });
  } catch { return null; }
}

// ─── Messaging ───────────────────────────────────────────────────

/**
 * Get conversations
 */
export async function getConversations(token, userId) {
  try {
    return await moodleCall(token, "core_message_get_conversations", {
      userid: userId, limitnum: 50,
    });
  } catch { return null; }
}

/**
 * Get messages from a conversation
 */
export async function getConversationMessages(token, conversationId, userId) {
  try {
    return await moodleCall(token, "core_message_get_conversation_messages", {
      convid: conversationId, currentuserid: userId, limitnum: 30,
    });
  } catch { return null; }
}

/**
 * Send a message to a user
 */
export async function sendMessage(token, toUserId, text) {
  try {
    return await moodleCall(token, "core_message_send_instant_messages", {
      "messages[0][touserid]": toUserId,
      "messages[0][text]": text,
    });
  } catch (e) {
    throw new Error(e.message || "No se pudo enviar el mensaje");
  }
}

// ─── Badges ──────────────────────────────────────────────────────

/**
 * Get user badges
 */
export async function getUserBadges(token, userId) {
  try {
    return await moodleCall(token, "core_badges_get_user_badges", {
      userid: userId,
    });
  } catch { return null; }
}

/**
 * Get enrolled users in a course
 */
export async function getEnrolledUsers(token, courseId) {
  try {
    return await moodleCall(token, "core_enrol_get_enrolled_users", {
      courseid: courseId,
    });
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════
// ROLE DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Moodle role IDs (standard):
 *   1 = manager
 *   3 = editingteacher
 *   4 = teacher (non-editing)
 *   5 = student
 * 
 * We check the user's role in their enrolled courses.
 * If they have role 3 or 4 in ANY course → "teacher"
 * Otherwise → "student"
 */

const TEACHER_ROLE_IDS = [1, 3, 4]; // manager, editingteacher, teacher

/**
 * Detect user role by checking enrolled users in the first available course.
 * Returns "teacher" or "student".
 * 
 * Strategy:
 *  1. Try core_enrol_get_enrolled_users on each course until we find the user
 *  2. Check their roles array for teacher role IDs
 *  3. Also check role shortnames as fallback (editingteacher, teacher, manager)
 */
export async function detectUserRole(token, userId, courses) {
  if (!courses || courses.length === 0) return "student";

  // Check up to 3 courses to find user's role (usually first one is enough)
  for (const course of courses.slice(0, 3)) {
    try {
      const enrolled = await getEnrolledUsers(token, course.id);
      if (!enrolled || !Array.isArray(enrolled)) continue;

      const me = enrolled.find(u => u.id === userId);
      if (!me || !me.roles) continue;

      const isTeacher = me.roles.some(r =>
        TEACHER_ROLE_IDS.includes(r.roleid) ||
        ["editingteacher", "teacher", "manager", "coursecreator"].includes(r.shortname)
      );

      if (isTeacher) return "teacher";

      // Found user but they're a student in this course
      return "student";
    } catch (err) {
      console.warn(`Role detection failed for course ${course.id}:`, err.message);
      continue;
    }
  }

  // Default to student if we couldn't determine
  return "student";
}

/**
 * Get all grades for all students in a course (TEACHER ONLY)
 * Uses gradereport_user_get_grade_items for each student
 */
export async function getCourseGrades(token, courseId) {
  try {
    return await moodleCall(token, "gradereport_user_get_grade_items", {
      courseid: courseId,
    });
  } catch { return null; }
}

/**
 * Get course participants count and basic stats
 */
export async function getCourseParticipants(token, courseId) {
  try {
    const users = await getEnrolledUsers(token, courseId);
    if (!users || !Array.isArray(users)) return { total: 0, students: [], teachers: [] };

    const students = users.filter(u =>
      u.roles?.some(r => r.shortname === "student" || r.roleid === 5)
    );
    const teachers = users.filter(u =>
      u.roles?.some(r => TEACHER_ROLE_IDS.includes(r.roleid) ||
        ["editingteacher", "teacher", "manager"].includes(r.shortname))
    );

    return { total: users.length, students, teachers };
  } catch { return { total: 0, students: [], teachers: [] }; }
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