import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { generateQuiz } from "../services/ai";
import { Btn } from "../components/UI";
import { HelpCircle, RefreshCw } from "lucide-react";

export default function Quiz({ initialCourse }) {
  const { courses } = useApp();
  const [quizData, setQuizData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [quizCourse, setQuizCourse] = useState(initialCourse || null);
  const [loading, setLoading] = useState(false);

  const generate = async (course) => {
    setLoading(true);
    setQuizCourse(course);
    setAnswers({});
    setSubmitted(false);
    const result = await generateQuiz(course.fullname);
    setQuizData(result);
    setLoading(false);
  };

  // Auto-generate if initialCourse provided and no quiz yet
  if (initialCourse && !quizData && !loading && quizCourse?.id !== initialCourse.id) {
    generate(initialCourse);
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 26, color: P.text, marginBottom: 4, fontWeight: 800 }}>Práctica</h1>
        <p style={{ color: P.textMuted, fontSize: 14 }}>
          {quizCourse ? `Cuestionario de ${quizCourse.fullname}` : "Elegí una materia para practicar"}
        </p>
      </div>

      {/* Course selector */}
      {!quizData && !loading && (
        <div>
          <p style={{ fontSize: 14, color: P.textSec, marginBottom: 16 }}>Seleccioná una materia para generar un cuestionario:</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => generate(course)}
                style={{ padding: "18px 20px", borderRadius: 14, background: P.card, border: `1px solid ${P.border}`, textAlign: "left", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 14 }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = course.color; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 16px ${course.color}12`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 11, background: `${course.color}12`, display: "flex", alignItems: "center", justifyContent: "center", color: course.color }}>
                  <HelpCircle size={21} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: P.text }}>{course.shortname}</div>
                  <div style={{ fontSize: 12, color: P.textMuted }}>{course.fullname}</div>
                </div>
              </button>
            ))}
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
      {quizData?.questions && (
        <div style={{ maxWidth: 700 }}>
          {quizData.questions.map((q, qi) => (
            <div key={q.id} className="slide-in" style={{ animationDelay: `${qi * 0.1}s`, background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <span
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: submitted ? (answers[q.id] === q.correct ? "#DCFCE7" : P.redSoft) : P.cream,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                    color: submitted ? (answers[q.id] === q.correct ? "#16A34A" : P.red) : P.textMuted,
                    flexShrink: 0,
                  }}
                >
                  {submitted ? (answers[q.id] === q.correct ? "✓" : "✗") : qi + 1}
                </span>
                <p style={{ fontSize: 15, fontWeight: 500, color: P.text, lineHeight: 1.5 }}>{q.question}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: 42 }}>
                {q.options.map((opt, oi) => {
                  const selected = answers[q.id] === oi;
                  const isCorrect = q.correct === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => !submitted && setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                      style={{
                        padding: "10px 14px", borderRadius: 10,
                        border: `1px solid ${submitted ? (isCorrect ? "#86EFAC" : selected ? P.redMuted : P.border) : selected ? P.red : P.border}`,
                        background: submitted ? (isCorrect ? "#F0FDF4" : selected ? P.redSoft : P.card) : selected ? P.redSoft : P.card,
                        color: P.text, fontSize: 14, textAlign: "left",
                        cursor: submitted ? "default" : "pointer",
                        transition: "all 0.15s", fontWeight: selected ? 500 : 400,
                      }}
                    >
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
                <Btn onClick={() => generate(quizCourse)}>
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
