import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { Btn } from "../components/UI";
import {
  Link, Calendar, Mail, LogOut, GraduationCap, BookOpen, HardDrive,
  Shield, ArrowRightLeft, Loader2, CheckCircle, AlertCircle, Unlink,
} from "lucide-react";

export default function SettingsPage() {
  const {
    moodleToken, zonaSession, zonaProfile, zonaLoading, loadZonaProfile,
    googleAccessToken, user, logout, userRole, isTeacher, isDualRole,
    availableRoles, connectZonaOnly, disconnectZona,
  } = useApp();

  const [showZonaForm, setShowZonaForm] = useState(false);
  const [zUser, setZUser] = useState("");
  const [zPass, setZPass] = useState("");
  const [zonaConnecting, setZonaConnecting] = useState(false);
  const [zonaResult, setZonaResult] = useState(null); // "ok" | "error" | null

  useEffect(() => {
    if (zonaSession && !zonaProfile) loadZonaProfile();
  }, [zonaSession, zonaProfile, loadZonaProfile]);

  const googleConnected = !!googleAccessToken;

  const handleConnectZona = async () => {
    if (!zUser || !zPass) return;
    setZonaConnecting(true);
    setZonaResult(null);
    const ok = await connectZonaOnly(zUser, zPass);
    setZonaResult(ok ? "ok" : "error");
    setZonaConnecting(false);
    if (ok) {
      setShowZonaForm(false);
      setZUser("");
      setZPass("");
      setTimeout(() => setZonaResult(null), 3000);
    }
  };

  const handleDisconnectZona = () => {
    disconnectZona();
    setZonaResult(null);
  };

  const connections = [
    { name: "Campus Virtual (Moodle)", status: moodleToken ? "Conectado" : "Desconectado", Icon: Link, color: moodleToken ? "#16A34A" : P.red, connected: !!moodleToken },
    { name: "Zona Interactiva", status: zonaSession ? "Conectado" : "No vinculada", Icon: GraduationCap, color: zonaSession ? "#16A34A" : "#D97706", connected: !!zonaSession },
    { name: "Google Calendar", status: googleConnected ? "Conectado" : "Pendiente", Icon: Calendar, color: googleConnected ? "#16A34A" : "#D97706", connected: googleConnected },
    { name: "Gmail", status: googleConnected ? "Conectado" : "Pendiente", Icon: Mail, color: googleConnected ? "#16A34A" : "#D97706", connected: googleConnected },
    { name: "Google Drive", status: googleConnected ? "Conectado" : "Pendiente", Icon: HardDrive, color: googleConnected ? "#16A34A" : "#D97706", connected: googleConnected },
  ];

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    background: P.bg, border: `1px solid ${P.border}`,
    color: P.text, fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <div className="fade-in" style={{ maxWidth: 640 }}>
      <h1 style={{ fontFamily: ff.heading, fontSize: 26, color: P.text, marginBottom: 24, fontWeight: 800 }}>Ajustes</h1>

      {/* User info */}
      {user && (
        <div style={{ background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
          {user.picture ? (
            <img src={user.picture} alt="" style={{ width: 48, height: 48, borderRadius: 12 }} referrerPolicy="no-referrer" />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 12, background: P.red, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 700 }}>
              {user.name?.charAt(0) || "U"}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.text }}>{user.name}</div>
            <div style={{ fontSize: 13, color: P.textMuted }}>{user.email}</div>
          </div>
          {userRole && (
            <span style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: isTeacher ? "#2E86C115" : "#05966915",
              color: isTeacher ? "#2E86C1" : "#059669",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              {isTeacher ? <Shield size={12} /> : <GraduationCap size={12} />}
              {isTeacher ? "Docente" : "Alumno"}
              {isDualRole && " (dual)"}
            </span>
          )}
        </div>
      )}

      <h3 style={{ fontFamily: ff.heading, fontSize: 18, color: P.text, marginBottom: 12 }}>Conexiones</h3>
      {connections.map((conn, i) => (
        <div key={i} style={{ background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, padding: "16px 20px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: `${conn.color}10`, display: "flex", alignItems: "center", justifyContent: "center", color: conn.color }}>
              <conn.Icon size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{conn.name}</div>
              <div style={{ fontSize: 12, color: conn.color, fontWeight: 600 }}>{conn.status}</div>
            </div>
          </div>
          {conn.connected && <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>✓</span>}
        </div>
      ))}

      {/* Zona Interactiva connect/disconnect section */}
      {!zonaSession ? (
        <div style={{ background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, padding: "20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showZonaForm ? 16 : 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: P.text }}>Vincular Zona Interactiva</div>
              <div style={{ fontSize: 12, color: P.textMuted }}>Conectá para acceder a tu perfil académico, analítico y plan de estudios</div>
            </div>
            {!showZonaForm && (
              <button onClick={() => setShowZonaForm(true)}
                style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: P.primary, color: "#fff", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <Link size={14} /> Vincular
              </button>
            )}
          </div>

          {showZonaForm && (
            <div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", color: P.textSec, fontSize: 12, marginBottom: 4, fontWeight: 500 }}>Usuario (Zona)</label>
                <input type="text" value={zUser} onChange={e => setZUser(e.target.value)} placeholder="DNI o usuario de Zona" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = P.redMuted} onBlur={e => e.target.style.borderColor = P.border} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", color: P.textSec, fontSize: 12, marginBottom: 4, fontWeight: 500 }}>Contraseña (Zona)</label>
                <input type="password" value={zPass} onChange={e => setZPass(e.target.value)} placeholder="Contraseña de Zona" style={inputStyle}
                  onKeyDown={e => e.key === "Enter" && handleConnectZona()}
                  onFocus={e => e.target.style.borderColor = P.redMuted} onBlur={e => e.target.style.borderColor = P.border} />
              </div>
              {zonaResult === "error" && (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: "#DC262610", color: "#DC2626", fontSize: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertCircle size={14} /> No se pudo conectar. Verificá las credenciales.
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={handleConnectZona} disabled={zonaConnecting || !zUser || !zPass}
                  style={{
                    padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: P.primary, color: "#fff", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    opacity: (zonaConnecting || !zUser || !zPass) ? 0.5 : 1,
                  }}>
                  {zonaConnecting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Link size={14} />}
                  {zonaConnecting ? "Conectando..." : "Conectar"}
                </button>
                <button onClick={() => { setShowZonaForm(false); setZonaResult(null); }}
                  style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, color: P.textMuted, background: "transparent", border: "none", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <button onClick={handleDisconnectZona}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 12, color: P.textMuted,
              background: "transparent", border: `1px solid ${P.border}`, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#DC2626"; e.currentTarget.style.color = "#DC2626"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.color = P.textMuted; }}>
            <Unlink size={14} /> Desvincular Zona Interactiva
          </button>
        </div>
      )}

      {/* Success message */}
      {zonaResult === "ok" && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: "#05966910", border: "1px solid #05966920", color: "#059669", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={16} /> Zona Interactiva vinculada correctamente
        </div>
      )}

      {!googleConnected && (
        <p style={{ color: P.textMuted, fontSize: 13, marginTop: 8, marginBottom: 20, lineHeight: 1.5 }}>
          Calendar, Gmail y Drive se conectan automáticamente al iniciar sesión con tu cuenta Google @ucalpvirtual.edu.ar
        </p>
      )}

      {/* Zona Profile Data */}
      {zonaSession && zonaProfile?.analitico?.length > 0 && (
        <>
          <h3 style={{ fontFamily: ff.heading, fontSize: 18, color: P.text, marginBottom: 12, marginTop: 24 }}>Historial Académico</h3>
          <div style={{ background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, overflow: "hidden" }}>
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: P.cream }}>
                    {["Materia", "Nota", "Fecha", "Estado"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: P.textSec, fontSize: 12, borderBottom: `1px solid ${P.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zonaProfile.analitico.map((m, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${P.borderLight}` }}>
                      <td style={{ padding: "8px 12px", color: P.text, fontWeight: 500 }}>{m.materia}</td>
                      <td style={{ padding: "8px 12px", color: P.red, fontWeight: 700 }}>{m.nota}</td>
                      <td style={{ padding: "8px 12px", color: P.textMuted }}>{m.fecha}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: m.estado?.toLowerCase().includes("aprob") ? "#DCFCE7" : P.redSoft, color: m.estado?.toLowerCase().includes("aprob") ? "#16A34A" : P.red }}>
                          {m.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <button onClick={logout}
        style={{ marginTop: 24, padding: "12px 20px", borderRadius: 12, background: P.redSoft, color: P.red, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, border: `1px solid ${P.redMuted}`, cursor: "pointer" }}>
        <LogOut size={18} /> Cerrar sesión
      </button>
    </div>
  );
}