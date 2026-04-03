import { useState, useRef } from "react";
import { P, ff } from "../styles/theme";
import { Btn } from "../components/UI";
import ShareButtons from "../components/ShareButtons";
import { CONFIG } from "../config";
import {
  Calculator, Send, Loader2, Trash2,
  Sigma, TrendingUp, PieChart, Atom,
} from "lucide-react";

const WOLFRAM_URL = `${CONFIG.API_BASE}/api/wolfram/query`;
const AI_URL = `${CONFIG.API_BASE}/api/ai`;

async function translateToEnglish(text) {
  try {
    const res = await fetch(AI_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Traducí esta consulta matemática/científica al inglés para Wolfram Alpha. Devolvé SOLO la traducción, sin explicaciones ni comillas:\n\n${text}`,
        systemPrompt: "Sos un traductor técnico. Traducí consultas matemáticas y científicas del español al inglés de forma precisa. Si la consulta ya está en inglés o es una fórmula/ecuación, devolvela tal cual. Respondé SOLO con la traducción.",
      }),
    });
    const data = await res.json();
    return data.response?.trim() || text;
  } catch { return text; }
}

async function translateToSpanish(text) {
  if (!text || /^[\d.,\s+\-*/^()=<>%$€£¥°]+$/.test(text.trim())) return text;
  try {
    const res = await fetch(AI_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Traducí esta respuesta de Wolfram Alpha al español. Devolvé SOLO la traducción, sin explicaciones. Si es un número o fórmula, devolvelo tal cual:\n\n${text}`,
        systemPrompt: "Sos un traductor técnico. Traducí respuestas científicas del inglés al español. Si la respuesta es un número, fórmula, o dato que no necesita traducción, devolvelo tal cual. Respondé SOLO con la traducción.",
      }),
    });
    const data = await res.json();
    return data.response?.trim() || text;
  } catch { return text; }
}

