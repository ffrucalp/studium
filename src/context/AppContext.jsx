import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { getMoodleToken, getSiteInfo, getUserCourses, getCourseContents, assignCourseColor, parseCourseContents, detectUserRole } from "../services/moodle";
import { zonaLogin, zonaGetProfile } from "../services/zona";
import { refreshToken } from "../services/google";

const AppContext = createContext(null);

// ─── localStorage helpers ────────────────────────────────────────
const STORAGE_KEY = "studium_session";

function saveSession(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ─── Mock data ────────────────────────────────────────────────────
const MOCK_COURSES = [
  { id: 1, fullname: "Introducción a la Gobernanza de Datos", shortname: "IGD", category: "1er Año", progress: 65, materials: 12, color: "#2563eb" },
  { id: 2, fullname: "Fundamentos de Computación", shortname: "FC", category: "1er Año", progress: 40, materials: 8, color: "#7c3aed" },
  { id: 3, fullname: "Introducción a la Economía", shortname: "IE", category: "1er Año", progress: 80, materials: 15, color: "#059669" },
  { id: 4, fullname: "Filosofía General I", shortname: "FG1", category: "1er Año", progress: 55, materials: 10, color: "#d97706" },
  { id: 5, fullname: "Derecho y Gobernanza Digital", shortname: "DGD", category: "1er Año", progress: 20, materials: 6, color: "#0891b2" },
];

export const MOCK_MATERIALS = [
  { id: 1, name: "Programa de la materia 2026", type: "pdf", size: "245 KB", section: "General" },
  { id: 2, name: "Guía de Estudio - Unidad 1", type: "pdf", size: "1.2 MB", section: "Unidad 1" },
  { id: 3, name: "Apunte: Conceptos fundamentales de datos", type: "pdf", size: "890 KB", section: "Unidad 1" },
  { id: 4, name: "Lectura obligatoria - Cap. 1 al 3", type: "pdf", size: "3.4 MB", section: "Unidad 1" },
  { id: 5, name: "Guía de Estudio - Unidad 2", type: "pdf", size: "1.1 MB", section: "Unidad 2" },
  { id: 6, name: "Apunte: Gobernanza y gestión de datos", type: "pdf", size: "760 KB", section: "Unidad 2" },
  { id: 7, name: "Presentación - Clase 1", type: "pptx", size: "5.2 MB", section: "Unidad 1" },
  { id: 8, name: "Actividad práctica N°1", type: "assign", size: "", section: "Unidad 1" },
];

export function AppProvider({ children }) {
  // Restore session from localStorage
  const saved = useRef(loadSession()).current;

  const [user, setUser] = useState(saved?.user || null);
  const [userRole, setUserRole] = useState(saved?.userRole || null); // "teacher" | "student" | null
  const [availableRoles, setAvailableRoles] = useState(saved?.availableRoles || []); // ["teacher", "student"] if dual
  const [isDualRole, setIsDualRole] = useState(saved?.isDualRole || false);
  const [teacherCourses, setTeacherCourses] = useState(saved?.teacherCourses || []);
  const [studentCourses, setStudentCourses] = useState(saved?.studentCourses || []);
  const [roleLoading, setRoleLoading] = useState(false);
  const [moodleToken, setMoodleToken] = useState(saved?.moodleToken || null);
  const [moodleUserId, setMoodleUserId] = useState(saved?.moodleUserId || null);
  const [courses, setCourses] = useState(saved?.courses || []);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseMaterials, setCourseMaterials] = useState(() => {
    try {
      const cached = localStorage.getItem("studium_materials");
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });
  const [useMock, setUseMock] = useState(saved?.useMock || false);

  // Persist courseMaterials cache
  useEffect(() => {
    try {
      if (Object.keys(courseMaterials).length > 0) {
        localStorage.setItem("studium_materials", JSON.stringify(courseMaterials));
      }
    } catch {}
  }, [courseMaterials]);

  // Zona Interactiva state
  const [zonaSession, setZonaSession] = useState(saved?.zonaSession || null);
  const [zonaStudent, setZonaStudent] = useState(saved?.zonaStudent || null);
  const [zonaProfile, setZonaProfile] = useState(null);
  const [zonaLoading, setZonaLoading] = useState(false);

  // Google tokens
  const [googleAccessToken, setGoogleAccessToken] = useState(saved?.googleAccessToken || null);
  const [googleRefreshToken, setGoogleRefreshToken] = useState(saved?.googleRefreshToken || null);

  // ── Persist session to localStorage on key changes ──
  useEffect(() => {
    if (!user) return;
    saveSession({
      user, userRole, availableRoles, isDualRole, teacherCourses, studentCourses,
      moodleToken, moodleUserId, courses, useMock,
      zonaSession, zonaStudent,
      googleAccessToken, googleRefreshToken,
    });
  }, [user, userRole, availableRoles, isDualRole, teacherCourses, studentCourses, moodleToken, moodleUserId, courses, useMock, zonaSession, zonaStudent, googleAccessToken, googleRefreshToken]);

  // ── Auto-refresh Google token on restore ──
  useEffect(() => {
    if (googleRefreshToken && !googleAccessToken && user) {
      // Token expired on reload — try refreshing
      refreshToken(googleRefreshToken)
        .then(data => { if (data.access_token) setGoogleAccessToken(data.access_token); })
        .catch(() => { /* silently fail, user can re-auth */ });
    }
  }, []); // only on mount

  // ── Google OAuth Login ──
  const loginWithGoogle = useCallback((userData) => {
    setUser({
      name: userData?.name || "Usuario UCALP",
      email: userData?.email || "usuario@ucalpvirtual.edu.ar",
      picture: userData?.picture || null,
      given_name: userData?.given_name || null,
    });
  }, []);

  // ── Store Google tokens from OAuth callback ──
  const setGoogleTokens = useCallback((data) => {
    if (data.access_token) setGoogleAccessToken(data.access_token);
    if (data.refresh_token) setGoogleRefreshToken(data.refresh_token);
  }, []);

  // ── Connect both Moodle + Zona with same credentials ──
  const connectMoodle = useCallback(async (username, password) => {
    const results = { moodle: false, zona: false };

    // Try Moodle
    let detectedCourses = [];
    let detectedToken = null;
    let detectedUserId = null;

    try {
      const token = await getMoodleToken(username, password);
      detectedToken = token;
      setMoodleToken(token);
      const siteInfo = await getSiteInfo(token);
      detectedUserId = siteInfo.userid;
      setMoodleUserId(siteInfo.userid);
      const rawCourses = await getUserCourses(token, siteInfo.userid);
      const currentYear = new Date().getFullYear().toString(); // "2026"
      const enriched = rawCourses
        .filter(c => c.visible !== 0)
        .filter(c => {
          // Show only courses from current year
          const name = (c.fullname || "").toLowerCase();
          const short = (c.shortname || "").toLowerCase();
          return name.includes(currentYear) || short.includes(currentYear);
        })
        .map((c, i) => {
          // Clean up course name: remove "1 - " prefix and "DISTDATOS1/2026" suffix
          let cleanName = c.fullname || "";
          cleanName = cleanName.replace(/^\d+\s*-\s*/, ""); // remove "1 - " prefix
          cleanName = cleanName.replace(/\s*(DIST\w+\d*\/\d{4}|\w+-\w+-\d+\s*-\s*\d{4})$/i, ""); // remove code suffix
          return {
            id: c.id,
            fullname: cleanName.trim() || c.fullname,
            shortname: c.shortname || c.fullname.substring(0, 3).toUpperCase(),
            category: c.categoryname || "",
            progress: c.progress ?? 0,
            materials: 0, color: assignCourseColor(i), _raw: c,
          };
        });
      detectedCourses = enriched;
      setCourses(enriched);
      setUseMock(false);
      results.moodle = true;
    } catch (err) {
      console.warn("Moodle fallback to mock:", err.message);
      setMoodleToken("mock_token");
      setCourses(MOCK_COURSES);
      detectedCourses = MOCK_COURSES;
      setUseMock(true);
      results.moodle = true; // mock fallback
    }

    // ── Detect user role (supports dual roles) ──
    if (detectedToken && detectedToken !== "mock_token" && detectedUserId && detectedCourses.length > 0) {
      setRoleLoading(true);
      try {
        const roleResult = await detectUserRole(detectedToken, detectedUserId, detectedCourses);
        setAvailableRoles(roleResult.roles);
        setIsDualRole(roleResult.isDualRole);
        setTeacherCourses(roleResult.teacherCourses);
        setStudentCourses(roleResult.studentCourses);
        setUserRole(roleResult.defaultRole);
        console.log(`[Studium] Roles detectados: ${roleResult.roles.join(", ")}${roleResult.isDualRole ? " (dual)" : ""}`);
      } catch (err) {
        console.warn("Role detection failed, defaulting to student:", err.message);
        setUserRole("student");
        setAvailableRoles(["student"]);
        setIsDualRole(false);
      } finally {
        setRoleLoading(false);
      }
    } else {
      // Mock mode → default to student (can be toggled in settings)
      setUserRole("student");
      setAvailableRoles(["student"]);
      setIsDualRole(false);
    }

    // Try Zona Interactiva (same credentials: DNI + password)
    try {
      const zona = await zonaLogin(username, password);
      setZonaSession(zona.session);
      setZonaStudent(zona.student);

      // Update user name from Zona if available
      if (zona.student?.nombre) {
        setUser(prev => ({
          ...prev,
          name: zona.student.nombre,
          email: zona.student.email || prev?.email,
          campusUser: zona.student.campusUser,
          carreras: zona.student.carreras,
          carreraActual: zona.student.carreraActual,
        }));
      }

      results.zona = true;
    } catch (err) {
      console.warn("Zona login failed:", err.message);
    }

    return results;
  }, []);

  // ── Switch role (only for dual-role users) ──
  const switchRole = useCallback((role) => {
    if (availableRoles.includes(role)) {
      setUserRole(role);
      console.log(`[Studium] Rol cambiado a: ${role}`);
    }
  }, [availableRoles]);

  // ── Manual role override (for testing / settings) ──
  const setRoleOverride = useCallback((role) => {
    if (role === "teacher" || role === "student") {
      setUserRole(role);
      if (!availableRoles.includes(role)) {
        setAvailableRoles(prev => [...prev, role]);
        setIsDualRole(true);
      }
    }
  }, [availableRoles]);

  // ── Helper: is teacher? ──
  const isTeacher = userRole === "teacher";

  // ── Load Zona academic profile ──
  const loadZonaProfile = useCallback(async (idCliente = null) => {
    if (!zonaSession) return null;
    setZonaLoading(true);
    try {
      const profile = await zonaGetProfile(zonaSession, idCliente);
      setZonaProfile(profile);
      return profile;
    } catch (err) {
      console.error("Error loading Zona profile:", err);
      return null;
    } finally {
      setZonaLoading(false);
    }
  }, [zonaSession]);

  // ── Load Course Materials ──
  const loadCourseMaterials = useCallback(async (courseId) => {
    if (courseMaterials[courseId]) return courseMaterials[courseId];

    if (useMock || !moodleToken || moodleToken === "mock_token") {
      setCourseMaterials(prev => ({ ...prev, [courseId]: MOCK_MATERIALS }));
      return MOCK_MATERIALS;
    }

    try {
      const sections = await getCourseContents(moodleToken, courseId);
      const materials = parseCourseContents(sections);
      setCourseMaterials(prev => ({ ...prev, [courseId]: materials }));
      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, materials: materials.length } : c));
      return materials;
    } catch (err) {
      console.error("Error loading materials:", err);
      return MOCK_MATERIALS;
    }
  }, [moodleToken, useMock, courseMaterials]);

  // ── Logout ──
  const logout = useCallback(() => {
    setUser(null);
    setUserRole(null);
    setAvailableRoles([]);
    setIsDualRole(false);
    setTeacherCourses([]);
    setStudentCourses([]);
    setMoodleToken(null);
    setMoodleUserId(null);
    setCourses([]);
    setSelectedCourse(null);
    setCourseMaterials({});
    try { localStorage.removeItem("studium_materials"); localStorage.removeItem("studium_screen"); } catch {}
    setUseMock(false);
    setZonaSession(null);
    setZonaStudent(null);
    setZonaProfile(null);
    setGoogleAccessToken(null);
    setGoogleRefreshToken(null);
    clearSession();
  }, []);

  return (
    <AppContext.Provider value={{
      user, userRole, isTeacher, roleLoading,
      availableRoles, isDualRole, teacherCourses, studentCourses, switchRole,
      moodleToken, moodleUserId, courses, selectedCourse,
      courseMaterials, useMock,
      zonaSession, zonaStudent, zonaProfile, zonaLoading,
      googleAccessToken, googleRefreshToken,
      setSelectedCourse, loginWithGoogle, setGoogleTokens, connectMoodle,
      loadCourseMaterials, loadZonaProfile, logout, setRoleOverride,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};