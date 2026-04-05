import { useState, useEffect, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { zonaScrape, zonaLiquidacion } from "../services/zona";
import {
  Clock, Loader2, RefreshCw, AlertCircle, Building2, BookOpen,
  Briefcase, ChevronDown,
} from "lucide-react";

// ─── HTML Parsing ────────────────────────────────────────────────

function parseIdPersona(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const input = doc.querySelector("input#idPersona") || doc.querySelector('input[name="idPersona"]');
  return input ? input.value : null;
}

function parsePeriodos(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const select = doc.querySelector("select#filtro");
  if (!select) return [];
  const periodos = [];
  select.querySelectorAll("option").forEach(opt => {
    const valor = opt.value;
    if (valor && valor !== "0") periodos.push({ id: valor, texto: opt.textContent.trim() });
  });
  return periodos;
}

function parseLiquidacionHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const table = doc.querySelector("table.table");
  const items = [];
  let totalHoras = 0;
  if (table) {
    table.querySelectorAll("tr.Datos").forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 5) {
        const horasStr = cols[4].textContent.trim().replace(",", ".");
        const horas = parseFloat(horasStr) || 0;
        items.push({
          sede: cols[0].textContent.trim(), facultad: cols[1].textContent.trim(),
          tipo: cols[2].textContent.trim(), cargo: cols[3].textContent.trim(), horas,
        });
        totalHoras += horas;
      }
    });
  }
  // Group by tipo
  const porTipo = {};
  items.forEach(item => { porTipo[item.tipo] = (porTipo[item.tipo] || 0) + item.horas; });
  // Group by facultad
  const porFacultad = {};
  items.forEach(item => { porFacultad[item.facultad] = (porFacultad[item.facultad] || 0) + item.horas; });

  return { items, total_horas: Math.round(totalHoras * 100) / 100, porTipo, porFacultad };
}

const TIPO_COLORS = {
  "Hora cátedra": "#6366f1", "Hora distancia": "#10b981", "Hora final": "#f59e0b",
  "Hora feriado": "#ef4444", "Viático": "#8b5cf6", "default": "#2E86C1",
};
function getTipoColor(tipo) {
  return TIPO_COLORS[tipo] || TIPO_COLORS.default;
}

// ─── Component ───────────────────────────────────────────────────

