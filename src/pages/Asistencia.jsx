import { useState, useEffect, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { zonaScrape } from "../services/zona";
import {
  ClipboardCheck, Loader2, RefreshCw, AlertCircle, Users, User,
  ChevronDown, ChevronRight, Calendar, AlertTriangle, CheckCircle,
} from "lucide-react";

// ─── HTML Parsing ────────────────────────────────────────────────

function parseCatedras(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const select = doc.querySelector("select");
  if (!select) return [];
  const catedras = [];
  select.querySelectorAll("option").forEach(opt => {
    const val = opt.value;
    if (val && val !== "0" && val !== "") {
      catedras.push({ id: val, nombre: opt.textContent.trim() });
    }
  });
  return catedras;
}

function parsePlanillas(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const planillas = [];
  const tables = doc.querySelectorAll("table.table, table");
  tables.forEach(table => {
    const rows = table.querySelectorAll("tr");
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].querySelectorAll("td");
      if (cols.length >= 4) {
        // Find "Ver" link to extract id_cursada and cod
        let idCursada = "", cod = "";
        const link = rows[i].querySelector("a");
        if (link) {
          const href = link.getAttribute("href") || "";
          const cursadaMatch = href.match(/id_cursada=(\d+)/);
          const codMatch = href.match(/cod=(\d+)/);
          if (cursadaMatch) idCursada = cursadaMatch[1];
          if (codMatch) cod = codMatch[1];
        }
        planillas.push({
          planilla: cols[0].textContent.trim(),
          alumnos: parseInt(cols[1].textContent.trim()) || 0,
          fechasActualizadas: parseInt(cols[2].textContent.trim()) || 0,
          ultimaActualizacion: cols[3].textContent.trim(),
          idCursada, cod,
        });
      }
    }
  });
  return planillas;
}

function parseAlumnos(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const alumnos = [];

  // Extract title (e.g. "Asistencias Sociología - 2A23-LE")
  const h2 = doc.querySelector("h2, h3, .titulo");
  const titulo = h2 ? h2.textContent.trim().replace(/^Asistencias\s*/i, "") : "";

  const tables = doc.querySelectorAll("table.table, table");
  tables.forEach(table => {
    const rows = table.querySelectorAll("tr");
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].querySelectorAll("td");
      if (cols.length >= 3) {
        const inasistencia = parseFloat(cols[2].textContent.trim().replace(",", ".")) || 0;
        alumnos.push({
          legajo: cols[0].textContent.trim(),
          nombre: cols[1].textContent.trim(),
          inasistencia,
          asistencia: Math.round((100 - inasistencia) * 100) / 100,
        });
      }
    }
  });
  return { titulo, alumnos };
}

function getAsistenciaColor(pct) {
  if (pct >= 90) return "#059669";
  if (pct >= 75) return "#2E86C1";
  if (pct >= 60) return "#D97706";
  return "#DC2626";
}

// ─── Component ───────────────────────────────────────────────────

