import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { generateCourseSummary } from "../services/ai";
import { ensureDriveFolder, uploadMoodleFileToDrive } from "../services/google";
import { Btn, RenderMarkdown } from "../components/UI";
import { BookOpen, Sparkles, HelpCircle, FileText, HardDrive, Upload, Check } from "lucide-react";

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
  const { loadCourseMaterials, courseMaterials, googleAccessToken, moodleToken } = useApp();
  const [materials, setMaterials] = useState(null);
  const [matLoading, setMatLoading] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [savedFiles, setSavedFiles] = useState({}); // matId -> { saving, saved, link }

  useEffect(() => {
    let cancelled = false;
    setMatLoading(true);
    loadCourseMaterials(course.id).then(mats => {
      if (!cancelled) { setMaterials(mats); setMatLoading(false); }
    });
    return () => { cancelled = true; };
  }, [course.id, loadCourseMaterials]);

  const saveFileToDrive = async (mat) => {
    if (!googleAccessToken || !moodleToken) {
      alert("Conectá tu cuenta Google para guardar archivos en Drive");
      return;
    }
    const file = mat.files?.[0];
    if (!file?.fileurl) return;

    setSavedFiles(prev => ({ ...prev, [mat.id]: { saving: true } }));
    try {
      const folderId = await ensureDriveFolder(googleAccessToken);
      const result = await uploadMoodleFileToDrive(googleAccessToken, {
        fileUrl: file.fileurl,
        fileName: file.filename || mat.name,
        moodleToken,
        folderId,
      });
      setSavedFiles(prev => ({ ...prev, [mat.id]: { saving: false, saved: true, link: result.link } }));
    } catch (err) {
      setSavedFiles(prev => ({ ...prev, [mat.id]: { saving: false, error: err.message } }));
      alert(`❌ Error: ${err.message}`);
    }
  };

  const handleSummary = async () => {
    setSummaryLoading(true);
    setSummaryData(null);
    // If we have real material names, pass them for context
    const matContext = materials
      ? materials.map(m => `- ${m.name} (${m.section})`).join("\n")
      : null;
    const result = await generateCourseSummary(course.fullname, matContext);
    setSummaryData(result);
    setSummaryLoading(false);
  };

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
            {course.category ? `${course.category} · ` : ""}{materials ? materials.length : "..."} recursos disponibles
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <Btn primary onClick={handleSummary} disabled={summaryLoading}>
          <Sparkles size={16} /> {summaryLoading ? "Generando..." : "Resumen IA"}
        </Btn>
        <Btn onClick={() => onNavigateQuiz(course)}>
          <HelpCircle size={16} /> Cuestionario
        </Btn>
        <Btn onClick={onNavigateChat}>
          <Sparkles size={16} /> Preguntarle al tutor
        </Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: summaryData ? "1fr 1fr" : "1fr", gap: 20 }}>
        {/* Materials */}
        <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${P.borderLight}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Material del aula</h3>
          </div>
          <div style={{ padding: "8px 12px" }}>
            {matLoading ? (
              <div style={{ padding: 20, textAlign: "center", color: P.textMuted }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <div style={{ width: 16, height: 16, border: `2px solid ${P.redMuted}`, borderTopColor: P.red, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Cargando materiales...
                </div>
              </div>
            ) : materials?.map((mat, i) => {
              const c = FILE_COLORS[mat.type] || FILE_COLORS.default;
              const size = mat.size || (mat.files?.[0] ? fileSize(mat.files[0].filesize) : "");
              return (
                <div key={mat.id || i} className="slide-in"
                  style={{ animationDelay: `${i * 0.04}s`, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, transition: "background 0.15s", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = P.cream}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", color: c.fg, flexShrink: 0 }}>
                    <FileText size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: P.text, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{mat.name}</div>
                    <div style={{ fontSize: 11, color: P.textMuted }}>{mat.section}{size ? ` · ${size}` : ""}</div>
                  </div>
                  {/* Drive save button */}
                  {googleAccessToken && mat.files?.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); saveFileToDrive(mat); }}
                      disabled={savedFiles[mat.id]?.saving}
                      title={savedFiles[mat.id]?.saved ? "Guardado en Drive" : "Guardar en Google Drive"}
                      style={{
                        width: 30, height: 30, borderRadius: 7, flexShrink: 0, border: "none", cursor: "pointer",
                        background: savedFiles[mat.id]?.saved ? "#DCFCE7" : "#EFF6FF",
                        color: savedFiles[mat.id]?.saved ? "#16A34A" : "#3B82F6",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s", opacity: savedFiles[mat.id]?.saving ? 0.5 : 1,
                      }}>
                      {savedFiles[mat.id]?.saved ? <Check size={14} /> : <HardDrive size={14} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        {(summaryLoading || summaryData) && (
          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={18} style={{ color: P.red }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Resumen IA</h3>
            </div>
            <div style={{ padding: "16px 20px", maxHeight: 500, overflow: "auto" }}>
              {summaryLoading ? (
                <div>{[1,2,3,4,5].map(i => <div key={i} className="shimmer" style={{ height: i === 1 ? 24 : 16, marginBottom: 12, width: i === 1 ? "60%" : `${70 + Math.random() * 30}%` }} />)}</div>
              ) : <RenderMarkdown text={summaryData} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
