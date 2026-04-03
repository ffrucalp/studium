import { useState, useCallback, useRef } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { callAI } from "../services/ai";
import { getCourseContents, extractFileText } from "../services/moodle";
import ShareButtons from "../components/ShareButtons";
import {
  GitBranch, ChevronRight, ArrowLeft, Loader2, Sparkles, RotateCcw, Download, Printer, Image,
} from "lucide-react";

const COL_COLORS = [
  { bg: "#2563eb", light: "#eff6ff", border: "#bfdbfe", text: "#1e40af", accent: "#3b82f6" },
  { bg: "#9333ea", light: "#f5f3ff", border: "#ddd6fe", text: "#6b21a8", accent: "#a855f7" },
  { bg: "#059669", light: "#ecfdf5", border: "#a7f3d0", text: "#065f46", accent: "#10b981" },
  { bg: "#ea580c", light: "#fff7ed", border: "#fed7aa", text: "#9a3412", accent: "#f97316" },
  { bg: "#0891b2", light: "#ecfeff", border: "#a5f3fc", text: "#155e75", accent: "#06b6d4" },
  { bg: "#c026d3", light: "#fdf4ff", border: "#f0abfc", text: "#86198f", accent: "#d946ef" },
];

export default function ConceptMap() {
  const { moodleToken, courses } = useApp();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [mapData, setMapData] = useState(null);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);

  const generateMap = useCallback(async (course) => {
    setGenerating(true);
    setMapData(null);
    setError(null);

    try {
      const contents = await getCourseContents(moodleToken, course.id);
      let materialText = "";
      for (const section of (contents || [])) {
        for (const mod of (section.modules || [])) {
          if (materialText.length > 5000) break;
          if (mod.modname === "resource" && mod.contents?.[0]?.fileurl) {
            try {
              const result = await extractFileText(moodleToken, mod.contents[0].fileurl);
              if (result?.text && result.text.length > 50) materialText += `\n${mod.name}: ${result.text.substring(0, 2000)}`;
            } catch {}
          }
        }
      }

      const topicPart = topic.trim() ? `Enfocate específicamente en: "${topic}".` : "";
      const contextPart = materialText.length > 100 ? `\n\nContenido de la materia:\n${materialText.substring(0, 6000)}` : "";

      const prompt = `Generá un mapa conceptual académico detallado para "${course.fullname}". ${topicPart}${contextPart}

Respondé SOLO con JSON válido (sin backticks ni texto extra):
{
  "title": "TÍTULO EN MAYÚSCULAS",
  "subtitle": "Descripción breve en cursiva",
  "central": "CONCEPTO CENTRAL (2-4 palabras en mayúsculas)",
  "columns": [
    {
      "header": "NOMBRE CATEGORÍA",
      "items": [
        {
          "name": "Nombre del concepto",
          "highlight": "DATO CLAVE en mayúsculas",
          "details": ["Detalle 1", "Detalle 2"]
        }
      ]
    }
  ],
  "notes": ["Nota importante 1", "Nota importante 2"]
}

Reglas:
- Generá entre 3 y 4 columnas (categorías)
- Cada columna tiene 2-4 items
- Cada item tiene name, highlight (concepto clave) y 1-2 details
- "notes" tiene 2-3 observaciones importantes sobre el tema
- Todo en español, académico y preciso
- Los headers van en MAYÚSCULAS`;

      const result = await callAI(prompt);

      let parsed;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
      } catch {
        parsed = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      }

      if (parsed?.columns?.length > 0) {
        setMapData(parsed);
      } else {
        setError("No se pudo generar el mapa. Intentá con un tema más específico.");
      }
    } catch (e) {
      setError("Error: " + e.message);
    }
    setGenerating(false);
  }, [moodleToken, topic]);

  // Download SVG
  const downloadSVG = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current.outerHTML;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mapa-${mapData?.title?.replace(/\s+/g, "-").toLowerCase() || "conceptual"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download PNG
  const downloadPNG = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new window.Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `mapa-${mapData?.title?.replace(/\s+/g, "-").toLowerCase() || "conceptual"}.png`;
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Print map
  const printMap = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>${mapData?.title || "Mapa conceptual"} — Studium UCALP</title>
      <style>@page{size:landscape;margin:1cm}body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}svg{max-width:100%;height:auto}</style>
    </head><body>${svgData}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
  };

  // ═══ Map view ═══
  if (selectedCourse && mapData) {
    const shareText = `📌 ${mapData.title}\n${mapData.subtitle || ""}\n\n🔵 ${mapData.central}\n\n` +
      mapData.columns.map((col, i) => `━━ ${col.header} ━━\n` +
        col.items.map(item => `▸ ${item.name}\n  ${item.highlight}\n  ${item.details?.join(" / ") || ""}`).join("\n")
      ).join("\n\n") +
      (mapData.notes ? `\n\n📝 Notas:\n${mapData.notes.map(n => `• ${n}`).join("\n")}` : "");

    return (
      <div className="fade-in">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => setMapData(null)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600 }}>
            <ArrowLeft size={16} /> Volver
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => generateMap(selectedCourse)} disabled={generating}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: P.redSoft, color: P.red, display: "flex", alignItems: "center", gap: 4, border: "none", cursor: "pointer" }}>
              <RotateCcw size={13} /> Regenerar
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto", background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: 20 }}>
          <ProfessionalMap data={mapData} svgRef={svgRef} />
        </div>

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
          <ShareButtons text={shareText} title={`Mapa: ${mapData.title}`} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={downloadSVG}
              style={{ padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: P.card, border: `1px solid ${P.border}`, color: P.textSec, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <Download size={13} /> SVG
            </button>
            <button onClick={downloadPNG}
              style={{ padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: P.card, border: `1px solid ${P.border}`, color: P.textSec, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <Image size={13} /> PNG
            </button>
            <button onClick={printMap}
              style={{ padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600, background: P.card, border: `1px solid ${P.border}`, color: P.textSec, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <Printer size={13} /> Imprimir
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ Generate form ═══
  if (selectedCourse) {
    return (
      <div className="fade-in" style={{ maxWidth: 600, margin: "0 auto" }}>
        <button onClick={() => setSelectedCourse(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Volver a materias
        </button>
        <h1 style={{ fontFamily: ff.heading, fontSize: 24, color: P.text, fontWeight: 800, marginBottom: 4 }}>{selectedCourse.fullname}</h1>
        <p style={{ color: P.textMuted, fontSize: 13, marginBottom: 20 }}>Generá un mapa conceptual académico con IA</p>

        <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color={P.red} /> Generar mapa conceptual
          </div>
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="Tema específico (opcional, ej: 'presocráticos', 'gobernanza de datos')"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 14, color: P.text, background: P.bg, fontFamily: ff.body, outline: "none", marginBottom: 14, boxSizing: "border-box" }}
            onFocus={e => e.currentTarget.style.borderColor = P.red} onBlur={e => e.currentTarget.style.borderColor = P.border}
          />
          <button onClick={() => generateMap(selectedCourse)} disabled={generating}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: generating ? P.border : P.red, color: generating ? P.textMuted : "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: generating ? "not-allowed" : "pointer", border: "none" }}>
            {generating ? <><Loader2 size={18} className="spin" /> Generando mapa...</> : <><GitBranch size={18} /> Generar mapa</>}
          </button>
          {error && <div style={{ marginTop: 14, padding: "10px 14px", background: "#FEF2F2", borderRadius: 8, color: "#DC2626", fontSize: 13 }}>{error}</div>}
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
      </div>
    );
  }

  // ═══ Course grid ═══
  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 28, color: P.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <GitBranch size={26} color={P.red} /> Mapas conceptuales
        </h1>
        <p style={{ color: P.textMuted, fontSize: 14, marginTop: 2 }}>Seleccioná una materia para generar un mapa académico con IA</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {courses.map((course, i) => (
          <button key={course.id} className="slide-in" onClick={() => setSelectedCourse(course)}
            style={{ animationDelay: `${i * 0.05}s`, background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, overflow: "hidden", textAlign: "left", cursor: "pointer", transition: "all 0.2s", width: "100%" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${course.color}, ${course.color}88)` }} />
            <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${course.color}12`, color: course.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><GitBranch size={18} /></div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.fullname}</div></div>
              <ChevronRight size={16} color={P.textMuted} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Professional SVG concept map renderer
 */
function ProfessionalMap({ data, svgRef }) {
  const cols = data.columns || [];
  const numCols = cols.length;
  const colWidth = 260;
  const colGap = 30;
  const totalW = numCols * colWidth + (numCols - 1) * colGap + 80;
  const svgW = Math.max(totalW, 800);
  const centerX = svgW / 2;

  // Calculate heights per column
  const colHeights = cols.map(col => {
    const headerH = 50;
    const itemH = col.items.reduce((sum, item) => {
      const lines = 2 + (item.details?.length || 0);
      return sum + Math.max(70, lines * 18 + 30);
    }, 0);
    const gaps = (col.items.length - 1) * 12;
    return headerH + 20 + itemH + gaps;
  });
  const maxColH = Math.max(...colHeights, 200);
  const titleH = 90;
  const centralH = 60;
  const connectorH = 40;
  const notesH = data.notes?.length ? 30 + data.notes.length * 20 + 20 : 0;
  const svgH = titleH + centralH + connectorH + maxColH + 40 + notesH;

  const colStartY = titleH + centralH + connectorH;

  return (
    <svg ref={svgRef} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}>
      {/* Background */}
      <rect width={svgW} height={svgH} fill="#f8fafc" rx="12" />

      {/* Title */}
      <text x={centerX} y={35} fontFamily="Arial, sans-serif" fontSize="24" fontWeight="bold" textAnchor="middle" fill="#1e293b">
        {data.title || "MAPA CONCEPTUAL"}
      </text>
      {data.subtitle && (
        <text x={centerX} y={60} fontFamily="Arial, sans-serif" fontSize="14" fontStyle="italic" textAnchor="middle" fill="#64748b">
          {data.subtitle}
        </text>
      )}

      {/* Central node */}
      <rect x={centerX - 160} y={titleH} width={320} height={50} rx={12} fill="#1e293b" />
      <text x={centerX} y={titleH + 32} fontFamily="Arial, sans-serif" fontSize="18" fontWeight="bold" textAnchor="middle" fill="white">
        {data.central || "CONCEPTO CENTRAL"}
      </text>

      {/* Connecting lines from center to columns */}
      {cols.map((_, ci) => {
        const colX = 40 + ci * (colWidth + colGap) + colWidth / 2;
        return (
          <g key={`line-${ci}`} stroke="#cbd5e1" strokeWidth="2" fill="none">
            <path d={`M${centerX} ${titleH + 50} L${centerX} ${titleH + 50 + 15}`} />
            <path d={`M${40 + colWidth / 2} ${titleH + 50 + 15} L${40 + (numCols - 1) * (colWidth + colGap) + colWidth / 2} ${titleH + 50 + 15}`} />
            <path d={`M${colX} ${titleH + 50 + 15} L${colX} ${colStartY}`} />
          </g>
        );
      })}

      {/* Columns */}
      {cols.map((col, ci) => {
        const color = COL_COLORS[ci % COL_COLORS.length];
        const colX = 40 + ci * (colWidth + colGap);
        let curY = colStartY;

        return (
          <g key={`col-${ci}`}>
            {/* Header */}
            <rect x={colX} y={curY} width={colWidth} height={44} rx={8} fill={color.bg} />
            <text x={colX + colWidth / 2} y={curY + 28} fontFamily="Arial, sans-serif" fontSize="13" fontWeight="bold" textAnchor="middle" fill="white">
              {col.header}
            </text>

            {/* Items */}
            {col.items.map((item, ii) => {
              const itemY = curY + 44 + 16 + ii * 100;
              const cardH = 20 + 18 + (item.details?.length || 0) * 16 + 16;

              return (
                <g key={`item-${ci}-${ii}`}>
                  {/* Connection line */}
                  <line x1={colX + colWidth / 2} y1={ii === 0 ? curY + 44 : itemY - 12} x2={colX + colWidth / 2} y2={itemY} stroke={color.border} strokeWidth="1.5" />

                  {/* Card */}
                  <rect x={colX + 5} y={itemY} width={colWidth - 10} height={cardH} rx={6} fill="white" stroke={color.bg} strokeWidth="1.5" />

                  {/* Name */}
                  <text x={colX + colWidth / 2} y={itemY + 18} fontFamily="Arial, sans-serif" fontSize="13" fontWeight="bold" textAnchor="middle" fill={color.text}>
                    {item.name}
                  </text>

                  {/* Highlight */}
                  <text x={colX + colWidth / 2} y={itemY + 36} fontFamily="Arial, sans-serif" fontSize="11" fontWeight="bold" textAnchor="middle" fill={color.bg}>
                    {item.highlight}
                  </text>

                  {/* Details */}
                  {item.details?.map((detail, di) => (
                    <text key={di} x={colX + colWidth / 2} y={itemY + 52 + di * 15} fontFamily="Arial, sans-serif" fontSize="10" textAnchor="middle" fill="#64748b">
                      {detail.length > 35 ? detail.substring(0, 33) + "…" : detail}
                    </text>
                  ))}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Notes */}
      {data.notes?.length > 0 && (
        <g>
          <rect x={40} y={svgH - notesH - 10} width={svgW - 80} height={notesH} rx={10} fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
          <text x={60} y={svgH - notesH + 18} fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="#1e40af">
            Notas del mapa:
          </text>
          {data.notes.map((note, ni) => (
            <text key={ni} x={60} y={svgH - notesH + 38 + ni * 18} fontFamily="Arial, sans-serif" fontSize="11" fill="#3b82f6">
              • {note.length > 100 ? note.substring(0, 98) + "…" : note}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}