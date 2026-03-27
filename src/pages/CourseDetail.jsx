import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { generateCourseSummary, generateQuiz, callAI } from "../services/ai";
import { extractFileText } from "../services/moodle";
import { ensureDriveFolder, uploadMoodleFileToDrive } from "../services/google";
import { Btn, RenderMarkdown } from "../components/UI";
import { BookOpen, Sparkles, HelpCircle, FileText, HardDrive, Check, Eye, Loader } from "lucide-react";

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
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: P.text }}>{selectedMat.name}</h3>
                    <span style={{ fontSize: 11, color: P.textMuted }}>{extractedTexts[selectedMat.id].chars} caracteres extraídos</span>
                  </div>
                  <button onClick={() => setSelectedMat(null)} style={{ background: "none", border: "none", color: P.textMuted, cursor: "pointer", fontSize: 16 }}>✕</button>
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

                {/* File text content preview */}
                <div style={{ padding: "12px 18px", maxHeight: 200, overflow: "auto", fontSize: 12, lineHeight: 1.6, color: P.textSec, background: P.bg, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {extractedTexts[selectedMat.id].text.substring(0, 2000)}
                  {extractedTexts[selectedMat.id].text.length > 2000 && "\n\n... (contenido truncado)"}
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
    </div>
  );
}
