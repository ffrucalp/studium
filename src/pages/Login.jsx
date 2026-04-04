import { P, ff } from "../styles/theme";
import { CONFIG } from "../config";
import { startGoogleLogin } from "../services/google";
import { GraduationCap } from "lucide-react";

export default function Login({ onMockLogin }) {
  const handleLogin = () => {
    if (CONFIG.GOOGLE_CLIENT_ID) {
      // Real Google OAuth
      startGoogleLogin();
    } else {
      // Dev mode: mock login
      onMockLogin?.();
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: P.cream, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.4, backgroundImage: `linear-gradient(${P.border} 1px, transparent 1px), linear-gradient(90deg, ${P.border} 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
      <div style={{ position: "absolute", top: -120, right: -120, width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, ${P.redSoft} 0%, transparent 70%)`, opacity: 0.8 }} />

      <div className="fade-in" style={{ background: P.card, borderRadius: 24, padding: "52px 44px", maxWidth: 440, width: "90%", textAlign: "center", boxShadow: "0 4px 40px rgba(26,82,118,0.08), 0 1px 3px rgba(0,0,0,0.04)", border: `1px solid ${P.border}`, position: "relative" }}>
        <div style={{ marginBottom: 32 }}>
          <img src="/ucalp-logo.png" alt="UCALP" style={{ width: 90, height: 90, borderRadius: 20, margin: "0 auto 20px", display: "block", objectFit: "contain" }} />
          <h1 style={{ fontFamily: ff.heading, fontSize: 36, fontWeight: 800, color: P.red, marginBottom: 6, letterSpacing: -0.5 }}>Studium</h1>
          <p style={{ color: P.textMuted, fontSize: 14, lineHeight: 1.6 }}>
            Plataforma acad\u00e9mica inteligente<br />
            <span style={{ fontWeight: 600, color: P.red }}>Universidad Cat\u00f3lica de La Plata</span>
          </p>
        </div>

        <button onClick={handleLogin}
          style={{ width: "100%", padding: "14px 24px", borderRadius: 12, background: P.card, color: P.text, fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, transition: "all 0.2s", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", border: `1px solid ${P.border}`, cursor: "pointer" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.1)"; e.currentTarget.style.borderColor = P.redMuted; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = P.border; }}>
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Ingresar con @ucalpvirtual.edu.ar
        </button>

        <p style={{ color: P.textMuted, fontSize: 12, marginTop: 20 }}>
          {CONFIG.GOOGLE_CLIENT_ID ? "Se conectará con tu cuenta Google institucional" : "Exclusivo para alumnos con mail institucional (modo demo)"}
        </p>
      </div>
    </div>
  );
}