import { useState, useEffect, useRef, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { getConversations, getConversationMessages, sendMessage } from "../services/moodle";
import {
  MessageCircle, Search, Send, Loader2, User, Users,
  ArrowLeft, ChevronRight, RefreshCw,
} from "lucide-react";

function timeAgo(ts) {
  if (!ts) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hs`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} días`;
  return new Date(ts * 1000).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

export default function Messages() {
  const { moodleToken, moodleUserId } = useApp();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(null); // conversation object
  const [messages, setMessages] = useState([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const msgsEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversations
  const loadConversations = useCallback(async (silent = false) => {
    if (!moodleToken || moodleToken === "mock_token") { setLoading(false); return; }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getConversations(moodleToken, moodleUserId);
      if (data?.conversations) {
        setConversations(data.conversations.filter(c => c.members?.length > 0));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, [moodleToken, moodleUserId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (conv) => {
    setMsgsLoading(true);
    setMessages([]);
    try {
      const data = await getConversationMessages(moodleToken, conv.id, moodleUserId);
      if (data?.messages) {
        setMessages(data.messages.sort((a, b) => (a.timecreated || 0) - (b.timecreated || 0)));
      }
    } catch (e) { console.error(e); }
    setMsgsLoading(false);
    setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [moodleToken, moodleUserId]);

  const selectConv = (conv) => {
    setSelected(conv);
    loadMessages(conv);
  };

  // Send message
  const handleSend = async () => {
    if (!newMsg.trim() || !selected || sending) return;
    const otherUser = selected.members?.find(m => m.id !== moodleUserId);
    if (!otherUser) return;

    setSending(true);
    try {
      await sendMessage(moodleToken, otherUser.id, newMsg.trim());
      setNewMsg("");
      // Reload messages
      await loadMessages(selected);
      inputRef.current?.focus();
    } catch (e) {
      alert("Error al enviar: " + e.message);
    }
    setSending(false);
  };

  // Filter conversations
  const filtered = filter.trim()
    ? conversations.filter(c => {
        const name = c.members?.map(m => m.fullname).join(", ") || "";
        const lastMsg = stripHtml(c.messages?.[0]?.text || "");
        return name.toLowerCase().includes(filter.toLowerCase()) || lastMsg.toLowerCase().includes(filter.toLowerCase());
      })
    : conversations;

  // Mobile: show list or chat
  const showChat = !!selected;

  return (
    <div className="fade-in" style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 28, color: P.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
            <MessageCircle size={26} color={P.red} /> Mensajes
          </h1>
          <p style={{ color: P.textMuted, fontSize: 14, marginTop: 2 }}>
            {conversations.length} conversaciones
          </p>
        </div>
        <button onClick={() => loadConversations(true)} disabled={refreshing}
          style={{ padding: "8px 14px", borderRadius: 8, background: P.card, border: `1px solid ${P.border}`, color: P.textMuted, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <RefreshCw size={14} className={refreshing ? "spin" : ""} /> Actualizar
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 0, background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden", minHeight: 0 }}>

        {/* ═══ LEFT: Conversations list ═══ */}
        <div style={{
          width: showChat ? 320 : "100%", maxWidth: 380, flexShrink: 0,
          borderRight: `1px solid ${P.borderLight}`, display: "flex", flexDirection: "column",
          ...(showChat ? {} : { flex: 1 }),
        }}>
          {/* Search */}
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${P.borderLight}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: P.bg, borderRadius: 10, padding: "0 12px", border: `1px solid ${P.border}` }}>
              <Search size={14} color={P.textMuted} />
              <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
                placeholder="Buscar conversación..."
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: P.text, padding: "10px 0", fontFamily: ff.body }}
              />
            </div>
          </div>

          {/* Conversations */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Loader2 size={18} className="spin" color={P.red} /> Cargando...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: P.textMuted }}>
                <MessageCircle size={28} strokeWidth={1.2} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>{filter ? "Sin resultados" : "No hay conversaciones"}</div>
              </div>
            ) : filtered.map((conv, i) => {
              const otherMembers = conv.members?.filter(m => m.id !== moodleUserId) || [];
              const name = otherMembers.map(m => m.fullname).join(", ") || "Desconocido";
              const avatar = otherMembers[0]?.profileimageurl;
              const initial = name.charAt(0).toUpperCase();
              const lastMsg = conv.messages?.[0];
              const lastText = stripHtml(lastMsg?.text || "");
              const isGroup = conv.type === 2;
              const isSelected = selected?.id === conv.id;
              const isUnread = conv.isread === false || conv.unreadcount > 0;

              return (
                <button key={conv.id || i} onClick={() => selectConv(conv)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", textAlign: "left", transition: "all 0.15s",
                    background: isSelected ? `${P.red}08` : "transparent",
                    borderBottom: `1px solid ${P.borderLight}`,
                    borderLeft: isSelected ? `3px solid ${P.red}` : "3px solid transparent",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = P.cream; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? `${P.red}08` : "transparent"; }}>
                  {/* Avatar */}
                  {avatar && !avatar.includes("/u/f2") ? (
                    <img src={avatar} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} referrerPolicy="no-referrer" />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: isGroup ? "#E0E7FF" : P.redSoft, color: isGroup ? "#4F46E5" : P.red, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15, fontWeight: 700 }}>
                      {isGroup ? <Users size={18} /> : initial}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: isUnread ? 700 : 500, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                      {lastMsg && <span style={{ fontSize: 10, color: P.textMuted, flexShrink: 0, marginLeft: 8 }}>{timeAgo(lastMsg.timecreated)}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: isUnread ? P.text : P.textMuted, fontWeight: isUnread ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {lastText || "Sin mensajes"}
                    </div>
                  </div>
                  {isUnread && conv.unreadcount > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: P.red, padding: "1px 6px", borderRadius: 10, flexShrink: 0 }}>
                      {conv.unreadcount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ RIGHT: Chat ═══ */}
        {showChat ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Chat header */}
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setSelected(null)} style={{ padding: 4, color: P.textMuted, borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.color = P.text} onMouseLeave={e => e.currentTarget.style.color = P.textMuted}>
                <ArrowLeft size={18} />
              </button>
              {(() => {
                const other = selected.members?.filter(m => m.id !== moodleUserId) || [];
                const name = other.map(m => m.fullname).join(", ");
                const avatar = other[0]?.profileimageurl;
                return (
                  <>
                    {avatar && !avatar.includes("/u/f2") ? (
                      <img src={avatar} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover" }} referrerPolicy="no-referrer" />
                    ) : (
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: P.redSoft, color: P.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: P.text }}>{name}</div>
                      <div style={{ fontSize: 11, color: P.textMuted }}>{other.length > 1 ? `${other.length} participantes` : "Mensaje directo"}</div>
                    </div>
                  </>
                );
              })()}
              <button onClick={() => loadMessages(selected)} style={{ marginLeft: "auto", padding: 6, color: P.textMuted, borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.color = P.text} onMouseLeave={e => e.currentTarget.style.color = P.textMuted}>
                <RefreshCw size={15} />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {msgsLoading ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: P.textMuted, gap: 8 }}>
                  <Loader2 size={18} className="spin" color={P.red} /> Cargando mensajes...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: P.textMuted, fontSize: 13 }}>
                  No hay mensajes en esta conversación
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isMine = msg.useridfrom === moodleUserId;
                    const text = stripHtml(msg.text);
                    const time = msg.timecreated ? new Date(msg.timecreated * 1000).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";
                    const showDate = i === 0 || !messages[i - 1]?.timecreated || new Date(msg.timecreated * 1000).toDateString() !== new Date(messages[i - 1].timecreated * 1000).toDateString();
                    return (
                      <div key={msg.id || i}>
                        {showDate && (
                          <div style={{ textAlign: "center", padding: "8px 0", fontSize: 11, color: P.textMuted, fontWeight: 600 }}>
                            {new Date(msg.timecreated * 1000).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                          <div style={{
                            maxWidth: "75%", padding: "10px 14px", borderRadius: 14,
                            background: isMine ? P.red : P.bg,
                            color: isMine ? "#fff" : P.text,
                            border: isMine ? "none" : `1px solid ${P.border}`,
                            borderBottomRightRadius: isMine ? 4 : 14,
                            borderBottomLeftRadius: isMine ? 14 : 4,
                          }}>
                            {!isMine && selected.members?.length > 2 && (
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#4F46E5", marginBottom: 4 }}>
                                {msg.userfullname || ""}
                              </div>
                            )}
                            <div style={{ fontSize: 13, lineHeight: 1.55, wordBreak: "break-word" }}>{text}</div>
                            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: "right" }}>{time}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={msgsEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: "12px 18px", borderTop: `1px solid ${P.borderLight}`, display: "flex", gap: 8 }}>
              <input ref={inputRef} type="text" value={newMsg} onChange={e => setNewMsg(e.target.value)}
                placeholder="Escribí un mensaje..."
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${P.border}`, fontSize: 14, color: P.text, background: P.bg, fontFamily: ff.body, outline: "none" }}
                onFocus={e => e.currentTarget.style.borderColor = P.red} onBlur={e => e.currentTarget.style.borderColor = P.border}
              />
              <button onClick={handleSend} disabled={!newMsg.trim() || sending}
                style={{
                  width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  background: !newMsg.trim() ? P.borderLight : P.red, color: !newMsg.trim() ? P.textMuted : "#fff",
                  border: "none", cursor: !newMsg.trim() ? "not-allowed" : "pointer", transition: "all 0.2s", flexShrink: 0,
                }}>
                {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: P.textMuted }}>
            <div style={{ textAlign: "center" }}>
              <MessageCircle size={40} strokeWidth={1.2} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: P.textSec }}>Seleccioná una conversación</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Elegí un chat de la lista para ver los mensajes</div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}