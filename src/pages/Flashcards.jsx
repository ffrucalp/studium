import { useState, useEffect, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { callAI } from "../services/ai";
import { getCourseContents, extractFileText } from "../services/moodle";
import {
  Layers, ChevronRight, ArrowLeft, Loader2, RotateCcw,
  ThumbsUp, ThumbsDown, Repeat, Sparkles, BookOpen,
  CheckCircle, XCircle, Shuffle, Trash2, Download,
} from "lucide-react";

const STORAGE_KEY = "studium_flashcards";

function loadSavedCards() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveCards(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export default function Flashcards() {
  const { moodleToken, courses } = useApp();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [cards, setCards] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [studying, setStudying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ easy: 0, hard: 0, repeat: 0 });
  const [filter, setFilter] = useState("");
  const [topic, setTopic] = useState("");
  const [cardCount, setCardCount] = useState(15);
  const [savedData, setSavedData] = useState(loadSavedCards);

  // Get saved cards for a course
  const getSavedCards = (courseId) => savedData[courseId]?.cards || [];
  const hasSavedCards = (courseId) => (savedData[courseId]?.cards?.length || 0) > 0;

  // Generate flashcards from course content
  const generateCards = useCallback(async (course) => {
    setGenerating(true);
    setCards([]);

    try {
      // Get course materials
      const contents = await getCourseContents(moodleToken, course.id);
      let materialText = "";

      // Try to extract text from first few files
      for (const section of (contents || [])) {
        for (const mod of (section.modules || [])) {
          if (materialText.length > 6000) break;
          if (mod.modname === "resource" && mod.contents?.[0]?.fileurl) {
            try {
              const result = await extractFileText(moodleToken, mod.contents[0].fileurl);
              if (result?.text && result.text.length > 50) {
                materialText += `\n\n--- ${mod.name} ---\n${result.text.substring(0, 3000)}`;
              }
            } catch {}
          }
        }
      }

      const topicInstruction = topic.trim()
        ? `Enfocate específicamente en el tema: "${topic}".`
        : "Cubrí los temas principales de la materia.";

      const contextPart = materialText.length > 100
        ? `\n\nContenido real de la materia:\n${materialText.substring(0, 8000)}`
        : "";

      const prompt = `Generá exactamente ${cardCount} flashcards de estudio para la materia "${course.fullname}" de la Lic. en Gobernanza de Datos (UCALP).
${topicInstruction}
${contextPart}

IMPORTANTE: Respondé SOLO con un JSON array válido, sin texto adicional ni backticks. Cada objeto debe tener:
- "q": la pregunta (corta y clara)
- "a": la respuesta (concisa, 1-3 oraciones)
- "d": dificultad (1=fácil, 2=medio, 3=difícil)

Ejemplo de formato:
[{"q":"¿Qué es la gobernanza de datos?","a":"Es el conjunto de procesos, políticas y estándares que aseguran la gestión efectiva de los datos en una organización.","d":1}]`;

      const result = await callAI(prompt);

      // Parse JSON from response
      let parsed;
      try {
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = JSON.parse(result);
        }
      } catch {
        // Try cleaning
        const clean = result.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(clean);
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        const newCards = parsed.map((c, i) => ({
          id: `${course.id}-${Date.now()}-${i}`,
          q: c.q || c.question || c.pregunta || "",
          a: c.a || c.answer || c.respuesta || "",
          d: c.d || c.difficulty || 2,
          status: null, // null, 'easy', 'hard', 'repeat'
        })).filter(c => c.q && c.a);

        setCards(newCards);
        // Save to localStorage
        const newData = { ...savedData, [course.id]: { cards: newCards, generated: new Date().toISOString(), courseName: course.fullname } };
        setSavedData(newData);
        saveCards(newData);
      }
    } catch (e) {
      console.error("Error generating flashcards:", e);
    }
    setGenerating(false);
  }, [moodleToken, topic, cardCount, savedData]);

  // Start studying
  const startStudy = (courseCards) => {
    setCards(courseCards.map(c => ({ ...c, status: null })));
    setStudying(true);
    setCurrentIdx(0);
    setFlipped(false);
    setStats({ easy: 0, hard: 0, repeat: 0 });
  };

  // Handle card response
  const handleResponse = (type) => {
    const updated = [...cards];
    updated[currentIdx] = { ...updated[currentIdx], status: type };
    setCards(updated);
    setStats(s => ({ ...s, [type]: s[type] + 1 }));
    setFlipped(false);

    // Next card
    if (currentIdx < cards.length - 1) {
      setTimeout(() => setCurrentIdx(currentIdx + 1), 200);
    } else {
      // Check if there are 'repeat' cards
      const repeats = updated.filter(c => c.status === "repeat");
      if (repeats.length > 0) {
        setTimeout(() => {
          setCards(repeats.map(c => ({ ...c, status: null })));
          setCurrentIdx(0);
          setStats(s => ({ ...s, repeat: 0 }));
        }, 500);
      }
    }
  };

  // Shuffle cards
  const shuffleCards = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIdx(0);
    setFlipped(false);
  };

  // Delete saved cards for a course
  const deleteSaved = (courseId) => {
    const newData = { ...savedData };
    delete newData[courseId];
    setSavedData(newData);
    saveCards(newData);
  };

  const isFinished = studying && currentIdx >= cards.length - 1 && cards[currentIdx]?.status;

  const filtered = filter.trim()
    ? courses.filter(c => c.fullname.toLowerCase().includes(filter.toLowerCase()) || c.shortname.toLowerCase().includes(filter.toLowerCase()))
    : courses;

  // ═══ Study mode ═══
  if (studying && cards.length > 0) {
    const card = cards[currentIdx];
    const progress = ((currentIdx + (card?.status ? 1 : 0)) / cards.length) * 100;
    const diffColors = { 1: "#059669", 2: "#D97706", 3: "#DC2626" };
    const diffLabels = { 1: "Fácil", 2: "Medio", 3: "Difícil" };

    return (
      <div className="fade-in" style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <button onClick={() => setStudying(false)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600 }}>
            <ArrowLeft size={16} /> Volver
          </button>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: P.textMuted }}>
            <span style={{ color: "#059669", fontWeight: 600 }}>✓ {stats.easy}</span>
            <span style={{ color: "#D97706", fontWeight: 600 }}>~ {stats.hard}</span>
            <span style={{ color: "#DC2626", fontWeight: 600 }}>↻ {stats.repeat}</span>
          </div>
          <span style={{ fontSize: 12, color: P.textMuted }}>{currentIdx + 1}/{cards.length}</span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: P.borderLight, borderRadius: 2, marginBottom: 24 }}>
          <div style={{ height: "100%", background: P.red, borderRadius: 2, width: `${progress}%`, transition: "width 0.3s" }} />
        </div>

        {/* Finished */}
        {isFinished && cards.filter(c => c.status === "repeat").length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <CheckCircle size={48} color="#059669" strokeWidth={1.5} style={{ marginBottom: 14 }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, color: P.text, fontFamily: ff.heading, marginBottom: 8 }}>¡Repaso completado!</h2>
            <div style={{ fontSize: 14, color: P.textMuted, marginBottom: 20 }}>
              {stats.easy} fáciles · {stats.hard} difíciles · {stats.repeat} repetidas
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => startStudy(cards)} style={{ padding: "10px 20px", borderRadius: 10, background: P.red, color: "#fff", fontSize: 14, fontWeight: 600 }}>
                <RotateCcw size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} /> Repetir
              </button>
              <button onClick={() => setStudying(false)} style={{ padding: "10px 20px", borderRadius: 10, background: P.borderLight, color: P.textSec, fontSize: 14, fontWeight: 600 }}>
                Volver
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Card */}
            <div onClick={() => setFlipped(!flipped)}
              style={{
                background: P.card, borderRadius: 20, border: `1px solid ${P.border}`,
                padding: "40px 30px", minHeight: 250, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)", transition: "all 0.2s", position: "relative",
              }}>
              {/* Difficulty badge */}
              <span style={{ position: "absolute", top: 16, right: 16, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: `${diffColors[card.d]}12`, color: diffColors[card.d] }}>
                {diffLabels[card.d]}
              </span>

              {!flipped ? (
                <>
                  <div style={{ fontSize: 11, color: P.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, fontWeight: 700 }}>Pregunta</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: P.text, textAlign: "center", lineHeight: 1.5, fontFamily: ff.heading }}>{card.q}</div>
                  <div style={{ fontSize: 12, color: P.textMuted, marginTop: 20 }}>Tocá para ver la respuesta</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: "#059669", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, fontWeight: 700 }}>Respuesta</div>
                  <div style={{ fontSize: 16, color: P.textSec, textAlign: "center", lineHeight: 1.7 }}>{card.a}</div>
                </>
              )}
            </div>

            {/* Response buttons */}
            {flipped && (
              <div className="fade-in" style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
                <button onClick={() => handleResponse("easy")}
                  style={{ flex: 1, padding: "14px", borderRadius: 12, background: "#ECFDF5", color: "#059669", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid #05966920`, transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#D1FAE5"} onMouseLeave={e => e.currentTarget.style.background = "#ECFDF5"}>
                  <ThumbsUp size={18} /> Fácil
                </button>
                <button onClick={() => handleResponse("hard")}
                  style={{ flex: 1, padding: "14px", borderRadius: 12, background: "#FEF3C7", color: "#D97706", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid #D9770620`, transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FDE68A"} onMouseLeave={e => e.currentTarget.style.background = "#FEF3C7"}>
                  <ThumbsDown size={18} /> Difícil
                </button>
                <button onClick={() => handleResponse("repeat")}
                  style={{ flex: 1, padding: "14px", borderRadius: 12, background: "#FEF2F2", color: "#DC2626", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid #DC262620`, transition: "all 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FEE2E2"} onMouseLeave={e => e.currentTarget.style.background = "#FEF2F2"}>
                  <Repeat size={18} /> Repetir
                </button>
              </div>
            )}

            {/* Shuffle button */}
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={shuffleCards} style={{ fontSize: 12, color: P.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Shuffle size={13} /> Mezclar
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ═══ Course selected — generate or study ═══
  if (selectedCourse) {
    const saved = getSavedCards(selectedCourse.id);

    return (
      <div className="fade-in" style={{ maxWidth: 700, margin: "0 auto" }}>
        <button onClick={() => { setSelectedCourse(null); setCards([]); }}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 16 }}>
          <ArrowLeft size={16} /> Volver a materias
        </button>

        <h1 style={{ fontFamily: ff.heading, fontSize: 24, color: P.text, fontWeight: 800, marginBottom: 4 }}>
          {selectedCourse.fullname}
        </h1>
        <p style={{ color: P.textMuted, fontSize: 13, marginBottom: 20 }}>
          {saved.length > 0 ? `${saved.length} tarjetas guardadas` : "Generá tarjetas de estudio con IA"}
        </p>

        {/* Generate form */}
        <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} color={P.red} /> Generar flashcards
          </div>

          <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="Tema específico (opcional, ej: 'metadatos', 'ética en IA')"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.bg, fontFamily: ff.body, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
            onFocus={e => e.currentTarget.style.borderColor = P.red} onBlur={e => e.currentTarget.style.borderColor = P.border}
          />

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={cardCount} onChange={e => setCardCount(Number(e.target.value))}
              style={{ padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 13, color: P.text, background: P.bg, fontFamily: ff.body }}>
              <option value={10}>10 tarjetas</option>
              <option value={15}>15 tarjetas</option>
              <option value={20}>20 tarjetas</option>
              <option value={30}>30 tarjetas</option>
            </select>

            <button onClick={() => generateCards(selectedCourse)} disabled={generating}
              style={{ flex: 1, padding: "10px 16px", borderRadius: 10, background: generating ? P.border : P.red, color: generating ? P.textMuted : "#fff", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: generating ? "not-allowed" : "pointer" }}>
              {generating ? <><Loader2 size={16} className="spin" /> Generando...</> : <><Sparkles size={16} /> Generar</>}
            </button>
          </div>
        </div>

        {/* Saved cards */}
        {saved.length > 0 && (
          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: P.text, display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={16} color={selectedCourse.color} /> {saved.length} tarjetas
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => deleteSaved(selectedCourse.id)}
                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, color: P.textMuted, background: P.borderLight, display: "flex", alignItems: "center", gap: 4 }}>
                  <Trash2 size={12} /> Borrar
                </button>
              </div>
            </div>

            {/* Preview first 3 cards */}
            {saved.slice(0, 3).map((c, i) => (
              <div key={i} style={{ padding: "10px 14px", background: P.bg, borderRadius: 10, marginBottom: 6, fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: P.text }}>{c.q}</span>
              </div>
            ))}
            {saved.length > 3 && <div style={{ fontSize: 12, color: P.textMuted, paddingLeft: 14 }}>... y {saved.length - 3} más</div>}

            <button onClick={() => startStudy(saved)}
              style={{ width: "100%", marginTop: 14, padding: "12px", borderRadius: 10, background: P.red, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <BookOpen size={18} /> Estudiar ahora
            </button>
          </div>
        )}

        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
      </div>
    );
  }

  // ═══ Course selection ═══
  return (
    <div className="fade-in" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 28, color: P.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
          <Layers size={26} color={P.red} /> Flashcards
        </h1>
        <p style={{ color: P.textMuted, fontSize: 14, marginTop: 2 }}>
          Seleccioná una materia para generar o repasar tarjetas de estudio
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {filtered.map((course, i) => {
          const saved = hasSavedCards(course.id);
          const count = getSavedCards(course.id).length;
          return (
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
                  <Layers size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.fullname}</div>
                  {saved ? (
                    <div style={{ fontSize: 11, color: "#059669", fontWeight: 600, marginTop: 2 }}>✓ {count} tarjetas guardadas</div>
                  ) : (
                    <div style={{ fontSize: 11, color: P.textMuted, marginTop: 2 }}>Sin tarjetas</div>
                  )}
                </div>
                <ChevronRight size={16} color={P.textMuted} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}