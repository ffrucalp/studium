import { useState, useEffect, useRef, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { CONFIG } from "../config";
import { useApp } from "../context/AppContext";
import { generateCourseSummary, generateQuiz, callAI } from "../services/ai";
import { extractFileText, downloadFile, getForumsByCourse, getForumDiscussions, getDiscussionPosts, addForumReply, addForumDiscussion } from "../services/moodle";
import { ensureDriveFolder, uploadMoodleFileToDrive, listDriveFolders, createDriveFolder } from "../services/google";
import { Btn, RenderMarkdown } from "../components/UI";
import ShareButtons from "../components/ShareButtons";
import { BookOpen, Sparkles, HelpCircle, FileText, HardDrive, Check, Eye, Loader, Maximize2, Minimize2, Type, FolderOpen, ChevronRight, ChevronDown, Plus, ArrowLeft, FileSearch, MessageSquare, Megaphone, Users, Clock } from "lucide-react";

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
 * Formats plain extracted text into styled HTML paragraphs.
 * Handles both well-structured text (with newlines) and wall-of-text blobs.
 */
function FormattedContent({ text }) {
  if (!text) return null;

  // Step 1: Clean garbled characters but preserve Spanish
  let clean = text
    .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  // Step 2: Join lines that were split mid-sentence by PDF extraction
  // If a line doesn't end with punctuation/colon and next starts with lowercase → join
  const rawLines = clean.split("\n");
  const joined = [];
  let current = "";

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      if (current) { joined.push(current); current = ""; }
      joined.push(""); // paragraph break
      continue;
    }

    if (!current) {
      current = line;
    } else {
      // Check if previous line ended mid-sentence
      const endsWithPunct = /[.!?:;,\-—]$/.test(current);
      const nextStartsLower = /^[a-záéíóúñü]/.test(line);
      const currentShort = current.length < 80;
      const lineShort = line.length < 15;

      if (!endsWithPunct && nextStartsLower && !lineShort) {
        // Join: mid-sentence break
        current += " " + line;
      } else if (!endsWithPunct && currentShort && line.length > 10 && !/^[A-ZÁÉÍÓÚÑÜ\d•\-►]/.test(line)) {
        // Short line not ending with punct + next line is normal text → join
        current += " " + line;
      } else {
        joined.push(current);
        current = line;
      }
    }
  }
  if (current) joined.push(current);

  // Step 3: Split into paragraph blocks (empty lines = paragraph break)
  const blocks = [];
  let buf = [];
  for (const line of joined) {
    if (line === "") {
      if (buf.length > 0) { blocks.push(buf.join(" ")); buf = []; }
    } else {
      buf.push(line);
    }
  }
  if (buf.length > 0) blocks.push(buf.join(" "));

  // Step 4: If still very few blocks and long text, split on sentence boundaries
  const finalBlocks = [];
  for (const block of blocks) {
    if (block.length > 800) {
      // Split on ". " followed by uppercase
      const parts = block.split(/\.\s+(?=[A-ZÁÉÍÓÚÑÜ])/).map((p, i, arr) => i < arr.length - 1 ? p + "." : p);
      finalBlocks.push(...parts.filter(p => p.trim()));
    } else {
      finalBlocks.push(block);
    }
  }

  // Detect headings (conservative)
  const isHeading = (t) => {
    if (t.length > 120 || t.length < 3) return false;
    // Explicit academic heading keywords
    if (/^(SEMANA|UNIDAD|TEMA|MÓDULO|SECCIÓN|CAPÍTULO|PARTE|CLASE|BLOQUE)\s*\d/i.test(t)) return true;
    if (/^(INTRODUCCIÓN|CONCLUSIÓN|BIBLIOGRAFÍA|OBJETIVOS|CONTENIDOS|EVALUACIÓN|PROGRAMA|FUNDAMENTACIÓN|METODOLOGÍA|CRONOGRAMA)\b/i.test(t)) return true;
    if (/^(FACULTAD|CARRERA|ASIGNATURA|TRABAJO PRÁCTICO|TP \d)/i.test(t)) return true;
    // ALL CAPS and short (but must have at least 2 words to avoid false positives)
    if (/^[A-ZÁÉÍÓÚÑÜ\s\d.:–\-]+$/.test(t) && t.length < 60 && t.split(/\s+/).length >= 2 && !/^\d+\.?\s*$/.test(t)) return true;
    return false;
  };

  const isListItem = (t) => /^[\-•·▪►]\s/.test(t) || /^[a-z]\)\s/i.test(t);
  const isNumberedItem = (t) => /^\d+[\.\)]\s/.test(t) && t.length < 300;

  return (
    <div style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, lineHeight: 1.8, color: P.textSec }}>
      {finalBlocks.map((para, i) => {
        if (isHeading(para)) {
          return (
            <h3 key={i} style={{
              fontSize: 16, fontWeight: 700, color: P.red,
              fontFamily: "'Crimson Pro', serif",
              margin: i === 0 ? "0 0 10px" : "24px 0 8px",
              paddingBottom: 4, borderBottom: `1px solid ${P.borderLight}`,
            }}>
              {para}
            </h3>
          );
        }

        if (isListItem(para)) {
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, paddingLeft: 12 }}>
              <span style={{ color: P.red, fontWeight: 600, flexShrink: 0 }}>•</span>
              <span>{para.replace(/^[\-•·▪►]\s*/, "")}</span>
            </div>
          );
        }

        if (isNumberedItem(para)) {
          const numMatch = para.match(/^(\d+[\.\)])\s*/);
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, paddingLeft: 8 }}>
              <span style={{ color: P.red, fontWeight: 700, flexShrink: 0, minWidth: 22 }}>{numMatch[1]}</span>
              <span>{para.replace(/^\d+[\.\)]\s*/, "")}</span>
            </div>
          );
        }

        return (
          <p key={i} style={{ marginBottom: 12, textAlign: "justify" }}>
            {para}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Google Drive folder picker modal
 */
function FolderPicker({ accessToken, fileName, onSelect, onClose }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState(null); // null = root
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: "Mi Drive" }]);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);

  // Load folders when navigating
  useEffect(() => {
    setLoading(true);
    listDriveFolders(accessToken, currentFolderId)
      .then(f => { setFolders(f || []); setLoading(false); })
      .catch(() => { setFolders([]); setLoading(false); });
  }, [accessToken, currentFolderId]);

  const navigateInto = (folder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateTo = (index) => {
    const target = breadcrumb[index];
    setCurrentFolderId(target.id);
    setBreadcrumb(prev => prev.slice(0, index + 1));
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreating(true);
    try {
      const folder = await createDriveFolder(accessToken, newFolderName.trim(), currentFolderId);
      setFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName("");
      setShowNewFolder(false);
    } catch {}
    setCreating(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: P.card, borderRadius: 18, width: "100%", maxWidth: 500,
        maxHeight: "70vh", display: "flex", flexDirection: "column",
        boxShadow: "0 16px 48px rgba(0,0,0,0.25)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${P.borderLight}`, background: P.cream }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <HardDrive size={18} style={{ color: P.red }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text }}>Guardar en Google Drive</h3>
            </div>
            <button onClick={onClose}
              style={{ width: 28, height: 28, borderRadius: 8, background: P.borderLight, color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ fontSize: 12, color: P.textMuted, background: P.bg, padding: "6px 10px", borderRadius: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <FileText size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
            {fileName}
          </div>
        </div>

        {/* Breadcrumb */}
        <div style={{ padding: "10px 20px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", fontSize: 12 }}>
          {breadcrumb.map((crumb, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {i > 0 && <ChevronRight size={12} style={{ color: P.textMuted }} />}
              <button onClick={() => navigateTo(i)}
                style={{ background: "none", border: "none", color: i === breadcrumb.length - 1 ? P.red : P.textMuted, fontWeight: i === breadcrumb.length - 1 ? 700 : 400, cursor: "pointer", fontSize: 12, padding: "2px 4px", borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = P.cream}
                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* Folder list */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px 12px", minHeight: 200 }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <div style={{ width: 14, height: 14, border: `2px solid ${P.redMuted}`, borderTopColor: P.red, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Cargando carpetas...
            </div>
          ) : (
            <>
              {folders.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: P.textMuted, fontSize: 13 }}>
                  No hay subcarpetas acá
                </div>
              )}
              {folders.map(folder => (
                <button key={folder.id} onClick={() => navigateInto(folder)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 8, border: "none", background: "transparent",
                    cursor: "pointer", textAlign: "left", fontSize: 13, color: P.text,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = P.cream}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <FolderOpen size={18} style={{ color: "#FBBC05", flexShrink: 0 }} />
                  <span style={{ fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.name}</span>
                  <ChevronRight size={14} style={{ color: P.textMuted, flexShrink: 0 }} />
                </button>
              ))}
            </>
          )}
        </div>

        {/* New folder */}
        {showNewFolder && (
          <div style={{ padding: "10px 20px", borderTop: `1px solid ${P.borderLight}`, display: "flex", gap: 8 }}>
            <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateFolder()}
              placeholder="Nombre de la carpeta"
              autoFocus
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, outline: "none" }} />
            <button onClick={handleCreateFolder} disabled={creating || !newFolderName.trim()}
              style={{ padding: "8px 14px", borderRadius: 8, background: P.red, color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", opacity: creating ? 0.6 : 1 }}>
              {creating ? "..." : "Crear"}
            </button>
            <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
              style={{ padding: "8px 10px", borderRadius: 8, background: P.borderLight, color: P.textMuted, fontSize: 12, border: "none", cursor: "pointer" }}>✕</button>
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${P.borderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: P.bg }}>
          <button onClick={() => setShowNewFolder(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "transparent", color: P.textSec, fontSize: 12, fontWeight: 600, border: `1px solid ${P.border}`, cursor: "pointer" }}>
            <Plus size={14} /> Nueva carpeta
          </button>
          <button onClick={() => onSelect(currentFolderId)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 8, background: P.red, color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
            <HardDrive size={14} /> Guardar aquí
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * PDF Viewer Modal - uses Adobe PDF Embed API with AI sidebar
 */
function PDFViewerModal({ mat, moodleToken, onClose }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const viewerInitialized = useRef(false);
  // AI panel
  const [aiOpen, setAiOpen] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState("");

  useEffect(() => {
    let cancelled = false;
    const file = mat.files?.[0];
    if (!file?.fileurl || !moodleToken) return;

    (async () => {
      try {
        const data = await downloadFile(moodleToken, file.fileurl);
        if (cancelled) return;

        const binary = atob(data.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });

        if (CONFIG.ADOBE_CLIENT_ID && window.AdobeDC && !viewerInitialized.current) {
          viewerInitialized.current = true;
          const adobeDCView = new window.AdobeDC.View({
            clientId: CONFIG.ADOBE_CLIENT_ID,
            divId: "studium-pdf-viewer",
            locale: "es-ES",
          });
          adobeDCView.previewFile({
            content: { promise: Promise.resolve(bytes.buffer) },
            metaData: { fileName: file.filename || mat.name, id: String(mat.id) },
          }, {
            embedMode: "FULL_WINDOW",
            showAnnotationTools: true, showDownloadPDF: true, showPrintPDF: true,
            enableAnnotationAPIs: true, includePDFAnnotations: true, defaultViewMode: "FIT_PAGE",
          });
          setLoading(false);
        } else {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [mat, moodleToken]);

  // AI action handler - always use vision since PDF is already downloaded
  const handleAI = async (action) => {
    setAiOpen(true);
    setAiAction(action);
    setAiResult(null);
    setAiLoading(true);

    const actionInstructions = {
      resumir: "Resumí el contenido de forma clara y estructurada. Usá títulos y puntos clave.",
      conceptos: "Extraé los conceptos clave. Para cada concepto, da una definición breve.",
      preguntas: "Generá 10 preguntas de repaso con sus respuestas basadas en el contenido.",
      explicar: "Explicá el contenido de forma simple y didáctica, como si le explicaras a un estudiante. Usá ejemplos.",
    };

    try {
      const file = mat.files?.[0];
      const data = await downloadFile(moodleToken, file.fileurl);
      const prompt = `Analizá este documento PDF académico universitario. ${actionInstructions[action]}\n\nRespondé en español de forma académica y clara.`;
      const images = [{ data: data.content, mimeType: "application/pdf" }];
      const result = await callAI(prompt, undefined, images);
      setAiResult(result);
    } catch (e) {
      setAiResult("Error al procesar: " + e.message);
    }
    setAiLoading(false);
  };

  const aiActions = [
    { id: "resumir", label: "Resumir", icon: "📋" },
    { id: "conceptos", label: "Conceptos clave", icon: "💡" },
    { id: "preguntas", label: "Preguntas", icon: "❓" },
    { id: "explicar", label: "Explicar", icon: "📖" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "8px 16px", background: "#1A1A1A", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <FileSearch size={16} style={{ color: "#D97706", flexShrink: 0 }} />
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {mat.name}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {aiActions.map(a => (
            <button key={a.id} onClick={() => handleAI(a.id)}
              style={{
                padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: aiAction === a.id && aiOpen ? P.red : "rgba(255,255,255,0.1)",
                color: aiAction === a.id && aiOpen ? "#fff" : "rgba(255,255,255,0.7)",
                border: "none", cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 4,
              }}
              onMouseEnter={e => { if (aiAction !== a.id) e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={e => { if (aiAction !== a.id) e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}>
              {a.icon} {a.label}
            </button>
          ))}
        </div>
        <button onClick={onClose}
          style={{ padding: "5px 14px", borderRadius: 6, background: P.red, color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", marginLeft: 8 }}>
          ✕
        </button>
      </div>

      {/* Content: PDF + AI panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* PDF Viewer */}
        <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {loading && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", gap: 10 }}>
              <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Cargando PDF...
            </div>
          )}
          {error && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: P.redMuted, flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Error al cargar el PDF</span>
              <span style={{ fontSize: 13 }}>{error}</span>
            </div>
          )}
          <div id="studium-pdf-viewer" style={{ width: "100%", height: "100%" }} />
          {blobUrl && <iframe src={blobUrl} title={mat.name} style={{ width: "100%", height: "100%", border: "none" }} />}
        </div>

        {/* AI Side Panel */}
        {aiOpen && (
          <div style={{ width: 380, maxWidth: "40vw", background: P.bg, borderLeft: `1px solid ${P.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: P.text }}>
                {aiActions.find(a => a.id === aiAction)?.icon} {aiActions.find(a => a.id === aiAction)?.label}
              </span>
              <button onClick={() => setAiOpen(false)} style={{ color: P.textMuted, padding: 4, fontSize: 16 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "14px 16px" }}>
              {aiLoading && (
                <div style={{ textAlign: "center", padding: 20, color: P.textMuted, fontSize: 13 }}>
                  <div style={{ width: 14, height: 14, border: `2px solid ${P.redMuted}`, borderTopColor: P.red, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                  Analizando PDF con IA...
                </div>
              )}
              {aiResult && !aiLoading && (
                <>
                  <RenderMarkdown text={aiResult} />
                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${P.borderLight}` }}>
                    <ShareButtons text={aiResult} title={`${aiActions.find(a => a.id === aiAction)?.label} — ${mat.name}`} compact />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Forums & Announcements section
 */
function ForumsSection({ forums, moodleToken, loading }) {
  const [discussions, setDiscussions] = useState({}); // forumId -> discussions[]
  const [posts, setPosts] = useState({}); // discussionId -> posts[]
  const [loadingDisc, setLoadingDisc] = useState({});
  const [loadingPosts, setLoadingPosts] = useState({});
  const [expandedForum, setExpandedForum] = useState(null);
  const [expandedDisc, setExpandedDisc] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  // Reply state
  const [replyTo, setReplyTo] = useState(null); // { discId, postId }
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(null);
  // New discussion state
  const [newDiscForum, setNewDiscForum] = useState(null); // forumId
  const [newDiscSubject, setNewDiscSubject] = useState("");
  const [newDiscMessage, setNewDiscMessage] = useState("");
  const [newDiscSending, setNewDiscSending] = useState(false);

  const loadDiscussions = async (forumId) => {
    if (discussions[forumId]) {
      setExpandedForum(expandedForum === forumId ? null : forumId);
      return;
    }
    setLoadingDisc(p => ({ ...p, [forumId]: true }));
    setExpandedForum(forumId);
    const discs = await getForumDiscussions(moodleToken, forumId);
    setDiscussions(p => ({ ...p, [forumId]: discs }));
    setLoadingDisc(p => ({ ...p, [forumId]: false }));
  };

  const loadPosts = async (discId) => {
    if (posts[discId]) {
      setExpandedDisc(expandedDisc === discId ? null : discId);
      return;
    }
    setLoadingPosts(p => ({ ...p, [discId]: true }));
    setExpandedDisc(discId);
    const ps = await getDiscussionPosts(moodleToken, discId);
    setPosts(p => ({ ...p, [discId]: ps }));
    setLoadingPosts(p => ({ ...p, [discId]: false }));
  };

  const summarizeDiscussion = async (disc, discPosts) => {
    setAiSummaryLoading(true);
    setAiSummary(null);
    const postsText = discPosts
      .map(p => {
        const author = p.userfullname || p.author?.fullname || "Anónimo";
        const text = (p.message || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
        return `${author}: ${text}`;
      })
      .join("\n\n");
    const prompt = `Resumí la siguiente discusión del foro "${disc.name || disc.subject}" de forma clara y organizada. Identificá los temas principales, las posturas de los participantes, y las conclusiones o acuerdos si los hay:\n\n${postsText.substring(0, 8000)}`;
    const result = await callAI(prompt);
    setAiSummary(result);
    setAiSummaryLoading(false);
  };

  const summarizeForum = async (forum) => {
    setAiSummaryLoading(true);
    setAiSummary(null);
    // Load all discussions if not loaded
    let discs = discussions[forum.id];
    if (!discs) {
      discs = await getForumDiscussions(moodleToken, forum.id);
      setDiscussions(p => ({ ...p, [forum.id]: discs }));
    }
    // Load posts for each discussion (first 5)
    const allPostsText = [];
    for (const disc of discs.slice(0, 5)) {
      let ps = posts[disc.discussion || disc.id];
      if (!ps) {
        ps = await getDiscussionPosts(moodleToken, disc.discussion || disc.id);
        setPosts(p => ({ ...p, [disc.discussion || disc.id]: ps }));
      }
      const discTitle = disc.name || disc.subject || "Sin título";
      const postsStr = ps.map(p => {
        const author = p.userfullname || p.author?.fullname || "Anónimo";
        const text = (p.message || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
        return `  ${author}: ${text}`;
      }).join("\n");
      allPostsText.push(`--- ${discTitle} ---\n${postsStr}`);
    }
    const prompt = `Resumí todo lo discutido en el foro "${forum.name}" de forma clara y organizada. Identificá los temas principales, las ideas destacadas y los aportes más relevantes:\n\n${allPostsText.join("\n\n").substring(0, 10000)}`;
    const result = await callAI(prompt);
    setAiSummary(result);
    setAiSummaryLoading(false);
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = new Date(ts * 1000);
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  };

  const stripHtml = (html) => (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

  // Reply to a post
  const handleReply = async (discId) => {
    if (!replyText.trim() || !replyTo) return;
    setReplySending(true);
    try {
      await addForumReply(moodleToken, replyTo.postId, replyText.trim());
      setReplySuccess(discId);
      setReplyText("");
      setReplyTo(null);
      // Reload posts for this discussion
      const ps = await getDiscussionPosts(moodleToken, discId);
      setPosts(p => ({ ...p, [discId]: ps }));
      setTimeout(() => setReplySuccess(null), 3000);
    } catch (e) {
      alert("Error al responder: " + e.message);
    }
    setReplySending(false);
  };

  // Create a new discussion
  const handleNewDiscussion = async (forumId) => {
    if (!newDiscSubject.trim() || !newDiscMessage.trim()) return;
    setNewDiscSending(true);
    try {
      await addForumDiscussion(moodleToken, forumId, newDiscSubject.trim(), newDiscMessage.trim());
      setNewDiscSubject(""); setNewDiscMessage(""); setNewDiscForum(null);
      // Reload discussions
      const discs = await getForumDiscussions(moodleToken, forumId);
      setDiscussions(p => ({ ...p, [forumId]: discs }));
    } catch (e) {
      alert("Error al crear tema: " + e.message);
    }
    setNewDiscSending(false);
  };

  if (loading) {
    return (
      <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: 20 }}>
        <div className="shimmer" style={{ height: 20, width: "40%", marginBottom: 12 }} />
        {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 44, marginBottom: 8 }} />)}
      </div>
    );
  }

  if (!forums || forums.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <h2 style={{ fontFamily: ff.heading, fontSize: 20, fontWeight: 700, color: P.text, marginBottom: 14 }}>
        Foros y Avisos
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {forums.map(forum => {
          const isNews = forum.type === "news";
          const isExpanded = expandedForum === forum.id;
          const forumDiscs = discussions[forum.id] || [];

          return (
            <div key={forum.id} style={{ background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, overflow: "hidden" }}>
              {/* Forum header */}
              <button onClick={() => loadDiscussions(forum.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
                }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: isNews ? "#FEF3C7" : "#E0E7FF",
                  color: isNews ? "#D97706" : "#4F46E5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isNews ? <Megaphone size={18} /> : <MessageSquare size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{forum.name}</div>
                  {forum.intro && (
                    <div style={{ fontSize: 12, color: P.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {stripHtml(forum.intro).substring(0, 100)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {forum.numdiscussions != null && (
                    <span style={{ fontSize: 11, color: P.textMuted, background: P.borderLight, padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
                      {forum.numdiscussions} {forum.numdiscussions === 1 ? "tema" : "temas"}
                    </span>
                  )}
                  {isExpanded ? <ChevronDown size={16} style={{ color: P.textMuted }} /> : <ChevronRight size={16} style={{ color: P.textMuted }} />}
                </div>
              </button>

              {/* Discussions list */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${P.borderLight}` }}>
                  {loadingDisc[forum.id] ? (
                    <div style={{ padding: 16, textAlign: "center", color: P.textMuted, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <div style={{ width: 14, height: 14, border: `2px solid ${P.redMuted}`, borderTopColor: P.red, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      Cargando discusiones...
                    </div>
                  ) : forumDiscs.length === 0 ? (
                    <div style={{ padding: 16, textAlign: "center", color: P.textMuted, fontSize: 13 }}>
                      No hay discusiones en este foro
                    </div>
                  ) : (
                    <>
                      {/* Summarize forum + New topic buttons */}
                      <div style={{ padding: "8px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => summarizeForum(forum)} disabled={aiSummaryLoading}
                          style={{ padding: "5px 12px", borderRadius: 6, background: P.redSoft, color: P.red, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: aiSummaryLoading ? 0.5 : 1 }}>
                          <Sparkles size={12} /> Resumir con IA
                        </button>
                        {forum.type !== "news" && (
                          <button onClick={() => setNewDiscForum(newDiscForum === forum.id ? null : forum.id)}
                            style={{ padding: "5px 12px", borderRadius: 6, background: "#E0E7FF", color: "#4F46E5", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            <MessageSquare size={12} /> Nuevo tema
                          </button>
                        )}
                      </div>

                      {/* New discussion form */}
                      {newDiscForum === forum.id && (
                        <div style={{ padding: "14px 18px", background: P.cream, borderBottom: `1px solid ${P.borderLight}` }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: P.text, marginBottom: 8 }}>Crear nuevo tema de discusión</div>
                          <input type="text" value={newDiscSubject} onChange={e => setNewDiscSubject(e.target.value)}
                            placeholder="Título del tema..."
                            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${P.border}`, fontSize: 13, fontFamily: ff.body, color: P.text, background: P.card, outline: "none", marginBottom: 8, boxSizing: "border-box" }}
                          />
                          <textarea value={newDiscMessage} onChange={e => setNewDiscMessage(e.target.value)} rows={3}
                            placeholder="Escribí tu mensaje..."
                            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${P.border}`, fontSize: 13, fontFamily: ff.body, color: P.text, background: P.card, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                          />
                          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                            <button onClick={() => { setNewDiscForum(null); setNewDiscSubject(""); setNewDiscMessage(""); }}
                              style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, color: P.textMuted, background: P.borderLight, border: "none", cursor: "pointer" }}>
                              Cancelar
                            </button>
                            <button onClick={() => handleNewDiscussion(forum.id)} disabled={!newDiscSubject.trim() || !newDiscMessage.trim() || newDiscSending}
                              style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#fff", background: (!newDiscSubject.trim() || !newDiscMessage.trim()) ? P.border : "#4F46E5", border: "none", cursor: (!newDiscSubject.trim() || !newDiscMessage.trim()) ? "not-allowed" : "pointer" }}>
                              {newDiscSending ? "Creando..." : "Publicar tema"}
                            </button>
                          </div>
                        </div>
                      )}

                      {forumDiscs.map(disc => {
                        const discId = disc.discussion || disc.id;
                        const isDiscExpanded = expandedDisc === discId;
                        const discPosts = posts[discId] || [];
                        const author = disc.userfullname || disc.firstname ? `${disc.firstname || ""} ${disc.lastname || ""}`.trim() : "Anónimo";

                        return (
                          <div key={discId}>
                            <button onClick={() => loadPosts(discId)}
                              style={{
                                width: "100%", display: "flex", alignItems: "center", gap: 10,
                                padding: "10px 18px", background: isDiscExpanded ? `${P.cream}` : "transparent",
                                border: "none", borderBottom: `1px solid ${P.borderLight}`, cursor: "pointer", textAlign: "left",
                              }}
                              onMouseEnter={e => { if (!isDiscExpanded) e.currentTarget.style.background = P.cream; }}
                              onMouseLeave={e => { if (!isDiscExpanded) e.currentTarget.style.background = "transparent"; }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: P.text }}>{disc.name || disc.subject}</div>
                                <div style={{ fontSize: 11, color: P.textMuted, display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                  <Users size={10} /> {author}
                                  {disc.numreplies != null && <span>· {disc.numreplies} respuestas</span>}
                                  <Clock size={10} style={{ marginLeft: 4 }} /> {formatDate(disc.timemodified || disc.created)}
                                </div>
                              </div>
                              {isDiscExpanded ? <ChevronDown size={14} style={{ color: P.textMuted }} /> : <ChevronRight size={14} style={{ color: P.textMuted }} />}
                            </button>

                            {/* Posts */}
                            {isDiscExpanded && (
                              <div style={{ background: P.bg, borderBottom: `1px solid ${P.borderLight}` }}>
                                {loadingPosts[discId] ? (
                                  <div style={{ padding: 14, textAlign: "center", color: P.textMuted, fontSize: 12 }}>Cargando mensajes...</div>
                                ) : (
                                  <>
                                    {/* AI summarize button */}
                                    {discPosts.length > 1 && (
                                      <div style={{ padding: "8px 24px" }}>
                                        <button onClick={() => summarizeDiscussion(disc, discPosts)} disabled={aiSummaryLoading}
                                          style={{ padding: "4px 10px", borderRadius: 5, background: P.redSoft, color: P.red, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, opacity: aiSummaryLoading ? 0.5 : 1 }}>
                                          <Sparkles size={10} /> Resumir discusión
                                        </button>
                                      </div>
                                    )}
                                    {discPosts.map((post, pi) => {
                                      const postAuthor = post.userfullname || post.author?.fullname || "Anónimo";
                                      const postDate = formatDate(post.created || post.timecreated);
                                      const postText = stripHtml(post.message);
                                      return (
                                        <div key={post.id || pi} className="slide-in"
                                          style={{
                                            animationDelay: `${pi * 0.04}s`,
                                            padding: "12px 24px", borderBottom: `1px solid ${P.borderLight}`,
                                            marginLeft: pi > 0 ? 16 : 0,
                                          }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                            <div style={{
                                              width: 26, height: 26, borderRadius: 7,
                                              background: pi === 0 ? P.redSoft : "#E0E7FF",
                                              color: pi === 0 ? P.red : "#4F46E5",
                                              display: "flex", alignItems: "center", justifyContent: "center",
                                              fontSize: 11, fontWeight: 700,
                                            }}>
                                              {postAuthor.charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: P.text }}>{postAuthor}</span>
                                            <span style={{ fontSize: 11, color: P.textMuted }}>{postDate}</span>
                                            <button onClick={() => setReplyTo({ discId, postId: post.id })}
                                              style={{ marginLeft: "auto", fontSize: 11, color: P.red, fontWeight: 600, background: P.redSoft, padding: "2px 8px", borderRadius: 5, border: "none", cursor: "pointer" }}>
                                              Responder
                                            </button>
                                          </div>
                                          <div style={{ fontSize: 13, lineHeight: 1.6, color: P.textSec, paddingLeft: 34 }}>
                                            {postText.substring(0, 500)}
                                            {postText.length > 500 && "..."}
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* Reply success message */}
                                    {replySuccess === discId && (
                                      <div style={{ padding: "10px 24px", color: "#059669", fontSize: 12, fontWeight: 600, background: "#ECFDF5" }}>
                                        ✓ Respuesta enviada correctamente
                                      </div>
                                    )}

                                    {/* Reply textarea */}
                                    {replyTo?.discId === discId && (
                                      <div style={{ padding: "12px 24px", background: P.cream, borderTop: `1px solid ${P.borderLight}` }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: P.textSec, marginBottom: 6 }}>Escribir respuesta:</div>
                                        <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3}
                                          placeholder="Escribí tu respuesta..."
                                          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${P.border}`, fontSize: 13, fontFamily: ff.body, color: P.text, background: P.card, outline: "none", resize: "vertical", boxSizing: "border-box" }}
                                          onFocus={e => e.currentTarget.style.borderColor = P.red} onBlur={e => e.currentTarget.style.borderColor = P.border}
                                        />
                                        <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                                          <button onClick={() => { setReplyTo(null); setReplyText(""); }}
                                            style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, color: P.textMuted, background: P.borderLight, border: "none", cursor: "pointer" }}>
                                            Cancelar
                                          </button>
                                          <button onClick={() => handleReply(discId)} disabled={!replyText.trim() || replySending}
                                            style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: "#fff", background: !replyText.trim() ? P.border : P.red, border: "none", cursor: !replyText.trim() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                            {replySending ? "Enviando..." : "Enviar respuesta"}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AI Summary result */}
      {(aiSummaryLoading || aiSummary) && (
        <div style={{ marginTop: 16, background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} style={{ color: P.red }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: P.text }}>Resumen del foro</h3>
            <button onClick={() => setAiSummary(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: P.textMuted, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ padding: "14px 18px", maxHeight: 400, overflow: "auto" }}>
            {aiSummaryLoading ? (
              <div>{[1, 2, 3, 4].map(i => <div key={i} className="shimmer" style={{ height: i === 1 ? 22 : 16, marginBottom: 10, width: `${60 + Math.random() * 40}%` }} />)}</div>
            ) : <>
              <RenderMarkdown text={aiSummary} />
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${P.borderLight}` }}>
                <ShareButtons text={aiSummary} title="Resumen del foro" />
              </div>
            </>}
          </div>
        </div>
      )}
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
  const [folderPickerMat, setFolderPickerMat] = useState(null); // material awaiting folder selection
  const [pdfViewerMat, setPdfViewerMat] = useState(null); // material being viewed as PDF
  const [pdfLoading, setPdfLoading] = useState(false);

  // Forum state
  const [forums, setForums] = useState(null);
  const [forumsLoading, setForumsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMatLoading(true);
    loadCourseMaterials(course.id).then(mats => {
      if (!cancelled) { setMaterials(mats); setMatLoading(false); }
    });
    return () => { cancelled = true; };
  }, [course.id, loadCourseMaterials]);

  // Load forums for this course
  const loadForums = useCallback(async () => {
    if (!moodleToken || moodleToken === "mock_token") return;
    setForumsLoading(true);
    try {
      const forumList = await getForumsByCourse(moodleToken, course.id);
      setForums(Array.isArray(forumList) ? forumList : []);
    } catch { setForums([]); }
    setForumsLoading(false);
  }, [moodleToken, course.id]);

  useEffect(() => { loadForums(); }, [loadForums]);

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
  // Save to Drive (with specific folder from picker)
  const saveFileToDrive = async (mat, selectedFolderId = null) => {
    if (!googleAccessToken || !moodleToken) return;
    const file = mat.files?.[0];
    if (!file?.fileurl) return;
    setSavedFiles(prev => ({ ...prev, [mat.id]: { saving: true } }));
    setFolderPickerMat(null);
    try {
      const folderId = selectedFolderId || await ensureDriveFolder(googleAccessToken);
      const result = await uploadMoodleFileToDrive(googleAccessToken, {
        fileUrl: file.fileurl, fileName: file.filename || mat.name,
        moodleToken, folderId,
      });
      setSavedFiles(prev => ({ ...prev, [mat.id]: { saving: false, saved: true, link: result.link } }));
    } catch (err) {
      setSavedFiles(prev => ({ ...prev, [mat.id]: { saving: false, error: err.message } }));
    }
  };

  // Open PDF in full viewer
  const openPdfViewer = async (mat) => {
    const file = mat.files?.[0];
    if (!file?.fileurl || !moodleToken) return;
    const isPdf = (file.mimetype || "").includes("pdf") || (file.filename || "").toLowerCase().endsWith(".pdf");
    if (!isPdf) return;
    setPdfLoading(true);
    setPdfViewerMat(mat);
    // The actual PDF loading happens inside the PDFViewerModal component
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
                  onClick={() => {
                    if (mat.type === "forum" || mat.type === "url" || mat.type === "assign" || mat.type === "quiz") {
                      if (mat.url) window.open(mat.url, "_blank");
                    } else if (extracted?.text) {
                      setSelectedMat(mat);
                    }
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = P.cream; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{ width: 34, height: 34, borderRadius: 7, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", color: c.fg, flexShrink: 0 }}>
                    {mat.type === "forum" ? <MessageSquare size={16} /> : mat.type === "url" ? <ChevronRight size={16} /> : mat.type === "assign" ? <BookOpen size={16} /> : mat.type === "quiz" ? <HelpCircle size={16} /> : <FileText size={16} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: P.text, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{mat.name}</div>
                    <div style={{ fontSize: 11, color: P.textMuted }}>
                      {mat.section}{size ? ` · ${size}` : ""}
                      {mat.type === "forum" && <span style={{ color: "#E65100", fontWeight: 600 }}> · Foro — Abrir en Moodle</span>}
                      {mat.type === "url" && <span style={{ color: "#2E7D32", fontWeight: 600 }}> · Enlace externo</span>}
                      {mat.type === "assign" && <span style={{ color: "#2563EB", fontWeight: 600 }}> · Actividad — Abrir en Moodle</span>}
                      {mat.type === "quiz" && <span style={{ color: "#6A1B9A", fontWeight: 600 }}> · Cuestionario — Abrir en Moodle</span>}
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
                    {hasFile && ((mat.files?.[0]?.mimetype || "").includes("pdf") || (mat.files?.[0]?.filename || "").toLowerCase().endsWith(".pdf")) && (
                      <button onClick={(e) => { e.stopPropagation(); openPdfViewer(mat); }}
                        title="Ver PDF completo"
                        style={{ width: 28, height: 28, borderRadius: 6, background: "#FEF3C7", color: "#D97706", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
                        <FileSearch size={13} />
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
                      <button onClick={(e) => { e.stopPropagation(); setFolderPickerMat(mat); }}
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
                  ) : <>
                    <RenderMarkdown text={summaryData} />
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${P.borderLight}` }}>
                      <ShareButtons text={summaryData} title={`Resumen — ${course.fullname}`} />
                    </div>
                  </>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Forums & Announcements ── */}
      <ForumsSection forums={forums} moodleToken={moodleToken} loading={forumsLoading} />

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
              <FormattedContent text={extractedTexts[selectedMat.id].text} />
            </div>
          </div>
        </div>
      )}

      {/* ── Folder Picker Modal ── */}
      {folderPickerMat && googleAccessToken && (
        <FolderPicker
          accessToken={googleAccessToken}
          fileName={folderPickerMat.files?.[0]?.filename || folderPickerMat.name}
          onSelect={(folderId) => saveFileToDrive(folderPickerMat, folderId)}
          onClose={() => setFolderPickerMat(null)}
        />
      )}

      {/* PDF Viewer Modal */}
      {pdfViewerMat && (
        <PDFViewerModal
          mat={pdfViewerMat}
          moodleToken={moodleToken}
          onClose={() => { setPdfViewerMat(null); setPdfLoading(false); }}
        />
      )}
    </div>
  );
}