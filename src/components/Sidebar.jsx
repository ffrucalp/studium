import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import {
  Home, Sparkles, Calendar, HelpCircle, Settings,
  GraduationCap, BookOpen, ChevronLeft, ChevronDown, ChevronRight as ChevronR,
  Menu, Library, Calculator, Camera, MessageCircle, Radio, Users,
  Sun, Moon, Layers, FlaskConical, GitBranch,
} from "lucide-react";

const mainNav = [
  { id: "dashboard", label: "Inicio", Icon: Home },
  { id: "courses", label: "Mis Materias", Icon: GraduationCap },
  { id: "career", label: "Mi Carrera", Icon: BookOpen },
  { id: "chat", label: "Tutor IA", Icon: Sparkles },
  { id: "planner", label: "Planificador", Icon: Calendar },
  { id: "library", label: "Biblioteca", Icon: Library },
];

const studyNav = [
  { id: "wolfram", label: "Calculadora", Icon: Calculator },
  { id: "scan", label: "Digitalizar", Icon: Camera },
  { id: "quizzes", label: "Cuestionarios", Icon: HelpCircle },
  { id: "flashcards", label: "Flashcards", Icon: Layers },
  { id: "conceptmap", label: "Mapas conceptuales", Icon: GitBranch },
  { id: "quiz", label: "Práctica", Icon: FlaskConical },
];

const bottomNav = [
  { id: "messages", label: "Mensajes", Icon: MessageCircle },
  { id: "livechat", label: "Chat en vivo", Icon: Radio },
  { id: "classmates", label: "Compañeros", Icon: Users },
  { id: "settings", label: "Ajustes", Icon: Settings },
];

function NavButton({ item, active, open, onNavigate }) {
  return (
    <button onClick={() => onNavigate(item.id)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: open ? "9px 14px" : "9px 0", borderRadius: 10,
        background: active ? P.sidebarActive : "transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.5)",
        fontSize: 13, fontWeight: active ? 600 : 400,
        transition: "all 0.2s", width: "100%",
        justifyContent: open ? "flex-start" : "center",
        borderLeft: active ? `3px solid ${P.redAccent}` : "3px solid transparent",
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = P.sidebarHover; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = active ? "#fff" : "rgba(255,255,255,0.5)"; } }}>
      <item.Icon size={18} />
      {open && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
    </button>
  );
}

export default function Sidebar({ currentScreen, onNavigate, dark, onToggleDark, mobileOpen }) {
  const [open, setOpen] = useState(true);
  const [studyOpen, setStudyOpen] = useState(() => {
    // Auto-open if current screen is a study item
    return studyNav.some(i => i.id === currentScreen);
  });
  const { user } = useApp();

  // Keep study section open if a study item is active
  const studyActive = studyNav.some(i => i.id === currentScreen);

  return (
    <aside
      className={`studium-sidebar ${mobileOpen ? "open" : ""}`}
      style={{
        width: open ? 240 : 64,
        background: P.sidebar,
        display: "flex", flexDirection: "column",
        transition: "width 0.3s ease, transform 0.3s ease",
        overflow: "hidden", flexShrink: 0,
      }}>
      {/* Header */}
      <div style={{ padding: open ? "18px 16px" : "18px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {open ? (
          <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: P.red, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}>
              <GraduationCap size={20} />
            </div>
            <span style={{ color: "#fff", fontFamily: ff.heading, fontSize: 21, fontWeight: 700, whiteSpace: "nowrap", flex: 1 }}>
              Studium
            </span>
            <button onClick={() => setOpen(false)}
              style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.45)", border: "none", flexShrink: 0, transition: "all 0.2s", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
              title="Contraer menú">
              <ChevronLeft size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => setOpen(true)}
            style={{ width: 42, height: 42, borderRadius: 10, background: P.red, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", border: "none", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 8px rgba(183,28,28,0.25)" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            title="Expandir menú">
            <Menu size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "10px 10px", display: "flex", flexDirection: "column", gap: 1, overflow: "auto" }}>
        {/* Main nav */}
        {mainNav.map(item => (
          <NavButton key={item.id} item={item} active={currentScreen === item.id} open={open} onNavigate={onNavigate} />
        ))}

        {/* ── Mi Estudio section ── */}
        <div style={{ marginTop: 8 }}>
          {open ? (
            <button onClick={() => setStudyOpen(prev => !prev)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", borderRadius: 8, transition: "all 0.15s",
                background: "transparent", border: "none",
                color: studyActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                cursor: "pointer",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
              onMouseLeave={e => e.currentTarget.style.color = studyActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)"}>
              {(studyOpen || studyActive) ? <ChevronDown size={13} /> : <ChevronR size={13} />}
              Mi Estudio
            </button>
          ) : (
            <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" }} />
          )}

          {(studyOpen || studyActive || !open) && (
            <div style={{ paddingLeft: open ? 6 : 0 }}>
              {studyNav.map(item => (
                <NavButton key={item.id} item={item} active={currentScreen === item.id} open={open} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>

        {/* ── Separator ── */}
        {open ? (
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "8px 14px" }} />
        ) : (
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" }} />
        )}

        {/* Bottom nav */}
        {bottomNav.map(item => (
          <NavButton key={item.id} item={item} active={currentScreen === item.id} open={open} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Dark mode toggle + User */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onToggleDark}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: open ? "12px 20px" : "12px 0", justifyContent: open ? "flex-start" : "center",
            color: "rgba(255,255,255,0.7)", fontSize: 13, transition: "all 0.2s",
            background: "rgba(255,255,255,0.04)", borderRadius: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          {open && <span style={{ fontWeight: 500 }}>{dark ? "Modo claro" : "Modo oscuro"}</span>}
        </button>

        <div style={{ padding: open ? "12px 20px" : "12px 0", display: "flex", alignItems: "center", justifyContent: open ? "flex-start" : "center", gap: 10 }}>
          {user?.picture ? (
            <img src={user.picture} alt="" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, objectFit: "cover" }} referrerPolicy="no-referrer" />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: 9, background: P.red, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {user?.name?.charAt(0) || "E"}
            </div>
          )}
          {open && (
            <div style={{ overflow: "hidden" }}>
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.name}
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user?.email}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}