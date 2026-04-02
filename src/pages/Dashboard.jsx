import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { getUpcomingEvents, getUserGrades, getNotifications } from "../services/moodle";
import {
  Calendar, Sparkles, HelpCircle, FileText, ChevronRight,
  Clock, AlertTriangle, CheckCircle, BookOpen, Bell,
  Award, TrendingUp, Loader2, ExternalLink,
} from "lucide-react";

function timeAgo(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const diff = timestamp - now;
  if (diff < 0) return "Vencido";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hs`;
  if (diff < 86400 * 2) return "Mañana";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} días`;
  return `${Math.floor(diff / (86400 * 7))} sem`;
}

function urgencyColor(timestamp) {
  const diff = timestamp - Math.floor(Date.now() / 1000);
  if (diff < 0) return "#DC2626";
  if (diff < 86400) return "#EA580C";
  if (diff < 86400 * 3) return "#D97706";
  return "#059669";
}

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Dashboard({ onNavigate, onSelectCourse }) {
  const { courses, moodleToken, moodleUserId } = useApp();
  const [events, setEvents] = useState(null);
  const [grades, setGrades] = useState(null);
  const [notifications, setNotifications] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!moodleToken || moodleToken === "mock_token") { setLoading(false); return; }
    let cancelled = false;

    const loadData = async () => {
      // Load upcoming events
      const evts = await getUpcomingEvents(moodleToken);
      if (!cancelled && evts?.events) setEvents(evts.events);

      // Load notifications
      const notifs = await getNotifications(moodleToken, moodleUserId);
      if (!cancelled && notifs?.notifications) setNotifications(notifs.notifications);

      // Load grades for first 5 courses
      const courseGrades = [];
      for (const c of courses.slice(0, 5)) {
        const g = await getUserGrades(moodleToken, c.id, moodleUserId);
        if (!cancelled && g?.usergrades?.[0]) {
          const ug = g.usergrades[0];
          const items = (ug.gradeitems || []).filter(gi =>
            gi.itemtype !== "course" && gi.graderaw !== null && gi.graderaw !== undefined
          );
          if (items.length > 0) {
            courseGrades.push({
              courseId: c.id, courseName: c.fullname, shortname: c.shortname, color: c.color,
              items: items.map(gi => ({
                name: gi.itemname || gi.itemtype, grade: gi.gradeformatted || String(Math.round(gi.graderaw)),
                gradeMax: gi.grademax, percentage: gi.percentageformatted,
                feedback: gi.feedback?.replace(/<[^>]+>/g, "").trim() || "",
              })),
              courseTotal: ug.gradeitems?.find(gi => gi.itemtype === "course")?.gradeformatted || null,
            });
          }
        }
      }
      if (!cancelled) setGrades(courseGrades);
      if (!cancelled) setLoading(false);
    };
    loadData();
    return () => { cancelled = true; };
  }, [moodleToken, moodleUserId, courses]);

  const quickActions = [
    { label: "Generar plan semanal", icon: Calendar, color: P.red, target: "planner" },
    { label: "Chatear con el tutor", icon: Sparkles, color: "#7c3aed", target: "chat" },
    { label: "Cuestionario rápido", icon: HelpCircle, color: "#059669", target: "quiz" },
    { label: "Biblioteca", icon: BookOpen, color: "#2563eb", target: "library" },
  ];

  const upcomingEvents = (events || []).slice(0, 6);
  const unreadNotifs = (notifications || []).filter(n => !n.read).slice(0, 4);

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 30, color: P.text, marginBottom: 6, fontWeight: 800 }}>
          Bienvenido/a de vuelta
        </h1>
        <p style={{ color: P.textMuted, fontSize: 15 }}>
          Tenés {courses.length} materias en curso · <span style={{ color: P.red, fontWeight: 600 }}>Lic. en Gobernanza de Datos</span>
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
        {quickActions.map((act, i) => (
          <button key={i} onClick={() => onNavigate(act.target)} className="slide-in"
            style={{
              animationDelay: `${i * 0.1}s`, padding: "16px 18px", borderRadius: 14,
              background: P.card, border: `1px solid ${P.border}`,
              display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s", textAlign: "left",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = act.color; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.transform = "none"; }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${act.color}10`, display: "flex", alignItems: "center", justifyContent: "center", color: act.color }}>
              <act.icon size={19} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: P.text }}>{act.label}</span>
          </button>
        ))}
      </div>

      {/* Main grid: Events + Grades/Notifications */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>

        {/* ═══ Upcoming Events / Deadlines ═══ */}
        <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} color={P.red} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Próximas entregas</h3>
            </div>
            {upcomingEvents.length > 0 && <span style={{ fontSize: 11, color: P.textMuted, background: P.borderLight, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>{events?.length || 0}</span>}
          </div>
          <div style={{ padding: "8px 12px", maxHeight: 320, overflow: "auto" }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Loader2 size={16} className="spin" color={P.red} /> Cargando...
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: P.textMuted }}>
                <CheckCircle size={24} strokeWidth={1.5} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>No hay entregas pendientes</div>
              </div>
            ) : (
              upcomingEvents.map((evt, i) => {
                const color = urgencyColor(evt.timesort || evt.timestart);
                const course = courses.find(c => c.id === evt.course?.id);
                return (
                  <a key={i} href={evt.url} target="_blank" rel="noopener noreferrer"
                    className="slide-in" style={{
                      animationDelay: `${i * 0.05}s`, display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 8, transition: "all 0.15s",
                      textDecoration: "none", borderLeft: `3px solid ${color}`,
                      marginBottom: 4,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = P.cream; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                      <AlertTriangle size={15} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {evt.name}
                      </div>
                      <div style={{ fontSize: 11, color: P.textMuted }}>
                        {course?.shortname || evt.course?.fullname || ""} · {formatDate(evt.timesort || evt.timestart)}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color, flexShrink: 0, padding: "2px 8px", borderRadius: 6, background: `${color}10` }}>
                      {timeAgo(evt.timesort || evt.timestart)}
                    </span>
                  </a>
                );
              })
            )}
          </div>
        </div>

        {/* ═══ Grades + Notifications ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Grades */}
          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden", flex: 1 }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={16} color="#059669" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Mis calificaciones</h3>
            </div>
            <div style={{ padding: "8px 12px", maxHeight: 200, overflow: "auto" }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Loader2 size={16} className="spin" color={P.red} /> Cargando...
                </div>
              ) : !grades || grades.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: P.textMuted, fontSize: 13 }}>
                  No hay calificaciones registradas aún
                </div>
              ) : (
                grades.map((cg, ci) => (
                  <div key={ci} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cg.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{cg.shortname}</span>
                      {cg.courseTotal && <span style={{ fontSize: 13, fontWeight: 800, color: P.text }}>{cg.courseTotal}</span>}
                    </div>
                    {cg.items.slice(0, 3).map((gi, ii) => (
                      <div key={ii} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px 4px 16px" }}>
                        <span style={{ fontSize: 12, color: P.textSec, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{gi.name}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                          background: parseFloat(gi.grade) >= 6 ? "#ECFDF5" : parseFloat(gi.grade) >= 4 ? "#FEF3C7" : "#FEF2F2",
                          color: parseFloat(gi.grade) >= 6 ? "#059669" : parseFloat(gi.grade) >= 4 ? "#D97706" : "#DC2626",
                        }}>
                          {gi.grade}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notifications */}
          {unreadNotifs.length > 0 && (
            <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={16} color="#7c3aed" />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Notificaciones</h3>
                <span style={{ fontSize: 11, color: "#fff", background: "#7c3aed", padding: "1px 7px", borderRadius: 10, fontWeight: 700 }}>{unreadNotifs.length}</span>
              </div>
              <div style={{ padding: "8px 12px" }}>
                {unreadNotifs.map((n, i) => (
                  <div key={i} style={{ padding: "8px 10px", borderRadius: 6, fontSize: 12, color: P.textSec, lineHeight: 1.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: P.text }}>{n.subject || "Notificación"}</span>
                    {n.smallmessage && <span style={{ color: P.textMuted }}> — {n.smallmessage.substring(0, 80)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Courses */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: P.text, marginBottom: 16, fontFamily: ff.heading }}>Mis Materias</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {courses.map((course, i) => (
          <div key={course.id} className="slide-in"
            style={{
              animationDelay: `${i * 0.08}s`, background: P.card, borderRadius: 16,
              border: `1px solid ${P.border}`, overflow: "hidden",
              cursor: "pointer", transition: "all 0.2s",
            }}
            onClick={() => onSelectCourse(course)}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(183,28,28,0.06)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ height: 5, background: `linear-gradient(90deg, ${course.color}, ${course.color}88)` }} />
            <div style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: course.color, textTransform: "uppercase", letterSpacing: 1.2 }}>
                    {course.shortname}
                  </span>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: P.text, marginTop: 4, lineHeight: 1.35 }}>
                    {course.fullname}
                  </h3>
                </div>
                <div style={{ color: P.textMuted }}><ChevronRight size={18} /></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                <div style={{ flex: 1, height: 5, background: P.borderLight, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${course.progress}%`, height: "100%", background: `linear-gradient(90deg, ${course.color}, ${course.color}bb)`, borderRadius: 3, transition: "width 0.6s ease" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: course.color }}>{course.progress}%</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <span style={{ fontSize: 12, color: P.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                  <FileText size={14} /> {course.materials} recursos
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}