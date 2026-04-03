import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { getCourseContents, downloadFile } from "../services/moodle";
import { FileText, Loader2, ChevronDown, ChevronRight, Check } from "lucide-react";

/**
 * CourseMaterialPicker - shows PDF files from a course for selection
 * Props:
 *   courseId: number
 *   moodleToken: string
 *   selected: object | null - currently selected file
 *   onSelect: (file) => void - { name, fileurl, filename, size }
 *   onContentReady: (base64) => void - called with downloaded base64 content
 */
export default function CourseMaterialPicker({ courseId, moodleToken, selected, onSelect, onContentReady }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!courseId || !moodleToken) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const contents = await getCourseContents(moodleToken, courseId);
        const pdfFiles = [];
        for (const section of (contents || [])) {
          for (const mod of (section.modules || [])) {
            if (mod.modname === "resource" && mod.contents?.[0]) {
              const file = mod.contents[0];
              const fn = (file.filename || "").toLowerCase();
              const mt = file.mimetype || "";
              if (fn.endsWith(".pdf") || mt.includes("pdf")) {
                pdfFiles.push({
                  id: mod.id,
                  name: mod.name,
                  filename: file.filename,
                  fileurl: file.fileurl,
                  size: file.filesize,
                  section: section.name || "General",
                });
              }
            }
          }
        }
        if (!cancelled) setFiles(pdfFiles);
      } catch (e) { console.error(e); }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [courseId, moodleToken]);

  const handleSelect = async (file) => {
    onSelect(file);
    if (onContentReady) {
      setDownloading(true);
      try {
        const data = await downloadFile(moodleToken, file.fileurl);
        onContentReady(data.content);
      } catch (e) {
        console.error("Error downloading:", e);
      }
      setDownloading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div style={{ padding: "12px 14px", background: P.bg, borderRadius: 10, border: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 8, color: P.textMuted, fontSize: 12 }}>
        <Loader2 size={14} className="spin" /> Cargando archivos del aula...
      </div>
    );
  }

  if (files.length === 0) return null;

  return (
    <div style={{ background: P.bg, borderRadius: 10, border: `1px solid ${P.borderLight}`, overflow: "hidden" }}>
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", background: "transparent", border: "none",
          color: P.text, fontSize: 12, fontWeight: 700, cursor: "pointer",
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <FileText size={14} color={P.red} />
        PDFs del aula ({files.length})
        {selected && <span style={{ marginLeft: "auto", fontSize: 11, color: "#059669", fontWeight: 600, textTransform: "none" }}>✓ {selected.name}</span>}
      </button>

      {/* File list */}
      {expanded && (
        <div style={{ padding: "0 6px 8px", maxHeight: 200, overflow: "auto" }}>
          {files.map((file) => {
            const isSelected = selected?.id === file.id;
            return (
              <button key={file.id} onClick={() => handleSelect(file)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 8, textAlign: "left",
                  background: isSelected ? `${P.red}08` : "transparent",
                  border: isSelected ? `1.5px solid ${P.red}40` : "1.5px solid transparent",
                  transition: "all 0.15s", cursor: "pointer",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = P.cream; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? `${P.red}08` : "transparent"; }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: isSelected ? P.redSoft : "#FEF2F2",
                  color: isSelected ? P.red : "#DC2626",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isSelected ? <Check size={14} /> : <FileText size={14} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: 10, color: P.textMuted }}>
                    {file.section} · {formatSize(file.size)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {downloading && (
        <div style={{ padding: "8px 14px", borderTop: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 6, color: P.textMuted, fontSize: 11 }}>
          <Loader2 size={12} className="spin" /> Descargando PDF para análisis...
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}