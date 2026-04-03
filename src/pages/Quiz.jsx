import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { generateQuiz, callAI } from "../services/ai";
import { Btn } from "../components/UI";
import CourseMaterialPicker from "../components/CourseMaterialPicker";
import { HelpCircle, RefreshCw, ArrowLeft, Sparkles, Loader2, ChevronRight } from "lucide-react";

export default function Quiz({ initialCourse }) {
  const { courses, moodleToken } = useApp();
  const [quizData, setQuizData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [quizCourse, setQuizCourse] = useState(initialCourse || null);
  const [loading, setLoading] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [pdfContent, setPdfContent] = useState(null);
  const [topic, setTopic] = useState("");
  const [showForm, setShowForm] = useState(!initialCourse);

  const generate = async (course) => {
    setLoading(true);
    setQuizCourse(course);
    setAnswers({});
    setSubmitted(false);
    setShowForm(false);

    try {
      if (pdfContent) {
        const topicPart = topic.trim() ? `Enfocate en: "${topic}".` : "";
        const prompt = `Analizá este documento PDF y generá un cuestionario de opción múltiple con 10 preguntas. ${topicPart}

Respondé SOLO con JSON válido (sin backticks):
{"questions":[{"id":"q1","question":"Pregunta","options":["A","B","C","D"],"correct":0,"explanation":"Por qué es correcta"}]}

Reglas:
- 10 preguntas variadas en dificultad
- 4 opciones cada una
- "correct" es el índice (0-3) de la respuesta correcta
- "explanation" explica por qué esa es la respuesta correcta
- Todo en español`;

        const images = [{ data: pdfContent, mimeType: "application/pdf" }];
        const result = await callAI(prompt, undefined, images);
        let parsed;
        try {
          const jsonMatch = result.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
        } catch {
          parsed = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
        }
        setQuizData(parsed);
      } else {
        const result = await generateQuiz(course.fullname + (topic.trim() ? ` — ${topic}` : ""));
        setQuizData(result);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Auto-generate if initialCourse provided
  if (initialCourse && !quizData && !loading && quizCourse?.id !== initialCourse.id) {
    generate(initialCourse);
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 26, color: P.text, marginBottom: 4, fontWeight: 800 }}>Práctica</h1>
        <p style={{ color: P.textMuted, fontSize: 14 }}>
          {quizCourse && !showForm ? `Cuestionario de ${quizCourse.fullname}` : "Elegí una materia para practicar"}
        </p>
      </div>

      {/* ═══ Course selector ═══ */}
      {!quizCourse && !loading && (
        <div>
          <p style={{ fontSize: 14, color: P.textSec, marginBottom: 16 }}>Seleccioná una materia para generar un cuestionario:</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {courses.map((course) => (
              <button key={course.id} onClick={() => { setQuizCourse(course); setShowForm(true); }}
                style={{ padding: "16px 18px", borderRadius: 14, background: P.card, border: `1px solid ${P.border}`, textAlign: "left", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 12, overflow: "hidden", width: "100%" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.05)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ height: 4, position: "absolute", top: 0, left: 0, right: 0, background: course.color }} />
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${course.color}12`, display: "flex", alignItems: "center", justifyContent: "center", color: course.color, flexShrink: 0 }}>
                  <HelpCircle size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{course.fullname}</div>
                </div>
                <ChevronRight size={16} color={P.textMuted} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Generate form with PDF picker ═══ */}
      {quizCourse && showForm && !loading && (
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <button onClick={() => { setQuizCourse(null); setShowForm(false); setSelectedPdf(null); setPdfContent(null); setTopic(""); }}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 16 }}>
            <ArrowLeft size={16} /> Volver a materias
          </button>
          <h2 style={{ fontFamily: ff.heading, fontSize: 22, color: P.text, fontWeight: 800, marginBottom: 4 }}>{quizCourse.fullname}</h2>
          <p style={{ color: P.textMuted, fontSize: 13, marginBottom: 20 }}>Generá un cuestionario de práctica con IA</p>

          <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color={P.red} /> Generar cuestionario
            </div>

            <div style={{ marginBottom: 12 }}>
              <CourseMaterialPicker courseId={quizCourse.id} moodleToken={moodleToken}
                selected={selectedPdf} onSelect={f => { setSelectedPdf(f); setPdfContent(null); }}
                onContentReady={setPdfContent} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0", color: P.textMuted, fontSize: 11 }}>
              <div style={{ flex: 1, height: 1, background: P.borderLight }} />
              {selectedPdf ? "o agregá un tema específico" : "o escribí un tema"}
              <div style={{ flex: 1, height: 1, background: P.borderLight }} />
            </div>

            <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="Tema específico (opcional)"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${P.border}`, fontSize: 14, color: P.text, background: P.bg, fontFamily: ff.body, outline: "none", marginBottom: 14, boxSizing: "border-box" }}
              onFocus={e => e.currentTarget.style.borderColor = P.red} onBlur={e => e.currentTarget.style.borderColor = P.border}
            />

            <button onClick={() => generate(quizCourse)} disabled={loading}
              style={{ width: "100%", padding: "12px", borderRadius: 10, background: P.red, color: "#fff", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", cursor: "pointer" }}>
              <HelpCircle size={18} /> Generar cuestionario
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div className="float" style={{ width: 56, height: 56, borderRadius: 14, background: P.red, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#fff" }}>
            <HelpCircle size={26} />
          </div>
          <p style={{ color: P.textMuted, fontSize: 14 }}>Generando cuestionario...</p>
        </div>
      )}

      {/* Quiz questions */}
      {quizData?.questions && !showForm && (
        <div style={{ maxWidth: 700 }}>
          {quizData.questions.map((q, qi) => (
            <div key={q.id} className="slide-in" style={{ animationDelay: `${qi * 0.1}s`, background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: submitted ? (answers[q.id] === q.correct ? "#DCFCE7" : P.redSoft) : P.cream,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                  color: submitted ? (answers[q.id] === q.correct ? "#16A34A" : P.red) : P.textMuted,
                  flexShrink: 0,
                }}>
                  {submitted ? (answers[q.id] === q.correct ? "✓" : "✗") : qi + 1}
                </span>
                <p style={{ fontSize: 15, fontWeight: 500, color: P.text, lineHeight: 1.5 }}>{q.question}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: 42 }}>
                {q.options.map((opt, oi) => {
                  const selected = answers[q.id] === oi;
                  const isCorrect = q.correct === oi;
                  return (
                    <button key={oi} onClick={() => !submitted && setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                      style={{
                        padding: "10px 14px", borderRadius: 10, textAlign: "left",
                        border: `1px solid ${submitted ? (isCorrect ? "#86EFAC" : selected ? P.redMuted : P.border) : selected ? P.red : P.border}`,
                        background: submitted ? (isCorrect ? "#F0FDF4" : selected ? P.redSoft : P.card) : selected ? P.redSoft : P.card,
                        color: P.text, fontSize: 14, cursor: submitted ? "default" : "pointer",
                        transition: "all 0.15s", fontWeight: selected ? 500 : 400,
                      }}>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && q.explanation && (
                <div style={{ marginTop: 12, marginLeft: 42, padding: "10px 14px", borderRadius: 10, background: P.cream, border: `1px solid ${P.border}` }}>
                  <p style={{ fontSize: 13, color: P.textSec, lineHeight: 1.5 }}>💡 {q.explanation}</p>
                </div>
              )}
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
            {!submitted ? (
              <Btn primary onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length < quizData.questions.length}>
                Corregir respuestas
              </Btn>
            ) : (
              <>
                <div style={{ padding: "12px 20px", borderRadius: 12, background: "#F0FDF4", border: "1px solid #86EFAC", fontSize: 14, fontWeight: 700, color: "#16A34A" }}>
                  Resultado: {quizData.questions.filter((q) => answers[q.id] === q.correct).length}/{quizData.questions.length} correctas
                </div>
                <Btn onClick={() => { setShowForm(true); setQuizData(null); setSelectedPdf(null); setPdfContent(null); setTopic(""); }}>
                  <RefreshCw size={16} /> Nuevo cuestionario
                </Btn>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}