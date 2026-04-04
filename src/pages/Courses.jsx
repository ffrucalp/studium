import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { FileText, ChevronRight, Search, GraduationCap } from "lucide-react";
import { useState } from "react";

export default function Courses({ onSelectCourse }) {
  const { courses } = useApp();
  const [filter, setFilter] = useState("");

  const filtered = filter.trim()
    ? courses.filter(c =>
        c.fullname.toLowerCase().includes(filter.toLowerCase()) ||
        c.shortname.toLowerCase().includes(filter.toLowerCase()))
    : courses;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 30, color: P.text, fontWeight: 800, marginBottom: 6 }}>
          <GraduationCap size={28} style={{ verticalAlign: "-4px", marginRight: 10, color: P.red }} />
          Mis Materias
        </h1>
        <p style={{ color: P.textMuted, fontSize: 15 }}>
          {courses.length} materias en curso · <span style={{ color: P.red, fontWeight: 600 }}>Lic. en Gobernanza de Datos</span>
        </p>
      </div>

      {/* Search */}
      {courses.length > 6 && (
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10, background: P.card, border: `1.5px solid ${P.border}`, borderRadius: 12, padding: "0 14px", maxWidth: 400 }}>
          <Search size={16} color={P.textMuted} />
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar materia..."
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: P.text, padding: "12px 0", fontFamily: ff.body }}
          />
          {filter && <button onClick={() => setFilter("")} style={{ fontSize: 12, color: P.textMuted }}>✕</button>}
        </div>
      )}

      {/* Courses grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map((course, i) => (
          <div key={course.id} className="slide-in"
            style={{
              animationDelay: `${i * 0.06}s`, background: P.card, borderRadius: 16,
              border: `1px solid ${P.border}`, overflow: "hidden",
              cursor: "pointer", transition: "all 0.2s",
            }}
            onClick={() => onSelectCourse(course)}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(26,82,118,0.06)"; }}
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

      {filtered.length === 0 && filter && (
        <div style={{ textAlign: "center", padding: 40, color: P.textMuted }}>
          No se encontraron materias con "{filter}"
        </div>
      )}
    </div>
  );
}