import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { Link, ChevronDown, ChevronRight, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

export default function MoodleConnect({ onConnected }) {
  const { connectMoodle, connectMoodleOnly, connectZonaOnly } = useApp();
  const [mUser, setMUser] = useState("");
  const [mPass, setMPass] = useState("");
  const [zUser, setZUser] = useState("");
  const [zPass, setZPass] = useState("");
  const [sameCredentials, setSameCredentials] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(""); // "" | "moodle" | "zona" | "done"
  const [moodleOk, setMoodleOk] = useState(false);
  const [zonaOk, setZonaOk] = useState(false);
  const [zonaError, setZonaError] = useState(false);

  const handleConnect = async () => {
    if (!mUser || !mPass) return;
    setLoading(true);
    setZonaError(false);

    if (sameCredentials) {
      // Same credentials for both
      setStep("moodle");
      const results = await connectMoodle(mUser, mPass);
      setMoodleOk(results.moodle);
      setZonaOk(results.zona);
      if (!results.zona) setZonaError(true);
      setStep("done");
      setLoading(false);
      // Continue even if Zona failed — they can reconnect from Settings
      setTimeout(() => onConnected(), results.zona ? 500 : 2000);
    } else {
      // Different credentials
      setStep("moodle");
      await connectMoodleOnly(mUser, mPass);
      setMoodleOk(true);

      if (zUser && zPass) {
        setStep("zona");
        const zonaResult = await connectZonaOnly(zUser, zPass);
        setZonaOk(zonaResult);
        if (!zonaResult) setZonaError(true);
      }

      setStep("done");
      setLoading(false);
      setTimeout(() => onConnected(), zonaError ? 2000 : 500);
    }
  };

  const handleSkipZona = async () => {
    if (!mUser || !mPass) return;
    setLoading(true);
    setSameCredentials(false);
    setStep("moodle");
    await connectMoodleOnly(mUser, mPass);
    setMoodleOk(true);
    setStep("done");
    setLoading(false);
    setTimeout(() => onConnected(), 500);
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 10,
    background: P.bg, border: `1px solid ${P.border}`,
    color: P.text, fontSize: 15, outline: "none", transition: "border-color 0.2s",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: P.cream, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.4, backgroundImage: `linear-gradient(${P.border} 1px, transparent 1px), linear-gradient(90deg, ${P.border} 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />

      <div className="fade-in" style={{ background: P.card, borderRadius: 24, padding: "48px 40px", maxWidth: 480, width: "90%", boxShadow: "0 4px 40px rgba(26,82,118,0.06)", border: `1px solid ${P.border}`, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: P.redSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: P.red }}>
            <Link size={28} />
          </div>
          <h2 style={{ fontFamily: ff.heading, fontSize: 26, color: P.text, marginBottom: 8 }}>Conectar con UCALP</h2>
          <p style={{ color: P.textMuted, fontSize: 14 }}>
            Ingresá tus credenciales de <strong style={{ color: P.red }}>campus.ucalp.edu.ar</strong>
          </p>
        </div>

        {/* Moodle credentials */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", color: P.textSec, fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
            Usuario {!sameCredentials && <span style={{ color: P.textMuted, fontWeight: 400 }}>(Moodle)</span>}
          </label>
          <input type="text" value={mUser} onChange={(e) => setMUser(e.target.value)} placeholder="Tu usuario del campus" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = P.redMuted)} onBlur={(e) => (e.target.style.borderColor = P.border)} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", color: P.textSec, fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
            Contraseña {!sameCredentials && <span style={{ color: P.textMuted, fontWeight: 400 }}>(Moodle)</span>}
          </label>
          <input type="password" value={mPass} onChange={(e) => setMPass(e.target.value)} placeholder="Tu contraseña" style={inputStyle}
            onKeyDown={(e) => e.key === "Enter" && sameCredentials && handleConnect()}
            onFocus={(e) => (e.target.style.borderColor = P.redMuted)} onBlur={(e) => (e.target.style.borderColor = P.border)} />
        </div>

        {/* Same credentials toggle */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setSameCredentials(!sameCredentials)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10, border: `1px solid ${P.border}`,
              background: P.bg, cursor: "pointer", transition: "all 0.2s",
              color: P.textSec, fontSize: 13,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = P.redMuted}
            onMouseLeave={e => e.currentTarget.style.borderColor = P.border}>
            {sameCredentials ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <span style={{ flex: 1, textAlign: "left" }}>
              {sameCredentials
                ? "¿Usás credenciales distintas para Zona Interactiva?"
                : "Credenciales de Zona Interactiva"}
            </span>
          </button>

          {/* Zona separate credentials */}
          {!sameCredentials && (
            <div style={{ marginTop: 12, padding: "16px", background: P.bg, borderRadius: 12, border: `1px solid ${P.borderLight}` }}>
              <p style={{ fontSize: 12, color: P.textMuted, marginBottom: 12 }}>
                Ingresá tus credenciales de zona.ucalp.edu.ar si son distintas a las de Moodle
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", color: P.textSec, fontSize: 12, marginBottom: 4, fontWeight: 500 }}>Usuario (Zona)</label>
                <input type="text" value={zUser} onChange={(e) => setZUser(e.target.value)} placeholder="DNI o usuario de Zona" style={{ ...inputStyle, fontSize: 14, padding: "10px 14px" }}
                  onFocus={(e) => (e.target.style.borderColor = P.redMuted)} onBlur={(e) => (e.target.style.borderColor = P.border)} />
              </div>
              <div>
                <label style={{ display: "block", color: P.textSec, fontSize: 12, marginBottom: 4, fontWeight: 500 }}>Contraseña (Zona)</label>
                <input type="password" value={zPass} onChange={(e) => setZPass(e.target.value)} placeholder="Contraseña de Zona" style={{ ...inputStyle, fontSize: 14, padding: "10px 14px" }}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  onFocus={(e) => (e.target.style.borderColor = P.redMuted)} onBlur={(e) => (e.target.style.borderColor = P.border)} />
              </div>
            </div>
          )}
        </div>

        {/* Connection status */}
        {step && (
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              {moodleOk ? <CheckCircle size={16} style={{ color: "#16A34A" }} /> : step === "moodle" ? <Loader2 size={16} style={{ color: P.primary, animation: "spin 1s linear infinite" }} /> : null}
              <span style={{ color: moodleOk ? "#16A34A" : P.textSec }}>{moodleOk ? "Campus Virtual conectado" : "Conectando a Moodle..."}</span>
            </div>
            {(step === "zona" || step === "done") && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                {zonaOk ? <CheckCircle size={16} style={{ color: "#16A34A" }} /> : zonaError ? <AlertCircle size={16} style={{ color: "#D97706" }} /> : <Loader2 size={16} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />}
                <span style={{ color: zonaOk ? "#16A34A" : zonaError ? "#D97706" : P.textSec }}>
                  {zonaOk ? "Zona Interactiva conectada" : zonaError ? "Zona no conectada (podés vincularla después desde Ajustes)" : "Conectando a Zona..."}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Main connect button */}
        <button onClick={handleConnect} disabled={loading || !mUser || !mPass}
          style={{
            width: "100%", padding: "14px", borderRadius: 12,
            background: (loading || !mUser || !mPass) ? P.textMuted : P.red,
            color: "#fff", fontSize: 15, fontWeight: 600, transition: "all 0.2s",
            cursor: (loading || !mUser || !mPass) ? "default" : "pointer",
            border: "none",
          }}
          onMouseEnter={(e) => { if (!loading && mUser && mPass) e.currentTarget.style.background = P.redDark; }}
          onMouseLeave={(e) => { if (!loading && mUser && mPass) e.currentTarget.style.background = P.red; }}>
          {loading ? "Conectando..." : sameCredentials ? "Conectar al Campus y Zona" : "Conectar"}
        </button>

        {/* Skip Zona option */}
        {sameCredentials && !loading && (
          <button onClick={handleSkipZona} disabled={!mUser || !mPass}
            style={{
              width: "100%", padding: "10px", marginTop: 8, borderRadius: 10,
              background: "transparent", color: P.textMuted, fontSize: 13,
              border: "none", cursor: "pointer", transition: "color 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = P.textSec}
            onMouseLeave={e => e.currentTarget.style.color = P.textMuted}>
            Conectar solo Moodle (vincular Zona después)
          </button>
        )}

        <p style={{ color: P.textMuted, fontSize: 12, marginTop: 16, textAlign: "center", lineHeight: 1.5 }}>
          Tus credenciales se usan solo para obtener el token de acceso. No se almacenan.
        </p>
      </div>
    </div>
  );
}