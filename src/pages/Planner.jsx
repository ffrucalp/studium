import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { generateStudyPlan } from "../services/ai";
import { createCalendarEvent, sendStudyReminder, syncStudyPlanToCalendar } from "../services/google";
import { Btn } from "../components/UI";
import ShareButtons from "../components/ShareButtons";
import { Calendar, Clock, RefreshCw, Mail, Upload } from "lucide-react";

export default function Planner() {
  const { courses, googleAccessToken, user } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const generate = async () => {
    setLoading(true);
    const result = await generateStudyPlan(courses);
    setData(result);
    setLoading(false);
  };

  const syncToCalendar = async (block, day) => {
    if (!googleAccessToken) {
      alert("Conectá tu cuenta Google para sincronizar con Calendar");
      return;
    }
    try {
      const today = new Date();
      const dayMap = { "Lunes": 1, "Martes": 2, "Miércoles": 3, "Jueves": 4, "Viernes": 5, "Sábado": 6 };
      const offset = dayMap[day] || 0;
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + ((offset - today.getDay() + 7) % 7 || 7));
      const dateStr = nextDate.toISOString().split("T")[0];
      const [startH, startM] = (block.time?.split("-")[0] || "09:00").split(":");
      const [endH, endM] = (block.time?.split("-")[1] || "10:00").split(":");

      await createCalendarEvent(googleAccessToken, {
        summary: `📚 ${block.course}`,
        description: `${block.task || ""}\n📌 ${block.technique || "Estudio libre"}\n\nCreado por Studium UCALP`,
        startDateTime: `${dateStr}T${startH.padStart(2, "0")}:${(startM || "00").padStart(2, "0")}:00-03:00`,
        endDateTime: `${dateStr}T${endH.padStart(2, "0")}:${(endM || "00").padStart(2, "0")}:00-03:00`,
      });
      alert(`✅ Evento "${block.course}" agregado a Google Calendar`);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const sendReminder = async (block, day) => {
    if (!googleAccessToken || !user?.email) {
      alert("Conectá tu cuenta Google para enviar recordatorios");
      return;
    }
    try {
      await sendStudyReminder(googleAccessToken, {
        to: user.email,
        courseName: block.course,
        task: block.task,
        day, time: block.time,
      });
      alert(`✅ Recordatorio enviado a ${user.email}`);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const syncAllToCalendar = async () => {
    if (!googleAccessToken || !data) return;
    setSyncing(true);
    try {
      const results = await syncStudyPlanToCalendar(googleAccessToken, data);
      alert(`✅ ${results.length} eventos creados en Google Calendar`);
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
    setSyncing(false);
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 26, color: P.text, marginBottom: 4, fontWeight: 800 }}>Planificador de Estudio</h1>
          <p style={{ color: P.textMuted, fontSize: 14 }}>Plan semanal personalizado según tu progreso</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn primary onClick={generate} disabled={loading}>
            {loading ? <Clock size={16} /> : <RefreshCw size={16} />}
            {loading ? "Generando..." : "Regenerar plan"}
          </Btn>
          {data?.days && googleAccessToken && (
            <Btn onClick={syncAllToCalendar} disabled={syncing}>
              <Upload size={16} /> {syncing ? "Sincronizando..." : "Sincronizar todo a Calendar"}
            </Btn>
          )}
        </div>
      </div>

      {/* Share plan */}
      {data?.days && (
        <div style={{ marginBottom: 16 }}>
          <ShareButtons
            title="Plan de estudio semanal"
            text={data.days.map(d => `${d.day}:\n${(d.blocks || []).map(b => `  ${b.time || ""} — ${b.course}: ${b.task || ""}${b.technique ? ` (${b.technique})` : ""}`).join("\n")}`).join("\n\n")}
          />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: 20 }}>
              <div className="shimmer" style={{ height: 20, width: "40%", marginBottom: 16 }} />
              {[1, 2, 3].map((j) => <div key={j} className="shimmer" style={{ height: 60, marginBottom: 8 }} />)}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div className="float" style={{ width: 64, height: 64, borderRadius: 16, background: P.red, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#fff" }}>
            <Calendar size={30} />
          </div>
          <h3 style={{ fontSize: 20, color: P.text, marginBottom: 8, fontFamily: ff.heading, fontWeight: 700 }}>Generá tu plan de estudio</h3>
          <p style={{ color: P.textMuted, fontSize: 14, maxWidth: 420, margin: "0 auto 24px" }}>
            La IA analizará tu progreso en cada materia y creará un plan semanal personalizado.
          </p>
          <Btn primary onClick={generate} style={{ margin: "0 auto" }}>Generar plan semanal</Btn>
        </div>
      )}

      {/* Plan grid */}
      {data?.days && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {data.days.map((day, di) => (
            <div key={di} className="slide-in" style={{ animationDelay: `${di * 0.08}s`, background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${P.borderLight}`, background: P.cream }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: P.red, fontFamily: ff.heading }}>{day.day}</h3>
              </div>
              <div style={{ padding: "8px 12px" }}>
                {day.blocks?.map((block, bi) => {
                  const course = courses.find((c) => block.course && c.fullname.toLowerCase().includes(block.course.toLowerCase())) || courses[bi % courses.length];
                  return (
                    <div
                      key={bi}
                      style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 6, borderLeft: `3px solid ${course?.color || P.red}`, transition: "all 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = P.cream)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: course?.color || P.red }}>{block.time}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => syncToCalendar(block, day.day)} title="Agregar a Calendar"
                            style={{ width: 26, height: 26, borderRadius: 6, background: "#EFF6FF", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
                            <Calendar size={13} />
                          </button>
                          <button onClick={() => sendReminder(block, day.day)} title="Recordatorio por email"
                            style={{ width: 26, height: 26, borderRadius: 6, background: P.redSoft, color: P.red, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
                            <Mail size={13} />
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: P.text, marginBottom: 2 }}>{block.course}</div>
                      <div style={{ fontSize: 12, color: P.textSec }}>{block.task}</div>
                      {block.technique && <div style={{ fontSize: 11, color: P.textMuted, marginTop: 4, fontStyle: "italic" }}>📌 {block.technique}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}