import { Component } from "react";
import { P, ff } from "../styles/theme";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Studium Error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", background: P.cream, padding: 20,
        }}>
          <div style={{
            background: P.card, borderRadius: 20, padding: "40px 36px",
            maxWidth: 460, width: "100%", textAlign: "center",
            border: `1px solid ${P.border}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, background: P.redSoft,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", fontSize: 28,
            }}>
              ⚠️
            </div>
            <h2 style={{ fontFamily: ff.heading, fontSize: 22, color: P.text, marginBottom: 8 }}>
              Algo salió mal
            </h2>
            <p style={{ color: P.textMuted, fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>
              Ocurrió un error inesperado. Intentá recargar la página.
            </p>
            <pre style={{
              background: P.bg, padding: 12, borderRadius: 8, fontSize: 12,
              color: P.red, textAlign: "left", overflow: "auto", maxHeight: 120,
              marginBottom: 20, border: `1px solid ${P.border}`,
            }}>
              {this.state.error?.message || "Error desconocido"}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "12px 28px", borderRadius: 10, background: P.red,
                color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                border: "none",
              }}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
