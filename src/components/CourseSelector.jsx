import { P } from "../styles/theme";

// ─── Faculty color mapping ───────────────────────────────────────
const FACULTY_COLORS = [
  { match: ["exactas", "ingeniería", "ingenieria"], color: "#DC2626", label: "Cs. Exactas e Ingeniería" },
  { match: ["odontolog"], color: "#D97706", label: "Odontología" },
  { match: ["económicas", "economicas", "sociales"], color: "#7C3AED", label: "Cs. Económicas y Sociales" },
  { match: ["derecho", "políticas", "politicas"], color: "#EA580C", label: "Derecho y Cs. Políticas" },
  { match: ["arquitectura", "diseño", "diseno"], color: "#059669", label: "Arquitectura y Diseño" },
  { match: ["salud"], color: "#DB2777", label: "Cs. de la Salud" },
  { match: ["humanidades"], color: "#6366F1", label: "Humanidades" },
  { match: ["rectorado"], color: "#8B5CF6", label: "Rectorado" },
];

const DEFAULT_COLOR = "#2E86C1";

export function getFacultyColor(category) {
  if (!category) return null;
  const cat = category.toLowerCase();
  for (const fac of FACULTY_COLORS) {
    if (fac.match.some(m => cat.includes(m))) return fac.color;
  }
  return null;
}

export function getFacultyLabel(category) {
  if (!category) return "";
  const cat = category.toLowerCase();
  for (const fac of FACULTY_COLORS) {
    if (fac.match.some(m => cat.includes(m))) return fac.label;
  }
  return category;
}

// ─── CourseSelector component ────────────────────────────────────

export default function CourseSelector({ courses, selectedId, onSelect }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
      {courses.map(c => {
        const color = getFacultyColor(c.category) || c.color || DEFAULT_COLOR;
        const isSelected = selectedId === c.id;
        return (
          <button key={c.id} onClick={() => onSelect(c.id)}
            style={{
              padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600,
              background: isSelected ? color : P.card,
              color: isSelected ? "#fff" : P.text,
              border: `2px solid ${isSelected ? color : P.border}`,
              cursor: "pointer", transition: "all 0.2s",
              maxWidth: 260, textAlign: "left", lineHeight: 1.3,
              boxShadow: isSelected ? `0 2px 10px ${color}30` : "none",
            }}
            onMouseEnter={e => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = color;
                e.currentTarget.style.background = color + "10";
              }
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = P.border;
                e.currentTarget.style.background = P.card;
              }
            }}>
            <div style={{
              width: 6, height: 6, borderRadius: 3,
              background: isSelected ? "#fff" : color,
              display: "inline-block", marginRight: 8, verticalAlign: "middle",
            }} />
            {c.fullname}
          </button>
        );
      })}
    </div>
  );
}