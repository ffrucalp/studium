import { useState, useRef } from "react";
import { P, ff } from "../styles/theme";
import { Btn } from "../components/UI";
import { RenderMarkdown } from "../components/UI";
import { CONFIG } from "../config";
import {
  Camera, Upload, FileText, Loader2, Download, Copy, CheckCircle,
  Printer, Trash2, Image, Plus, X, Sparkles,
} from "lucide-react";

const VISION_MODEL = "google/gemini-flash-1.5-8b";
const AI_URL = `${CONFIG.API_BASE}/api/ai`;

const SYSTEM_PROMPT = `Sos un asistente académico experto en digitalización de apuntes universitarios.
Tu tarea es extraer TODO el texto visible en la imagen, ya sea manuscrito o impreso.
Reglas:
- Transcribí el texto lo más fielmente posible
- Corregí errores ortográficos obvios pero mantené el contenido original
- Estructurá el contenido con títulos (##), subtítulos (###), listas y párrafos en Markdown
- Si hay fórmulas matemáticas, escribilas en formato legible
- Si hay diagramas o esquemas, describilos brevemente entre [corchetes]
- Si hay tablas, recrealas en formato Markdown
- Respondé SOLO con el texto extraído y estructurado, sin comentarios adicionales`;

export default function ScanNotes() {
  const [images, setImages] = useState([]); // { file, preview, base64 }
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const addImage = async (file) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);
    setImages(prev => [...prev, { file, preview, base64 }]);
  };

  const removeImage = (index) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const fileToBase64 = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

  const handleFiles = (e) => {
    Array.from(e.target.files || []).forEach(addImage);
    e.target.value = "";
  };

  const processImages = async () => {
    if (images.length === 0) return;
    setLoading(true); setResult("");

    try {
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: images.length === 1
            ? "Extraé y estructurá todo el texto de esta imagen de apuntes."
            : `Extraé y estructurá todo el texto de estas ${images.length} imágenes de apuntes. Unificá todo en un solo documento coherente.`,
          systemPrompt: SYSTEM_PROMPT,
          model: VISION_MODEL,
          images: images.map(img => img.base64),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(`**Error:** ${data.error}`);
      } else {
        setResult(data.response || "No se pudo extraer texto de la imagen.");
      }
    } catch (err) {
      setResult("**Error:** No se pudo procesar la imagen. Intentá de nuevo.");
    } finally { setLoading(false); }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    const blob = new Blob([result], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `apuntes_${new Date().toISOString().slice(0, 10)}.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  const printResult = () => {
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Apuntes Digitalizados</title>
      <style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;line-height:1.8;color:#1a1a1a}
      h1,h2,h3{font-family:'Crimson Pro',serif;color:#B71C1C}table{border-collapse:collapse;width:100%}
      td,th{border:1px solid #ccc;padding:8px;text-align:left}pre,code{background:#f5f5f5;padding:2px 6px;border-radius:3px}
      @media print{body{margin:20px}}</style></head>
      <body>${result.replace(/\n/g, "<br>")}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const reset = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]); setResult("");
  };

  return (
    <div className="fade-in" style={{ maxWidth: 780, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 30, color: P.text, fontWeight: 800, marginBottom: 6 }}>
          <Camera size={28} style={{ verticalAlign: "-4px", marginRight: 10, color: P.red }} />
          Digitalizar Apuntes
        </h1>
        <p style={{ color: P.textMuted, fontSize: 15 }}>
          Subí fotos de tus apuntes y la IA los convierte en texto estructurado
        </p>
      </div>

      {/* Upload area */}
      {!result && (
        <>
          <div
            style={{
              border: `2px dashed ${images.length > 0 ? P.red : P.border}`,
              borderRadius: 16, padding: images.length > 0 ? 16 : "48px 20px",
              textAlign: "center", transition: "all 0.2s",
              background: images.length > 0 ? "transparent" : P.card,
            }}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = P.red; e.currentTarget.style.background = P.redSoft; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = images.length > 0 ? P.red : P.border; e.currentTarget.style.background = images.length > 0 ? "transparent" : P.card; }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = P.red; e.currentTarget.style.background = "transparent"; Array.from(e.dataTransfer.files).forEach(addImage); }}
          >
            {images.length === 0 ? (
              <>
                <Image size={48} color={P.textMuted} strokeWidth={1.2} style={{ marginBottom: 14 }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: P.text, marginBottom: 6 }}>
                  Arrastrá tus fotos acá
                </div>
                <div style={{ fontSize: 13, color: P.textMuted, marginBottom: 20 }}>
                  o usá los botones para subir archivos o sacar una foto
                </div>
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12, marginBottom: 12 }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: "relative", borderRadius: 10, overflow: "hidden", aspectRatio: "4/3" }}>
                    <img src={img.preview} alt={`Apunte ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button onClick={() => removeImage(i)}
                      style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12, background: "rgba(0,0,0,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <X size={14} />
                    </button>
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 8px", background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 10, textAlign: "center" }}>
                      Imagen {i + 1}
                    </div>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()}
                  style={{
                    borderRadius: 10, aspectRatio: "4/3", border: `2px dashed ${P.border}`,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    color: P.textMuted, fontSize: 12, gap: 4, transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = P.red; e.currentTarget.style.color = P.red; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.color = P.textMuted; }}
                >
                  <Plus size={20} /> Agregar
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFiles} style={{ display: "none" }} />
              <Btn onClick={() => fileRef.current?.click()} style={{ borderRadius: 10 }}>
                <Upload size={16} /> Subir archivos
              </Btn>
              <Btn onClick={() => cameraRef.current?.click()} style={{ borderRadius: 10 }}>
                <Camera size={16} /> Sacar foto
              </Btn>
            </div>
          </div>

          {/* Process button */}
          {images.length > 0 && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <Btn primary onClick={processImages} disabled={loading} style={{ padding: "14px 32px", borderRadius: 14, fontSize: 15 }}>
                {loading ? <Loader2 size={20} className="spin" /> : <Sparkles size={20} />}
                {loading ? "Procesando..." : `Digitalizar ${images.length} imagen${images.length > 1 ? "es" : ""}`}
              </Btn>
            </div>
          )}
        </>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <Loader2 size={36} color={P.red} className="spin" style={{ marginBottom: 14 }} />
          <div style={{ fontSize: 15, color: P.text, fontWeight: 600, marginBottom: 6 }}>Analizando apuntes...</div>
          <div style={{ fontSize: 13, color: P.textMuted }}>La IA está leyendo y estructurando el texto de tus imágenes</div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div>
          {/* Actions bar */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <Btn onClick={copyToClipboard} style={{ borderRadius: 10 }}>
              {copied ? <CheckCircle size={16} color="#059669" /> : <Copy size={16} />}
              {copied ? "Copiado" : "Copiar texto"}
            </Btn>
            <Btn onClick={downloadTxt} style={{ borderRadius: 10 }}>
              <Download size={16} /> Descargar .md
            </Btn>
            <Btn onClick={printResult} style={{ borderRadius: 10 }}>
              <Printer size={16} /> Imprimir / PDF
            </Btn>
            <button onClick={reset} style={{ marginLeft: "auto", fontSize: 13, color: P.textMuted, display: "flex", alignItems: "center", gap: 4 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = P.red; }} onMouseLeave={(e) => { e.currentTarget.style.color = P.textMuted; }}>
              <Trash2 size={14} /> Nueva digitalización
            </button>
          </div>

          {/* Preview of images used */}
          {images.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
              {images.map((img, i) => (
                <img key={i} src={img.preview} alt="" style={{ height: 60, borderRadius: 8, border: `1px solid ${P.border}`, flexShrink: 0 }} />
              ))}
            </div>
          )}

          {/* Rendered result */}
          <div style={{
            background: P.card, borderRadius: 16, border: `1px solid ${P.border}`,
            padding: "24px 28px", lineHeight: 1.75,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.red, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
              Texto digitalizado
            </div>
            <RenderMarkdown text={result} />
          </div>
        </div>
      )}

      {/* Tips */}
      {images.length === 0 && !result && (
        <div style={{ marginTop: 28, padding: "20px 24px", borderRadius: 14, background: P.borderLight }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 10 }}>Tips para mejores resultados:</div>
          <div style={{ fontSize: 13, color: P.textSec, lineHeight: 1.7 }}>
            · Sacá la foto con buena iluminación y sin sombras<br />
            · Intentá que el papel esté lo más recto posible<br />
            · Podés subir varias páginas y se unifican en un solo documento<br />
            · Funciona con letra manuscrita, impresa, pizarrones y pantallas<br />
            · Las fórmulas matemáticas se transcriben en formato legible
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}
