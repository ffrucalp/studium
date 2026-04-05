import { useState, useEffect } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import CourseSelector from "../components/CourseSelector";
import { getForumsByCourse, getForumDiscussions, addForumDiscussion } from "../services/moodle";
import {
  Megaphone, Loader2, Send, Plus, Clock, ChevronDown, ChevronRight,
  MessageSquare, CheckCircle, AlertCircle, Sparkles,
} from "lucide-react";

export default function AnnouncementsPage() {
  const { courses, moodleToken, useMock, googleAccessToken } = useApp();
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [forums, setForums] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [useAI, setUseAI] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Load forums & discussions
  useEffect(() => {
    if (!selectedCourseId || !moodleToken || moodleToken === "mock_token") {
      if (selectedCourseId && useMock) {
        setForums([{ id: 1, name: "Avisos", type: "news" }]);
        setDiscussions([
          { id: 1, name: "Bienvenidos al curso 2026", message: "Les damos la bienvenida...", timemodified: Date.now() / 1000 - 86400 * 7, userfullname: "Prof. Fernández" },
          { id: 2, name: "Fecha de entrega TP1", message: "La fecha de entrega del TP1 es...", timemodified: Date.now() / 1000 - 86400 * 2, userfullname: "Prof. Fernández" },
        ]);
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    setForums([]);
    setDiscussions([]);

    getForumsByCourse(moodleToken, selectedCourseId).then(async (forumList) => {
      if (cancelled || !Array.isArray(forumList)) { setLoading(false); return; }
      setForums(forumList);

      // Load discussions from news/announcements forum
      const newsForum = forumList.find(f => f.type === "news") || forumList[0];
      if (newsForum) {
        const discs = await getForumDiscussions(moodleToken, newsForum.id);
        if (!cancelled) setDiscussions(discs);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [selectedCourseId, moodleToken, useMock]);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) return;
    const newsForum = forums.find(f => f.type === "news") || forums[0];
    if (!newsForum) { setError("No se encontró un foro de avisos"); return; }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      if (useMock || !moodleToken || moodleToken === "mock_token") {
        await new Promise(r => setTimeout(r, 1000));
        setDiscussions(prev => [{
          id: Date.now(), name: subject, message, timemodified: Date.now() / 1000, userfullname: "Vos",
        }, ...prev]);
      } else {
        await addForumDiscussion(moodleToken, newsForum.id, subject, message);
        // Reload discussions
        const discs = await getForumDiscussions(moodleToken, newsForum.id);
        setDiscussions(discs);
      }
      setSuccess("Anuncio publicado correctamente");
      setSubject("");
      setMessage("");
      setShowCompose(false);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message || "Error al publicar el anuncio");
    } finally {
      setSending(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!subject.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Sos un asistente académico que ayuda a redactar anuncios para un curso universitario. Respondé solo con el texto del anuncio, sin comillas ni explicaciones. Usá un tono formal pero cercano, en español rioplatense." },
            { role: "user", content: `Redactá un anuncio para el foro del curso "${selectedCourse?.fullname || "la materia"}" con el asunto: "${subject}". El anuncio debe ser claro, conciso y profesional.` },
          ],
        }),
      });
      const data = await res.json();
      const aiText = data?.choices?.[0]?.message?.content || data?.content || "";
      if (aiText) setMessage(aiText);
    } catch (err) {
      console.error("AI generation failed:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const fmtDate = (ts) => new Date(ts * 1000).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 26, fontWeight: 700, color: P.text, marginBottom: 6 }}>
            Anuncios
          </h1>
          <p style={{ color: P.textMuted, fontSize: 14 }}>
            Publicá avisos en el foro de novedades de cada materia
          </p>
        </div>
        {selectedCourseId && (
          <button onClick={() => setShowCompose(!showCompose)}
            style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: P.primary, color: "#fff", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <Plus size={16} /> Nuevo anuncio
          </button>
        )}
      </div>

      {/* Course selector */}
      <CourseSelector courses={courses} selectedId={selectedCourseId} onSelect={(id) => { setSelectedCourseId(id); setShowCompose(false); }} />

      {/* Success / Error messages */}
      {success && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#05966915", border: "1px solid #05966930", color: "#059669", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={16} /> {success}
        </div>
      )}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "#DC262615", border: "1px solid #DC262630", color: "#DC2626", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!selectedCourseId ? (
        <div style={{ background: P.card, borderRadius: 16, padding: "60px 32px", textAlign: "center", border: `1px solid ${P.border}` }}>
          <Megaphone size={48} style={{ color: P.textMuted, marginBottom: 16 }} />
          <p style={{ color: P.textMuted, fontSize: 15 }}>Seleccioná una materia para gestionar anuncios</p>
        </div>
      ) : (
        <>
          {/* Compose form */}
          {showCompose && (
            <div style={{ background: P.card, borderRadius: 16, padding: 24, border: `1px solid ${P.primary}40`, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: P.text, marginBottom: 16 }}>Nuevo anuncio</h3>
              <input
                value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Asunto del anuncio..."
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.bg, color: P.text, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
              />
              <textarea
                value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Escribí el contenido del anuncio..."
                rows={6}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${P.border}`, background: P.bg, color: P.text, fontSize: 14, resize: "vertical", fontFamily: ff.body, marginBottom: 12, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={handleSend} disabled={sending || !subject.trim() || !message.trim()}
                  style={{
                    padding: "10px 24px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: P.primary, color: "#fff", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8, opacity: (sending || !subject.trim() || !message.trim()) ? 0.5 : 1,
                  }}>
                  {sending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={14} />}
                  Publicar
                </button>
                <button onClick={handleAIGenerate} disabled={aiLoading || !subject.trim()}
                  style={{
                    padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                    background: P.primarySoft, color: P.primary, border: `1px solid ${P.primary}30`, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8, opacity: (aiLoading || !subject.trim()) ? 0.5 : 1,
                  }}>
                  {aiLoading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
                  Generar con IA
                </button>
                <button onClick={() => { setShowCompose(false); setSubject(""); setMessage(""); }}
                  style={{ padding: "10px 16px", borderRadius: 10, fontSize: 13, color: P.textMuted, background: "transparent", border: "none", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Existing discussions */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Loader2 size={24} style={{ color: P.primary, animation: "spin 1s linear infinite" }} />
            </div>
          ) : (
            <div style={{ background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden" }}>
              {discussions.length === 0 ? (
                <p style={{ padding: 32, textAlign: "center", color: P.textMuted, fontSize: 14 }}>No hay anuncios publicados</p>
              ) : (
                discussions.map((d, i) => (
                  <div key={d.id}
                    style={{
                      padding: "16px 20px",
                      borderBottom: i < discussions.length - 1 ? `1px solid ${P.borderLight}` : "none",
                    }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: P.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Megaphone size={16} style={{ color: P.primary }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: P.text, marginBottom: 4 }}>{d.name}</div>
                        <p style={{ fontSize: 13, color: P.textSec, lineHeight: 1.5, marginBottom: 8 }}>
                          {(d.message || "").replace(/<[^>]+>/g, "").substring(0, 200)}
                          {(d.message || "").length > 200 ? "..." : ""}
                        </p>
                        <div style={{ display: "flex", gap: 16, fontSize: 11, color: P.textMuted }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={12} /> {fmtDate(d.timemodified)}
                          </span>
                          <span>{d.userfullname}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}