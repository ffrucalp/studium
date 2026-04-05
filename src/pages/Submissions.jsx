import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { getAssignments, getAssignmentSubmissions, getEnrolledUsers } from "../services/moodle";
import {
  FileCheck, Loader2, Search, Clock, CheckCircle, XCircle,
  AlertTriangle, ChevronDown, ChevronRight, User, ExternalLink,
} from "lucide-react";

const STATUS_MAP = {
  submitted: { label: "Entregado", color: "#059669", Icon: CheckCircle },
  new: { label: "Sin entregar", color: "#DC2626", Icon: XCircle },
  draft: { label: "Borrador", color: "#D97706", Icon: Clock },
  reopened: { label: "Reabierto", color: "#6366F1", Icon: AlertTriangle },
};

export default function SubmissionsPage() {
  const { courses, moodleToken, useMock } = useApp();
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignId, setSelectedAssignId] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [search, setSearch] = useState("");

  // Load assignments when course changes
  useEffect(() => {
    if (!selectedCourseId || !moodleToken || moodleToken === "mock_token") {
      if (selectedCourseId && useMock) {
        setAssignments([
          { id: 1, name: "TP N°1 - Gobernanza de Datos", duedate: Date.now() / 1000 - 86400 * 3 },
          { id: 2, name: "TP N°2 - Análisis de caso", duedate: Date.now() / 1000 + 86400 * 5 },
          { id: 3, name: "Trabajo Final Integrador", duedate: Date.now() / 1000 + 86400 * 30 },
        ]);
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    setAssignments([]);
    setSelectedAssignId(null);
    setSubmissions([]);

    Promise.all([
      getAssignments(moodleToken, [selectedCourseId]),
      getEnrolledUsers(moodleToken, selectedCourseId),
    ]).then(([assignData, enrolledData]) => {
      if (cancelled) return;
      const courseAssigns = assignData?.courses?.[0]?.assignments || [];
      setAssignments(courseAssigns);
      if (Array.isArray(enrolledData)) {
        setStudents(enrolledData.filter(u => u.roles?.some(r => r.roleid === 5 || r.shortname === "student")));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [selectedCourseId, moodleToken, useMock]);

  // Load submissions when assignment changes
  useEffect(() => {
    if (!selectedAssignId || !moodleToken || moodleToken === "mock_token") {
      if (selectedAssignId && useMock) {
        setSubmissions([
          { userid: 101, fullname: "María García", status: "submitted", timemodified: Date.now() / 1000 - 7200 },
          { userid: 102, fullname: "Juan Pérez", status: "new", timemodified: 0 },
          { userid: 103, fullname: "Ana López", status: "submitted", timemodified: Date.now() / 1000 - 86400 },
        ]);
      }
      return;
    }
    let cancelled = false;
    setLoadingSubs(true);
    getAssignmentSubmissions(moodleToken, selectedAssignId).then(data => {
      if (cancelled) return;
      const subs = data?.assignments?.[0]?.submissions || [];
      // Merge with student info
      const enriched = subs.map(sub => {
        const student = students.find(s => s.id === sub.userid);
        return { ...sub, fullname: student?.fullname || `Usuario #${sub.userid}` };
      });
      setSubmissions(enriched);
      setLoadingSubs(false);
    }).catch(() => setLoadingSubs(false));
    return () => { cancelled = true; };
  }, [selectedAssignId, moodleToken, useMock, students]);

  const fmtDate = (ts) => {
    if (!ts || ts === 0) return "-";
    return new Date(ts * 1000).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const filteredSubs = submissions.filter(s =>
    !search || s.fullname?.toLowerCase().includes(search.toLowerCase())
  );

  const submittedCount = submissions.filter(s => s.status === "submitted").length;

  return (
    <div>
      <h1 style={{ fontFamily: ff.heading, fontSize: 26, fontWeight: 700, color: P.text, marginBottom: 6 }}>
        Entregas
      </h1>
      <p style={{ color: P.textMuted, fontSize: 14, marginBottom: 24 }}>
        Revisá el estado de las entregas de trabajos prácticos
      </p>

      {/* Course selector */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        {courses.map(c => (
          <button key={c.id} onClick={() => { setSelectedCourseId(c.id); setSelectedAssignId(null); }}
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
          <FileCheck size={48} style={{ color: P.textMuted, marginBottom: 16 }} />
          <p style={{ color: P.textMuted, fontSize: 15 }}>Seleccioná una materia para ver las entregas</p>
        </div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Loader2 size={24} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <>
          {/* Assignment selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, display: "block" }}>
              Trabajo práctico
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {assignments.length === 0 ? (
                <p style={{ color: P.textMuted, fontSize: 13 }}>No hay trabajos prácticos en esta materia</p>
              ) : (
                assignments.map(a => {
                  const isPast = a.duedate && a.duedate < Date.now() / 1000;
                  return (
                    <button key={a.id} onClick={() => setSelectedAssignId(a.id)}
                      style={{
                        padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                        background: selectedAssignId === a.id ? P.primary : P.card,
                        color: selectedAssignId === a.id ? "#fff" : P.text,
                        border: `1px solid ${selectedAssignId === a.id ? P.primary : P.border}`,
                        cursor: "pointer", transition: "all 0.2s", textAlign: "left",
                      }}>
                      <div>{a.name}</div>
                      {a.duedate > 0 && (
                        <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7, color: selectedAssignId === a.id ? "#fff" : (isPast ? "#DC2626" : P.textMuted) }}>
                          {isPast ? "Venció" : "Vence"}: {fmtDate(a.duedate)}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Submissions */}
          {selectedAssignId && (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ background: P.card, borderRadius: 12, padding: "12px 20px", border: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={16} style={{ color: "#059669" }} />
                  <span style={{ fontSize: 13, color: P.textSec }}>{submittedCount} entregados</span>
                </div>
                <div style={{ background: P.card, borderRadius: 12, padding: "12px 20px", border: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <XCircle size={16} style={{ color: "#DC2626" }} />
                  <span style={{ fontSize: 13, color: P.textSec }}>{submissions.length - submittedCount} pendientes</span>
                </div>
              </div>

              <div style={{ position: "relative", marginBottom: 16 }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: P.textMuted }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar alumno..."
                  style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontSize: 13, boxSizing: "border-box" }}
                />
              </div>

              {loadingSubs ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Loader2 size={24} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
                  {filteredSubs.length === 0 ? (
                    <p style={{ padding: 32, textAlign: "center", color: P.textMuted, fontSize: 14 }}>No hay entregas</p>
                  ) : (
                    filteredSubs.map((s, i) => {
                      const st = STATUS_MAP[s.status] || STATUS_MAP.new;
                      return (
                        <div key={s.userid || i}
                          style={{
                            display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                            borderBottom: i < filteredSubs.length - 1 ? `1px solid ${P.borderLight}` : "none",
                          }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: st.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <st.Icon size={16} style={{ color: st.color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: P.text }}>{s.fullname}</div>
                            <div style={{ fontSize: 12, color: P.textMuted }}>
                              {s.status === "submitted" ? `Entregado: ${fmtDate(s.timemodified)}` : "Sin entregar"}
                            </div>
                          </div>
                          <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: st.color + "15", color: st.color }}>
                            {st.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}