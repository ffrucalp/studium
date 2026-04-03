import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { ensureDriveFolder, listDriveFiles, listDriveFolders, createDriveFolder } from "../services/google";
import {
  X, FolderOpen, FileText, Image, File, Film, Music,
  ChevronRight, ArrowLeft, Plus, Loader2, ExternalLink,
  HardDrive, FolderPlus,
} from "lucide-react";

const ICONS = {
  "application/pdf": { icon: FileText, color: "#DC2626" },
  "application/vnd.google-apps.folder": { icon: FolderOpen, color: "#D97706" },
  "image/": { icon: Image, color: "#059669" },
  "video/": { icon: Film, color: "#7c3aed" },
  "audio/": { icon: Music, color: "#0891b2" },
};

function getIcon(mime) {
  if (!mime) return { icon: File, color: P.textMuted };
  for (const [k, v] of Object.entries(ICONS)) {
    if (mime.startsWith(k) || mime.includes(k)) return v;
  }
  if (mime.includes("document") || mime.includes("word")) return { icon: FileText, color: "#2563eb" };
  if (mime.includes("spreadsheet") || mime.includes("excel")) return { icon: FileText, color: "#059669" };
  if (mime.includes("presentation") || mime.includes("powerpoint")) return { icon: FileText, color: "#EA580C" };
  return { icon: File, color: P.textMuted };
}

function formatSize(bytes) {
  if (!bytes) return "";
  const n = parseInt(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export default function DriveModal({ onClose }) {
  const { googleAccessToken } = useApp();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rootId, setRootId] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    if (!googleAccessToken) { setLoading(false); return; }
    loadRoot();
  }, [googleAccessToken]);

  const loadRoot = async () => {
    setLoading(true);
    try {
      const folder = await ensureDriveFolder(googleAccessToken);
      const folderId = folder.folderId;
      setRootId(folderId);
      setCurrentFolder(folderId);
      setFolderPath([{ id: folderId, name: "Studium UCALP" }]);
      await loadFiles(folderId);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadFiles = async (folderId) => {
    setLoading(true);
    try {
      const fileList = await listDriveFiles(googleAccessToken, folderId);
      const folders = await listDriveFolders(googleAccessToken, folderId);
      const folderItems = (folders?.folders || []).map(f => ({ ...f, mimeType: "application/vnd.google-apps.folder", isFolder: true }));
      const fileItems = (fileList || []).filter(f => f.mimeType !== "application/vnd.google-apps.folder");
      setFiles([...folderItems, ...fileItems]);
    } catch (e) { console.error(e); setFiles([]); }
    setLoading(false);
  };

  const openFolder = async (folder) => {
    setCurrentFolder(folder.id);
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    await loadFiles(folder.id);
  };

  const goBack = async () => {
    if (folderPath.length <= 1) return;
    const newPath = folderPath.slice(0, -1);
    const parent = newPath[newPath.length - 1];
    setFolderPath(newPath);
    setCurrentFolder(parent.id);
    await loadFiles(parent.id);
  };

  const goToPath = async (idx) => {
    const newPath = folderPath.slice(0, idx + 1);
    const target = newPath[newPath.length - 1];
    setFolderPath(newPath);
    setCurrentFolder(target.id);
    await loadFiles(target.id);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreating(true);
    try {
      await createDriveFolder(googleAccessToken, newFolderName.trim(), currentFolder);
      setNewFolderName("");
      await loadFiles(currentFolder);
    } catch (e) { console.error(e); }
    setCreating(false);
  };

  if (!googleAccessToken) {
    return (
      <Overlay onClose={onClose}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <HardDrive size={40} color={P.textMuted} strokeWidth={1.2} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: P.text, marginBottom: 6 }}>Google Drive no conectado</div>
          <div style={{ fontSize: 13, color: P.textMuted }}>Conectá tu cuenta de Google desde Ajustes para acceder a Drive</div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${P.borderLight}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HardDrive size={20} color="#4285F4" />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Google Drive</h2>
        </div>
        <button onClick={onClose} style={{ padding: 6, color: P.textMuted, borderRadius: 8 }}
          onMouseEnter={e => e.currentTarget.style.color = P.text} onMouseLeave={e => e.currentTarget.style.color = P.textMuted}>
          <X size={20} />
        </button>
      </div>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 20px", flexWrap: "wrap", borderBottom: `1px solid ${P.borderLight}` }}>
        {folderPath.length > 1 && (
          <button onClick={goBack} style={{ padding: "4px 8px", borderRadius: 6, color: P.textMuted, display: "flex", alignItems: "center" }}
            onMouseEnter={e => e.currentTarget.style.background = P.cream} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <ArrowLeft size={14} />
          </button>
        )}
        {folderPath.map((f, i) => (
          <span key={f.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && <ChevronRight size={12} color={P.textMuted} />}
            <button onClick={() => goToPath(i)}
              style={{ fontSize: 12, fontWeight: i === folderPath.length - 1 ? 700 : 400, color: i === folderPath.length - 1 ? P.text : P.textMuted, padding: "2px 6px", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = P.cream} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              {f.name}
            </button>
          </span>
        ))}
      </div>

      {/* New folder */}
      <div style={{ display: "flex", gap: 8, padding: "10px 20px", borderBottom: `1px solid ${P.borderLight}` }}>
        <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
          placeholder="Nueva carpeta..." onKeyDown={e => e.key === "Enter" && handleCreateFolder()}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${P.border}`, fontSize: 13, background: "transparent", color: P.text, fontFamily: ff.body, outline: "none" }}
        />
        <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || creating}
          style={{ padding: "8px 14px", borderRadius: 8, background: "#4285F4", color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, opacity: !newFolderName.trim() ? 0.5 : 1 }}>
          {creating ? <Loader2 size={14} className="spin" /> : <FolderPlus size={14} />} Crear
        </button>
      </div>

      {/* Files */}
      <div style={{ padding: "8px 12px", maxHeight: 400, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Loader2 size={18} className="spin" color="#4285F4" /> Cargando...
          </div>
        ) : files.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: P.textMuted }}>
            <FolderOpen size={32} strokeWidth={1.2} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>Carpeta vacía</div>
          </div>
        ) : files.map((f, i) => {
          const { icon: Icon, color } = getIcon(f.mimeType);
          return (
            <div key={f.id || i}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}
              onClick={() => f.isFolder ? openFolder(f) : f.webViewLink && window.open(f.webViewLink, "_blank")}
              onMouseEnter={e => e.currentTarget.style.background = P.cream} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
                <Icon size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ fontSize: 11, color: P.textMuted }}>
                  {f.isFolder ? "Carpeta" : formatSize(f.size)}
                  {f.modifiedTime && !f.isFolder && ` · ${new Date(f.modifiedTime).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`}
                </div>
              </div>
              {f.isFolder ? <ChevronRight size={16} color={P.textMuted} /> : f.webViewLink && <ExternalLink size={14} color={P.textMuted} />}
            </div>
          );
        })}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </Overlay>
  );
}

function Overlay({ onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: "90%", maxWidth: 600, maxHeight: "85vh", background: P.bg, borderRadius: 20, border: `1px solid ${P.border}`, boxShadow: "0 25px 60px rgba(0,0,0,0.15)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}