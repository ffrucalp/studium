import { useEffect, useState } from "react";
import { P, ff } from "../styles/theme";
import { exchangeCode } from "../services/google";
import { GraduationCap } from "lucide-react";

export default function AuthCallback({ onSuccess, onError }) {
  const [status, setStatus] = useState("processing");
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");

    if (errorParam) {
      setStatus("error");
      setError(errorParam === "access_denied" ? "Acceso denegado. Intentá de nuevo." : errorParam);
      return;
    }

    if (!code) {
      setStatus("error");
      setError("No se recibió el código de autorización.");
      return;
    }

    exchangeCode(code)
      .then((data) => {
        setStatus("success");
        // Clean URL
        window.history.replaceState({}, "", "/");
        // Pass data to parent
        onSuccess(data);
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: P.cream }}>
      <div style={{ background: P.card, borderRadius: 20, padding: "40px 36px", maxWidth: 400, width: "90%", textAlign: "center", border: `1px solid ${P.border}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: status === "error" ? P.redSoft : `${P.red}10`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: P.red }}>
          <GraduationCap size={28} />
        </div>
        {status === "processing" && (
          <>
            <h2 style={{ fontFamily: ff.heading, fontSize: 20, color: P.text, marginBottom: 8 }}>Conectando con Google...</h2>
            <p style={{ color: P.textMuted, fontSize: 14 }}>Verificando tu cuenta @ucalpvirtual.edu.ar</p>
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: P.redMuted, animation: "pulse 1s infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </>
        )}
        {status === "success" && (
          <>
            <h2 style={{ fontFamily: ff.heading, fontSize: 20, color: "#16A34A", marginBottom: 8 }}>¡Conectado!</h2>
            <p style={{ color: P.textMuted, fontSize: 14 }}>Redirigiendo...</p>
          </>
        )}
        {status === "error" && (
          <>
            <h2 style={{ fontFamily: ff.heading, fontSize: 20, color: P.red, marginBottom: 8 }}>Error de conexión</h2>
            <p style={{ color: P.textMuted, fontSize: 14, marginBottom: 16 }}>{error}</p>
            <button onClick={() => { window.history.replaceState({}, "", "/"); onError?.(); }}
              style={{ padding: "10px 20px", borderRadius: 10, background: P.red, color: "#fff", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}>
              Volver al inicio
            </button>
          </>
        )}
      </div>
    </div>
  );
}
