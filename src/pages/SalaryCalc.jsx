import { useState, useEffect, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { zonaScrape, zonaLiquidacion } from "../services/zona";
import {
  DollarSign, Loader2, RefreshCw, AlertCircle, Calculator,
  TrendingUp, Clock, Award, Info, ExternalLink,
} from "lucide-react";

// ─── Remote salary values (from GitHub) ──────────────────────────

const VALORES_URL = "https://raw.githubusercontent.com/franfr007/ucalp-valores/main/valores.json";

let VALORES_HORA = {
  "TITULAR": 10126, "TITULAR INTERINO": 10126, "ADJUNTO A CARGO": 10126,
  "ASOCIADO": 7719, "ASOCIADO INTERINO": 7719,
  "ADJUNTO": 6391, "ADJUNTO INTERINO": 6391, "JTP": 4980,
};
let BONIF_CARGA = [
  { min: 0, max: 23, pct: 0 }, { min: 24, max: 32, pct: 0.10 }, { min: 33, max: 9999, pct: 0.15 },
];
let BONIF_ANTIGUEDAD = [
  { min: 1, max: 5, pct: 0.12 }, { min: 6, max: 10, pct: 0.15 },
  { min: 11, max: 15, pct: 0.20 }, { min: 16, max: 20, pct: 0.31 }, { min: 21, max: 99, pct: 0.43 },
];

function getValorHora(cargo) {
  const c = (cargo || "").toUpperCase().trim();
  for (const [key, valor] of Object.entries(VALORES_HORA)) {
    if (c.includes(key) || key.includes(c)) return valor;
  }
  if (c.includes("TITULAR")) return VALORES_HORA["TITULAR"];
  if (c.includes("A CARGO")) return VALORES_HORA["ADJUNTO A CARGO"];
  if (c.includes("ASOCIADO")) return VALORES_HORA["ASOCIADO"];
  if (c.includes("ADJUNTO")) return VALORES_HORA["ADJUNTO"];
  if (c.includes("JTP")) return VALORES_HORA["JTP"];
  return VALORES_HORA["ADJUNTO"];
}

function getBonifCarga(totalHoras) {
  for (const b of BONIF_CARGA) { if (totalHoras >= b.min && totalHoras <= b.max) return b.pct; }
  return 0;
}

function getBonifAntiguedad(anios) {
  for (const b of BONIF_ANTIGUEDAD) { if (anios >= b.min && anios <= b.max) return b.pct; }
  return 0;
}

function calcularSalario(items, aniosAntiguedad = 0) {
  const porCargo = {};
  let totalHoras = 0;
  for (const item of items) {
    const cargo = item.cargo;
    const horas = item.horas;
    const valor = getValorHora(cargo);
    if (!porCargo[cargo]) porCargo[cargo] = { horas: 0, valor_hora: valor, subtotal: 0 };
    porCargo[cargo].horas += horas;
    porCargo[cargo].subtotal += horas * valor;
    totalHoras += horas;
  }
  const subtotal = Object.values(porCargo).reduce((sum, c) => sum + c.subtotal, 0);
  const bonifCargaPct = getBonifCarga(totalHoras);
  const bonifAntiguedadPct = aniosAntiguedad > 0 ? getBonifAntiguedad(aniosAntiguedad) : 0;
  const bonifCarga = subtotal * bonifCargaPct;
  const bonifAntiguedad = subtotal * bonifAntiguedadPct;
  const total = subtotal + bonifCarga + bonifAntiguedad;
  return { porCargo, totalHoras, subtotal, bonifCargaPct, bonifCarga, bonifAntiguedadPct, bonifAntiguedad, total };
}

function formatMoney(n) { return "$" + Math.round(n).toLocaleString("es-AR"); }

// ─── HTML Parsing (same as Liquidacion page) ─────────────────────

function parseIdPersona(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const input = doc.querySelector("input#idPersona") || doc.querySelector('input[name="idPersona"]');
  return input ? input.value : null;
}

function parsePeriodos(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const select = doc.querySelector("select#filtro");
  if (!select) return [];
  const periodos = [];
  select.querySelectorAll("option").forEach(opt => {
    if (opt.value && opt.value !== "0") periodos.push({ id: opt.value, texto: opt.textContent.trim() });
  });
  return periodos;
}

function parseLiquidacionHTML(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table.table");
  const items = [];
  if (table) {
    table.querySelectorAll("tr.Datos").forEach(row => {
      const cols = row.querySelectorAll("td");
      if (cols.length >= 5) {
        items.push({
          sede: cols[0].textContent.trim(), facultad: cols[1].textContent.trim(),
          tipo: cols[2].textContent.trim(), cargo: cols[3].textContent.trim(),
          horas: parseFloat(cols[4].textContent.trim().replace(",", ".")) || 0,
        });
      }
    });
  }
  return items;
}

// ─── Component ───────────────────────────────────────────────────

export default function SalaryCalcPage() {
  const { zonaSession, teacherAntiguedad, setTeacherAntiguedad } = useApp();
  const [periodos, setPeriodos] = useState([]);
  const [selectedPeriodo, setSelectedPeriodo] = useState(null);
  const [idPersona, setIdPersona] = useState(null);
  const [items, setItems] = useState([]);
  const anios = teacherAntiguedad || 0;
  const [loading, setLoading] = useState(false);
  const [loadingLiq, setLoadingLiq] = useState(false);
  const [valoresVersion, setValoresVersion] = useState("local");
  const [error, setError] = useState(null);
  const [salary, setSalary] = useState(null);

  // Load remote values on mount
  useEffect(() => {
    fetch(VALORES_URL, { cache: "no-cache" }).then(r => r.json()).then(data => {
      if (data.valores_hora) VALORES_HORA = data.valores_hora;
      if (data.bonif_carga) BONIF_CARGA = data.bonif_carga;
      if (data.bonif_antiguedad) BONIF_ANTIGUEDAD = data.bonif_antiguedad;
      setValoresVersion(data.fecha_actualizacion || "remoto");
      // Recalculate if we already have items
      if (items.length > 0) setSalary(calcularSalario(items, anios));
    }).catch(() => setValoresVersion("local (sin conexión)"));
  }, []);

  // Load periods
  const fetchPeriodos = useCallback(async () => {
    if (!zonaSession) { setError("Zona Interactiva no está vinculada."); return; }
    setLoading(true); setError(null);
    try {
      const data = await zonaScrape(zonaSession, "bGlxdWlkYWNpb25lcw==");
      setIdPersona(parseIdPersona(data.html));
      const pers = parsePeriodos(data.html);
      setPeriodos(pers);
      if (pers.length > 0) setSelectedPeriodo(pers[pers.length - 1].id);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [zonaSession]);

  useEffect(() => { fetchPeriodos(); }, [fetchPeriodos]);

  // Load liquidacion when period changes
  useEffect(() => {
    if (!selectedPeriodo || !idPersona || !zonaSession) return;
    let cancelled = false;
    setLoadingLiq(true); setItems([]); setSalary(null);

    zonaLiquidacion(zonaSession, selectedPeriodo, idPersona).then(data => {
      if (cancelled) return;
      const parsed = parseLiquidacionHTML(data.html);
      setItems(parsed);
      if (parsed.length > 0) setSalary(calcularSalario(parsed, anios));
      setLoadingLiq(false);
    }).catch(() => { if (!cancelled) setLoadingLiq(false); });

    return () => { cancelled = true; };
  }, [selectedPeriodo, idPersona, zonaSession]);

  // Recalculate when anios changes
  useEffect(() => {
    if (items.length > 0) setSalary(calcularSalario(items, anios));
  }, [anios, items]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 26, fontWeight: 700, color: P.text, marginBottom: 6 }}>Cálculo Salarial</h1>
          <p style={{ color: P.textMuted, fontSize: 14 }}>Estimación de haberes basada en horas liquidadas</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#D9770615", border: "1px solid #D9770630", color: "#D97706", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Loader2 size={28} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
        </div>
      ) : periodos.length > 0 && (
        <>
          {/* Controls */}
          <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>Período</label>
              <select value={selectedPeriodo || ""} onChange={e => setSelectedPeriodo(e.target.value)}
                style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontSize: 14, minWidth: 220 }}>
                {periodos.map(p => <option key={p.id} value={p.id}>{p.texto}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>Antigüedad (años)</label>
              <input type="number" min="0" max="50" value={anios} onChange={e => setTeacherAntiguedad(parseInt(e.target.value) || 0)}
                style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontSize: 14, width: 100 }} />
            </div>
            <div style={{ fontSize: 11, color: P.textMuted, padding: "10px 0", display: "flex", alignItems: "center", gap: 4 }}>
              <Info size={12} /> Valores: {valoresVersion} · La antigüedad se guarda en Ajustes
            </div>
          </div>

          {loadingLiq ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Loader2 size={24} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
            </div>
          ) : salary ? (
            <>
              {/* Total salary card */}
              <div style={{ background: `linear-gradient(135deg, ${P.primary}, #2E86C1)`, borderRadius: 20, padding: "32px", marginBottom: 20, color: "#fff", textAlign: "center" }}>
                <div style={{ fontSize: 12, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Estimación de haberes</div>
                <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1 }}>{formatMoney(salary.total)}</div>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
                  {salary.totalHoras} horas · {Object.keys(salary.porCargo).length} cargo{Object.keys(salary.porCargo).length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                {/* By cargo */}
                <div style={{ background: P.card, borderRadius: 14, padding: 20, border: `1px solid ${P.border}` }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: P.text, marginBottom: 16 }}>Desglose por cargo</h3>
                  {Object.entries(salary.porCargo).map(([cargo, data]) => (
                    <div key={cargo} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${P.borderLight}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: P.text, marginBottom: 4 }}>{cargo}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: P.textMuted }}>
                        <span>{data.horas} hs × {formatMoney(data.valor_hora)}/h</span>
                        <span style={{ fontWeight: 700, color: P.primary }}>{formatMoney(data.subtotal)}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: P.text, paddingTop: 4 }}>
                    <span>Subtotal</span>
                    <span>{formatMoney(salary.subtotal)}</span>
                  </div>
                </div>

                {/* Bonuses */}
                <div style={{ background: P.card, borderRadius: 14, padding: 20, border: `1px solid ${P.border}` }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: P.text, marginBottom: 16 }}>Bonificaciones</h3>

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: P.text, display: "flex", alignItems: "center", gap: 6 }}>
                          <Clock size={14} style={{ color: "#6366f1" }} /> Carga horaria
                        </div>
                        <div style={{ fontSize: 12, color: P.textMuted }}>{salary.totalHoras} hs → {Math.round(salary.bonifCargaPct * 100)}%</div>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 700, color: salary.bonifCarga > 0 ? "#059669" : P.textMuted }}>
                        {salary.bonifCarga > 0 ? `+${formatMoney(salary.bonifCarga)}` : "$0"}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: P.borderLight }}>
                      <div style={{ height: "100%", borderRadius: 3, background: "#6366f1", width: `${Math.min((salary.totalHoras / 33) * 100, 100)}%`, transition: "width 0.4s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: P.textMuted, marginTop: 4 }}>
                      <span>0hs (0%)</span><span>24hs (10%)</span><span>33hs (15%)</span>
                    </div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: P.text, display: "flex", alignItems: "center", gap: 6 }}>
                          <Award size={14} style={{ color: "#f59e0b" }} /> Antigüedad
                        </div>
                        <div style={{ fontSize: 12, color: P.textMuted }}>
                          {anios > 0 ? `${anios} años → ${Math.round(salary.bonifAntiguedadPct * 100)}%` : "No configurada"}
                        </div>
                      </div>
                      <span style={{ fontSize: 16, fontWeight: 700, color: salary.bonifAntiguedad > 0 ? "#059669" : P.textMuted }}>
                        {salary.bonifAntiguedad > 0 ? `+${formatMoney(salary.bonifAntiguedad)}` : "$0"}
                      </span>
                    </div>
                    {anios > 0 && (
                      <div style={{ height: 6, borderRadius: 3, background: P.borderLight }}>
                        <div style={{ height: "100%", borderRadius: 3, background: "#f59e0b", width: `${Math.min((anios / 21) * 100, 100)}%`, transition: "width 0.4s" }} />
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: `2px solid ${P.border}`, paddingTop: 14, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800 }}>
                    <span style={{ color: P.text }}>Total estimado</span>
                    <span style={{ color: P.primary }}>{formatMoney(salary.total)}</span>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div style={{ padding: "12px 16px", borderRadius: 10, background: P.primarySoft, fontSize: 12, color: P.textMuted, lineHeight: 1.5, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Esta es una estimación. Los valores pueden variar según resoluciones vigentes, adicionales por título, o ajustes paritarios. Los valores se actualizan desde el repositorio de referencia.</span>
              </div>
            </>
          ) : items.length === 0 && !loadingLiq && (
            <div style={{ background: P.card, borderRadius: 16, padding: "60px 32px", textAlign: "center", border: `1px solid ${P.border}` }}>
              <Calculator size={48} style={{ color: P.textMuted, marginBottom: 16 }} />
              <p style={{ color: P.textMuted, fontSize: 15 }}>No hay datos de liquidación para este período</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}