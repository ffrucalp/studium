import { useState, useEffect, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { zonaScrape } from "../services/zona";
import {
  Calendar, Loader2, Users, Clock, ChevronDown, ChevronRight,
  Filter, RefreshCw, AlertCircle, User, BookOpen,
} from "lucide-react";

// ─── HTML Parsing (ported from Chrome extension scraper.js) ──────

function parseFecha(fechaStr) {
  const fmts = [
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})$/, order: [3, 2, 1] },
    { regex: /^(\d{2})-(\d{2})-(\d{4})$/, order: [3, 2, 1] },
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, order: [1, 2, 3] },
    { regex: /^(\d{2})\/(\d{2})\/(\d{2})$/, order: [3, 2, 1], shortYear: true },
  ];
  for (const fmt of fmts) {
    const match = fechaStr.trim().match(fmt.regex);
    if (match) {
      const parts = [match[1], match[2], match[3]];
      let year = parts[fmt.order[0] - 1];
      const month = parts[fmt.order[1] - 1];
      const day = parts[fmt.order[2] - 1];
      if (fmt.shortYear) year = "20" + year;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  return fechaStr;
}

function parseExamenesHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const examenes = [];
  doc.querySelectorAll("table.table").forEach(table => {
    const rows = table.querySelectorAll("tr");
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].querySelectorAll("td");
      if (cols.length >= 4) {
        let idFinal = "";
        const link = rows[i].querySelector("a.btn-info");
        if (link) {
          const href = link.getAttribute("href") || "";
          if (href.includes("id_final=")) idFinal = href.split("id_final=").pop();
        }
        const fechaStr = cols[0].textContent.trim();
        examenes.push({
          fecha: fechaStr, hora: cols[1].textContent.trim(),
          materia: cols[2].textContent.trim(), facultad: cols[3].textContent.trim(),
          id_final: idFinal, inscriptos: 0, alumnos: [],
          fecha_iso: parseFecha(fechaStr),
        });
      }
    }
  });
  return examenes;
}

function parseInscriptosHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table.table");
  const alumnos = [];
  if (table) {
    const thead = table.querySelector("thead");
    const allRows = Array.from(table.querySelectorAll("tr"));
    const dataRows = thead
      ? allRows.filter(r => !Array.from(thead.querySelectorAll("tr")).includes(r))
      : allRows.slice(1);
    dataRows.forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 4) {
        alumnos.push({
          numero: cols[0].textContent.trim(), legajo: cols[1].textContent.trim(),
          nombre: cols[2].textContent.trim(), documento: cols[3].textContent.trim(),
          cursada: cols[4]?.textContent.trim() || "", comision: cols[5]?.textContent.trim() || "",
        });
      }
    });
  }
  return alumnos;
}

const FAC_COLORS = {
  "HUMANIDADES": "#6366f1", "CIENCIAS ECONÓMICAS Y SOCIALES": "#10b981",
  "CIENCIAS EXACTAS E INGENIERÍA": "#f59e0b", "ODONTOLOGIA": "#ef4444",
  "RECTORADO": "#8b5cf6", "default": "#0077b6",
};
function getFacColor(fac) {
  const f = (fac || "").toUpperCase();
  for (const [k, c] of Object.entries(FAC_COLORS)) {
    if (k !== "default" && f.includes(k)) return c;
  }
  return FAC_COLORS.default;
}

// ─── Component ───────────────────────────────────────────────────

