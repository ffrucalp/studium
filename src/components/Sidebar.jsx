import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import {
  Home, Sparkles, Calendar, HelpCircle, Settings,
  GraduationCap, BookOpen, ChevronLeft, ChevronDown, ChevronRight as ChevronR,
  Menu, Library, Calculator, Camera, MessageCircle, Radio, Users,
  Sun, Moon, Layers, FlaskConical, GitBranch, FileCheck,
  ClipboardList, BarChart3, Megaphone, UserCheck, PenTool,
  Shield, DollarSign, ScrollText, CalendarCheck, ClipboardCheck,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// ROLE-BASED NAVIGATION
// ═══════════════════════════════════════════════════════════════════

// Shared pages (both roles)
const sharedMainNav = [
  { id: "dashboard", label: "Inicio", Icon: Home },
  { id: "courses", label: "Mis Materias", Icon: GraduationCap },
  { id: "chat", label: "Asistente IA", Icon: Sparkles },
  { id: "planner", label: "Planificador", Icon: Calendar },
  { id: "library", label: "Biblioteca", Icon: Library },
];

// Student-only main nav items
const studentMainNav = [
  ...sharedMainNav.slice(0, 2), // dashboard, courses
  { id: "career", label: "Mi Carrera", Icon: BookOpen },
  ...sharedMainNav.slice(2), // chat, planner, library
];

// Teacher-only main nav items
const teacherMainNav = [
  ...sharedMainNav,
];

// Student study section
const studentStudyNav = [
  { id: "wolfram", label: "Calculadora", Icon: Calculator },
  { id: "scan", label: "Digitalizar", Icon: Camera },
  { id: "quizzes", label: "Cuestionarios", Icon: HelpCircle },
  { id: "flashcards", label: "Flashcards", Icon: Layers },
  { id: "conceptmap", label: "Mapas conceptuales", Icon: GitBranch },
  { id: "corrector", label: "Corrector de TPs", Icon: FileCheck },
  { id: "quiz", label: "Práctica", Icon: FlaskConical },
];

// Teacher management section (replaces "Mi Estudio")
const teacherMgmtNav = [
  { id: "students", label: "Alumnos", Icon: Users },
  { id: "grading", label: "Calificaciones", Icon: ClipboardList },
  { id: "submissions", label: "Entregas", Icon: FileCheck },
  { id: "announcements", label: "Anuncios", Icon: Megaphone },
  { id: "coursestats", label: "Estadísticas", Icon: BarChart3 },
  { id: "finales", label: "Finales", Icon: CalendarCheck },
  { id: "asistencia", label: "Asistencia", Icon: ClipboardCheck },
  { id: "liquidacion", label: "Liquidación", Icon: ScrollText },
  { id: "salary", label: "Cálculo Salarial", Icon: DollarSign },
];

// Teacher tools section
const teacherToolsNav = [
  { id: "scan", label: "Digitalizar", Icon: Camera },
  { id: "wolfram", label: "Calculadora", Icon: Calculator },
];

// Student bottom nav
const studentBottomNav = [
  { id: "messages", label: "Mensajes", Icon: MessageCircle },
  { id: "livechat", label: "Chat en vivo", Icon: Radio },
  { id: "classmates", label: "Compañeros", Icon: Users },
  { id: "settings", label: "Ajustes", Icon: Settings },
];

// Teacher bottom nav
const teacherBottomNav = [
  { id: "messages", label: "Mensajes", Icon: MessageCircle },
  { id: "livechat", label: "Chat en vivo", Icon: Radio },
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
  const { user, isTeacher, userRole, isDualRole, switchRole, teacherCourses, studentCourses } = useApp();

  // Pick nav items based on role
  const mainNav = isTeacher ? teacherMainNav : studentMainNav;
  const sectionNav = isTeacher ? teacherMgmtNav : studentStudyNav;
  const sectionLabel = isTeacher ? "Gestión" : "Mi Estudio";
  const toolsNav = isTeacher ? teacherToolsNav : [];
  const bottomNav = isTeacher ? teacherBottomNav : studentBottomNav;

  const [sectionOpen, setSectionOpen] = useState(() => {
    return sectionNav.some(i => i.id === currentScreen);
  });
  const [toolsOpen, setToolsOpen] = useState(false);

  // Keep section open if an item within it is active
  const sectionActive = sectionNav.some(i => i.id === currentScreen);
  const toolsActive = toolsNav.some(i => i.id === currentScreen);

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
            <img src="/favicon-ucalp-180.png" alt="UCALP" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
            <span style={{ color: "#fff", fontFamily: ff.heading, fontSize: 20, fontWeight: 700, whiteSpace: "nowrap", flex: 1 }}>
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
            style={{ width: 42, height: 42, borderRadius: 10, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", transition: "all 0.2s", padding: 2 }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            title="Expandir menú">
            <img src="/favicon-ucalp-180.png" alt="UCALP" style={{ width: 36, height: 36, borderRadius: 8 }} />
          </button>
        )}
      </div>

      {/* Role badge / switcher */}
      {open && userRole && (
        isDualRole ? (
          /* ── Dual-role switcher ── */
          <div style={{
            margin: "8px 14px 2px", borderRadius: 8,
            background: "rgba(255,255,255,0.06)", padding: 3,
            display: "flex", gap: 2,
          }}>
            <button
              onClick={() => { switchRole("teacher"); onNavigate("dashboard"); }}
              style={{
                flex: 1, padding: "6px 0", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                transition: "all 0.2s",
                background: isTeacher ? "rgba(46,134,193,0.3)" : "transparent",
                color: isTeacher ? "#5DADE2" : "rgba(255,255,255,0.35)",
              }}
              title={`Docente en ${teacherCourses.length} materia${teacherCourses.length !== 1 ? "s" : ""}`}>
              <Shield size={11} /> Docente
            </button>
            <button
              onClick={() => { switchRole("student"); onNavigate("dashboard"); }}
              style={{
                flex: 1, padding: "6px 0", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                transition: "all 0.2s",
                background: !isTeacher ? "rgba(5,150,105,0.25)" : "transparent",
                color: !isTeacher ? "#34D399" : "rgba(255,255,255,0.35)",
              }}
              title={`Alumno en ${studentCourses.length} materia${studentCourses.length !== 1 ? "s" : ""}`}>
              <GraduationCap size={11} /> Alumno
            </button>
          </div>
        ) : (
          /* ── Single-role badge ── */
          <div style={{
            margin: "8px 14px 2px", padding: "5px 10px", borderRadius: 6,
            background: isTeacher ? "rgba(46,134,193,0.2)" : "rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 600, color: isTeacher ? "#5DADE2" : "rgba(255,255,255,0.5)",
            textTransform: "uppercase", letterSpacing: 0.8,
          }}>
            {isTeacher ? <Shield size={12} /> : <GraduationCap size={12} />}
            {isTeacher ? "Docente" : "Alumno"}
          </div>
        )
      )}
      {!open && isDualRole && userRole && (
        /* ── Collapsed dual-role: small toggle button ── */
        <button
          onClick={() => { switchRole(isTeacher ? "student" : "teacher"); onNavigate("dashboard"); }}
          style={{
            margin: "6px auto", width: 36, height: 36, borderRadius: 8,
            background: isTeacher ? "rgba(46,134,193,0.2)" : "rgba(5,150,105,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer", transition: "all 0.2s",
            color: isTeacher ? "#5DADE2" : "#34D399",
          }}
          title={`Cambiar a ${isTeacher ? "Alumno" : "Docente"}`}>
          {isTeacher ? <Shield size={16} /> : <GraduationCap size={16} />}
        </button>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "10px 10px", display: "flex", flexDirection: "column", gap: 1, overflow: "auto" }}>
        {/* Main nav */}
        {mainNav.map(item => (
          <NavButton key={item.id} item={item} active={currentScreen === item.id} open={open} onNavigate={onNavigate} />
        ))}

        {/* ── Section (Gestión / Mi Estudio) ── */}
        <div style={{ marginTop: 8 }}>
          {open ? (
            <button onClick={() => setSectionOpen(prev => !prev)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", borderRadius: 8, transition: "all 0.15s",
                background: "transparent", border: "none",
                color: sectionActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                cursor: "pointer",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
              onMouseLeave={e => e.currentTarget.style.color = sectionActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)"}>
              {sectionOpen ? <ChevronDown size={13} /> : <ChevronR size={13} />}
              {sectionLabel}
            </button>
          ) : (
            <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 0" }} />
          )}

          {(sectionOpen || !open) && (
            <div style={{ paddingLeft: open ? 6 : 0 }}>
              {sectionNav.map(item => (
                <NavButton key={item.id} item={item} active={currentScreen === item.id} open={open} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>

        {/* ── Teacher Tools section (only for teachers) ── */}
        {isTeacher && toolsNav.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {open ? (
              <button onClick={() => setToolsOpen(prev => !prev)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 14px", borderRadius: 8, transition: "all 0.15s",
                  background: "transparent", border: "none",
                  color: toolsActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1,
                  cursor: "pointer",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
                onMouseLeave={e => e.currentTarget.style.color = toolsActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)"}>
                {toolsOpen ? <ChevronDown size={13} /> : <ChevronR size={13} />}
                Herramientas
              </button>
            ) : null}

            {(toolsOpen || !open) && (
              <div style={{ paddingLeft: open ? 6 : 0 }}>
                {toolsNav.map(item => (
                  <NavButton key={item.id} item={item} active={currentScreen === item.id} open={open} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </div>
        )}

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
              {user?.name?.charAt(0) || "U"}
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