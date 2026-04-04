import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { Link } from "lucide-react";

export default function MoodleConnect({ onConnected }) {
  const { connectMoodle } = useApp();
  const [mUser, setMUser] = useState("");
  const [mPass, setMPass] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!mUser || !mPass) return;
    setLoading(true);
    await connectMoodle(mUser, mPass);
    setLoading(false);
    onConnected();
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 10,
    background: P.bg, border: `1px solid ${P.border}`,
    color: P.text, fontSize: 15, outline: "none", transition: "border-color 0.2s",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: P.cream, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.4, backgroundImage: `linear-gradient(${P.border} 1px, transparent 1px), linear-gradient(90deg, ${P.border} 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />

      <div className="fade-in" style={{ background: P.card, borderRadius: 24, padding: "48px 40px", maxWidth: 440, width: "90%", boxShadow: "0 4px 40px rgba(26,82,118,0.06)", border: `1px solid ${P.border}`, position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: P.redSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: P.red }}>
            <Link size={28} />
          </div>
          <h2 style={{ fontFamily: ff.heading, fontSize: 26, color: P.text, marginBottom: 8 }}>Conectar con UCALP</h2>
          <p style={{ color: P.textMuted, fontSize: 14 }}>
            Ingresá tus credenciales de <strong style={{ color: P.red }}>campus.ucalp.edu.ar</strong>
          </p>
          <p style={{ color: P.textMuted, fontSize: 12, marginTop: 4 }}>
            Se conectará al Campus Virtual y a Zona Interactiva
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", color: P.textSec, fontSize: 13, marginBottom: 6, fontWeight: 500 }}>Usuario</label>
          <input type="text" value={mUser} onChange={(e) => setMUser(e.target.value)} placeholder="Tu usuario del campus" style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = P.redMuted)} onBlur={(e) => (e.target.style.borderColor = P.border)} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", color: P.textSec, fontSize: 13, marginBottom: 6, fontWeight: 500 }}>Contraseña</label>
          <input type="password" value={mPass} onChange={(e) => setMPass(e.target.value)} placeholder="Tu contraseña" style={inputStyle}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            onFocus={(e) => (e.target.style.borderColor = P.redMuted)} onBlur={(e) => (e.target.style.borderColor = P.border)} />
        </div>

        <button onClick={handleConnect} disabled={loading}
          style={{ width: "100%", padding: "14px", borderRadius: 12, background: loading ? P.textMuted : P.red, color: "#fff", fontSize: 15, fontWeight: 600, transition: "all 0.2s" }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = P.redDark; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = P.red; }}>
          {loading ? "Conectando..." : "Conectar al Campus y Zona"}
        </button>

        <p style={{ color: P.textMuted, fontSize: 12, marginTop: 16, textAlign: "center", lineHeight: 1.5 }}>
          Tus credenciales se usan solo para obtener el token de acceso. No se almacenan.
        </p>
      </div>
    </div>
  );
}