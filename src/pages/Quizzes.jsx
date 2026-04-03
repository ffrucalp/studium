import { useState, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { getQuizzesByCourses, getUserAttempts } from "../services/moodle";
import {
  HelpCircle, Clock, CheckCircle, XCircle, AlertTriangle,
  ExternalLink, Loader2, ChevronDown, ChevronRight, Award,
  BarChart3, Target, ArrowLeft, FileText,
} from "lucide-react";

function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function timeLeft(ts) {
  if (!ts) return null;
  const diff = ts - Math.floor(Date.now() / 1000);
  if (diff < 0) return "Vencido";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hs`;
  return `${Math.floor(diff / 86400)} días`;
}

function gradeColor(grade, max) {
  if (grade == null || max == null || max === 0) return P.textMuted;
  const pct = (grade / max) * 100;
  if (pct >= 60) return "#059669";
  if (pct >= 40) return "#D97706";
  return "#DC2626";
}

function gradeBg(grade, max) {
  if (grade == null || max == null || max === 0) return P.borderLight;
  const pct = (grade / max) * 100;
  if (pct >= 60) return "#ECFDF5";
  if (pct >= 40) return "#FEF3C7";
  return "#FEF2F2";
}

export default function Quizzes() {
  const { moodleToken, moodleUserId, courses } = useApp();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState({});
  const [loadingAttempts, setLoadingAttempts] = useState({});
  const [expanded, setExpanded] = useState(null);

  const loadQuizzes = useCallback(async (course) => {
    setSelectedCourse(course);
    setQuizzes([]);
    setAttempts({});
    setExpanded(null);
    setLoading(true);
    try {
      const data = await getQuizzesByCourses(moodleToken, [course.id]);
      const items = (data?.quizzes || []).map(q => ({
        ...q, courseName: course.fullname, courseShortname: course.shortname, courseColor: course.color,
      }));
      items.sort((a, b) => {
        if (a.timeclose && b.timeclose) return a.timeclose - b.timeclose;
        if (a.timeclose) return -1;
        if (b.timeclose) return 1;
        return a.name.localeCompare(b.name);
      });
      setQuizzes(items);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [moodleToken]);

  const loadAttempts = async (quizId) => {
    if (attempts[quizId]) {
      setExpanded(expanded === quizId ? null : quizId);
      return;
    }
    setLoadingAttempts(p => ({ ...p, [quizId]: true }));
    setExpanded(quizId);
    const data = await getUserAttempts(moodleToken, quizId, moodleUserId);
    setAttempts(p => ({ ...p, [quizId]: data?.attempts || [] }));
    setLoadingAttempts(p => ({ ...p, [quizId]: false }));
  };

  const now = Math.floor(Date.now() / 1000);

  // ═══ Course selection view ═══
  if (!selectedCourse) {
    return (
      <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: ff.heading, fontSize: 28, color: P.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
            <HelpCircle size={26} color={P.red} /> Cuestionarios
          </h1>
          <p style={{ color: P.textMuted, fontSize: 14, marginTop: 2 }}>Seleccioná una materia para ver sus cuestionarios</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {courses.map((course, i) => (
            <button key={course.id} className="slide-in" onClick={() => loadQuizzes(course)}
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
                  <HelpCircle size={18} />
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

  // ═══ Quiz list for selected course ═══
  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => setSelectedCourse(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 12, padding: "4px 0" }}>
          <ArrowLeft size={16} /> Volver a materias
        </button>
        <h1 style={{ fontFamily: ff.heading, fontSize: 26, color: P.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${selectedCourse.color}12`, color: selectedCourse.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HelpCircle size={18} />
          </div>
          {selectedCourse.fullname}
        </h1>
        <p style={{ color: P.textMuted, fontSize: 14, marginTop: 4 }}>
          {loading ? "Cargando..." : `${quizzes.length} cuestionario${quizzes.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Loader2 size={20} className="spin" color={P.red} /> Cargando cuestionarios...
        </div>
      ) : quizzes.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: P.textMuted }}>
          <HelpCircle size={36} strokeWidth={1.2} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: P.textSec }}>No hay cuestionarios en esta materia</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {quizzes.map((quiz, i) => {
            const isExpanded = expanded === quiz.id;
            const quizAttempts = attempts[quiz.id] || [];
            const isOverdue = quiz.timeclose && quiz.timeclose < now;
            const isOpen = (!quiz.timeopen || quiz.timeopen <= now) && (!quiz.timeclose || quiz.timeclose > now);
            const tl = timeLeft(quiz.timeclose);
            const bestGrade = quizAttempts.length > 0 ? Math.max(...quizAttempts.map(a => a.sumgrades || 0)) : null;

            return (
              <div key={quiz.id} className="slide-in" style={{ animationDelay: `${i * 0.05}s`, background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, overflow: "hidden" }}>
                {/* Quiz header */}
                <button onClick={() => loadAttempts(quiz.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", textAlign: "left", transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = P.cream} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: isOverdue ? "#FEF2F2" : isOpen ? "#ECFDF5" : `${selectedCourse.color}10`,
                    color: isOverdue ? "#DC2626" : isOpen ? "#059669" : selectedCourse.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isOverdue ? <XCircle size={20} /> : isOpen ? <Target size={20} /> : <HelpCircle size={20} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{quiz.name}</div>
                    <div style={{ fontSize: 12, color: P.textMuted, marginTop: 2, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      {quiz.timeclose && <span><Clock size={10} style={{ verticalAlign: "-1px" }} /> {fmtDate(quiz.timeclose)}</span>}
                      {quiz.timelimit > 0 && <span>{Math.floor(quiz.timelimit / 60)} min</span>}
                      {quiz.attempts > 0 && <span>Máx. {quiz.attempts} intentos</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {tl && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                        background: isOverdue ? "#FEF2F2" : "#FEF3C7",
                        color: isOverdue ? "#DC2626" : "#D97706",
                      }}>
                        {tl}
                      </span>
                    )}
                    {isOpen && <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: "#ECFDF5", color: "#059669" }}>ABIERTO</span>}
                    {isExpanded ? <ChevronDown size={16} color={P.textMuted} /> : <ChevronRight size={16} color={P.textMuted} />}
                  </div>
                </button>

                {/* Expanded: attempts */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${P.borderLight}`, padding: "14px 18px" }}>
                    {loadingAttempts[quiz.id] ? (
                      <div style={{ padding: 16, textAlign: "center", color: P.textMuted, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <Loader2 size={14} className="spin" color={P.red} /> Cargando intentos...
                      </div>
                    ) : (
                      <>
                        {quiz.intro && (
                          <div style={{ fontSize: 13, color: P.textSec, lineHeight: 1.5, marginBottom: 12, padding: "8px 12px", background: P.borderLight, borderRadius: 8 }}>
                            {quiz.intro.replace(/<[^>]+>/g, "").substring(0, 200)}
                          </div>
                        )}

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                          {quiz.grade > 0 && <div style={{ fontSize: 12, color: P.textSec, display: "flex", alignItems: "center", gap: 4 }}><Award size={13} /> Nota máxima: {quiz.grade}</div>}
                          {quiz.timeopen > 0 && <div style={{ fontSize: 12, color: P.textSec }}>Abre: {fmtDate(quiz.timeopen)}</div>}
                        </div>

                        {quizAttempts.length === 0 ? (
                          <div style={{ padding: "12px 16px", background: P.borderLight, borderRadius: 8, fontSize: 13, color: P.textMuted, textAlign: "center" }}>
                            No realizaste intentos en este cuestionario
                          </div>
                        ) : (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: P.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                              <BarChart3 size={14} /> Mis intentos ({quizAttempts.length})
                            </div>
                            {quizAttempts.map((att, ai) => {
                              const grade = att.sumgrades != null ? parseFloat(att.sumgrades).toFixed(1) : null;
                              const maxGrade = quiz.sumgrades || quiz.grade || 10;
                              const pct = grade != null ? Math.round((grade / maxGrade) * 100) : null;
                              const stateLabels = { finished: "Finalizado", inprogress: "En curso", overdue: "Vencido", abandoned: "Abandonado" };
                              const stateColors = { finished: "#059669", inprogress: "#2563eb", overdue: "#DC2626", abandoned: "#6B7280" };
                              return (
                                <div key={att.id || ai} style={{
                                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                                  background: ai % 2 === 0 ? P.bg : "transparent", borderRadius: 8, marginBottom: 2,
                                }}>
                                  <div style={{ width: 28, height: 28, borderRadius: 7, background: gradeBg(grade, maxGrade), color: gradeColor(grade, maxGrade), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                                    {att.attempt || ai + 1}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, color: P.text, display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ fontWeight: 600 }}>Intento {att.attempt || ai + 1}</span>
                                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${stateColors[att.state] || "#6B7280"}12`, color: stateColors[att.state] || "#6B7280", fontWeight: 600 }}>
                                        {stateLabels[att.state] || att.state}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: 11, color: P.textMuted, marginTop: 2 }}>
                                      {fmtDate(att.timestart)}
                                      {att.timefinish > 0 && ` — ${Math.round((att.timefinish - att.timestart) / 60)} min`}
                                    </div>
                                  </div>
                                  {grade != null && (
                                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                                      <div style={{ fontSize: 16, fontWeight: 800, color: gradeColor(grade, maxGrade) }}>{grade}/{maxGrade}</div>
                                      {pct != null && <div style={{ fontSize: 10, color: P.textMuted }}>{pct}%</div>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {bestGrade != null && (
                              <div style={{ marginTop: 8, padding: "8px 14px", background: "#ECFDF5", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                <Award size={16} color="#059669" />
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>Mejor nota: {parseFloat(bestGrade).toFixed(1)}/{quiz.sumgrades || quiz.grade || 10}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <a href={`https://campus.ucalp.edu.ar/mod/quiz/view.php?id=${quiz.coursemodule}`} target="_blank" rel="noopener noreferrer"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                              borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none",
                              background: isOpen ? P.red : P.borderLight, color: isOpen ? "#fff" : P.textSec,
                            }}>
                            {isOpen ? <Target size={14} /> : <ExternalLink size={14} />}
                            {isOpen ? "Realizar cuestionario" : "Ver en Moodle"}
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}