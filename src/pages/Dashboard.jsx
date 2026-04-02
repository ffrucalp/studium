import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { getUpcomingEvents, getUserGrades, getNotifications, getCalendarEvents } from "../services/moodle";
import { listCalendarEvents } from "../services/google";
import DriveModal from "../components/DriveModal";
import AlertModal from "../components/AlertModal";
import {
  Calendar, Sparkles, HelpCircle, BookOpen, Bell,
  Clock, AlertTriangle, CheckCircle, TrendingUp, Loader2,
  ChevronLeft, ChevronRight, GraduationCap, ExternalLink,
  HardDrive,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────
function timeAgo(ts) {
  const diff = ts - Math.floor(Date.now() / 1000);
  if (diff < 0) return "Vencido";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hs`;
  if (diff < 86400 * 2) return "Mañana";
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} días`;
  return `${Math.floor(diff / (86400 * 7))} sem`;
}
function urgencyColor(ts) {
  const d = ts - Math.floor(Date.now() / 1000);
  if (d < 0) return "#DC2626";
  if (d < 86400) return "#EA580C";
  if (d < 86400 * 3) return "#D97706";
  return "#059669";
}
function fmtDate(ts) { return new Date(ts * 1000).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
function fmtDay(d) { return d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }); }
function sameDay(d1, d2) { return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate(); }

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function Dashboard({ onNavigate, onSelectCourse }) {
  const { courses, moodleToken, moodleUserId, googleAccessToken } = useApp();
  const [events, setEvents] = useState(null);
  const [grades, setGrades] = useState(null);
  const [notifications, setNotifications] = useState(null);
  const [calEvents, setCalEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDrive, setShowDrive] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (!moodleToken || moodleToken === "mock_token") { setLoading(false); return; }
    let cancelled = false;

    const load = async () => {
      // Upcoming deadlines
      const evts = await getUpcomingEvents(moodleToken);
      if (!cancelled && evts?.events) setEvents(evts.events);

      // Notifications
      const notifs = await getNotifications(moodleToken, moodleUserId);
      if (!cancelled && notifs?.notifications) setNotifications(notifs.notifications);

      // Moodle calendar events (pass course IDs to get course events)
      const courseIds = courses.map(c => c.id);
      const mCal = await getCalendarEvents(moodleToken, courseIds);
      const moodleEvts = (mCal?.events || []).map(e => ({
        id: `m-${e.id}`, title: e.name, start: new Date(e.timestart * 1000),
        end: new Date((e.timestart + (e.timeduration || 3600)) * 1000),
        type: "moodle", color: "#B71C1C", course: e.courseid,
        url: e.url, description: e.description?.replace(/<[^>]+>/g, "").substring(0, 120) || "",
      }));
      if (!cancelled) setCalEvents(prev => [...moodleEvts, ...prev.filter(e => e.type !== "moodle")]);

      // Google Calendar events
      if (googleAccessToken) {
        try {
          const now = new Date();
          const gCal = await listCalendarEvents(googleAccessToken,
            new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
            new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString());
          const gEvts = (gCal?.events || []).map(e => ({
            id: `g-${e.id}`, title: e.summary, start: new Date(e.start?.dateTime || e.start?.date),
            end: new Date(e.end?.dateTime || e.end?.date),
            type: "google", color: "#4285F4", url: e.htmlLink,
            description: e.description?.substring(0, 120) || "",
          }));
          if (!cancelled) setCalEvents(prev => [...prev.filter(e => e.type !== "google"), ...gEvts]);
        } catch {}
      }

      // Grades for first 5 courses
      const cGrades = [];
      for (const c of courses.slice(0, 5)) {
        const g = await getUserGrades(moodleToken, c.id, moodleUserId);
        if (!cancelled && g?.usergrades?.[0]) {
          const ug = g.usergrades[0];
          const items = (ug.gradeitems || []).filter(gi => gi.itemtype !== "course" && gi.graderaw != null);
          if (items.length > 0) cGrades.push({
            courseId: c.id, courseName: c.fullname, shortname: c.shortname, color: c.color,
            items: items.map(gi => ({ name: gi.itemname || gi.itemtype, grade: gi.gradeformatted || String(Math.round(gi.graderaw)) })),
            courseTotal: ug.gradeitems?.find(gi => gi.itemtype === "course")?.gradeformatted || null,
          });
        }
      }
      if (!cancelled) setGrades(cGrades);
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [moodleToken, moodleUserId, courses, googleAccessToken]);

  // ─── Calendar logic ────────────────────────────────────────────
  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const calCells = [];
  for (let i = 0; i < firstDay; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);
  const prevMonth = () => setCalMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCalMonth(new Date(year, month + 1, 1));

  const dayEvents = (day) => {
    if (!day) return [];
    const d = new Date(year, month, day);
    return calEvents.filter(e => sameDay(e.start, d));
  };

  const selectedDayEvents = selectedDay ? dayEvents(selectedDay) : [];
  const upcomingEvents = (events || []).slice(0, 6);
  const unreadNotifs = (notifications || []).filter(n => !n.read).slice(0, 5);

  const quickActions = [
    { label: "Mis Materias", icon: GraduationCap, color: P.red, target: "courses" },
    { label: "Plan semanal", icon: Calendar, color: "#d97706", target: "planner" },
    { label: "Tutor IA", icon: Sparkles, color: "#7c3aed", target: "chat" },
    { label: "Biblioteca", icon: BookOpen, color: "#2563eb", target: "library" },
    { label: "Mi Drive", icon: HardDrive, color: "#4285F4", action: () => setShowDrive(true) },
    { label: "Nueva alerta", icon: Bell, color: "#D97706", action: () => setShowAlert(true) },
  ];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 30, color: P.text, marginBottom: 6, fontWeight: 800 }}>Bienvenido/a de vuelta</h1>
        <p style={{ color: P.textMuted, fontSize: 15 }}>Tenés {courses.length} materias en curso · <span style={{ color: P.red, fontWeight: 600 }}>Lic. en Gobernanza de Datos</span></p>
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 22 }}>
        {quickActions.map((a, i) => (
          <button key={i} onClick={() => a.action ? a.action() : onNavigate(a.target)} className="slide-in"
            style={{ animationDelay: `${i * 0.08}s`, padding: "14px 16px", borderRadius: 12, background: P.card, border: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 10, transition: "all 0.2s", textAlign: "left" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.transform = "none"; }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${a.color}10`, display: "flex", alignItems: "center", justifyContent: "center", color: a.color }}><a.icon size={17} /></div>
            <span style={{ fontSize: 13, fontWeight: 600, color: P.text }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 20 }}>

        {/* ═══ LEFT: Entregas + Calendario ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Próximas entregas */}
          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
            <div style={{ padding: "13px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Clock size={15} color={P.red} /><h3 style={{ fontSize: 14, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Próximas entregas</h3></div>
              {events?.length > 0 && <span style={{ fontSize: 11, color: P.textMuted, background: P.borderLight, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>{events.length}</span>}
            </div>
            <div style={{ padding: "6px 10px", maxHeight: 220, overflow: "auto" }}>
              {loading ? <div style={{ padding: 24, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Loader2 size={15} className="spin" color={P.red} /> Cargando...</div>
              : upcomingEvents.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: P.textMuted }}><CheckCircle size={20} strokeWidth={1.5} style={{ marginBottom: 6 }} /><div style={{ fontSize: 13 }}>Sin entregas pendientes</div></div>
              : upcomingEvents.map((evt, i) => {
                const c = urgencyColor(evt.timesort || evt.timestart);
                const course = courses.find(cr => cr.id === evt.course?.id);
                return (
                  <a key={i} href={evt.url} target="_blank" rel="noopener noreferrer" className="slide-in"
                    style={{ animationDelay: `${i * 0.04}s`, display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, transition: "all 0.15s", textDecoration: "none", borderLeft: `3px solid ${c}`, marginBottom: 3 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = P.cream; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{evt.name}</div>
                      <div style={{ fontSize: 10, color: P.textMuted }}>{course?.shortname || ""} · {fmtDate(evt.timesort || evt.timestart)}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: c, flexShrink: 0, padding: "2px 7px", borderRadius: 5, background: `${c}10` }}>{timeAgo(evt.timesort || evt.timestart)}</span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* ═══ Calendario unificado ═══ */}
          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Calendar size={16} color="#2563eb" /><h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Calendario</h3></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: "#B71C1C", display: "inline-block" }} /><span style={{ fontSize: 11, color: P.textMuted }}>Moodle</span>
                {googleAccessToken && <><span style={{ width: 8, height: 8, borderRadius: 4, background: "#4285F4", display: "inline-block", marginLeft: 6 }} /><span style={{ fontSize: 11, color: P.textMuted }}>Google</span></>}
              </div>
            </div>
            <div style={{ padding: "16px 20px" }}>
              {/* Month nav */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <button onClick={prevMonth} style={{ padding: 6, color: P.textMuted, borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.color = P.text} onMouseLeave={e => e.currentTarget.style.color = P.textMuted}><ChevronLeft size={20} /></button>
                <span style={{ fontSize: 16, fontWeight: 700, color: P.text }}>{MONTH_NAMES[month]} {year}</span>
                <button onClick={nextMonth} style={{ padding: 6, color: P.textMuted, borderRadius: 8 }} onMouseEnter={e => e.currentTarget.style.color = P.text} onMouseLeave={e => e.currentTarget.style.color = P.textMuted}><ChevronRight size={20} /></button>
              </div>
              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
                {DAY_NAMES.map(d => <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: P.textMuted, padding: "6px 0" }}>{d}</div>)}
              </div>
              {/* Calendar grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                {calCells.map((day, i) => {
                  if (!day) return <div key={`e${i}`} />;
                  const isToday = sameDay(new Date(year, month, day), today);
                  const isSelected = selectedDay === day;
                  const evts = dayEvents(day);
                  const hasMoodle = evts.some(e => e.type === "moodle");
                  const hasGoogle = evts.some(e => e.type === "google");
                  return (
                    <button key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
                      style={{
                        padding: "10px 4px 8px", borderRadius: 10, textAlign: "center", transition: "all 0.15s",
                        background: isSelected ? `${P.red}12` : isToday ? P.borderLight : "transparent",
                        border: isSelected ? `2px solid ${P.red}` : isToday ? `2px solid ${P.border}` : "2px solid transparent",
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = P.cream; }}
                      onMouseLeave={e => { if (!isSelected && !isToday) e.currentTarget.style.background = "transparent"; else if (isToday && !isSelected) e.currentTarget.style.background = P.borderLight; }}>
                      <div style={{ fontSize: 14, fontWeight: isToday ? 800 : 500, color: isToday ? P.red : P.text }}>{day}</div>
                      {evts.length > 0 && (
                        <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: 4 }}>
                          {hasMoodle && <div style={{ width: 6, height: 6, borderRadius: 3, background: "#B71C1C" }} />}
                          {hasGoogle && <div style={{ width: 6, height: 6, borderRadius: 3, background: "#4285F4" }} />}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Selected day events */}
              {selectedDay && (
                <div style={{ marginTop: 14, borderTop: `1px solid ${P.borderLight}`, paddingTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 8 }}>{fmtDay(new Date(year, month, selectedDay))}</div>
                  {selectedDayEvents.length === 0 ? <div style={{ fontSize: 13, color: P.textMuted }}>Sin eventos este día</div>
                  : selectedDayEvents.map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, marginBottom: 4 }}
                      onMouseEnter={ev => ev.currentTarget.style.background = P.cream} onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: e.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                        {e.description && <div style={{ fontSize: 11, color: P.textMuted, marginTop: 2 }}>{e.description}</div>}
                      </div>
                      {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: P.textMuted, flexShrink: 0 }}><ExternalLink size={14} /></a>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Notas + Notificaciones ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Calificaciones */}
          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
            <div style={{ padding: "13px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={15} color="#059669" /><h3 style={{ fontSize: 14, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Mis calificaciones</h3>
            </div>
            <div style={{ padding: "6px 10px", maxHeight: 260, overflow: "auto" }}>
              {loading ? <div style={{ padding: 20, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Loader2 size={15} className="spin" color={P.red} /> Cargando...</div>
              : !grades || grades.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: P.textMuted, fontSize: 13 }}>No hay calificaciones aún</div>
              : grades.map((cg, ci) => (
                <div key={ci} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cg.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{cg.shortname}</span>
                    {cg.courseTotal && <span style={{ fontSize: 13, fontWeight: 800, color: P.text }}>{cg.courseTotal}</span>}
                  </div>
                  {cg.items.slice(0, 3).map((gi, ii) => (
                    <div key={ii} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 8px 3px 16px" }}>
                      <span style={{ fontSize: 11, color: P.textSec, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{gi.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 5,
                        background: parseFloat(gi.grade) >= 6 ? "#ECFDF5" : parseFloat(gi.grade) >= 4 ? "#FEF3C7" : "#FEF2F2",
                        color: parseFloat(gi.grade) >= 6 ? "#059669" : parseFloat(gi.grade) >= 4 ? "#D97706" : "#DC2626" }}>{gi.grade}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Notificaciones */}
          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
            <div style={{ padding: "13px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={15} color="#7c3aed" /><h3 style={{ fontSize: 14, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Notificaciones</h3>
              {unreadNotifs.length > 0 && <span style={{ fontSize: 10, color: "#fff", background: "#7c3aed", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>{unreadNotifs.length}</span>}
            </div>
            <div style={{ padding: "6px 10px", maxHeight: 200, overflow: "auto" }}>
              {loading ? <div style={{ padding: 20, textAlign: "center", color: P.textMuted }}><Loader2 size={15} className="spin" color={P.red} /></div>
              : !notifications || notifications.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: P.textMuted, fontSize: 13 }}>Sin notificaciones</div>
              : (notifications || []).slice(0, 6).map((n, i) => (
                <div key={i} style={{ padding: "7px 10px", borderRadius: 6, fontSize: 12, lineHeight: 1.5, marginBottom: 2,
                  background: !n.read ? `#7c3aed08` : "transparent", borderLeft: !n.read ? "3px solid #7c3aed" : "3px solid transparent" }}>
                  <div style={{ fontWeight: 600, color: P.text, fontSize: 12 }}>{n.subject || "Notificación"}</div>
                  {n.smallmessage && <div style={{ color: P.textMuted, fontSize: 11 }}>{n.smallmessage.substring(0, 100)}</div>}
                  {n.timecreated && <div style={{ fontSize: 10, color: P.textMuted, marginTop: 2 }}>{fmtDate(n.timecreated)}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>

      {/* Modals */}
      {showDrive && <DriveModal onClose={() => setShowDrive(false)} />}
      {showAlert && <AlertModal onClose={() => setShowAlert(false)} courses={courses} />}
    </div>
  );
}