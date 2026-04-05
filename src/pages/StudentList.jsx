import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import CourseSelector from "../components/CourseSelector";
import { getEnrolledUsers } from "../services/moodle";
import {
  Users, Search, Loader2, Mail, ChevronDown, ChevronRight,
  User, GraduationCap, Shield, Filter,
} from "lucide-react";

export default function StudentListPage() {
  const { courses, moodleToken, useMock } = useApp();
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // all | student | teacher

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  useEffect(() => {
    if (!selectedCourseId || useMock || !moodleToken || moodleToken === "mock_token") {
      if (selectedCourseId && useMock) {
        // Mock students
        setStudents([
          { id: 1, fullname: "María García", email: "mgarcia@ucalpvirtual.edu.ar", roles: [{ shortname: "student", roleid: 5 }], lastaccess: Date.now() / 1000 - 3600 },
          { id: 2, fullname: "Juan Pérez", email: "jperez@ucalpvirtual.edu.ar", roles: [{ shortname: "student", roleid: 5 }], lastaccess: Date.now() / 1000 - 86400 },
          { id: 3, fullname: "Ana López", email: "alopez@ucalpvirtual.edu.ar", roles: [{ shortname: "student", roleid: 5 }], lastaccess: Date.now() / 1000 - 172800 },
          { id: 4, fullname: "Prof. Roberto Sánchez", email: "rsanchez@ucalpvirtual.edu.ar", roles: [{ shortname: "editingteacher", roleid: 3 }], lastaccess: Date.now() / 1000 - 1800 },
        ]);
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    getEnrolledUsers(moodleToken, selectedCourseId).then(data => {
      if (!cancelled && Array.isArray(data)) setStudents(data);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [selectedCourseId, moodleToken, useMock]);

  const getRoleBadge = (user) => {
    const isTeacher = user.roles?.some(r => [1, 3, 4].includes(r.roleid) || ["editingteacher", "teacher", "manager"].includes(r.shortname));
    return isTeacher ? { label: "Docente", color: "#2E86C1", Icon: Shield } : { label: "Alumno", color: "#059669", Icon: GraduationCap };
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = !search || s.fullname?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (roleFilter === "all") return true;
    const isTeacher = s.roles?.some(r => [1, 3, 4].includes(r.roleid));
    return roleFilter === "teacher" ? isTeacher : !isTeacher;
  });

  const studentCount = students.filter(s => !s.roles?.some(r => [1, 3, 4].includes(r.roleid))).length;
  const teacherCount = students.filter(s => s.roles?.some(r => [1, 3, 4].includes(r.roleid))).length;

  const fmtLastAccess = (ts) => {
    if (!ts) return "Nunca";
    const diff = Date.now() / 1000 - ts;
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} hs`;
    if (diff < 86400 * 7) return `Hace ${Math.floor(diff / 86400)} días`;
    return new Date(ts * 1000).toLocaleDateString("es-AR");
  };

  return (
    <div>
      <h1 style={{ fontFamily: ff.heading, fontSize: 26, fontWeight: 700, color: P.text, marginBottom: 6 }}>
        Alumnos
      </h1>
      <p style={{ color: P.textMuted, fontSize: 14, marginBottom: 24 }}>
        Consultá los alumnos inscriptos en cada materia
      </p>

      {/* Course selector */}
      <CourseSelector courses={courses} selectedId={selectedCourseId} onSelect={setSelectedCourseId} />

      {!selectedCourseId ? (
        <div style={{ background: P.card, borderRadius: 16, padding: "60px 32px", textAlign: "center", border: `1px solid ${P.border}` }}>
          <Users size={48} style={{ color: P.textMuted, marginBottom: 16 }} />
          <p style={{ color: P.textMuted, fontSize: 15 }}>Seleccioná una materia para ver los alumnos inscriptos</p>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ background: P.card, borderRadius: 12, padding: "12px 20px", border: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <GraduationCap size={16} style={{ color: "#059669" }} />
              <span style={{ fontSize: 13, color: P.textSec }}>{studentCount} alumnos</span>
            </div>
            <div style={{ background: P.card, borderRadius: 12, padding: "12px 20px", border: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Shield size={16} style={{ color: "#2E86C1" }} />
              <span style={{ fontSize: 13, color: P.textSec }}>{teacherCount} docentes</span>
            </div>
          </div>

          {/* Search + filter */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: P.textMuted }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar alumno..."
                style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontSize: 13 }}
              />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontSize: 13 }}>
              <option value="all">Todos</option>
              <option value="student">Solo alumnos</option>
              <option value="teacher">Solo docentes</option>
            </select>
          </div>

          {/* Student list */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Loader2 size={24} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
              {filteredStudents.length === 0 ? (
                <p style={{ padding: 32, textAlign: "center", color: P.textMuted, fontSize: 14 }}>No se encontraron usuarios</p>
              ) : (
                filteredStudents.map((s, i) => {
                  const badge = getRoleBadge(s);
                  return (
                    <div key={s.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                        borderBottom: i < filteredStudents.length - 1 ? `1px solid ${P.borderLight}` : "none",
                      }}>
                      {s.profileimageurl ? (
                        <img src={s.profileimageurl} alt="" style={{ width: 38, height: 38, borderRadius: 10, objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: badge.color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <User size={18} style={{ color: badge.color }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: P.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.fullname}
                        </div>
                        <div style={{ fontSize: 12, color: P.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.email || "Sin email"}
                        </div>
                      </div>
                      <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: badge.color + "15", color: badge.color }}>
                        {badge.label}
                      </span>
                      <span style={{ fontSize: 11, color: P.textMuted, whiteSpace: "nowrap" }}>
                        {fmtLastAccess(s.lastaccess)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}