export default function FinalesPage() {
  const { zonaSession } = useApp();
  const [examenes, setExamenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingInscriptos, setLoadingInscriptos] = useState(false);
  const [error, setError] = useState(null);
  const [facFilter, setFacFilter] = useState("");
  const [expanded, setExpanded] = useState(null);

  const fetchExamenes = useCallback(async () => {
    if (!zonaSession) { setError("Zona Interactiva no está vinculada. Vinculala desde Ajustes."); return; }
    setLoading(true); setError(null);
    try {
      // Fetch all exams (filtro=T)
      const data = await zonaScrape(zonaSession, "cHJvZl9jb25zdWx0YUZpbmFs", { filtro: "T" });
      let parsed = parseExamenesHTML(data.html);
      // Filter future only
      const hoy = new Date().toISOString().split("T")[0];
      parsed = parsed.filter(e => (e.fecha_iso || "") >= hoy);
      parsed.sort((a, b) => (a.fecha_iso || "9999").localeCompare(b.fecha_iso || "9999"));
      setExamenes(parsed);

      // Fetch inscriptos in batches
      if (parsed.length > 0) {
        setLoadingInscriptos(true);
        const updated = [...parsed];
        for (let i = 0; i < updated.length; i += 5) {
          const batch = updated.slice(i, i + 5);
          const results = await Promise.all(
            batch.map(async (e) => {
              if (!e.id_final) return { cantidad: 0, alumnos: [] };
              try {
                const d = await zonaScrape(zonaSession, "cHJvZl9jb25zdWx0YUZpbmFsMg==", { id_final: e.id_final });
                const alumnos = parseInscriptosHTML(d.html);
                return { cantidad: alumnos.length, alumnos };
              } catch { return { cantidad: 0, alumnos: [] }; }
            })
          );
          results.forEach((res, j) => {
            updated[i + j].inscriptos = res.cantidad;
            updated[i + j].alumnos = res.alumnos;
          });
          setExamenes([...updated]);
        }
        setLoadingInscriptos(false);
      }
    } catch (err) {
      setError(err.message || "Error al obtener exámenes");
    } finally { setLoading(false); }
  }, [zonaSession]);

  useEffect(() => { fetchExamenes(); }, [fetchExamenes]);

  const filtered = facFilter ? examenes.filter(e => e.facultad === facFilter) : examenes;
  const facultades = [...new Set(examenes.map(e => e.facultad).filter(Boolean))];
  const totalInscriptos = examenes.reduce((s, e) => s + (e.inscriptos || 0), 0);
  const materias = new Set(examenes.map(e => e.materia?.toUpperCase()));

  const diasAlProximo = examenes.length > 0 ? (() => {
    try {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      return Math.ceil((new Date(examenes[0].fecha_iso + "T00:00:00") - hoy) / 86400000);
    } catch { return "-"; }
  })() : "-";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 26, fontWeight: 700, color: P.text, marginBottom: 6 }}>Mesas de Finales</h1>
          <p style={{ color: P.textMuted, fontSize: 14 }}>Próximas mesas de examen e inscriptos</p>
        </div>
        <button onClick={fetchExamenes} disabled={loading}
          style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: P.card, color: P.textSec, border: `1px solid ${P.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} /> Actualizar
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#D9770615", border: "1px solid #D9770630", color: "#D97706", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Loader2 size={28} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
          <p style={{ color: P.textMuted, fontSize: 13, marginTop: 12 }}>Obteniendo mesas de finales...</p>
        </div>
      ) : examenes.length > 0 && (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Mesas", value: filtered.length, color: "#2E86C1" },
              { label: "Días al próximo", value: diasAlProximo, color: "#D97706" },
              { label: "Materias", value: materias.size, color: "#7c3aed" },
              { label: "Inscriptos", value: loadingInscriptos ? "..." : totalInscriptos, color: "#059669" },
            ].map((s, i) => (
              <div key={i} style={{ background: P.card, borderRadius: 12, padding: "14px 16px", border: `1px solid ${P.border}` }}>
                <div style={{ fontSize: 11, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Filter */}
          {facultades.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <select value={facFilter} onChange={e => setFacFilter(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontSize: 13 }}>
                <option value="">Todas las facultades</option>
                {facultades.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {/* Exam list */}
          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
            {filtered.map((exam, i) => {
              const color = getFacColor(exam.facultad);
              const isExpanded = expanded === i;
              return (
                <div key={i}>
                  <div
                    onClick={() => setExpanded(isExpanded ? null : i)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                      borderBottom: (!isExpanded && i < filtered.length - 1) ? `1px solid ${P.borderLight}` : "none",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = P.borderLight}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 4, height: 40, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{exam.materia}</div>
                      <div style={{ fontSize: 12, color: P.textMuted, display: "flex", gap: 12, marginTop: 2 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> {exam.fecha}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {exam.hora}</span>
                        <span style={{ color: color, fontSize: 11 }}>{exam.facultad}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                        background: exam.inscriptos > 0 ? "#05966915" : P.borderLight,
                        color: exam.inscriptos > 0 ? "#059669" : P.textMuted,
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <Users size={13} /> {loadingInscriptos && !exam.alumnos?.length ? "..." : exam.inscriptos}
                      </span>
                      {isExpanded ? <ChevronDown size={14} style={{ color: P.textMuted }} /> : <ChevronRight size={14} style={{ color: P.textMuted }} />}
                    </div>
                  </div>
                  {isExpanded && exam.alumnos?.length > 0 && (
                    <div style={{ padding: "0 20px 16px 38px", borderBottom: i < filtered.length - 1 ? `1px solid ${P.borderLight}` : "none" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: P.textSec, marginBottom: 8 }}>Inscriptos ({exam.alumnos.length})</div>
                      {exam.alumnos.map((a, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 13 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: P.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <User size={12} style={{ color: P.primary }} />
                          </div>
                          <span style={{ flex: 1, color: P.text }}>{a.nombre}</span>
                          <span style={{ color: P.textMuted, fontSize: 11 }}>Leg. {a.legajo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {isExpanded && exam.inscriptos === 0 && (
                    <div style={{ padding: "0 20px 16px 38px", borderBottom: i < filtered.length - 1 ? `1px solid ${P.borderLight}` : "none" }}>
                      <p style={{ fontSize: 13, color: P.textMuted, fontStyle: "italic" }}>Sin inscriptos</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && examenes.length === 0 && !error && (
        <div style={{ background: P.card, borderRadius: 16, padding: "60px 32px", textAlign: "center", border: `1px solid ${P.border}` }}>
          <Calendar size={48} style={{ color: P.textMuted, marginBottom: 16 }} />
          <p style={{ color: P.textMuted, fontSize: 15 }}>No hay mesas de finales próximas</p>
        </div>
      )}
    </div>
  );
}