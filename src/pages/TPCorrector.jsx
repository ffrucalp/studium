import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { callAI } from "../services/ai";
import { createGoogleDoc, ensureDriveFolder } from "../services/google";
import CourseMaterialPicker from "../components/CourseMaterialPicker";
import { RenderMarkdown } from "../components/UI";
import ShareButtons from "../components/ShareButtons";
import {
  FileCheck, ArrowLeft, Loader2, Sparkles, ChevronRight,
  Upload, FileText, ClipboardPaste, RotateCcw, CheckCircle,
  AlertTriangle, XCircle, Target, BookOpen,
} from "lucide-react";

const CRITERIA = [
  { id: "general", label: "Revisión general", desc: "Ortografía, gramática, coherencia, estructura" },
  { id: "academic", label: "Ensayo académico", desc: "Tesis, argumentación, citas, conclusión" },
  { id: "monografia", label: "Monografía", desc: "Marco teórico, metodología, bibliografía" },
  { id: "tp", label: "Trabajo práctico", desc: "Respuestas a consignas, desarrollo, fundamentación" },
  { id: "informe", label: "Informe técnico", desc: "Objetivos, análisis, resultados, conclusiones" },
  { id: "apa7", label: "Normas APA 7", desc: "Formato, citas, referencias, márgenes, tipografía APA 7ª ed." },
];

function ScoreBadge({ score }) {
  const color = score >= 8 ? "#059669" : score >= 6 ? "#D97706" : "#DC2626";
  const bg = score >= 8 ? "#ECFDF5" : score >= 6 ? "#FEF3C7" : "#FEF2F2";
  const Icon = score >= 8 ? CheckCircle : score >= 6 ? AlertTriangle : XCircle;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: bg, border: `1px solid ${color}20` }}>
      <Icon size={18} color={color} />
      <span style={{ fontSize: 22, fontWeight: 800, color }}>{score}</span>
      <span style={{ fontSize: 12, color, fontWeight: 600 }}>/10</span>
    </div>
  );
}

