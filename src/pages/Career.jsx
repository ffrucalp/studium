import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { Btn } from "../components/UI";
import { GraduationCap, BookOpen, Clock, Check, X, RefreshCw, ChevronRight } from "lucide-react";

export default function Career() {
  const { zonaSession, zonaProfile, zonaLoading, loadZonaProfile, user } = useApp();
  const [activeTab, setActiveTab] = useState("analitico");

  useEffect(() => {
    if (zonaSession && !zonaProfile) loadZonaProfile();
  }, [zonaSession, zonaProfile, loadZonaProfile]);

  if (!zonaSession) {
    return (
      <div className="fade-in" style={{ textAlign: "center", padding: "60px 20px" }}>
        <div className="float" style={{ width: 64, height: 64, borderRadius: 16, background: P.redSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: P.red }}>
          <GraduationCap size={30} />
        </div>
        <h3 style={{ fontSize: 20, color: P.text, marginBottom: 8, fontFamily: ff.heading, fontWeight: 700 }}>Zona Interactiva no conectada</h3>
        <p style={{ color: P.textMuted, fontSize: 14, maxWidth: 420, margin: "0 auto" }}>
          Para ver tu historial académico, plan de estudios y cursadas, necesitás estar conectado a Zona Interactiva. La conexión se realiza automáticamente al ingresar tus credenciales del campus.
        </p>
      </div>
    );
  }

  if (zonaLoading) {
    return (
      <div className="fade-in" style={{ maxWidth: 800 }}>
        <div className="shimmer" style={{ height: 32, width: "40%", marginBottom: 24 }} />
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="shimmer" style={{ height: 48, marginBottom: 8 }} />)}
      </div>
    );
  }

  const tabs = [
    { id: "analitico", label: "Historial Académico", icon: BookOpen, count: zonaProfile?.analitico?.length },
    { id: "plan", label: "Plan de Estudios", icon: GraduationCap, count: zonaProfile?.planEstudios?.length },
    { id: "cursadasActuales", label: "Cursadas Actuales", icon: Clock, count: zonaProfile?.cursadasActuales?.length },
    { id: "cursadasAnteriores", label: "Cursadas Anteriores", icon: Clock, count: zonaProfile?.cursadasAnteriores?.length },
  ];

  const getEstadoBadge = (estado) => {
    if (!estado) return { bg: P.borderLight, color: P.textMuted };
    const e = estado.toLowerCase();
    if (e.includes("aprob") || e.includes("regular")) return { bg: "#DCFCE7", color: "#16A34A" };
    if (e.includes("libre") || e.includes("ausente") || e.includes("reprob")) return { bg: P.redSoft, color: P.red };
    if (e.includes("curs") || e.includes("inscr")) return { bg: "#DBEAFE", color: "#2563EB" };
    return { bg: "#FEF3C7", color: "#D97706" };
  };

  const aprobadas = zonaProfile?.analitico?.filter(m => m.estado?.toLowerCase().includes("aprob")).length || 0;
  const totalPlan = zonaProfile?.planEstudios?.length || 0;
  const promedio = zonaProfile?.analitico?.filter(m => {
    const n = parseFloat(m.nota);
    return !isNaN(n) && n > 0;
  });
  const promedioVal = promedio?.length > 0
    ? (promedio.reduce((sum, m) => sum + parseFloat(m.nota), 0) / promedio.length).toFixed(2)
    : null;

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 26, color: P.text, fontWeight: 800 }}>Mi Carrera</h1>
          <p style={{ color: P.textMuted, fontSize: 14 }}>
            {user?.carreraActual || "Datos de Zona Interactiva"}
          </p>
        </div>
        <Btn onClick={() => loadZonaProfile()} disabled={zonaLoading}>
          <RefreshCw size={16} /> Actualizar
        </Btn>
      </div>

      {/* Stats cards */}
      {zonaProfile && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16, flexShrink: 0 }}>
          {[
            { label: "Materias aprobadas", value: aprobadas, color: "#16A34A" },
            { label: "Total del plan", value: totalPlan, color: "#2563EB" },
            { label: "Avance", value: totalPlan > 0 ? `${Math.round(aprobadas / totalPlan * 100)}%` : "—", color: P.red },
            { label: "Promedio", value: promedioVal || "—", color: "#7C3AED" },
          ].map((stat, i) => (
            <div key={i} style={{ background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, padding: "16px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, fontFamily: ff.heading }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: P.textMuted, marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 0, borderBottom: `2px solid ${P.borderLight}`, paddingBottom: 0, overflow: "auto", flexShrink: 0 }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 16px", borderRadius: "8px 8px 0 0", fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              background: activeTab === tab.id ? P.card : "transparent",
              color: activeTab === tab.id ? P.red : P.textMuted,
              border: activeTab === tab.id ? `2px solid ${P.border}` : "2px solid transparent",
              borderBottom: activeTab === tab.id ? `2px solid ${P.card}` : "2px solid transparent",
              marginBottom: -2, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            }}>
            <tab.icon size={15} />
            {tab.label}
            {tab.count != null && <span style={{ background: activeTab === tab.id ? P.redSoft : P.borderLight, color: activeTab === tab.id ? P.red : P.textMuted, padding: "1px 6px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ background: P.card, borderRadius: "0 0 16px 16px", border: `1px solid ${P.border}`, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

        {/* Historial Académico */}
        {activeTab === "analitico" && (
          zonaProfile?.analitico?.length > 0 ? (
            <div style={{ overflow: "auto", flex: 1 }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: P.cream, position: "sticky", top: 0 }}>
                    {["Materia", "Nota", "Fecha", "Estado"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: P.textSec, fontSize: 12, borderBottom: `1px solid ${P.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zonaProfile.analitico.map((m, i) => {
                    const badge = getEstadoBadge(m.estado);
                    return (
                      <tr key={i} className="slide-in" style={{ animationDelay: `${i * 0.03}s`, borderBottom: `1px solid ${P.borderLight}` }}>
                        <td style={{ padding: "10px 14px", color: P.text, fontWeight: 500 }}>{m.materia}</td>
                        <td style={{ padding: "10px 14px", color: P.red, fontWeight: 700, fontSize: 15 }}>{m.nota}</td>
                        <td style={{ padding: "10px 14px", color: P.textMuted }}>{m.fecha}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color }}>{m.estado}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div style={{ padding: 30, textAlign: "center", color: P.textMuted }}>No se encontraron datos en el historial académico.</div>
        )}

        {/* Plan de Estudios */}
        {activeTab === "plan" && (
          zonaProfile?.planEstudios?.length > 0 ? (
            <div style={{ overflow: "auto", flex: 1 }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: P.cream, position: "sticky", top: 0 }}>
                    {["Materia", "Año", "Estado"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: P.textSec, fontSize: 12, borderBottom: `1px solid ${P.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zonaProfile.planEstudios.map((m, i) => {
                    const badge = getEstadoBadge(m.estado);
                    return (
                      <tr key={i} className="slide-in" style={{ animationDelay: `${i * 0.03}s`, borderBottom: `1px solid ${P.borderLight}` }}>
                        <td style={{ padding: "10px 14px", color: P.text, fontWeight: 500 }}>{m.materia}</td>
                        <td style={{ padding: "10px 14px", color: P.textMuted }}>{m.anio}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color }}>{m.estado}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div style={{ padding: 30, textAlign: "center", color: P.textMuted }}>No se encontró el plan de estudios.</div>
        )}

        {/* Cursadas Actuales */}
        {activeTab === "cursadasActuales" && (
          zonaProfile?.cursadasActuales?.length > 0 ? (
            <div style={{ padding: "12px" }}>
              {zonaProfile.cursadasActuales.map((c, i) => (
                <div key={i} className="slide-in" style={{ animationDelay: `${i * 0.05}s`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, borderBottom: `1px solid ${P.borderLight}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: "#2563EB" }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: P.text }}>{c.materia}</span>
                  </div>
                  <span style={{ fontSize: 12, color: P.textMuted }}>{c.info}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ padding: 30, textAlign: "center", color: P.textMuted }}>No se encontraron cursadas actuales.</div>
        )}

        {/* Cursadas Anteriores */}
        {activeTab === "cursadasAnteriores" && (
          zonaProfile?.cursadasAnteriores?.length > 0 ? (
            <div style={{ padding: "12px" }}>
              {zonaProfile.cursadasAnteriores.map((c, i) => (
                <div key={i} className="slide-in" style={{ animationDelay: `${i * 0.05}s`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, borderBottom: `1px solid ${P.borderLight}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 4, background: "#16A34A" }} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: P.text }}>{c.materia}</span>
                  </div>
                  <span style={{ fontSize: 12, color: P.textMuted }}>{c.info}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ padding: 30, textAlign: "center", color: P.textMuted }}>No se encontraron cursadas anteriores.</div>
        )}
      </div>
    </div>
  );
}