export default function Wolfram() {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const doQuery = async (q) => {
    if (!q.trim()) return;
    const question = q.trim();
    setQuery(""); setLoading(true);
    setHistory(h => [...h, { type: "question", text: question }]);

    try {
      // 1. Translate to English
      const englishQuery = await translateToEnglish(question);

      // 2. Query Wolfram
      const res = await fetch(WOLFRAM_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: englishQuery }),
      });
      const data = await res.json();

      if (data.answer) {
        // 3. Translate response to Spanish
        const spanishAnswer = await translateToSpanish(data.answer);
        setHistory(h => [...h, { type: "answer", text: spanishAnswer, original: data.answer }]);
      } else {
        setHistory(h => [...h, { type: "error", text: "No se pudo resolver. Intentá reformulando la consulta." }]);
      }
    } catch (err) {
      setHistory(h => [...h, { type: "error", text: "Error de conexión. Intentá de nuevo." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); doQuery(query); };

  const suggestions = [
    { cat: "Matemática", icon: Sigma, color: "#7c3aed", items: [
      { es: "Resolver x² - 5x + 6 = 0", en: "solve x^2 - 5x + 6 = 0" },
      { es: "Derivada de sen(x)·eˣ", en: "derivative of sin(x)*e^x" },
      { es: "Integral de x² de 0 a 5", en: "integral of x^2 from 0 to 5" },
      { es: "Límite de (1+1/n)^n cuando n→∞", en: "limit of (1+1/n)^n as n->infinity" },
      { es: "Inversa de la matriz [[1,2],[3,4]]", en: "matrix [[1,2],[3,4]] inverse" },
    ]},
    { cat: "Estadística", icon: PieChart, color: "#0891b2", items: [
      { es: "Media de {4, 8, 15, 16, 23, 42}", en: "mean of {4, 8, 15, 16, 23, 42}" },
      { es: "Desvío estándar de {2,4,4,4,5,5,7,9}", en: "standard deviation of {2,4,4,4,5,5,7,9}" },
      { es: "Distribución normal media=100 sd=15", en: "normal distribution mean=100 sd=15" },
      { es: "Probabilidad de 3 caras en 5 lanzamientos", en: "probability of 3 heads in 5 coin flips" },
    ]},
    { cat: "Economía", icon: TrendingUp, color: "#059669", items: [
      { es: "Interés compuesto $1000 al 5% por 10 años", en: "compound interest $1000 5% 10 years" },
      { es: "PBI de Argentina", en: "GDP of Argentina" },
      { es: "Inflación Argentina", en: "inflation rate Argentina" },
      { es: "Valor presente de $5000 en 3 años al 8%", en: "present value of $5000 in 3 years at 8%" },
    ]},
    { cat: "Ciencias y conversiones", icon: Atom, color: "#e11d48", items: [
      { es: "Velocidad de la luz en km/s", en: "speed of light in km/s" },
      { es: "Masa de la Tierra", en: "mass of the earth" },
      { es: "Convertir 100 Fahrenheit a Celsius", en: "convert 100 fahrenheit to celsius" },
      { es: "Distancia Tierra a Luna", en: "distance earth to moon" },
    ]},
  ];

  return (
    <div className="fade-in" style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 30, color: P.text, fontWeight: 800, marginBottom: 6 }}>
          <Calculator size={28} style={{ verticalAlign: "-4px", marginRight: 10, color: P.red }} />
          Calculadora Wolfram
        </h1>
        <p style={{ color: P.textMuted, fontSize: 15 }}>
          Resolvé cálculos, ecuaciones, estadísticas y consultas — escribí en español
        </p>
      </div>

      {/* Chat history */}
      <div style={{ minHeight: history.length > 0 ? 200 : 0, marginBottom: 20 }}>
        {history.map((item, i) => (
          <div key={i} style={{ display: "flex", justifyContent: item.type === "question" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div style={{
              maxWidth: "85%", padding: "12px 16px", borderRadius: 14,
              background: item.type === "question" ? P.red : item.type === "error" ? "#FEF2F2" : P.card,
              color: item.type === "question" ? "#fff" : item.type === "error" ? "#DC2626" : P.text,
              border: item.type === "answer" ? `1px solid ${P.border}` : "none",
              fontSize: 14, lineHeight: 1.6,
              ...(item.type === "answer" ? { fontFamily: "'Source Code Pro', monospace", fontSize: 16, fontWeight: 600 } : {}),
            }}>
              {item.type === "answer" && (
                <div style={{ fontSize: 10, color: P.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, fontFamily: ff.body }}>
                  Wolfram Alpha
                </div>
              )}
              {item.text}
              {item.original && item.original !== item.text && (
                <div style={{ fontSize: 11, color: P.textMuted, marginTop: 6, fontFamily: ff.body, fontWeight: 400 }}>
                  Original: {item.original}
                </div>
              )}
              {item.type === "answer" && (
                <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${P.borderLight}` }}>
                  <ShareButtons text={`${item.query || ""}\n→ ${item.text}`} title="Cálculo Wolfram Alpha" compact />
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
            <div style={{ padding: "12px 20px", borderRadius: 14, background: P.card, border: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 8, color: P.textMuted, fontSize: 13 }}>
              <Loader2 size={18} color={P.red} className="spin" /> Consultando Wolfram Alpha...
            </div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div style={{ textAlign: "right", marginBottom: 10 }}>
          <button onClick={() => setHistory([])} style={{ fontSize: 12, color: P.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#DC2626"; }} onMouseLeave={(e) => { e.currentTarget.style.color = P.textMuted; }}>
            <Trash2 size={12} /> Limpiar historial
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 10,
          background: P.card, border: `2px solid ${P.border}`, borderRadius: 14, padding: "0 16px",
          transition: "border-color 0.2s",
        }}>
          <Calculator size={18} color={P.textMuted} />
          <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribí en español: ecuación, cálculo, conversión..."
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, color: P.text, padding: "14px 0", fontFamily: ff.body }}
            onFocus={(e) => { e.currentTarget.parentElement.style.borderColor = P.red; }}
            onBlur={(e) => { e.currentTarget.parentElement.style.borderColor = P.border; }}
          />
        </div>
        <Btn primary onClick={handleSubmit} disabled={!query.trim() || loading} style={{ padding: "12px 24px", borderRadius: 14 }}>
          {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </Btn>
      </form>

      {/* Suggestions in Spanish */}
      {history.length === 0 && (
        <div>
          {suggestions.map((cat, ci) => (
            <div key={ci} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <cat.icon size={16} color={cat.color} />
                <span style={{ fontSize: 13, fontWeight: 700, color: cat.color, textTransform: "uppercase", letterSpacing: 0.8 }}>{cat.cat}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {cat.items.map((item, ii) => (
                  <button key={ii} onClick={() => { setQuery(item.es); doQuery(item.es); }}
                    className="slide-in" style={{
                      animationDelay: `${(ci * 5 + ii) * 0.03}s`,
                      padding: "8px 14px", borderRadius: 10, fontSize: 13,
                      background: P.card, border: `1px solid ${P.border}`, color: P.text,
                      transition: "all 0.2s", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.transform = "none"; }}
                  >
                    {item.es}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <a href="https://www.wolframalpha.com/" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: P.textMuted, textDecoration: "none" }}>
              Powered by Wolfram|Alpha
            </a>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}