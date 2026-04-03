import { useState, useRef, useEffect, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { callAI } from "../services/ai";
import { getCourseContents, extractFileText } from "../services/moodle";
import ShareButtons from "../components/ShareButtons";
import {
  GitBranch, ChevronRight, ArrowLeft, Loader2, Sparkles,
  ZoomIn, ZoomOut, RotateCcw, Download, Maximize2,
} from "lucide-react";

const COLORS = ["#B71C1C", "#1565C0", "#2E7D32", "#6A1B9A", "#E65100", "#00695C", "#4527A0", "#AD1457", "#283593", "#558B2F"];

function hashColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function ConceptMap() {
  const { moodleToken, courses } = useApp();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [mapData, setMapData] = useState(null); // { nodes, edges }
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");

  const generateMap = useCallback(async (course) => {
    setGenerating(true);
    setMapData(null);
    setError(null);

    try {
      // Get course materials
      const contents = await getCourseContents(moodleToken, course.id);
      let materialText = "";

      for (const section of (contents || [])) {
        for (const mod of (section.modules || [])) {
          if (materialText.length > 5000) break;
          if (mod.modname === "resource" && mod.contents?.[0]?.fileurl) {
            try {
              const result = await extractFileText(moodleToken, mod.contents[0].fileurl);
              if (result?.text && result.text.length > 50) {
                materialText += `\n${mod.name}: ${result.text.substring(0, 2000)}`;
              }
            } catch {}
          }
        }
      }

      const topicPart = topic.trim() ? `Enfocate en el tema: "${topic}".` : "Cubrí los temas principales.";
      const contextPart = materialText.length > 100 ? `\n\nContenido de la materia:\n${materialText.substring(0, 6000)}` : "";

      const prompt = `Generá un mapa conceptual para la materia "${course.fullname}". ${topicPart}
${contextPart}

Respondé SOLO con un JSON válido sin backticks con esta estructura:
{
  "title": "Título del mapa",
  "nodes": [
    {"id": "1", "label": "Concepto principal", "level": 0},
    {"id": "2", "label": "Subconcepto", "level": 1},
    {"id": "3", "label": "Detalle", "level": 2}
  ],
  "edges": [
    {"from": "1", "to": "2", "label": "relación"},
    {"from": "2", "to": "3", "label": "incluye"}
  ]
}

Reglas:
- El nodo central (level 0) es el tema principal, debe haber solo 1
- Los nodos level 1 son las categorías principales (4-6 nodos)
- Los nodos level 2 son subconceptos (2-4 por categoría)
- Cada edge tiene un label corto que describe la relación
- Generá entre 15 y 25 nodos en total
- Los labels deben ser concisos (máx 4 palabras)`;

      const result = await callAI(prompt);

      let parsed;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
      } catch {
        const clean = result.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(clean);
      }

      if (parsed?.nodes?.length > 0) {
        setMapData(parsed);
      } else {
        setError("No se pudo generar el mapa. Intentá con un tema más específico.");
      }
    } catch (e) {
      console.error(e);
      setError("Error al generar: " + e.message);
    }
    setGenerating(false);
  }, [moodleToken, topic]);

  const filtered = filter.trim()
    ? courses.filter(c => c.fullname.toLowerCase().includes(filter.toLowerCase()))
    : courses;

  // ═══ Map view ═══
  if (selectedCourse && mapData) {
    return (
      <div className="fade-in" style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <button onClick={() => { setMapData(null); }} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 4 }}>
              <ArrowLeft size={16} /> Volver
            </button>
            <h2 style={{ fontFamily: ff.heading, fontSize: 20, color: P.text, fontWeight: 800 }}>{mapData.title || selectedCourse.fullname}</h2>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => generateMap(selectedCourse)} disabled={generating}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: P.redSoft, color: P.red, display: "flex", alignItems: "center", gap: 4 }}>
              <RotateCcw size={13} /> Regenerar
            </button>
          </div>
        </div>

        <div style={{ flex: 1, background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden", position: "relative" }}>
          <MapCanvas nodes={mapData.nodes} edges={mapData.edges} />
        </div>

        <div style={{ marginTop: 10 }}>
          <ShareButtons
            text={mapData.nodes.map(n => `${"  ".repeat(n.level)}• ${n.label}`).join("\n") + "\n\nRelaciones:\n" + mapData.edges.map(e => `${mapData.nodes.find(n => n.id === e.from)?.label} → ${e.label} → ${mapData.nodes.find(n => n.id === e.to)?.label}`).join("\n")}
            title={`Mapa conceptual: ${mapData.title || selectedCourse.fullname}`}
          />
        </div>
      </div>
    );
  }

  // ═══ Course selected — generate ═══
  if (selectedCourse) {
    return (
      <div className="fade-in" style={{ maxWidth: 600, margin: "0 auto" }}>
        <button onClick={() => setSelectedCourse(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Volver a materias
        </button>

        <h1 style={{ fontFamily: ff.heading, fontSize: 24, color: P.text, fontWeight: 800, marginBottom: 4 }}>
          {selectedCourse.fullname}
        </h1>
        <p style={{ color: P.textMuted, fontSize: 13, marginBottom: 20 }}>Generá un mapa conceptual con IA</p>

        <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: "24px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color={P.red} /> Generar mapa conceptual
          </div>

          <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="Tema específico (opcional, ej: 'bases de datos', 'ética')"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 14, color: P.text, background: P.bg, fontFamily: ff.body, outline: "none", marginBottom: 14, boxSizing: "border-box" }}
            onFocus={e => e.currentTarget.style.borderColor = P.red} onBlur={e => e.currentTarget.style.borderColor = P.border}
          />

          <button onClick={() => generateMap(selectedCourse)} disabled={generating}
            style={{ width: "100%", padding: "12px", borderRadius: 10, background: generating ? P.border : P.red, color: generating ? P.textMuted : "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: generating ? "not-allowed" : "pointer" }}>
            {generating ? <><Loader2 size={18} className="spin" /> Generando mapa...</> : <><GitBranch size={18} /> Generar mapa</>}
          </button>

          {error && <div style={{ marginTop: 14, padding: "10px 14px", background: "#FEF2F2", borderRadius: 8, color: "#DC2626", fontSize: 13 }}>{error}</div>}
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
          <GitBranch size={26} color={P.red} /> Mapas conceptuales
        </h1>
        <p style={{ color: P.textMuted, fontSize: 14, marginTop: 2 }}>Seleccioná una materia para generar un mapa con IA</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {filtered.map((course, i) => (
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
                <GitBranch size={18} />
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

/**
 * Interactive SVG concept map with zoom, pan, and radial layout
 */
function MapCanvas({ nodes, edges }) {
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [positions, setPositions] = useState({});

  // Calculate positions using radial layout
  useEffect(() => {
    const centerX = 500;
    const centerY = 400;
    const pos = {};

    const level0 = nodes.filter(n => n.level === 0);
    const level1 = nodes.filter(n => n.level === 1);
    const level2 = nodes.filter(n => n.level === 2);

    // Center node
    if (level0[0]) pos[level0[0].id] = { x: centerX, y: centerY };

    // Level 1: arrange in circle around center
    const r1 = 200;
    level1.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / level1.length - Math.PI / 2;
      pos[n.id] = { x: centerX + r1 * Math.cos(angle), y: centerY + r1 * Math.sin(angle) };
    });

    // Level 2: arrange around their parent
    const r2 = 120;
    level2.forEach((n) => {
      // Find parent from edges
      const parentEdge = edges.find(e => e.to === n.id);
      const parentId = parentEdge?.from;
      const parentPos = pos[parentId];

      if (parentPos) {
        // Find siblings
        const siblings = level2.filter(s => edges.find(e => e.to === s.id)?.from === parentId);
        const idx = siblings.indexOf(n);
        const parentAngle = Math.atan2(parentPos.y - centerY, parentPos.x - centerX);
        const spread = Math.PI * 0.6;
        const startAngle = parentAngle - spread / 2;
        const angle = siblings.length === 1 ? parentAngle : startAngle + (spread * idx) / (siblings.length - 1);

        pos[n.id] = { x: parentPos.x + r2 * Math.cos(angle), y: parentPos.y + r2 * Math.sin(angle) };
      } else {
        // Fallback position
        pos[n.id] = { x: centerX + (Math.random() - 0.5) * 400, y: centerY + (Math.random() - 0.5) * 300 };
      }
    });

    // Handle any remaining nodes
    nodes.forEach(n => {
      if (!pos[n.id]) {
        pos[n.id] = { x: centerX + (Math.random() - 0.5) * 500, y: centerY + (Math.random() - 0.5) * 400 };
      }
    });

    setPositions(pos);
  }, [nodes, edges]);

  // Mouse handlers for pan
  const handleMouseDown = (e) => {
    if (e.target.tagName === "rect" || e.target.tagName === "text") return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setDragging(false);

  const handleWheel = (e) => {
    e.preventDefault();
    const newZoom = Math.max(0.3, Math.min(3, zoom + (e.deltaY > 0 ? -0.1 : 0.1)));
    setZoom(newZoom);
  };

  const nodeSize = (level) => level === 0 ? { w: 160, h: 44 } : level === 1 ? { w: 140, h: 36 } : { w: 120, h: 30 };
  const fontSize = (level) => level === 0 ? 14 : level === 1 ? 12 : 11;

  if (Object.keys(positions).length === 0) return null;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Zoom controls */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.2))}
          style={{ width: 32, height: 32, borderRadius: 8, background: P.card, border: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: P.textSec, cursor: "pointer" }}>
          <ZoomIn size={16} />
        </button>
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))}
          style={{ width: 32, height: 32, borderRadius: 8, background: P.card, border: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: P.textSec, cursor: "pointer" }}>
          <ZoomOut size={16} />
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          style={{ width: 32, height: 32, borderRadius: 8, background: P.card, border: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: P.textSec, cursor: "pointer" }}>
          <Maximize2 size={16} />
        </button>
      </div>

      <svg ref={svgRef} width="100%" height="100%"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onWheel={handleWheel}>
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const from = positions[edge.from];
            const to = positions[edge.to];
            if (!from || !to) return null;

            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;

            return (
              <g key={`edge-${i}`}>
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={P.border} strokeWidth={1.5} strokeDasharray="4 2" />
                {edge.label && (
                  <text x={mx} y={my - 6} textAnchor="middle"
                    style={{ fontSize: 9, fill: P.textMuted, fontFamily: ff.body, fontWeight: 500 }}>
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;
            const size = nodeSize(node.level);
            const color = node.level === 0 ? P.red : hashColor(node.label);
            const fs = fontSize(node.level);

            return (
              <g key={node.id}>
                <rect x={pos.x - size.w / 2} y={pos.y - size.h / 2}
                  width={size.w} height={size.h} rx={size.h / 2}
                  fill={node.level === 0 ? color : "#fff"}
                  stroke={color} strokeWidth={node.level === 0 ? 0 : 2}
                  style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))" }} />
                <text x={pos.x} y={pos.y + fs * 0.35} textAnchor="middle"
                  style={{
                    fontSize: fs, fontFamily: ff.body, fontWeight: node.level === 0 ? 700 : 600,
                    fill: node.level === 0 ? "#fff" : color,
                  }}>
                  {node.label.length > 20 ? node.label.substring(0, 18) + "..." : node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}