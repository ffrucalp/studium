import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { generateCourseSummary, generateQuiz, callAI } from "../services/ai";
import { extractFileText } from "../services/moodle";
import { ensureDriveFolder, uploadMoodleFileToDrive } from "../services/google";
import { Btn, RenderMarkdown } from "../components/UI";
import { BookOpen, Sparkles, HelpCircle, FileText, HardDrive, Check, Eye, Loader, Maximize2, Minimize2, Type } from "lucide-react";

const FILE_COLORS = {
  resource: { bg: "#FFEBEE", fg: "#B71C1C" },
  page: { bg: "#E3F2FD", fg: "#1565C0" },
  assign: { bg: "#DBEAFE", fg: "#2563EB" },
  url: { bg: "#E8F5E9", fg: "#2E7D32" },
  forum: { bg: "#FFF3E0", fg: "#E65100" },
  quiz: { bg: "#F3E5F5", fg: "#6A1B9A" },
  default: { bg: "#F5F5F5", fg: "#616161" },
};

function fileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats plain extracted text into styled HTML paragraphs
 */
function FormattedContent({ text, fullHeight }) {
  if (!text) return null;

  // Split into paragraphs (double newline or single newline with indent/caps change)
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  return (
    <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, lineHeight: 1.75, color: P.textSec }}>
      {paragraphs.map((para, i) => {
        // Detect if it looks like a heading (short, no period at end, possibly all caps or starts with number.)
        const isHeading = para.length < 120 && !para.endsWith(".") && !para.endsWith(",") && (
          /^[A-ZÁÉÍÓÚÑÜ\s\d.:–\-]+$/.test(para) ||
          /^\d+[\.\)\-]\s/.test(para) ||
          /^(CAPÍTULO|UNIDAD|TEMA|MÓDULO|SECCIÓN|PARTE|INTRODUCCIÓN|CONCLUSIÓN|BIBLIOGRAFÍA|RESUMEN)/i.test(para)
        );

        // Detect if it looks like a list item
        const isListItem = /^[\-•·▪►]\s/.test(para) || /^[a-z]\)\s/i.test(para);
        const isNumberedItem = /^\d+[\.\)]\s/.test(para) && para.length < 300;

        // Detect sub-lines within the paragraph
        const subLines = para.split("\n").map(l => l.trim()).filter(Boolean);

        if (isHeading) {
          return (
            <h3 key={i} style={{
              fontSize: para.length < 60 ? 17 : 15,
              fontWeight: 700,
              color: P.red,
              fontFamily: "'Crimson Pro', serif",
              margin: i === 0 ? "0 0 12px" : "24px 0 10px",
              paddingBottom: 6,
              borderBottom: `1px solid ${P.borderLight}`,
            }}>
              {para}
            </h3>
          );
        }

        if (isListItem || isNumberedItem) {
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, paddingLeft: 8 }}>
              <span style={{ color: P.red, fontWeight: 600, flexShrink: 0 }}>
                {isNumberedItem ? para.match(/^\d+[\.\)]/)[0] : "•"}
              </span>
              <span>{isNumberedItem ? para.replace(/^\d+[\.\)]\s*/, "") : para.replace(/^[\-•·▪►]\s*/, "")}</span>
            </div>
          );
        }

        // Regular paragraph - handle sub-lines
        if (subLines.length > 1) {
          return (
            <div key={i} style={{ marginBottom: 12 }}>
              {subLines.map((line, j) => {
                const isSubList = /^[\-•·▪►]\s/.test(line) || /^[a-z]\)\s/i.test(line) || /^\d+[\.\)]\s/.test(line);
                if (isSubList) {
                  return (
                    <div key={j} style={{ display: "flex", gap: 8, marginBottom: 4, paddingLeft: 12 }}>
                      <span style={{ color: P.redLight, flexShrink: 0, fontSize: 12 }}>•</span>
                      <span style={{ fontSize: 13 }}>{line.replace(/^[\-•·▪►\d]+[\.\)]*\s*/, "")}</span>
                    </div>
                  );
                }
                return <p key={j} style={{ margin: "2px 0" }}>{line}</p>;
              })}
            </div>
          );
        }

        return (
          <p key={i} style={{
            margin: "0 0 12px",
            textAlign: "justify",
            hyphens: "auto",
          }}>
            {para}
          </p>
        );
      })}
    </div>
  );
}

