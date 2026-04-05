import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { getEnrolledUsers, getCourseGrades, getUserGrades } from "../services/moodle";
import {
  ClipboardList, Loader2, Search, Download, ChevronDown, ChevronRight,
  User, TrendingUp, TrendingDown, Minus, AlertTriangle,
} from "lucide-react";

export default function GradingPage() {
  const { courses, moodleToken, moodleUserId, useMock } = useApp();
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [students, setStudents] = useState([]);
  const [gradesMap, setGradesMap] = useState({}); // { [userId]: { items, total } }
  const [loading, setLoading] = useState(false);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedStudent, setExpandedStudent] = useState(null);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Load students when course changes
  useEffect(() => {
    if (!selectedCourseId || !moodleToken || moodleToken === "mock_token") {
      if (selectedCourseId && useMock) {
        setStudents([
          { id: 101, fullname: "María García", email: "mgarcia@ucalpvirtual.edu.ar", roles: [{ roleid: 5 }] },
          { id: 102, fullname: "Juan Pérez", email: "jperez@ucalpvirtual.edu.ar", roles: [{ roleid: 5 }] },
          { id: 103, fullname: "Ana López", email: "alopez@ucalpvirtual.edu.ar", roles: [{ roleid: 5 }] },
        ]);
        setGradesMap({
          101: { items: [{ name: "TP1", grade: "8" }, { name: "TP2", grade: "7" }, { name: "Parcial 1", grade: "9" }], total: "8.00" },
          102: { items: [{ name: "TP1", grade: "6" }, { name: "TP2", grade: "-" }, { name: "Parcial 1", grade: "5" }], total: "5.50" },
          103: { items: [{ name: "TP1", grade: "10" }, { name: "TP2", grade: "9" }, { name: "Parcial 1", grade: "10" }], total: "9.67" },
        });
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    setGradesMap({});
    getEnrolledUsers(moodleToken, selectedCourseId).then(data => {
      if (!cancelled && Array.isArray(data)) {
        // Filter only students
        const studentList = data.filter(u => u.roles?.some(r => r.roleid === 5 || r.shortname === "student"));
        setStudents(studentList);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [selectedCourseId, moodleToken, useMock]);

  // Load grades for all students
  useEffect(() => {
    if (students.length === 0 || !moodleToken || moodleToken === "mock_token" || !selectedCourseId) return;
    let cancelled = false;
    setLoadingGrades(true);

    const loadAll = async () => {
      const map = {};
      for (const s of students) {
        try {
          const g = await getUserGrades(moodleToken, selectedCourseId, s.id);
          if (cancelled) return;
          if (g?.usergrades?.[0]) {
            const ug = g.usergrades[0];
            const items = (ug.gradeitems || []).filter(gi => gi.itemtype !== "course" && gi.graderaw != null);
            const courseTotal = ug.gradeitems?.find(gi => gi.itemtype === "course");
            map[s.id] = {
              items: items.map(gi => ({ name: gi.itemname || gi.itemtype, grade: gi.gradeformatted || String(Math.round(gi.graderaw)) })),
              total: courseTotal?.gradeformatted || "-",
            };
          }
        } catch {}
      }
      if (!cancelled) {
        setGradesMap(map);
        setLoadingGrades(false);
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, [students, moodleToken, selectedCourseId]);

  const filteredStudents = students.filter(s =>
    !search || s.fullname?.toLowerCase().includes(search.toLowerCase())
  );

  const gradeColor = (grade) => {
    const num = parseFloat(grade);
    if (isNaN(num)) return P.textMuted;
    if (num >= 7) return "#059669";
    if (num >= 4) return "#D97706";
    return "#DC2626";
  };

  // Stats
  const studentsWithGrades = Object.keys(gradesMap).length;
  const avgGrade = studentsWithGrades > 0
    ? (Object.values(gradesMap).reduce((sum, g) => sum + (parseFloat(g.total) || 0), 0) / studentsWithGrades).toFixed(1)
    : "-";
  const approvedCount = Object.values(gradesMap).filter(g => parseFloat(g.total) >= 4).length;

  return (
    <div>
      <h1 style={{ fontFamily: ff.heading, fontSize: 26, fontWeight: 700, color: P.text, marginBottom: 6 }}>
        Calificaciones
      </h1>
      <p style={{ color: P.textMuted, fontSize: 14, marginBottom: 24 }}>
        Revisá las notas de tus alumnos por materia
      </p>

      {/* Course selector */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        {courses.map(c => (
          <button key={c.id} onClick={() => setSelectedCourseId(c.id)}
            style={{
              padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
              background: selectedCourseId === c.id ? c.color : P.card,
              color: selectedCourseId === c.id ? "#fff" : P.textSec,
              border: `1px solid ${selectedCourseId === c.id ? c.color : P.border}`,
              cursor: "pointer", transition: "all 0.2s",
            }}>
            {c.shortname || c.fullname.substring(0, 15)}
          </button>
        ))}
      </div>

      {!selectedCourseId ? (
        <div style={{ background: P.card, borderRadius: 16, padding: "60px 32px", textAlign: "center", border: `1px solid ${P.border}` }}>
          <ClipboardList size={48} style={{ color: P.textMuted, marginBottom: 16 }} />
          <p style={{ color: P.textMuted, fontSize: 15 }}>Seleccioná una materia para ver las calificaciones</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { label: "Alumnos", value: students.length, color: "#2E86C1" },
              { label: "Promedio gral.", value: avgGrade, color: gradeColor(avgGrade) },
              { label: "Aprobados", value: `${approvedCount}/${studentsWithGrades}`, color: "#059669" },
            ].map((s, i) => (
              <div key={i} style={{ background: P.card, borderRadius: 12, padding: "14px 20px", border: `1px solid ${P.border}`, flex: "1 1 120px" }}>
                <div style={{ fontSize: 11, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: P.textMuted }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar alumno..."
              style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          {/* Grades list */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Loader2 size={24} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
              {loadingGrades && (
                <div style={{ padding: "8px 20px", background: P.primarySoft, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: P.primary }}>
                  <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                  Cargando calificaciones...
                </div>
              )}
              {filteredStudents.length === 0 ? (
                <p style={{ padding: 32, textAlign: "center", color: P.textMuted, fontSize: 14 }}>No se encontraron alumnos</p>
              ) : (
                filteredStudents.map((s, i) => {
                  const g = gradesMap[s.id];
                  const isExpanded = expandedStudent === s.id;
                  return (
                    <div key={s.id}>
                      <div
                        onClick={() => setExpandedStudent(isExpanded ? null : s.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                          borderBottom: (i < filteredStudents.length - 1 && !isExpanded) ? `1px solid ${P.borderLight}` : "none",
                          cursor: "pointer", transition: "background 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = P.borderLight}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        {isExpanded ? <ChevronDown size={14} style={{ color: P.textMuted }} /> : <ChevronRight size={14} style={{ color: P.textMuted }} />}
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: P.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <User size={16} style={{ color: P.primary }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: P.text }}>{s.fullname}</div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: g ? gradeColor(g.total) : P.textMuted, minWidth: 50, textAlign: "right" }}>
                          {g ? g.total : "-"}
                        </div>
                      </div>
                      {isExpanded && g && (
                        <div style={{ padding: "0 20px 16px 60px", borderBottom: i < filteredStudents.length - 1 ? `1px solid ${P.borderLight}` : "none" }}>
                          {g.items.map((item, j) => (
                            <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
                              <span style={{ color: P.textSec }}>{item.name}</span>
                              <span style={{ fontWeight: 600, color: gradeColor(item.grade) }}>{item.grade}</span>
                            </div>
                          ))}
                          {g.items.length === 0 && (
                            <p style={{ fontSize: 13, color: P.textMuted, fontStyle: "italic" }}>Sin calificaciones registradas</p>
                          )}
                        </div>
                      )}
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