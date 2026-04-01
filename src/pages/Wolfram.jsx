import { useState, useRef } from "react";
import { P, ff } from "../styles/theme";
import { Btn } from "../components/UI";
import { CONFIG } from "../config";
import {
  Calculator, Send, Loader2, Trash2, Clock,
  ArrowRight, Sigma, TrendingUp, PieChart, Atom,
} from "lucide-react";

const WOLFRAM_URL = `${CONFIG.API_BASE}/api/wolfram/query`;

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
      const res = await fetch(WOLFRAM_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question }),
      });
      const data = await res.json();
      if (data.answer) {
        setHistory(h => [...h, { type: "answer", text: data.answer, query: question }]);
      } else {
        setHistory(h => [...h, { type: "error", text: data.error || "No se pudo resolver. Intentá reformular la consulta." }]);
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
      "solve x^2 - 5x + 6 = 0", "derivative of sin(x)*e^x", "integral of x^2 from 0 to 5",
      "limit of (1+1/n)^n as n->infinity", "matrix [[1,2],[3,4]] inverse",
    ]},
    { cat: "Estadística", icon: PieChart, color: "#0891b2", items: [
      "mean of {4, 8, 15, 16, 23, 42}", "standard deviation of {2,4,4,4,5,5,7,9}",
      "normal distribution mean=100 sd=15", "probability of 3 heads in 5 coin flips",
    ]},
    { cat: "Economía", icon: TrendingUp, color: "#059669", items: [
      "compound interest $1000 5% 10 years", "GDP of Argentina",
      "inflation rate Argentina", "present value of $5000 in 3 years at 8%",
    ]},
    { cat: "Ciencias", icon: Atom, color: "#e11d48", items: [
      "speed of light in km/s", "mass of the earth", "distance earth to moon",
      "convert 100 fahrenheit to celsius",
    ]},
  ];

  return (
    <div className="fade-in" style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 30, color: P.text, fontWeight: 800, marginBottom: 6 }}>
          <Calculator size={28} style={{ verticalAlign: "-4px", marginRight: 10, color: P.red }} />
          Wolfram Alpha
        </h1>
        <p style={{ color: P.textMuted, fontSize: 15 }}>
          Resolvé cálculos, ecuaciones, estadísticas y consultas de economía
        </p>
      </div>

      {/* Chat history */}
      <div style={{ minHeight: history.length > 0 ? 200 : 0, marginBottom: 20 }}>
        {history.map((item, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: item.type === "question" ? "flex-end" : "flex-start",
            marginBottom: 10,
          }}>
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
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
            <div style={{ padding: "12px 20px", borderRadius: 14, background: P.card, border: `1px solid ${P.border}` }}>
              <Loader2 size={18} color={P.red} className="spin" />
            </div>
          </div>
        )}
      </div>

      {/* Clear history */}
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
            placeholder="Escribí una consulta: ecuación, cálculo, conversión..."
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 15, color: P.text, padding: "14px 0", fontFamily: ff.body }}
            onFocus={(e) => { e.currentTarget.parentElement.style.borderColor = P.red; }}
            onBlur={(e) => { e.currentTarget.parentElement.style.borderColor = P.border; }}
          />
        </div>
        <Btn primary onClick={handleSubmit} disabled={!query.trim() || loading} style={{ padding: "12px 24px", borderRadius: 14 }}>
          {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </Btn>
      </form>

      {/* Suggestions */}
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
                  <button key={ii} onClick={() => { setQuery(item); doQuery(item); }}
                    className="slide-in" style={{
                      animationDelay: `${(ci * 4 + ii) * 0.03}s`,
                      padding: "8px 14px", borderRadius: 10, fontSize: 13,
                      background: P.card, border: `1px solid ${P.border}`, color: P.text,
                      fontFamily: "'Source Code Pro', monospace",
                      transition: "all 0.2s", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.transform = "none"; }}
                  >
                    {item}
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
