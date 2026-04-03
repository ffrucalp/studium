import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { getQuizzesByCourses, getUserAttempts } from "../services/moodle";
import {
  HelpCircle, Clock, CheckCircle, XCircle, AlertTriangle,
  ExternalLink, Loader2, ChevronDown, ChevronRight, Award,
  BarChart3, Target, RefreshCw,
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
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState({}); // quizId -> attempts[]
  const [loadingAttempts, setLoadingAttempts] = useState({});
  const [expanded, setExpanded] = useState(null); // quizId
  const [filter, setFilter] = useState("all"); // all, pending, completed, overdue

  useEffect(() => {
    if (!moodleToken || moodleToken === "mock_token") { setLoading(false); return; }
    let cancelled = false;

    const load = async () => {
      const courseIds = courses.map(c => c.id);
      const data = await getQuizzesByCourses(moodleToken, courseIds);
      if (cancelled) return;

      const allQuizzes = [];
      for (const courseGroup of (data?.courses || [])) {
        const course = courses.find(c => c.id === courseGroup.id);
        for (const quiz of (courseGroup.quizzes || [])) {
          allQuizzes.push({
            ...quiz,
            courseName: course?.fullname || courseGroup.fullname || "",
            courseShortname: course?.shortname || courseGroup.shortname || "",
            courseColor: course?.color || P.red,
          });
        }
      }

      // Sort: upcoming due dates first, then no due date
      allQuizzes.sort((a, b) => {
        if (a.timeclose && b.timeclose) return a.timeclose - b.timeclose;
        if (a.timeclose) return -1;
        if (b.timeclose) return 1;
        return a.name.localeCompare(b.name);
      });

      setQuizzes(allQuizzes);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [moodleToken, courses]);

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

  const filtered = quizzes.filter(q => {
    if (filter === "pending") return !q.timeclose || q.timeclose > now;
    if (filter === "overdue") return q.timeclose && q.timeclose < now;
    if (filter === "completed") return attempts[q.id]?.length > 0;
    return true;
  });

  // Stats
  const totalQuizzes = quizzes.length;
  const withDue = quizzes.filter(q => q.timeclose).length;
  const overdue = quizzes.filter(q => q.timeclose && q.timeclose < now).length;

  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 28, color: P.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <HelpCircle size={26} color={P.red} /> Cuestionarios
        </h1>
        <p style={{ color: P.textMuted, fontSize: 14, marginTop: 2 }}>
          {totalQuizzes} cuestionarios en {courses.length} materias
          {overdue > 0 && <span style={{ color: "#DC2626", fontWeight: 600 }}> · {overdue} vencidos</span>}
        </p>
      </div>

      {/* Stats */}
      {!loading && totalQuizzes > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total", value: totalQuizzes, icon: HelpCircle, color: "#2563eb" },
            { label: "Con fecha límite", value: withDue, icon: Clock, color: "#D97706" },
            { label: "Vencidos", value: overdue, icon: AlertTriangle, color: "#DC2626" },
          ].map((s, i) => (
            <div key={i} style={{ background: P.card, borderRadius: 12, border: `1px solid ${P.border}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${s.color}10`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={17} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: P.text }}>{s.value}</div>
                <div style={{ fontSize: 11, color: P.textMuted }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {!loading && totalQuizzes > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[
            { id: "all", label: "Todos" },
            { id: "pending", label: "Pendientes" },
            { id: "overdue", label: "Vencidos" },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: filter === f.id ? P.red : P.card,
                color: filter === f.id ? "#fff" : P.textMuted,
                border: `1px solid ${filter === f.id ? P.red : P.border}`,
                transition: "all 0.15s",
              }}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Quiz list */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Loader2 size={20} className="spin" color={P.red} /> Cargando cuestionarios...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: P.textMuted }}>
          <HelpCircle size={36} strokeWidth={1.2} style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: P.textSec }}>
            {filter !== "all" ? "No hay cuestionarios en esta categoría" : "No hay cuestionarios disponibles"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((quiz, i) => {
            const isExpanded = expanded === quiz.id;
            const quizAttempts = attempts[quiz.id] || [];
            const isOverdue = quiz.timeclose && quiz.timeclose < now;
            const isOpen = (!quiz.timeopen || quiz.timeopen <= now) && (!quiz.timeclose || quiz.timeclose > now);
            const tl = timeLeft(quiz.timeclose);
            const bestGrade = quizAttempts.length > 0 ? Math.max(...quizAttempts.map(a => a.sumgrades || 0)) : null;

            return (
              <div key={quiz.id} className="slide-in" style={{ animationDelay: `${i * 0.04}s`, background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, overflow: "hidden" }}>
                {/* Quiz header */}
                <button onClick={() => loadAttempts(quiz.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", textAlign: "left", transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = P.cream} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: isOverdue ? "#FEF2F2" : isOpen ? "#ECFDF5" : `${quiz.courseColor}10`,
                    color: isOverdue ? "#DC2626" : isOpen ? "#059669" : quiz.courseColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isOverdue ? <XCircle size={20} /> : isOpen ? <Target size={20} /> : <HelpCircle size={20} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{quiz.name}</div>
                    <div style={{ fontSize: 12, color: P.textMuted, marginTop: 2, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span style={{ fontWeight: 600, color: quiz.courseColor }}>{quiz.courseShortname}</span>
                      {quiz.timeclose && <span><Clock size={10} style={{ verticalAlign: "-1px" }} /> {fmtDate(quiz.timeclose)}</span>}
                      {quiz.timelimit > 0 && <span>{Math.floor(quiz.timelimit / 60)} min</span>}
                      {quiz.attempts > 0 && <span>Máx. {quiz.attempts} intentos</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {tl && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
                        background: isOverdue ? "#FEF2F2" : tl === "Mañana" || parseInt(tl) <= 3 ? "#FEF3C7" : "#ECFDF5",
                        color: isOverdue ? "#DC2626" : tl === "Mañana" || parseInt(tl) <= 3 ? "#D97706" : "#059669",
                      }}>
                        {tl}
                      </span>
                    )}
                    {isOpen && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: "#ECFDF5", color: "#059669" }}>ABIERTO</span>
                    )}
                    {isExpanded ? <ChevronDown size={16} color={P.textMuted} /> : <ChevronRight size={16} color={P.textMuted} />}
                  </div>
                </button>

                {/* Expanded: attempts + actions */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${P.borderLight}`, padding: "14px 18px" }}>
                    {loadingAttempts[quiz.id] ? (
                      <div style={{ padding: 16, textAlign: "center", color: P.textMuted, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <Loader2 size={14} className="spin" color={P.red} /> Cargando intentos...
                      </div>
                    ) : (
                      <>
                        {/* Quiz info */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                          {quiz.grade > 0 && (
                            <div style={{ fontSize: 12, color: P.textSec, display: "flex", alignItems: "center", gap: 4 }}>
                              <Award size={13} /> Nota máxima: {quiz.grade}
                            </div>
                          )}
                          {quiz.timeopen > 0 && (
                            <div style={{ fontSize: 12, color: P.textSec }}>
                              Abre: {fmtDate(quiz.timeopen)}
                            </div>
                          )}
                          {quiz.intro && (
                            <div style={{ width: "100%", fontSize: 13, color: P.textSec, lineHeight: 1.5 }}>
                              {quiz.intro.replace(/<[^>]+>/g, "").substring(0, 200)}
                            </div>
                          )}
                        </div>

                        {/* Attempts */}
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
                                      <div style={{ fontSize: 16, fontWeight: 800, color: gradeColor(grade, maxGrade) }}>
                                        {grade}/{maxGrade}
                                      </div>
                                      {pct != null && <div style={{ fontSize: 10, color: P.textMuted }}>{pct}%</div>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {bestGrade != null && (
                              <div style={{ marginTop: 8, padding: "8px 14px", background: "#ECFDF5", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                                <Award size={16} color="#059669" />
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>
                                  Mejor nota: {parseFloat(bestGrade).toFixed(1)}/{quiz.sumgrades || quiz.grade || 10}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <a href={`https://campus.ucalp.edu.ar/mod/quiz/view.php?id=${quiz.coursemodule}`} target="_blank" rel="noopener noreferrer"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
                              borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none",
                              background: isOpen ? P.red : P.borderLight,
                              color: isOpen ? "#fff" : P.textSec,
                              transition: "all 0.2s",
                            }}>
                            {isOpen ? <Target size={14} /> : <ExternalLink size={14} />}
                            {isOpen ? "Realizar cuestionario" : "Ver en Moodle"}
                          </a>
                          {quizAttempts.length > 0 && (
                            <a href={`https://campus.ucalp.edu.ar/mod/quiz/view.php?id=${quiz.coursemodule}`} target="_blank" rel="noopener noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none", background: P.borderLight, color: P.textSec }}>
                              <BarChart3 size={14} /> Revisar respuestas
                            </a>
                          )}
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