import { useState, useRef, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { chatWithTutor } from "../services/ai";
import { RenderMarkdown } from "../components/UI";
import ShareButtons from "../components/ShareButtons";
import { Sparkles, Send } from "lucide-react";

export default function Chat() {
  const { courses, selectedCourse } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    const context = selectedCourse
      ? `El alumno está consultando sobre la materia "${selectedCourse.fullname}".`
      : `El alumno cursa: ${courses.map((c) => c.fullname).join(", ")}.`;

    const result = await chatWithTutor(msg, context);
    setMessages((prev) => [...prev, { role: "assistant", text: result }]);
    setLoading(false);
  };

  const suggestions = [
    "Explicame qué es la gobernanza de datos",
    "¿Cómo me preparo para el parcial?",
    "Resumen de la última unidad",
    "Técnicas de estudio eficaces",
  ];

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 26, color: P.text, marginBottom: 4, fontWeight: 800 }}>Tutor IA</h1>
        <p style={{ color: P.textMuted, fontSize: 14 }}>
          {selectedCourse ? `Consultando sobre ${selectedCourse.fullname}` : "Preguntame sobre cualquier materia"}
        </p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", marginBottom: 16, paddingRight: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div className="float" style={{ width: 68, height: 68, borderRadius: 18, background: P.red, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#fff" }}>
              <Sparkles size={32} />
            </div>
            <h3 style={{ fontSize: 20, color: P.text, marginBottom: 8, fontWeight: 700, fontFamily: ff.heading }}>¿En qué puedo ayudarte?</h3>
            <p style={{ color: P.textMuted, fontSize: 14, maxWidth: 420, margin: "0 auto 24px", lineHeight: 1.6 }}>
              Puedo explicarte conceptos, ayudarte a repasar, sugerirte técnicas de estudio o resolver tus dudas académicas.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {suggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  style={{ padding: "8px 14px", borderRadius: 20, background: P.redSoft, color: P.red, fontSize: 13, fontWeight: 500, transition: "all 0.15s", border: "none" }}
                  onMouseEnter={(e) => { e.target.style.background = P.redMuted; e.target.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.target.style.background = P.redSoft; e.target.style.color = P.red; }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="fade-in" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div
              style={{
                maxWidth: "75%", padding: "12px 16px",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: msg.role === "user" ? P.red : P.card,
                color: msg.role === "user" ? "#fff" : P.text,
                fontSize: 14, lineHeight: 1.65,
                border: msg.role === "user" ? "none" : `1px solid ${P.border}`,
                boxShadow: msg.role === "user" ? "0 2px 10px rgba(183,28,28,0.2)" : "0 1px 4px rgba(0,0,0,0.03)",
              }}
            >
              {msg.role === "assistant" ? <>
                <RenderMarkdown text={msg.text} />
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${P.borderLight}` }}>
                  <ShareButtons text={msg.text} title="Respuesta del Tutor IA" compact />
                </div>
              </> : msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 6, padding: "12px 16px" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: P.redMuted, animation: "pulse 1s infinite", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 10, padding: "12px 0" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Escribí tu pregunta..."
          style={{ flex: 1, padding: "14px 18px", borderRadius: 14, border: `1px solid ${P.border}`, fontSize: 14, outline: "none", background: P.card, transition: "border-color 0.2s" }}
          onFocus={(e) => (e.target.style.borderColor = P.redMuted)}
          onBlur={(e) => (e.target.style.borderColor = P.border)}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{ width: 48, height: 48, borderRadius: 14, background: input.trim() ? P.red : P.border, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}