import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { Calendar, Sparkles, HelpCircle, FileText, ChevronRight } from "lucide-react";

export default function Dashboard({ onNavigate, onSelectCourse }) {
  const { courses } = useApp();

  const quickActions = [
    { label: "Generar plan semanal", icon: Calendar, color: P.red, target: "planner" },
    { label: "Chatear con el tutor", icon: Sparkles, color: "#7c3aed", target: "chat" },
    { label: "Cuestionario rápido", icon: HelpCircle, color: "#059669", target: "quiz" },
  ];

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 30 }}>
        {quickActions.map((act, i) => (
          <button
            key={i}
            onClick={() => onNavigate(act.target)}
            className="slide-in"
            style={{
              animationDelay: `${i * 0.1}s`, padding: "18px 20px", borderRadius: 14,
              background: P.card, border: `1px solid ${P.border}`,
              display: "flex", alignItems: "center", gap: 14,
              transition: "all 0.2s", textAlign: "left",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = act.color; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px ${act.color}15`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 11, background: `${act.color}10`, display: "flex", alignItems: "center", justifyContent: "center", color: act.color }}>
              <act.icon size={21} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{act.label}</span>
          </button>
        ))}
      </div>

      {/* Courses */}
      <h2 style={{ fontSize: 18, fontWeight: 700, color: P.text, marginBottom: 16, fontFamily: ff.heading }}>Mis Materias</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {courses.map((course, i) => (
          <div
            key={course.id}
            className="slide-in"
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
    </div>
  );
}