export default function TPCorrector() {
  const { courses, moodleToken, googleAccessToken } = useApp();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [text, setText] = useState("");
  const [criteria, setCriteria] = useState("general");
  const [consigna, setConsigna] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfContent, setPdfContent] = useState(null);
  const [inputMode, setInputMode] = useState("paste"); // paste | pdf
  const [apaResult, setApaResult] = useState(null);
  const [apaLoading, setApaLoading] = useState(false);
  const [creatingDoc, setCreatingDoc] = useState(false);

  const handleCorrect = async () => {
    if (!text.trim() && !pdfContent) return;
    setLoading(true);
    setResult(null);

    const criteriaInfo = CRITERIA.find(c => c.id === criteria);
    const consignaPart = consigna.trim() ? `\n\nConsigna o tema del trabajo: "${consigna}"` : "";

    const prompt = `Sos un profesor universitario exigente pero constructivo. Corregí el siguiente trabajo de un alumno de la Lic. en Gobernanza de Datos (UCALP), materia "${selectedCourse.fullname}".

Tipo de trabajo: ${criteriaInfo.label} (${criteriaInfo.desc})${consignaPart}

Respondé SOLO con JSON válido (sin backticks):
{
  "score": 7,
  "summary": "Evaluación general en 2-3 oraciones",
  "categories": [
    {
      "name": "Estructura y organización",
      "score": 8,
      "feedback": "Comentario detallado sobre este aspecto"
    },
    {
      "name": "Contenido y desarrollo",
      "score": 7,
      "feedback": "Comentario detallado"
    },
    {
      "name": "Argumentación y fundamentación",
      "score": 6,
      "feedback": "Comentario detallado"
    },
    {
      "name": "Redacción y gramática",
      "score": 8,
      "feedback": "Comentario detallado"
    },
    {
      "name": "Bibliografía y fuentes",
      "score": 5,
      "feedback": "Comentario detallado"
    }
  ],
  "strengths": ["Fortaleza 1", "Fortaleza 2"],
  "improvements": ["Mejora sugerida 1", "Mejora sugerida 2", "Mejora sugerida 3"],
  "correctedExcerpts": [
    {
      "original": "Fragmento con error del texto original",
      "corrected": "Fragmento corregido",
      "reason": "Explicación breve"
    }
  ]
}

Reglas:
- score general de 1 a 10
- 4-6 categorías de evaluación según el tipo de trabajo
- Cada categoría con score 1-10 y feedback constructivo
- 2-3 fortalezas concretas
- 2-4 mejoras específicas y accionables
- 3-5 correcciones puntuales del texto (fragmentos reales del trabajo)
- Sé constructivo pero honesto`;

    try {
      let aiResult;
      if (pdfContent && inputMode === "pdf") {
        const images = [{ data: pdfContent, mimeType: "application/pdf" }];
        aiResult = await callAI(prompt, undefined, images);
      } else {
        aiResult = await callAI(prompt + `\n\n---\nTrabajo del alumno:\n${text.substring(0, 12000)}`);
      }

      let parsed;
      try {
        const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResult);
      } catch {
        try {
          parsed = JSON.parse(aiResult.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
        } catch {
          // AI didn't return valid JSON — show as text feedback
          setResult({
            score: 0,
            summary: aiResult || "No se pudo procesar el trabajo. Intentá de nuevo.",
            categories: [],
            strengths: [],
            improvements: [],
            correctedExcerpts: [],
          });
          setLoading(false);
          return;
        }
      }
      setResult(parsed);
    } catch (e) {
      console.error(e);
      setResult({
        score: 0,
        summary: "Error al procesar el trabajo: " + (e.message || "Intentá de nuevo en unos segundos."),
        categories: [], strengths: [], improvements: [], correctedExcerpts: [],
      });
    }
    setLoading(false);
  };

  // Convert to APA 7
  const handleAPA = async () => {
    if (!text.trim() && !pdfContent) return;
    setApaLoading(true);
    setApaResult(null);

    const prompt = `Sos un experto en normas APA 7ª edición. Tomá el siguiente trabajo académico y reformatealo completamente según las normas APA 7.

Aplicá estas reglas:
1. **Página de título**: Título centrado en negrita, nombre del autor, institución (UCALP), materia (${selectedCourse.fullname}), fecha
2. **Tipografía**: Indicá que debe usar Times New Roman 12pt, doble espacio, márgenes de 2.54cm
3. **Encabezados**: Usá los 5 niveles de encabezado APA 7 (Nivel 1: centrado negrita, Nivel 2: alineado izquierda negrita, etc.)
4. **Citas en texto**: Convertí las menciones a autores al formato (Autor, año) o (Autor, año, p. X). Si no hay citas, sugerí dónde agregarlas
5. **Referencias**: Reformateá la bibliografía al formato APA 7 (Apellido, Inicial. (Año). Título en cursiva. Editorial.) con sangría francesa
6. **Párrafos**: Sangría de primera línea de 1.27cm, sin espacio extra entre párrafos
7. **Tablas y figuras**: Si hay, indicá el formato APA 7 correcto
8. **Números**: Usá palabras para números del uno al nueve, cifras para 10 en adelante
9. **Lenguaje inclusivo**: Sugerí alternativas si corresponde

Devolvé el trabajo completo reformateado en Markdown, con comentarios entre [NOTA APA: ...] donde sea necesario explicar un cambio. Al final, incluí una checklist de cumplimiento APA 7.`;

    try {
      let aiResult;
      if (pdfContent && inputMode === "pdf") {
        const images = [{ data: pdfContent, mimeType: "application/pdf" }];
        aiResult = await callAI(prompt, undefined, images);
      } else {
        aiResult = await callAI(prompt + `\n\n---\nTrabajo original:\n${text.substring(0, 15000)}`);
      }
      setApaResult(aiResult);
    } catch (e) {
      setApaResult("Error al procesar: " + e.message);
    }
    setApaLoading(false);
  };

  // ═══ APA result view ═══
  if (apaResult) {
    return (
      <div className="fade-in" style={{ maxWidth: 800, margin: "0 auto" }}>
        <button onClick={() => setApaResult(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Volver
        </button>

        <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontFamily: ff.heading, fontSize: 20, fontWeight: 800, color: P.text }}>Trabajo en formato APA 7</h2>
              <p style={{ fontSize: 12, color: P.textMuted, marginTop: 2 }}>{selectedCourse.fullname}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(apaResult); }}
              style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: P.redSoft, color: P.red, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <ClipboardPaste size={13} /> Copiar
            </button>
            {googleAccessToken && (
              <button onClick={async () => {
                setCreatingDoc(true);
                try {
                  const folder = await ensureDriveFolder(googleAccessToken);
                  const doc = await createGoogleDoc(googleAccessToken, {
                    title: `${selectedCourse.fullname} — APA 7`,
                    content: apaResult,
                    folderId: folder?.id,
                  });
                  window.open(doc.url, "_blank");
                } catch (e) { alert("Error al crear documento: " + e.message); }
                setCreatingDoc(false);
              }} disabled={creatingDoc}
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#E8F0FE", color: "#1967D2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {creatingDoc ? <><Loader2 size={13} className="spin" /> Creando...</> : <><BookOpen size={13} /> Google Docs</>}
              </button>
            )}
          </div>
          <div style={{ padding: "20px 24px", maxHeight: "70vh", overflow: "auto" }}>
            <RenderMarkdown text={apaResult} />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <ShareButtons text={apaResult} title={`Trabajo APA 7 — ${selectedCourse.fullname}`} />
          <button onClick={() => setApaResult(null)}
            style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 8, background: P.redSoft, color: P.red, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, border: "none", cursor: "pointer" }}>
            <RotateCcw size={13} /> Volver a convertir
          </button>
        </div>
      </div>
    );
  }

  // ═══ Results view ═══
  if (result) {
    const shareText = `📝 Corrección — ${selectedCourse.fullname}\n\nNota: ${result.score}/10\n${result.summary}\n\n✅ Fortalezas:\n${(result.strengths || []).map(s => `• ${s}`).join("\n")}\n\n📌 Mejoras:\n${(result.improvements || []).map(s => `• ${s}`).join("\n")}`;

    return (
      <div className="fade-in" style={{ maxWidth: 800, margin: "0 auto" }}>
        <button onClick={() => setResult(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Volver al trabajo
        </button>

        {/* Header with score */}
        <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: "24px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontFamily: ff.heading, fontSize: 22, fontWeight: 800, color: P.text, marginBottom: 6 }}>Resultado de la corrección</h2>
              <p style={{ fontSize: 13, color: P.textMuted }}>{selectedCourse.fullname} · {CRITERIA.find(c => c.id === criteria)?.label}</p>
            </div>
            {result.score > 0 && <ScoreBadge score={result.score} />}
          </div>
          {result.summary && (
            <p style={{ fontSize: 14, color: P.textSec, lineHeight: 1.6, marginTop: 14, padding: "12px 16px", background: P.bg, borderRadius: 10 }}>
              {result.summary}
            </p>
          )}
        </div>

        {/* Category scores */}
        {result.categories?.length > 0 && (
          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: "20px 24px", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 14 }}>Evaluación por categorías</h3>
            {result.categories.map((cat, i) => {
              const pct = (cat.score / 10) * 100;
              const color = cat.score >= 8 ? "#059669" : cat.score >= 6 ? "#D97706" : "#DC2626";
              return (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: P.text }}>{cat.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color }}>{cat.score}/10</span>
                  </div>
                  <div style={{ height: 6, background: P.borderLight, borderRadius: 3, marginBottom: 6 }}>
                    <div style={{ height: "100%", background: color, borderRadius: 3, width: `${pct}%`, transition: "width 0.5s" }} />
                  </div>
                  <p style={{ fontSize: 12, color: P.textMuted, lineHeight: 1.5 }}>{cat.feedback}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Strengths & Improvements */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {result.strengths?.length > 0 && (
            <div style={{ background: "#ECFDF5", borderRadius: 14, padding: "18px 20px", border: "1px solid #A7F3D0" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#065F46", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={15} /> Fortalezas
              </h3>
              {result.strengths.map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: "#047857", lineHeight: 1.5, marginBottom: 6, paddingLeft: 8, borderLeft: "2px solid #10B981" }}>
                  {s}
                </div>
              ))}
            </div>
          )}
          {result.improvements?.length > 0 && (
            <div style={{ background: "#FEF3C7", borderRadius: 14, padding: "18px 20px", border: "1px solid #FDE68A" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Target size={15} /> Mejoras sugeridas
              </h3>
              {result.improvements.map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: "#B45309", lineHeight: 1.5, marginBottom: 6, paddingLeft: 8, borderLeft: "2px solid #F59E0B" }}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Corrected excerpts */}
        {result.correctedExcerpts?.length > 0 && (
          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: "20px 24px", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 14 }}>Correcciones puntuales</h3>
            {result.correctedExcerpts.map((ex, i) => (
              <div key={i} style={{ marginBottom: 14, padding: "12px 16px", background: P.bg, borderRadius: 10 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", padding: "1px 6px", borderRadius: 4 }}>Original</span>
                  <span style={{ fontSize: 12, color: "#DC2626", textDecoration: "line-through" }}>{ex.original}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#ECFDF5", padding: "1px 6px", borderRadius: 4 }}>Corregido</span>
                  <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>{ex.corrected}</span>
                </div>
                <div style={{ fontSize: 11, color: P.textMuted, marginTop: 4, paddingLeft: 4 }}>💡 {ex.reason}</div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <ShareButtons text={shareText} title={`Corrección — ${selectedCourse.fullname}`} />
          {googleAccessToken && (
            <button onClick={async () => {
              setCreatingDoc(true);
              try {
                const docContent = `# Corrección — ${selectedCourse.fullname}\n\n**Nota: ${result.score}/10**\n\n${result.summary}\n\n## Evaluación por categorías\n\n${(result.categories || []).map(c => `### ${c.name} (${c.score}/10)\n${c.feedback}`).join("\n\n")}\n\n## Fortalezas\n\n${(result.strengths || []).map(s => `- ${s}`).join("\n")}\n\n## Mejoras sugeridas\n\n${(result.improvements || []).map(s => `- ${s}`).join("\n")}\n\n## Correcciones puntuales\n\n${(result.correctedExcerpts || []).map(e => `- **Original:** ~~${e.original}~~\n  **Corregido:** ${e.corrected}\n  *${e.reason}*`).join("\n\n")}`;
                const folder = await ensureDriveFolder(googleAccessToken);
                const doc = await createGoogleDoc(googleAccessToken, {
                  title: `Corrección — ${selectedCourse.fullname} — ${new Date().toLocaleDateString("es-AR")}`,
                  content: docContent,
                  folderId: folder?.id,
                });
                window.open(doc.url, "_blank");
              } catch (e) { alert("Error: " + e.message); }
              setCreatingDoc(false);
            }} disabled={creatingDoc}
              style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#E8F0FE", color: "#1967D2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {creatingDoc ? <><Loader2 size={13} className="spin" /> Creando...</> : <><BookOpen size={13} /> Google Docs</>}
            </button>
          )}
          <button onClick={() => setResult(null)}
            style={{ marginLeft: "auto", padding: "8px 16px", borderRadius: 8, background: P.redSoft, color: P.red, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, border: "none", cursor: "pointer" }}>
            <RotateCcw size={13} /> Corregir de nuevo
          </button>
        </div>
      </div>
    );
  }

  // ═══ Form view (course selected) ═══
  if (selectedCourse) {
    return (
      <div className="fade-in" style={{ maxWidth: 700, margin: "0 auto" }}>
        <button onClick={() => { setSelectedCourse(null); setText(""); setConsigna(""); setSelectedPdf(null); setPdfContent(null); }}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Volver a materias
        </button>

        <h1 style={{ fontFamily: ff.heading, fontSize: 24, color: P.text, fontWeight: 800, marginBottom: 4 }}>
          {selectedCourse.fullname}
        </h1>
        <p style={{ color: P.textMuted, fontSize: 13, marginBottom: 20 }}>Subí o pegá tu trabajo para que la IA lo corrija</p>

        <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: 24 }}>
          {/* Criteria selector */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: P.text, marginBottom: 8 }}>Tipo de trabajo</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CRITERIA.map(c => (
                <button key={c.id} onClick={() => setCriteria(c.id)}
                  style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: criteria === c.id ? P.red : P.bg,
                    color: criteria === c.id ? "#fff" : P.textSec,
                    border: `1px solid ${criteria === c.id ? P.red : P.border}`,
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                  {c.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: P.textMuted, marginTop: 6 }}>
              {CRITERIA.find(c => c.id === criteria)?.desc}
            </div>
          </div>

          {/* Consigna */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: P.text, marginBottom: 6 }}>Consigna o tema (opcional)</div>
            <input type="text" value={consigna} onChange={e => setConsigna(e.target.value)}
              placeholder="Ej: 'Analizar la ética aristotélica en relación con la gobernanza'"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.bg, fontFamily: ff.body, outline: "none", boxSizing: "border-box" }}
              onFocus={e => e.currentTarget.style.borderColor = P.red} onBlur={e => e.currentTarget.style.borderColor = P.border}
            />
          </div>

          {/* Input mode toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button onClick={() => setInputMode("paste")}
              style={{
                flex: 1, padding: "10px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: inputMode === "paste" ? `${P.red}10` : P.bg,
                color: inputMode === "paste" ? P.red : P.textMuted,
                border: `1.5px solid ${inputMode === "paste" ? P.red : P.border}`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
              }}>
              <ClipboardPaste size={15} /> Pegar texto
            </button>
            <button onClick={() => setInputMode("pdf")}
              style={{
                flex: 1, padding: "10px", borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: inputMode === "pdf" ? `${P.red}10` : P.bg,
                color: inputMode === "pdf" ? P.red : P.textMuted,
                border: `1.5px solid ${inputMode === "pdf" ? P.red : P.border}`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer",
              }}>
              <FileText size={15} /> Usar PDF del aula
            </button>
          </div>

          {/* Text input or PDF picker */}
          {inputMode === "paste" ? (
            <div style={{ marginBottom: 16 }}>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={10}
                placeholder="Pegá acá el texto de tu trabajo práctico, ensayo o monografía..."
                style={{
                  width: "100%", padding: "14px", borderRadius: 10, border: `1.5px solid ${P.border}`,
                  fontSize: 14, color: P.text, background: P.bg, fontFamily: ff.body,
                  outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.7,
                }}
                onFocus={e => e.currentTarget.style.borderColor = P.red} onBlur={e => e.currentTarget.style.borderColor = P.border}
              />
              <div style={{ fontSize: 11, color: P.textMuted, marginTop: 4, textAlign: "right" }}>
                {text.length.toLocaleString()} caracteres
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <CourseMaterialPicker courseId={selectedCourse.id} moodleToken={moodleToken}
                selected={selectedPdf} onSelect={f => { setSelectedPdf(f); setPdfContent(null); }}
                onContentReady={setPdfContent} />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleCorrect}
              disabled={loading || apaLoading || (inputMode === "paste" ? !text.trim() : !pdfContent)}
              style={{
                flex: 1, padding: "14px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: loading || (inputMode === "paste" ? !text.trim() : !pdfContent) ? P.border : P.red,
                color: loading || (inputMode === "paste" ? !text.trim() : !pdfContent) ? P.textMuted : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                cursor: loading ? "not-allowed" : "pointer", border: "none", transition: "all 0.2s",
              }}>
              {loading ? <><Loader2 size={18} className="spin" /> Analizando...</> : <><FileCheck size={18} /> Corregir</>}
            </button>
            <button onClick={handleAPA}
              disabled={loading || apaLoading || (inputMode === "paste" ? !text.trim() : !pdfContent)}
              style={{
                flex: 1, padding: "14px", borderRadius: 12, fontSize: 14, fontWeight: 700,
                background: apaLoading || (inputMode === "paste" ? !text.trim() : !pdfContent) ? P.border : "#1565C0",
                color: apaLoading || (inputMode === "paste" ? !text.trim() : !pdfContent) ? P.textMuted : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                cursor: apaLoading ? "not-allowed" : "pointer", border: "none", transition: "all 0.2s",
              }}>
              {apaLoading ? <><Loader2 size={18} className="spin" /> Convirtiendo...</> : <><BookOpen size={18} /> APA 7</>}
            </button>
          </div>
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
      </div>
    );
  }

  // ═══ Course selection ═══
  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 28, color: P.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <FileCheck size={26} color={P.red} /> Corrector de trabajos
        </h1>
        <p style={{ color: P.textMuted, fontSize: 14, marginTop: 2 }}>
          Subí tu TP, ensayo o monografía y recibí feedback antes de entregar
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {courses.map((course, i) => (
          <button key={course.id} className="slide-in" onClick={() => setSelectedCourse(course)}
            style={{
              animationDelay: `${i * 0.05}s`, background: P.card, borderRadius: 14,
              border: `1px solid ${P.border}`, overflow: "hidden", textAlign: "left",
              cursor: "pointer", transition: "all 0.2s", width: "100%",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${course.color}, ${course.color}88)` }} />
            <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${course.color}12`, color: course.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileCheck size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.fullname}</div>
              </div>
              <ChevronRight size={16} color={P.textMuted} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}