export default function AsistenciaPage() {
  const { zonaSession } = useApp();
  const [catedras, setCatedras] = useState([]);
  const [selectedCatedra, setSelectedCatedra] = useState(null);
  const [planillas, setPlanillas] = useState([]);
  const [selectedPlanilla, setSelectedPlanilla] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [titulo, setTitulo] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // Load cátedras on mount
  const fetchCatedras = useCallback(async () => {
    if (!zonaSession) { setError("Zona Interactiva no está vinculada. Vinculala desde Ajustes."); return; }
    setLoading(true); setError(null);
    try {
      const data = await zonaScrape(zonaSession, "cHJvZl9hc2lzdGVuY2lhcw==");
      const cats = parseCatedras(data.html);
      setCatedras(cats);
      // Also parse planillas from the initial page (might have default selection)
      const plans = parsePlanillas(data.html);
      if (plans.length > 0) setPlanillas(plans);
      if (cats.length > 0) setSelectedCatedra(cats[0].id);
    } catch (err) {
      setError(err.message || "Error al obtener asistencias");
    } finally { setLoading(false); }
  }, [zonaSession]);

  useEffect(() => { fetchCatedras(); }, [fetchCatedras]);

  // Load planillas when cátedra changes
  useEffect(() => {
    if (!selectedCatedra || !zonaSession) return;
    let cancelled = false;
    setLoadingDetail(true);
    setPlanillas([]);
    setSelectedPlanilla(null);
    setAlumnos([]);

    // Fetch the page with the selected cátedra (POST the select form)
    zonaScrape(zonaSession, "cHJvZl9hc2lzdGVuY2lhcw==", { id_cursada: selectedCatedra }).then(data => {
      if (cancelled) return;
      const plans = parsePlanillas(data.html);
      setPlanillas(plans);
      setLoadingDetail(false);
    }).catch(() => { if (!cancelled) setLoadingDetail(false); });

    return () => { cancelled = true; };
  }, [selectedCatedra, zonaSession]);

  // Load alumno detail when planilla is selected
  useEffect(() => {
    if (!selectedPlanilla || !zonaSession) return;
    let cancelled = false;
    setLoadingDetail(true);
    setAlumnos([]);

    zonaScrape(zonaSession, "cHJvZl9hc2lzdGVuY2lhc0FsdW1ub3M=", {
      id_cursada: selectedPlanilla.idCursada,
      cod: selectedPlanilla.cod,
    }).then(data => {
      if (cancelled) return;
      const result = parseAlumnos(data.html);
      setAlumnos(result.alumnos);
      setTitulo(result.titulo);
      setLoadingDetail(false);
    }).catch(() => { if (!cancelled) setLoadingDetail(false); });

    return () => { cancelled = true; };
  }, [selectedPlanilla, zonaSession]);

  // Stats
  const avgAsistencia = alumnos.length > 0
    ? Math.round(alumnos.reduce((s, a) => s + a.asistencia, 0) / alumnos.length * 10) / 10
    : 0;
  const riesgo = alumnos.filter(a => a.asistencia < 75).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 26, fontWeight: 700, color: P.text, marginBottom: 6 }}>Asistencia</h1>
          <p style={{ color: P.textMuted, fontSize: 14 }}>Control de asistencia de tus cátedras presenciales</p>
        </div>
        <button onClick={fetchCatedras} disabled={loading}
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
          <p style={{ color: P.textMuted, fontSize: 13, marginTop: 12 }}>Cargando cátedras...</p>
        </div>
      ) : catedras.length > 0 && (
        <>
          {/* Cátedra selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, display: "block" }}>Cátedra</label>
            <select value={selectedCatedra || ""} onChange={e => setSelectedCatedra(e.target.value)}
              style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontSize: 14, minWidth: 300, maxWidth: "100%" }}>
              {catedras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Planillas */}
          {planillas.length > 0 && !selectedPlanilla && (
            <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${P.borderLight}`, fontSize: 13, fontWeight: 600, color: P.textSec }}>
                Planillas de asistencia
              </div>
              {planillas.map((p, i) => (
                <div key={i}
                  onClick={() => p.idCursada && p.cod ? setSelectedPlanilla(p) : null}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                    borderBottom: i < planillas.length - 1 ? `1px solid ${P.borderLight}` : "none",
                    cursor: p.idCursada ? "pointer" : "default", transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { if (p.idCursada) e.currentTarget.style.background = P.borderLight; }}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: P.primarySoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ClipboardCheck size={18} style={{ color: P.primary }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{p.planilla}</div>
                    <div style={{ fontSize: 12, color: P.textMuted, display: "flex", gap: 16, marginTop: 2 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={11} /> {p.alumnos} alumnos</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> {p.fechasActualizadas} fechas</span>
                      <span>Últ: {p.ultimaActualizacion}</span>
                    </div>
                  </div>
                  {p.idCursada && <ChevronRight size={16} style={{ color: P.textMuted }} />}
                </div>
              ))}
            </div>
          )}

          {/* Loading detail */}
          {loadingDetail && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Loader2 size={24} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {/* Alumno detail view */}
          {selectedPlanilla && alumnos.length > 0 && (
            <>
              {/* Back button + title */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <button onClick={() => { setSelectedPlanilla(null); setAlumnos([]); }}
                  style={{ padding: "6px 12px", borderRadius: 8, fontSize: 13, background: P.card, color: P.textSec, border: `1px solid ${P.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  ← Volver
                </button>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: P.text }}>{titulo || selectedPlanilla.planilla}</div>
                  <div style={{ fontSize: 12, color: P.textMuted }}>{alumnos.length} alumnos</div>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Alumnos", value: alumnos.length, color: "#2E86C1", Icon: Users },
                  { label: "Asistencia prom.", value: `${avgAsistencia}%`, color: getAsistenciaColor(avgAsistencia), Icon: CheckCircle },
                  { label: "En riesgo (<75%)", value: riesgo, color: riesgo > 0 ? "#DC2626" : "#059669", Icon: AlertTriangle },
                ].map((s, i) => (
                  <div key={i} style={{ background: P.card, borderRadius: 12, padding: "14px 16px", border: `1px solid ${P.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <s.Icon size={14} style={{ color: s.color }} />
                      <span style={{ fontSize: 11, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Student list */}
              <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
                {alumnos.map((a, i) => {
                  const color = getAsistenciaColor(a.asistencia);
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
                      borderBottom: i < alumnos.length - 1 ? `1px solid ${P.borderLight}` : "none",
                    }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <User size={16} style={{ color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: P.text }}>{a.nombre}</div>
                        <div style={{ fontSize: 12, color: P.textMuted }}>Legajo: {a.legajo}</div>
                      </div>
                      {/* Attendance bar */}
                      <div style={{ width: 100, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color }}>{a.asistencia}%</span>
                        <div style={{ width: "100%", height: 5, borderRadius: 3, background: P.borderLight, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 3, background: color, width: `${a.asistencia}%`, transition: "width 0.4s" }} />
                        </div>
                      </div>
                      {a.inasistencia > 25 && (
                        <AlertTriangle size={14} style={{ color: "#DC2626", flexShrink: 0 }} title="Riesgo de quedar libre" />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {selectedPlanilla && alumnos.length === 0 && !loadingDetail && (
            <div style={{ background: P.card, borderRadius: 16, padding: "40px 32px", textAlign: "center", border: `1px solid ${P.border}` }}>
              <p style={{ color: P.textMuted, fontSize: 14 }}>No se encontraron datos de asistencia</p>
            </div>
          )}

          {planillas.length === 0 && !loadingDetail && !selectedPlanilla && (
            <div style={{ background: P.card, borderRadius: 16, padding: "40px 32px", textAlign: "center", border: `1px solid ${P.border}` }}>
              <ClipboardCheck size={40} style={{ color: P.textMuted, marginBottom: 12 }} />
              <p style={{ color: P.textMuted, fontSize: 14 }}>No hay planillas de asistencia para esta cátedra</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}