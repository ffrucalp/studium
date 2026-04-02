import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { createCalendarEvent } from "../services/google";
import {
  X, Bell, Calendar, Clock, CheckCircle, Loader2,
  AlertTriangle, BookOpen,
} from "lucide-react";

const PRESETS = [
  { label: "Estudiar para parcial", icon: BookOpen, color: "#2563eb" },
  { label: "Entregar trabajo práctico", icon: AlertTriangle, color: "#DC2626" },
  { label: "Foro de la materia", icon: Calendar, color: "#7c3aed" },
  { label: "Lectura obligatoria", icon: BookOpen, color: "#059669" },
  { label: "Reunión de grupo", icon: Calendar, color: "#D97706" },
];

export default function AlertModal({ onClose, courses = [] }) {
  const { googleAccessToken } = useApp();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [course, setCourse] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Set default date to tomorrow
  useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split("T")[0]);
  });

  const handlePreset = (preset) => {
    setTitle(preset.label);
  };

  const handleSave = async () => {
    if (!title.trim() || !date || !time) return;
    setSaving(true); setError(null);

    const startDateTime = `${date}T${time}:00-03:00`;
    const endDate = new Date(`${date}T${time}:00`);
    endDate.setMinutes(endDate.getMinutes() + parseInt(duration));
    const endDateTime = `${endDate.toISOString().split("T")[0]}T${endDate.toTimeString().split(" ")[0]}-03:00`;

    const summary = course ? `${title} — ${course}` : title;
    const desc = `${description ? description + "\n\n" : ""}Creado desde Studium UCALP`;

    try {
      await createCalendarEvent(googleAccessToken, {
        summary, description: desc, startDateTime, endDateTime,
      });
      setSaved(true);
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setError(e.message || "No se pudo crear la alerta");
    }
    setSaving(false);
  };

  if (!googleAccessToken) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <Bell size={40} color={P.textMuted} strokeWidth={1.2} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: P.text, marginBottom: 6 }}>Google Calendar no conectado</div>
          <div style={{ fontSize: 13, color: P.textMuted }}>Conectá tu cuenta de Google desde Ajustes para crear alertas</div>
        </div>
      </Overlay>
    );
  }

  if (saved) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: "center", padding: 50 }}>
          <CheckCircle size={48} color="#059669" strokeWidth={1.5} style={{ marginBottom: 14 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: P.text, marginBottom: 6 }}>Alerta creada</div>
          <div style={{ fontSize: 13, color: P.textMuted }}>Se agregó a tu Google Calendar con recordatorio</div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${P.borderLight}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Bell size={20} color="#D97706" />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Nueva alerta</h2>
        </div>
        <button onClick={onClose} style={{ padding: 6, color: P.textMuted, borderRadius: 8 }}
          onMouseEnter={e => e.currentTarget.style.color = P.text} onMouseLeave={e => e.currentTarget.style.color = P.textMuted}>
          <X size={20} />
        </button>
      </div>

      <div style={{ padding: "16px 20px", overflow: "auto", maxHeight: "70vh" }}>
        {/* Presets */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, display: "block", marginBottom: 8 }}>Sugerencias rápidas</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PRESETS.map((p, i) => (
              <button key={i} onClick={() => handlePreset(p)}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, border: `1px solid ${P.border}`, background: title === p.label ? `${p.color}12` : P.card, color: title === p.label ? p.color : P.text, fontWeight: 500, transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; }} onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, display: "block", marginBottom: 6 }}>Título *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Estudiar Unidad 3 de Estadística"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 14, background: "transparent", color: P.text, fontFamily: ff.body, outline: "none", boxSizing: "border-box" }}
            onFocus={e => e.currentTarget.style.borderColor = P.red} onBlur={e => e.currentTarget.style.borderColor = P.border}
          />
        </div>

        {/* Course select */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, display: "block", marginBottom: 6 }}>Materia (opcional)</label>
          <select value={course} onChange={e => setCourse(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 13, background: "transparent", color: P.text, fontFamily: ff.body, outline: "none", boxSizing: "border-box" }}>
            <option value="">Sin materia</option>
            {courses.map(c => <option key={c.id} value={c.shortname}>{c.fullname}</option>)}
          </select>
        </div>

        {/* Date & Time */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, display: "block", marginBottom: 6 }}>Fecha *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 13, background: "transparent", color: P.text, fontFamily: ff.body, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, display: "block", marginBottom: 6 }}>Hora *</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 13, background: "transparent", color: P.text, fontFamily: ff.body, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, display: "block", marginBottom: 6 }}>Duración</label>
            <select value={duration} onChange={e => setDuration(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 13, background: "transparent", color: P.text, fontFamily: ff.body, outline: "none", boxSizing: "border-box" }}>
              <option value="30">30 min</option>
              <option value="60">1 hora</option>
              <option value="90">1:30 hs</option>
              <option value="120">2 horas</option>
              <option value="180">3 horas</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, display: "block", marginBottom: 6 }}>Notas (opcional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalles adicionales..."
            rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 13, background: "transparent", color: P.text, fontFamily: ff.body, outline: "none", resize: "vertical", boxSizing: "border-box" }}
          />
        </div>

        {/* Info */}
        <div style={{ fontSize: 11, color: P.textMuted, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={12} /> Se creará un evento en Google Calendar con recordatorio 30 min antes y alerta por email 1 hora antes
        </div>

        {error && <div style={{ fontSize: 13, color: "#DC2626", marginBottom: 12, padding: "8px 12px", background: "#FEF2F2", borderRadius: 8 }}>{error}</div>}

        {/* Save button */}
        <button onClick={handleSave} disabled={!title.trim() || !date || !time || saving}
          style={{
            width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700,
            background: !title.trim() || !date ? P.border : P.red, color: !title.trim() || !date ? P.textMuted : "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.2s", border: "none", cursor: !title.trim() || !date ? "not-allowed" : "pointer",
          }}>
          {saving ? <Loader2 size={18} className="spin" /> : <Bell size={18} />}
          {saving ? "Creando..." : "Crear alerta"}
        </button>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </Overlay>
  );
}

function Overlay({ onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: "90%", maxWidth: 520, maxHeight: "85vh", background: P.bg, borderRadius: 20, border: `1px solid ${P.border}`, boxShadow: "0 25px 60px rgba(0,0,0,0.15)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}