export default function LiquidacionPage() {
  const { zonaSession } = useApp();
  const [periodos, setPeriodos] = useState([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState(null);
  const [idPersona, setIdPersona] = useState(null);
  const [liquidacion, setLiquidacion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingLiq, setLoadingLiq] = useState(false);
  const [error, setError] = useState(null);

  // Load periods on mount
  const fetchPeriodos = useCallback(async () => {
    if (!zonaSession) { setError("Zona Interactiva no está vinculada. Vinculala desde Ajustes."); return; }
    setLoading(true); setError(null);
    try {
      const data = await zonaScrape(zonaSession, "bGlxdWlkYWNpb25lcw==");
      const id = parseIdPersona(data.html);
      const pers = parsePeriodos(data.html);
      setIdPersona(id);
      setPeriodos(pers);
      // Auto-select last period
      if (pers.length > 0) setSelectedPeriodo(pers[pers.length - 1].id);
    } catch (err) {
      setError(err.message || "Error al obtener períodos");
    } finally { setLoading(false); }
  }, [zonaSession]);

  useEffect(() => { fetchPeriodos(); }, [fetchPeriodos]);

  // Load liquidacion when period changes
  useEffect(() => {
    if (!selectedPeriodo || !idPersona || !zonaSession) return;
    let cancelled = false;
    setLoadingLiq(true);
    setLiquidacion(null);

    zonaLiquidacion(zonaSession, selectedPeriodo, idPersona).then(data => {
      if (cancelled) return;
      const parsed = parseLiquidacionHTML(data.html);
      setLiquidacion(parsed);
      setLoadingLiq(false);
    }).catch(err => {
      if (!cancelled) { setError(err.message); setLoadingLiq(false); }
    });

    return () => { cancelled = true; };
  }, [selectedPeriodo, idPersona, zonaSession]);

  const maxTipoHoras = liquidacion ? Math.max(...Object.values(liquidacion.porTipo), 1) : 1;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 26, fontWeight: 700, color: P.text, marginBottom: 6 }}>Liquidación</h1>
          <p style={{ color: P.textMuted, fontSize: 14 }}>Horas liquidadas por período</p>
        </div>
        <button onClick={fetchPeriodos} disabled={loading}
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
          <p style={{ color: P.textMuted, fontSize: 13, marginTop: 12 }}>Cargando períodos...</p>
        </div>
      ) : periodos.length > 0 && (
        <>
          {/* Period selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, display: "block" }}>Período</label>
            <select value={selectedPeriodo || ""} onChange={e => setSelectedPeriodo(e.target.value)}
              style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontSize: 14, minWidth: 250 }}>
              {periodos.map(p => <option key={p.id} value={p.id}>{p.texto}</option>)}
            </select>
          </div>

          {loadingLiq ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Loader2 size={24} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
            </div>
          ) : liquidacion && (
            <>
              {/* Total hours card */}
              <div style={{ background: P.card, borderRadius: 16, padding: "24px", border: `1px solid ${P.border}`, marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total de horas</div>
                <div style={{ fontSize: 42, fontWeight: 800, color: P.primary }}>{liquidacion.total_horas}</div>
              </div>

              {/* Hours by tipo */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: P.card, borderRadius: 14, padding: 20, border: `1px solid ${P.border}` }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: P.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <Briefcase size={16} style={{ color: P.primary }} /> Por tipo
                  </h3>
                  {Object.entries(liquidacion.porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, horas]) => (
                    <div key={tipo} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: P.textSec }}>{tipo}</span>
                        <span style={{ fontWeight: 600, color: getTipoColor(tipo) }}>{horas}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: P.borderLight, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, width: `${(horas / maxTipoHoras) * 100}%`, background: getTipoColor(tipo), transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background: P.card, borderRadius: 14, padding: 20, border: `1px solid ${P.border}` }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: P.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <Building2 size={16} style={{ color: P.primary }} /> Por facultad
                  </h3>
                  {Object.entries(liquidacion.porFacultad).sort((a, b) => b[1] - a[1]).map(([fac, horas]) => (
                    <div key={fac} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: `1px solid ${P.borderLight}` }}>
                      <span style={{ color: P.textSec }}>{fac}</span>
                      <span style={{ fontWeight: 600, color: P.text }}>{horas}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail table */}
              {liquidacion.items.length > 0 && (
                <div style={{ background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, overflow: "hidden" }}>
                  <div style={{ maxHeight: 400, overflow: "auto" }}>
                    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: P.cream }}>
                          {["Sede", "Facultad", "Tipo", "Cargo", "Horas"].map(h => (
                            <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: P.textSec, fontSize: 12, borderBottom: `1px solid ${P.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {liquidacion.items.map((item, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${P.borderLight}` }}>
                            <td style={{ padding: "10px 14px", color: P.textMuted }}>{item.sede}</td>
                            <td style={{ padding: "10px 14px", color: P.text, fontWeight: 500 }}>{item.facultad}</td>
                            <td style={{ padding: "10px 14px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: getTipoColor(item.tipo) + "15", color: getTipoColor(item.tipo) }}>{item.tipo}</span>
                            </td>
                            <td style={{ padding: "10px 14px", color: P.textSec }}>{item.cargo}</td>
                            <td style={{ padding: "10px 14px", fontWeight: 700, color: P.primary }}>{item.horas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {liquidacion.items.length === 0 && (
                <div style={{ background: P.card, borderRadius: 16, padding: "40px 32px", textAlign: "center", border: `1px solid ${P.border}` }}>
                  <p style={{ color: P.textMuted, fontSize: 14 }}>No hay datos de liquidación para este período</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}