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
 * Split text into lines that fit within a max character width
 */
function wrapText(text, maxChars = 30) {
  if (!text || text.length <= maxChars) return [text || ""];
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    if (current && (current + " " + word).length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Professional SVG concept map renderer with text wrapping
 */
function ProfessionalMap({ data, svgRef }) {
  const cols = data.columns || [];
  const numCols = cols.length;
  const colWidth = 280;
  const colGap = 24;
  const marginX = 40;
  const totalW = numCols * colWidth + (numCols - 1) * colGap + marginX * 2;
  const svgW = Math.max(totalW, 800);
  const centerX = svgW / 2;
  const lineH = 15; // line height for wrapped text
  const cardPadTop = 14;
  const cardPadBot = 12;
  const itemGap = 14;

  // Pre-calculate wrapped text and card heights for each item
  const colData = cols.map((col) => {
    const items = col.items.map((item) => {
      const nameLines = wrapText(item.name, 28);
      const highlightLines = wrapText(item.highlight, 32);
      const detailLines = (item.details || []).flatMap(d => wrapText(d, 34));
      const totalLines = nameLines.length + highlightLines.length + detailLines.length;
      const cardH = cardPadTop + totalLines * lineH + (highlightLines.length > 0 ? 6 : 0) + (detailLines.length > 0 ? 6 : 0) + cardPadBot;
      return { ...item, nameLines, highlightLines, detailLines, cardH };
    });
    const headerH = 44;
    const totalItemH = items.reduce((s, it) => s + it.cardH, 0) + (items.length - 1) * itemGap;
    return { ...col, items, headerH, totalH: headerH + 20 + totalItemH };
  });

  const maxColH = Math.max(...colData.map(c => c.totalH), 200);
  const titleH = 90;
  const centralH = 60;
  const connectorH = 40;
  const notesH = data.notes?.length ? 20 + data.notes.length * 18 + 20 : 0;
  const svgH = titleH + centralH + connectorH + maxColH + 30 + notesH;
  const colStartY = titleH + centralH + connectorH;

  // Column X positions
  const colXs = colData.map((_, ci) => marginX + ci * (colWidth + colGap));

  return (
    <svg ref={svgRef} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" style={{ display: "block", margin: "0 auto", maxWidth: "100%" }}>
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
      {(() => {
        const centralLines = wrapText(data.central || "CONCEPTO CENTRAL", 30);
        const cH = 20 + centralLines.length * 22;
        return (
          <>
            <rect x={centerX - 170} y={titleH} width={340} height={cH} rx={12} fill="#1e293b" />
            {centralLines.map((line, li) => (
              <text key={li} x={centerX} y={titleH + 22 + li * 22} fontFamily="Arial, sans-serif" fontSize="18" fontWeight="bold" textAnchor="middle" fill="white">
                {line}
              </text>
            ))}
          </>
        );
      })()}

      {/* Connecting lines */}
      <g stroke="#cbd5e1" strokeWidth="2" fill="none">
        <line x1={centerX} y1={titleH + 54} x2={centerX} y2={titleH + 54 + 16} />
        <line x1={colXs[0] + colWidth / 2} y1={titleH + 54 + 16} x2={colXs[numCols - 1] + colWidth / 2} y2={titleH + 54 + 16} />
        {colXs.map((cx, ci) => (
          <line key={ci} x1={cx + colWidth / 2} y1={titleH + 54 + 16} x2={cx + colWidth / 2} y2={colStartY} />
        ))}
      </g>

      {/* Columns */}
      {colData.map((col, ci) => {
        const color = COL_COLORS[ci % COL_COLORS.length];
        const colX = colXs[ci];
        let curY = colStartY;

        return (
          <g key={`col-${ci}`}>
            {/* Header */}
            <rect x={colX} y={curY} width={colWidth} height={col.headerH} rx={8} fill={color.bg} />
            <text x={colX + colWidth / 2} y={curY + 28} fontFamily="Arial, sans-serif" fontSize="13" fontWeight="bold" textAnchor="middle" fill="white">
              {col.header}
            </text>

            {/* Items */}
            {col.items.map((item, ii) => {
              // Calculate Y based on previous items
              const prevItemsH = col.items.slice(0, ii).reduce((s, it) => s + it.cardH + itemGap, 0);
              const itemY = curY + col.headerH + 20 + prevItemsH;

              // Connection line
              const lineFromY = ii === 0 ? curY + col.headerH : itemY - itemGap / 2;

              let textY = itemY + cardPadTop;

              return (
                <g key={`item-${ci}-${ii}`}>
                  <line x1={colX + colWidth / 2} y1={lineFromY} x2={colX + colWidth / 2} y2={itemY} stroke={color.border} strokeWidth="1.5" />

                  <rect x={colX + 4} y={itemY} width={colWidth - 8} height={item.cardH} rx={6} fill="white" stroke={color.bg} strokeWidth="1.5" />

                  {/* Name lines */}
                  {item.nameLines.map((line, li) => {
                    const y = textY + li * lineH;
                    return (
                      <text key={`n${li}`} x={colX + colWidth / 2} y={y + 10} fontFamily="Arial, sans-serif" fontSize="13" fontWeight="bold" textAnchor="middle" fill={color.text}>
                        {line}
                      </text>
                    );
                  })}

                  {/* Highlight lines */}
                  {item.highlightLines.map((line, li) => {
                    const y = textY + (item.nameLines.length + li) * lineH + 6;
                    return (
                      <text key={`h${li}`} x={colX + colWidth / 2} y={y + 10} fontFamily="Arial, sans-serif" fontSize="11" fontWeight="bold" textAnchor="middle" fill={color.bg}>
                        {line}
                      </text>
                    );
                  })}

                  {/* Detail lines */}
                  {item.detailLines.map((line, li) => {
                    const y = textY + (item.nameLines.length + item.highlightLines.length + li) * lineH + 12;
                    return (
                      <text key={`d${li}`} x={colX + colWidth / 2} y={y + 10} fontFamily="Arial, sans-serif" fontSize="10" textAnchor="middle" fill="#64748b">
                        {line}
                      </text>
                    );
                  })}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Notes */}
      {data.notes?.length > 0 && (
        <g>
          <rect x={marginX} y={svgH - notesH - 10} width={svgW - marginX * 2} height={notesH} rx={10} fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
          <text x={marginX + 20} y={svgH - notesH + 14} fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold" fill="#1e40af">
            Notas del mapa:
          </text>
          {data.notes.map((note, ni) => {
            const noteLines = wrapText(note, 90);
            return noteLines.map((line, li) => (
              <text key={`${ni}-${li}`} x={marginX + 20} y={svgH - notesH + 32 + ni * 18 + li * 14} fontFamily="Arial, sans-serif" fontSize="11" fill="#3b82f6">
                {li === 0 ? `• ${line}` : `  ${line}`}
              </text>
            ));
          })}
        </g>
      )}
    </svg>
  );
}