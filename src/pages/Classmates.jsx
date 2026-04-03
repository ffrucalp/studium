import { useState, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { getEnrolledUsers } from "../services/moodle";
import {
  Users, Search, Loader2, ArrowLeft, ChevronRight,
  Mail, User, GraduationCap, BookOpen,
} from "lucide-react";

export default function Classmates() {
  const { moodleToken, courses } = useApp();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const loadUsers = useCallback(async (course) => {
    setSelectedCourse(course);
    setUsers([]);
    setFilter("");
    setLoading(true);
    try {
      const data = await getEnrolledUsers(moodleToken, course.id);
      // Separate by role
      const sorted = (data || []).sort((a, b) => {
        const aTeacher = a.roles?.some(r => r.shortname === "editingteacher" || r.shortname === "teacher");
        const bTeacher = b.roles?.some(r => r.shortname === "editingteacher" || r.shortname === "teacher");
        if (aTeacher && !bTeacher) return -1;
        if (!aTeacher && bTeacher) return 1;
        return (a.fullname || "").localeCompare(b.fullname || "");
      });
      setUsers(sorted);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [moodleToken]);

  const filtered = filter.trim()
    ? users.filter(u => u.fullname?.toLowerCase().includes(filter.toLowerCase()) || u.email?.toLowerCase().includes(filter.toLowerCase()))
    : users;

  const teachers = filtered.filter(u => u.roles?.some(r => r.shortname === "editingteacher" || r.shortname === "teacher"));
  const students = filtered.filter(u => !u.roles?.some(r => r.shortname === "editingteacher" || r.shortname === "teacher"));

  // ═══ Course selection ═══
  if (!selectedCourse) {
    return (
      <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: ff.heading, fontSize: 28, color: P.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={26} color={P.red} /> Compañeros de cursada
          </h1>
          <p style={{ color: P.textMuted, fontSize: 14, marginTop: 2 }}>Seleccioná una materia para ver sus integrantes</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {courses.map((course, i) => (
            <button key={course.id} className="slide-in" onClick={() => loadUsers(course)}
              style={{
                animationDelay: `${i * 0.05}s`, background: P.card, borderRadius: 14,
                border: `1px solid ${P.border}`, overflow: "hidden", textAlign: "left",
                cursor: "pointer", transition: "all 0.2s", width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ height: 4, background: `linear-gradient(90deg, ${course.color}, ${course.color}88)` }} />
              <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${course.color}12`, color: course.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Users size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: course.color, textTransform: "uppercase", letterSpacing: 0.8 }}>{course.shortname}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: P.text, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.fullname}</div>
                </div>
                <ChevronRight size={16} color={P.textMuted} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ═══ User list ═══
  return (
    <div className="fade-in" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setSelectedCourse(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 12, padding: "4px 0" }}>
          <ArrowLeft size={16} /> Volver a materias
        </button>
        <h1 style={{ fontFamily: ff.heading, fontSize: 24, color: P.text, fontWeight: 800 }}>
          {selectedCourse.fullname}
        </h1>
        <p style={{ color: P.textMuted, fontSize: 14, marginTop: 4 }}>
          {loading ? "Cargando..." : `${users.length} participantes`}
        </p>
      </div>

      {/* Search */}
      {users.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, background: P.card, borderRadius: 12, padding: "0 14px", border: `1.5px solid ${P.border}`, maxWidth: 400 }}>
          <Search size={16} color={P.textMuted} />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar por nombre o email..."
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: P.text, padding: "12px 0", fontFamily: ff.body }} />
        </div>
      )}

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Loader2 size={20} className="spin" color={P.red} /> Cargando participantes...
        </div>
      ) : (
        <>
          {/* Teachers */}
          {teachers.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: P.red, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <GraduationCap size={15} /> Profesores ({teachers.length})
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {teachers.map((u, i) => (
                  <UserCard key={u.id || i} user={u} color={selectedCourse.color} isTeacher />
                ))}
              </div>
            </div>
          )}

          {/* Students */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.textSec, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <BookOpen size={15} /> Estudiantes ({students.length})
            </div>
            {students.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: P.textMuted, fontSize: 13 }}>
                {filter ? "Sin resultados" : "No hay estudiantes inscriptos"}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                {students.map((u, i) => (
                  <UserCard key={u.id || i} user={u} color={selectedCourse.color} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}

function UserCard({ user, color, isTeacher }) {
  const pic = user.profileimageurl;
  const hasPic = pic && !pic.includes("/u/f2");
  return (
    <div style={{
      background: P.card, borderRadius: 12, border: `1px solid ${P.border}`,
      padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
      transition: "all 0.15s",
      ...(isTeacher ? { borderLeft: `3px solid ${P.red}` } : {}),
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.04)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
      {hasPic ? (
        <img src={pic} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} referrerPolicy="no-referrer" />
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: isTeacher ? P.redSoft : `${color}12`,
          color: isTeacher ? P.red : color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, fontWeight: 700,
        }}>
          {user.fullname?.charAt(0).toUpperCase() || <User size={18} />}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{user.fullname || "Sin nombre"}</div>
        {user.email && (
          <a href={`mailto:${user.email}`} style={{ fontSize: 12, color: P.textMuted, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}
            onMouseEnter={e => e.currentTarget.style.color = P.red} onMouseLeave={e => e.currentTarget.style.color = P.textMuted}>
            <Mail size={11} /> {user.email}
          </a>
        )}
        {isTeacher && <span style={{ fontSize: 10, fontWeight: 700, color: P.red, textTransform: "uppercase", marginTop: 2, display: "inline-block" }}>Profesor/a</span>}
      </div>
    </div>
  );
}