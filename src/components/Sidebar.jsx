import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import {
  Home, Sparkles, Calendar, HelpCircle, Settings,
  GraduationCap, BookOpen, ChevronLeft, Menu, Library,
  Calculator, Camera, MessageCircle, Radio,
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Inicio", Icon: Home },
  { id: "courses", label: "Mis Materias", Icon: GraduationCap },
  { id: "messages", label: "Mensajes", Icon: MessageCircle },
  { id: "livechat", label: "Chat en vivo", Icon: Radio },
  { id: "career", label: "Mi Carrera", Icon: BookOpen },
  { id: "library", label: "Biblioteca", Icon: Library },
  { id: "wolfram", label: "Calculadora", Icon: Calculator },
  { id: "scan", label: "Digitalizar", Icon: Camera },
  { id: "chat", label: "Tutor IA", Icon: Sparkles },
  { id: "planner", label: "Planificador", Icon: Calendar },
  { id: "quizzes", label: "Cuestionarios", Icon: HelpCircle },
  { id: "quiz", label: "Práctica", Icon: HelpCircle },
  { id: "settings", label: "Ajustes", Icon: Settings },
];

export default function Sidebar({ currentScreen, onNavigate }) {
  const [open, setOpen] = useState(true);
  const { user } = useApp();

  return (
    <aside
      style={{
        width: open ? 240 : 64,
        background: P.sidebar,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: open ? "18px 16px" : "18px 0",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {open ? (
          <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 10 }}>
            <div
              style={{
                width: 38, height: 38, borderRadius: 10, background: P.red,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: "#fff",
              }}
            >
              <GraduationCap size={20} />
            </div>
            <span style={{ color: "#fff", fontFamily: ff.heading, fontSize: 21, fontWeight: 700, whiteSpace: "nowrap", flex: 1 }}>
              Studium
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: 30, height: 30, borderRadius: 7,
                background: "rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.45)", border: "none",
                flexShrink: 0, transition: "all 0.2s", cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
              title="Contraer menú"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            style={{
              width: 42, height: 42, borderRadius: 10, background: P.red,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", border: "none", cursor: "pointer",
              transition: "all 0.2s", boxShadow: "0 2px 8px rgba(183,28,28,0.25)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(183,28,28,0.35)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(183,28,28,0.25)"; }}
            title="Expandir menú"
          >
            <Menu size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map((item) => {
          const active = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: open ? "11px 14px" : "11px 0",
                borderRadius: 10,
                background: active ? P.sidebarActive : "transparent",
                color: active ? "#fff" : "rgba(255,255,255,0.5)",
                fontSize: 14, fontWeight: active ? 600 : 400,
                transition: "all 0.2s", width: "100%",
                justifyContent: open ? "flex-start" : "center",
                borderLeft: active ? `3px solid ${P.redAccent}` : "3px solid transparent",
              }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = P.sidebarHover; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = active ? "#fff" : "rgba(255,255,255,0.5)"; } }}
            >
              <item.Icon size={20} />
              {open && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div
        style={{
          padding: open ? "16px 20px" : "16px 0",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center",
          justifyContent: open ? "flex-start" : "center",
          gap: 10,
        }}
      >
        {user?.picture ? (
          <img src={user.picture} alt="" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, objectFit: "cover" }} referrerPolicy="no-referrer" />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: P.red, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {user?.name?.charAt(0) || "E"}
          </div>
        )}
        {open && (
          <div style={{ overflow: "hidden" }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.name}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.email}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}