export default function CourseDetail({ course, onBack, onNavigateChat, onNavigateQuiz }) {
  const { loadCourseMaterials, googleAccessToken, moodleToken } = useApp();
  const [materials, setMaterials] = useState(null);
  const [matLoading, setMatLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [savedFiles, setSavedFiles] = useState({});
  const [extractedTexts, setExtractedTexts] = useState({}); // matId -> { loading, text, error }
  const [selectedMat, setSelectedMat] = useState(null); // material being viewed
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [expandedView, setExpandedView] = useState(false); // full-screen content view

  useEffect(() => {
    let cancelled = false;
    setMatLoading(true);
    loadCourseMaterials(course.id).then(mats => {
      if (!cancelled) { setMaterials(mats); setMatLoading(false); }
    });
    return () => { cancelled = true; };
  }, [course.id, loadCourseMaterials]);

  // Extract text from a file
  const extractText = async (mat) => {
    const file = mat.files?.[0];
    if (!file?.fileurl || !moodleToken) return;

    setExtractedTexts(prev => ({ ...prev, [mat.id]: { loading: true } }));
    try {
      const result = await extractFileText(moodleToken, file.fileurl);
      setExtractedTexts(prev => ({
        ...prev,
        [mat.id]: { loading: false, text: result.text, chars: result.chars },
      }));
      setSelectedMat(mat);
    } catch (err) {
      setExtractedTexts(prev => ({
        ...prev,
        [mat.id]: { loading: false, error: err.message },
      }));
    }
  };

  // Generate AI summary from ALL extracted texts
  const handleSummaryWithContent = async () => {
    setSummaryLoading(true);
    setSummaryData(null);

    // Gather all extracted texts
    const allTexts = Object.entries(extractedTexts)
      .filter(([_, v]) => v.text)
      .map(([id, v]) => {
        const mat = materials?.find(m => String(m.id) === id);
        return `--- ${mat?.name || "Archivo"} ---\n${v.text.substring(0, 3000)}`;
      })
      .join("\n\n");

    // Also include material names for context
    const matNames = materials
      ? materials.map(m => `- ${m.name} (${m.section})`).join("\n")
      : "";

    const context = allTexts
      ? `Estos son los contenidos reales extraídos de los materiales:\n\n${allTexts.substring(0, 8000)}`
      : matNames
      ? `Estos son los materiales disponibles:\n${matNames}`
      : null;

    const result = await generateCourseSummary(course.fullname, context);
    setSummaryData(result);
    setSummaryLoading(false);
  };

  // Analyze a specific file with AI
  const analyzeWithAI = async (mat, prompt) => {
    const extracted = extractedTexts[mat.id];
    if (!extracted?.text) return;

    setAiAnalysisLoading(true);
    setAiAnalysis(null);
    const result = await callAI(
      `${prompt}\n\nContenido del archivo "${mat.name}":\n---\n${extracted.text.substring(0, 8000)}\n---`,
    );
    setAiAnalysis(result);
    setAiAnalysisLoading(false);
  };

  // Save to Drive
  const saveFileToDrive = async (mat) => {
    if (!googleAccessToken || !moodleToken) return;
    const file = mat.files?.[0];
    if (!file?.fileurl) return;
    setSavedFiles(prev => ({ ...prev, [mat.id]: { saving: true } }));
    try {
      const folderId = await ensureDriveFolder(googleAccessToken);
      const result = await uploadMoodleFileToDrive(googleAccessToken, {
        fileUrl: file.fileurl, fileName: file.filename || mat.name,
        moodleToken, folderId,
      });
      setSavedFiles(prev => ({ ...prev, [mat.id]: { saving: false, saved: true, link: result.link } }));
    } catch (err) {
      setSavedFiles(prev => ({ ...prev, [mat.id]: { saving: false, error: err.message } }));
    }
  };

  const extractedCount = Object.values(extractedTexts).filter(v => v.text).length;

  return (
    <div className="fade-in">
      <button onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 6, color: P.red, fontSize: 14, fontWeight: 500, background: "none", marginBottom: 20, padding: "6px 0", cursor: "pointer" }}>
        ← Volver a materias
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `${course.color}12`, display: "flex", alignItems: "center", justifyContent: "center", color: course.color }}>
          <BookOpen size={26} />
        </div>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 26, color: P.text, fontWeight: 800 }}>{course.fullname}</h1>
          <p style={{ color: P.textMuted, fontSize: 14 }}>
            {course.category ? `${course.category} · ` : ""}{materials ? materials.length : "..."} recursos
            {extractedCount > 0 && ` · ${extractedCount} archivos leídos por la IA`}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <Btn primary onClick={handleSummaryWithContent} disabled={summaryLoading}>
          <Sparkles size={16} /> {summaryLoading ? "Generando..." : extractedCount > 0 ? "Resumen IA (con contenido)" : "Resumen IA"}
        </Btn>
        <Btn onClick={() => onNavigateQuiz(course)}>
          <HelpCircle size={16} /> Cuestionario
        </Btn>
        <Btn onClick={onNavigateChat}>
          <Sparkles size={16} /> Preguntarle al tutor
        </Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: (summaryData || selectedMat) ? "1fr 1fr" : "1fr", gap: 20 }}>
        {/* Materials list */}
        <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Material del aula</h3>
            {materials?.some(m => m.files?.length > 0) && (
              <button onClick={async () => {
                for (const mat of materials) {
                  if (mat.files?.length > 0 && !extractedTexts[mat.id]) await extractText(mat);
                }
              }}
              style={{ fontSize: 12, color: P.red, fontWeight: 600, background: P.redSoft, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer" }}>
                Leer todos
              </button>
            )}
          </div>
          <div style={{ padding: "8px 12px", maxHeight: 500, overflow: "auto" }}>
            {matLoading ? (
              <div style={{ padding: 20, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <div style={{ width: 16, height: 16, border: `2px solid ${P.redMuted}`, borderTopColor: P.red, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Cargando materiales...
              </div>
            ) : materials?.map((mat, i) => {
              const c = FILE_COLORS[mat.type] || FILE_COLORS.default;
              const size = mat.size || (mat.files?.[0] ? fileSize(mat.files[0].filesize) : "");
              const hasFile = mat.files?.length > 0;
              const extracted = extractedTexts[mat.id];
              const isSelected = selectedMat?.id === mat.id;

              return (
                <div key={mat.id || i} className="slide-in"
                  style={{
                    animationDelay: `${i * 0.04}s`, display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 8, transition: "all 0.15s", cursor: "pointer",
                    background: isSelected ? `${course.color}08` : "transparent",
                    borderLeft: isSelected ? `3px solid ${course.color}` : "3px solid transparent",
                  }}
                  onClick={() => extracted?.text && setSelectedMat(mat)}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = P.cream; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: 34, height: 34, borderRadius: 7, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", color: c.fg, flexShrink: 0 }}>
                    <FileText size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: P.text, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{mat.name}</div>
                    <div style={{ fontSize: 11, color: P.textMuted }}>
                      {mat.section}{size ? ` · ${size}` : ""}
                      {extracted?.text && <span style={{ color: "#16A34A", fontWeight: 600 }}> · ✓ {extracted.chars} chars</span>}
                      {extracted?.loading && <span style={{ color: P.red }}> · leyendo...</span>}
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                    {hasFile && !extracted?.text && (
                      <button onClick={(e) => { e.stopPropagation(); extractText(mat); }}
                        disabled={extracted?.loading}
                        title="Leer archivo con IA"
                        style={{ width: 28, height: 28, borderRadius: 6, background: "#EFF6FF", color: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", opacity: extracted?.loading ? 0.5 : 1 }}>
                        <Eye size={13} />
                      </button>
                    )}
                    {extracted?.text && (
                      <button onClick={(e) => { e.stopPropagation(); setSelectedMat(mat); }}
                        title="Ver contenido"
                        style={{ width: 28, height: 28, borderRadius: 6, background: "#DCFCE7", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
                        <Check size={13} />
                      </button>
                    )}
                    {googleAccessToken && hasFile && (
                      <button onClick={(e) => { e.stopPropagation(); saveFileToDrive(mat); }}
                        disabled={savedFiles[mat.id]?.saving}
                        title={savedFiles[mat.id]?.saved ? "Guardado en Drive" : "Guardar en Drive"}
                        style={{ width: 28, height: 28, borderRadius: 6, background: savedFiles[mat.id]?.saved ? "#DCFCE7" : "#F3E8FF", color: savedFiles[mat.id]?.saved ? "#16A34A" : "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", opacity: savedFiles[mat.id]?.saving ? 0.5 : 1 }}>
                        <HardDrive size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel: Summary, File Preview, or AI Analysis */}
        {(summaryLoading || summaryData || selectedMat || aiAnalysis) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* File preview */}
            {selectedMat && extractedTexts[selectedMat.id]?.text && (
              <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: P.redSoft, display: "flex", alignItems: "center", justifyContent: "center", color: P.red, flexShrink: 0 }}>
                      <FileText size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedMat.name}</h3>
                      <span style={{ fontSize: 11, color: P.textMuted }}>{extractedTexts[selectedMat.id].chars.toLocaleString()} caracteres</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setExpandedView(true)} title="Ver completo"
                      style={{ width: 30, height: 30, borderRadius: 8, background: P.cream, color: P.red, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
                      <Maximize2 size={14} />
                    </button>
                    <button onClick={() => setSelectedMat(null)}
                      style={{ width: 30, height: 30, borderRadius: 8, background: P.borderLight, color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>✕</button>
                  </div>
                </div>

                {/* AI action buttons for this file */}
                <div style={{ padding: "10px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { label: "Resumir", prompt: "Haceme un resumen claro y organizado del siguiente contenido:" },
                    { label: "Conceptos clave", prompt: "Extraé los conceptos clave y definiciones del siguiente contenido:" },
                    { label: "Preguntas de repaso", prompt: "Generame 5 preguntas de repaso sobre el siguiente contenido:" },
                    { label: "Explicar", prompt: "Explicame este contenido de forma simple y didáctica, como si fuera un profesor:" },
                  ].map((action, i) => (
                    <button key={i} onClick={() => analyzeWithAI(selectedMat, action.prompt)}
                      disabled={aiAnalysisLoading}
                      style={{ padding: "5px 10px", borderRadius: 6, background: P.redSoft, color: P.red, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: aiAnalysisLoading ? 0.5 : 1 }}>
                      {action.label}
                    </button>
                  ))}
                </div>

                {/* Formatted file content preview */}
                <div style={{ padding: "20px 24px", maxHeight: 400, overflow: "auto", background: P.bg }}>
                  <FormattedContent text={extractedTexts[selectedMat.id].text} />
                </div>
              </div>
            )}

            {/* AI Analysis result */}
            {(aiAnalysisLoading || aiAnalysis) && (
              <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} style={{ color: P.red }} />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: P.text }}>Análisis IA</h3>
                  <button onClick={() => setAiAnalysis(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: P.textMuted, cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
                <div style={{ padding: "14px 18px", maxHeight: 400, overflow: "auto" }}>
                  {aiAnalysisLoading ? (
                    <div>{[1,2,3,4].map(i => <div key={i} className="shimmer" style={{ height: i === 1 ? 22 : 16, marginBottom: 10, width: `${60 + Math.random() * 40}%` }} />)}</div>
                  ) : <RenderMarkdown text={aiAnalysis} />}
                </div>
              </div>
            )}

            {/* General Summary */}
            {(summaryLoading || summaryData) && (
              <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} style={{ color: P.red }} />
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: P.text }}>Resumen de la materia</h3>
                </div>
                <div style={{ padding: "14px 18px", maxHeight: 400, overflow: "auto" }}>
                  {summaryLoading ? (
                    <div>{[1,2,3,4,5].map(i => <div key={i} className="shimmer" style={{ height: i === 1 ? 22 : 16, marginBottom: 10, width: `${50 + Math.random() * 50}%` }} />)}</div>
                  ) : <RenderMarkdown text={summaryData} />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Full-screen expanded content viewer ── */}
      {expandedView && selectedMat && extractedTexts[selectedMat.id]?.text && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setExpandedView(false); }}>
          <div style={{
            background: P.card, borderRadius: 20,
            width: "100%", maxWidth: 820, maxHeight: "90vh",
            display: "flex", flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}>
            {/* Modal header */}
            <div style={{
              padding: "18px 24px", borderBottom: `1px solid ${P.borderLight}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: P.cream, flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: P.redSoft, display: "flex", alignItems: "center", justifyContent: "center", color: P.red, flexShrink: 0 }}>
                  <FileText size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: P.text, fontFamily: "'Crimson Pro', serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedMat.name}
                  </h2>
                  <span style={{ fontSize: 12, color: P.textMuted }}>
                    {extractedTexts[selectedMat.id].chars.toLocaleString()} caracteres · {selectedMat.section}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {/* AI buttons in modal */}
                {[
                  { label: "Resumir", prompt: "Haceme un resumen claro y organizado del siguiente contenido:" },
                  { label: "Conceptos clave", prompt: "Extraé los conceptos clave y definiciones del siguiente contenido:" },
                  { label: "Preguntas", prompt: "Generame 5 preguntas de repaso sobre el siguiente contenido:" },
                ].map((action, i) => (
                  <button key={i} onClick={() => { setExpandedView(false); analyzeWithAI(selectedMat, action.prompt); }}
                    style={{ padding: "6px 12px", borderRadius: 8, background: P.redSoft, color: P.red, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {action.label}
                  </button>
                ))}
                <button onClick={() => setExpandedView(false)}
                  style={{ width: 34, height: 34, borderRadius: 10, background: P.borderLight, color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", fontSize: 18 }}>
                  ✕
                </button>
              </div>
            </div>

            {/* Modal content - full formatted text */}
            <div style={{ flex: 1, overflow: "auto", padding: "28px 36px" }}>
              <FormattedContent text={extractedTexts[selectedMat.id].text} fullHeight />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}