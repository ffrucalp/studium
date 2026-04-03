import { useState, useEffect, useRef, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { supabase } from "../services/supabase";
import {
  MessageCircle, Send, Loader2, Users, Search,
  ArrowLeft, RefreshCw, Wifi, WifiOff, Hash,
} from "lucide-react";

function timeStr(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function dateStr(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Hoy";
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

export default function LiveChat() {
  const { user, moodleUserId, courses } = useApp();
  const [rooms, setRooms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [filter, setFilter] = useState("");
  const msgsEndRef = useRef(null);
  const inputRef = useRef(null);
  const channelRef = useRef(null);
  const presenceRef = useRef(null);

  if (!supabase) {
    return (
      <div className="fade-in" style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
        <WifiOff size={48} color={P.textMuted} strokeWidth={1.2} style={{ marginBottom: 14 }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: P.text, marginBottom: 8 }}>Chat no configurado</h2>
        <p style={{ color: P.textMuted, fontSize: 14 }}>Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el .env</p>
      </div>
    );
  }

  // ── Ensure rooms exist for all courses ──
  const ensureRooms = useCallback(async () => {
    setLoading(true);
    try {
      // Get existing rooms
      const { data: existing } = await supabase.from("chat_rooms").select("*").eq("type", "course");
      const existingCourseIds = (existing || []).map(r => r.course_id);

      // Create missing rooms
      const missing = courses.filter(c => !existingCourseIds.includes(c.id));
      if (missing.length > 0) {
        const newRooms = missing.map(c => ({
          name: c.fullname, type: "course", course_id: c.id,
        }));
        await supabase.from("chat_rooms").insert(newRooms);
      }

      // Reload all rooms
      const { data: allRooms } = await supabase.from("chat_rooms").select("*").eq("type", "course").order("name");
      setRooms(allRooms || []);

      // Ensure membership in batch
      const memberships = (allRooms || [])
        .filter(room => courses.find(c => c.id === room.course_id))
        .map(room => ({
          room_id: room.id, user_id: moodleUserId,
          user_name: user?.name || "Estudiante",
          user_email: user?.email || "",
          user_picture: user?.picture || null,
        }));
      if (memberships.length > 0) {
        await supabase.from("chat_members").upsert(memberships, { onConflict: "room_id,user_id" });
      }
    } catch (e) { console.error("Error ensuring rooms:", e); }
    setLoading(false);
  }, [courses, moodleUserId, user]);

  useEffect(() => { ensureRooms(); }, [ensureRooms]);

  // ── Presence channel for online count ──
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel("studium-presence", { config: { presence: { key: String(moodleUserId) } } });
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineCount(Object.keys(state).length);
    });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: moodleUserId, name: user?.name || "Estudiante" });
      }
    });
    presenceRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [moodleUserId, user]);

  // ── Load messages for selected room ──
  const loadMessages = useCallback(async (room) => {
    setMsgsLoading(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(data || []);
    setMsgsLoading(false);
    setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  // ── Select room + subscribe to realtime ──
  const selectRoom = useCallback((room) => {
    // Unsubscribe from previous
    if (channelRef.current) { channelRef.current.unsubscribe(); channelRef.current = null; }

    setSelected(room);
    loadMessages(room);

    // Subscribe to new messages in this room
    const channel = supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();
    channelRef.current = channel;
  }, [loadMessages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (channelRef.current) channelRef.current.unsubscribe(); };
  }, []);

  // ── Send message ──
  const handleSend = async () => {
    if (!newMsg.trim() || !selected || sending) return;
    setSending(true);
    try {
      await supabase.from("chat_messages").insert({
        room_id: selected.id,
        user_id: moodleUserId,
        user_name: user?.name || "Estudiante",
        user_picture: user?.picture || null,
        message: newMsg.trim(),
      });
      setNewMsg("");
      inputRef.current?.focus();
    } catch (e) { console.error(e); }
    setSending(false);
  };

  // ── Get last message and member count for all rooms at once ──
  const [lastMsgs, setLastMsgs] = useState({});
  const [memberCounts, setMemberCounts] = useState({});
  useEffect(() => {
    if (rooms.length === 0 || !supabase) return;
    const loadPreviews = async () => {
      const roomIds = rooms.map(r => r.id);
      // Get all recent messages in one query
      const { data: allMsgs } = await supabase
        .from("chat_messages")
        .select("room_id, message, user_name, created_at")
        .in("room_id", roomIds)
        .order("created_at", { ascending: false });
      const lm = {};
      for (const msg of (allMsgs || [])) {
        if (!lm[msg.room_id]) lm[msg.room_id] = msg;
      }
      setLastMsgs(lm);

      // Get all members in one query
      const { data: allMembers } = await supabase
        .from("chat_members")
        .select("room_id")
        .in("room_id", roomIds);
      const counts = {};
      for (const m of (allMembers || [])) {
        counts[m.room_id] = (counts[m.room_id] || 0) + 1;
      }
      setMemberCounts(counts);
    };
    loadPreviews();
  }, [rooms]);

  const filtered = filter.trim()
    ? rooms.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()))
    : rooms;

  const showChat = !!selected;

  return (
    <div className="fade-in" style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 28, color: P.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
            <MessageCircle size={26} color={P.red} /> Chat en vivo
          </h1>
          <p style={{ color: P.textMuted, fontSize: 14, marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
            {rooms.length} salas de materias
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#059669", fontWeight: 600 }}>
              <Wifi size={12} /> {onlineCount} conectado{onlineCount !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 0, background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden", minHeight: 0 }}>

        {/* ═══ LEFT: Rooms ═══ */}
        <div style={{ width: showChat ? 300 : "100%", maxWidth: 360, flexShrink: 0, borderRight: `1px solid ${P.borderLight}`, display: "flex", flexDirection: "column", ...(showChat ? {} : { flex: 1 }) }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${P.borderLight}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: P.bg, borderRadius: 10, padding: "0 12px", border: `1px solid ${P.border}` }}>
              <Search size={14} color={P.textMuted} />
              <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar materia..."
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: P.text, padding: "10px 0", fontFamily: ff.body }} />
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Loader2 size={18} className="spin" color={P.red} /> Cargando salas...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: P.textMuted }}>
                <Hash size={28} strokeWidth={1.2} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>{filter ? "Sin resultados" : "No hay salas"}</div>
              </div>
            ) : filtered.map((room, i) => {
              const isSelected = selected?.id === room.id;
              const last = lastMsgs[room.id];
              const members = memberCounts[room.id] || 0;
              const course = courses.find(c => c.id === room.course_id);
              const color = course?.color || P.red;
              return (
                <button key={room.id} onClick={() => selectRoom(room)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", textAlign: "left", transition: "all 0.15s",
                    background: isSelected ? `${color}08` : "transparent",
                    borderBottom: `1px solid ${P.borderLight}`,
                    borderLeft: isSelected ? `3px solid ${color}` : "3px solid transparent",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = P.cream; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? `${color}08` : "transparent"; }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, fontWeight: 700 }}>
                    <Hash size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {room.name}
                      </span>
                      {last && <span style={{ fontSize: 10, color: P.textMuted, flexShrink: 0, marginLeft: 8 }}>{timeStr(last.created_at)}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: P.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {last ? `${last.user_name.split(" ")[0]}: ${last.message}` : "Sin mensajes aún"}
                    </div>
                    {members > 0 && <div style={{ fontSize: 10, color: P.textMuted, marginTop: 2 }}><Users size={9} style={{ verticalAlign: "-1px" }} /> {members} participantes</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ RIGHT: Chat ═══ */}
        {showChat ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Header */}
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { setSelected(null); if (channelRef.current) { channelRef.current.unsubscribe(); channelRef.current = null; } }}
                style={{ padding: 4, color: P.textMuted, borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.color = P.text} onMouseLeave={e => e.currentTarget.style.color = P.textMuted}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${courses.find(c => c.id === selected.course_id)?.color || P.red}15`, color: courses.find(c => c.id === selected.course_id)?.color || P.red, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Hash size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: P.textMuted }}>{memberCounts[selected.id] || 0} participantes · Chat en vivo</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
              {msgsLoading ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: P.textMuted, gap: 8 }}>
                  <Loader2 size={18} className="spin" color={P.red} /> Cargando mensajes...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: P.textMuted }}>
                  <div style={{ textAlign: "center" }}>
                    <Hash size={32} strokeWidth={1.2} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: P.textSec }}>Inicio de la sala</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Sé el primero en escribir en esta sala</div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isMine = msg.user_id === moodleUserId;
                    const showAuthor = !isMine && (i === 0 || messages[i - 1]?.user_id !== msg.user_id);
                    const showDate = i === 0 || dateStr(msg.created_at) !== dateStr(messages[i - 1]?.created_at);
                    return (
                      <div key={msg.id || i}>
                        {showDate && (
                          <div style={{ textAlign: "center", padding: "10px 0 6px", fontSize: 11, color: P.textMuted, fontWeight: 600 }}>
                            {dateStr(msg.created_at)}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginTop: showAuthor && !isMine ? 8 : 0 }}>
                          <div style={{ maxWidth: "75%", display: "flex", gap: 8, flexDirection: isMine ? "row-reverse" : "row", alignItems: "flex-end" }}>
                            {!isMine && showAuthor && (
                              msg.user_picture ? (
                                <img src={msg.user_picture} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} referrerPolicy="no-referrer" />
                              ) : (
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#E0E7FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                  {msg.user_name?.charAt(0).toUpperCase()}
                                </div>
                              )
                            )}
                            {!isMine && !showAuthor && <div style={{ width: 28, flexShrink: 0 }} />}
                            <div style={{
                              padding: "8px 14px", borderRadius: 14,
                              background: isMine ? P.red : P.bg,
                              color: isMine ? "#fff" : P.text,
                              border: isMine ? "none" : `1px solid ${P.border}`,
                              borderBottomRightRadius: isMine ? 4 : 14,
                              borderBottomLeftRadius: isMine ? 14 : 4,
                            }}>
                              {!isMine && showAuthor && (
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", marginBottom: 3 }}>{msg.user_name}</div>
                              )}
                              <div style={{ fontSize: 13, lineHeight: 1.5, wordBreak: "break-word" }}>{msg.message}</div>
                              <div style={{ fontSize: 10, marginTop: 3, opacity: 0.55, textAlign: "right" }}>{timeStr(msg.created_at)}</div>
                            </div>
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
              <div style={{ fontSize: 15, fontWeight: 600, color: P.textSec }}>Seleccioná una sala</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Cada materia tiene su sala de chat en tiempo real</div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}import { useState, useEffect, useRef, useCallback } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { supabase } from "../services/supabase";
import {
  MessageCircle, Send, Loader2, Users, Search,
  ArrowLeft, RefreshCw, Wifi, WifiOff, Hash,
} from "lucide-react";

function timeStr(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}
function dateStr(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Hoy";
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

export default function LiveChat() {
  const { user, moodleUserId, courses } = useApp();
  const [rooms, setRooms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [filter, setFilter] = useState("");
  const msgsEndRef = useRef(null);
  const inputRef = useRef(null);
  const channelRef = useRef(null);
  const presenceRef = useRef(null);

  if (!supabase) {
    return (
      <div className="fade-in" style={{ maxWidth: 600, margin: "60px auto", textAlign: "center" }}>
        <WifiOff size={48} color={P.textMuted} strokeWidth={1.2} style={{ marginBottom: 14 }} />
        <h2 style={{ fontSize: 20, fontWeight: 700, color: P.text, marginBottom: 8 }}>Chat no configurado</h2>
        <p style={{ color: P.textMuted, fontSize: 14 }}>Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el .env</p>
      </div>
    );
  }

  // ── Ensure rooms exist for all courses ──
  const ensureRooms = useCallback(async () => {
    setLoading(true);
    try {
      // Get existing rooms
      const { data: existing } = await supabase.from("chat_rooms").select("*").eq("type", "course");
      const existingCourseIds = (existing || []).map(r => r.course_id);

      // Create missing rooms
      const missing = courses.filter(c => !existingCourseIds.includes(c.id));
      if (missing.length > 0) {
        const newRooms = missing.map(c => ({
          name: c.fullname, type: "course", course_id: c.id,
        }));
        await supabase.from("chat_rooms").insert(newRooms);
      }

      // Reload all rooms
      const { data: allRooms } = await supabase.from("chat_rooms").select("*").eq("type", "course").order("name");
      setRooms(allRooms || []);

      // Ensure membership in batch
      const memberships = (allRooms || [])
        .filter(room => courses.find(c => c.id === room.course_id))
        .map(room => ({
          room_id: room.id, user_id: moodleUserId,
          user_name: user?.name || "Estudiante",
          user_email: user?.email || "",
          user_picture: user?.picture || null,
        }));
      if (memberships.length > 0) {
        await supabase.from("chat_members").upsert(memberships, { onConflict: "room_id,user_id" });
      }
    } catch (e) { console.error("Error ensuring rooms:", e); }
    setLoading(false);
  }, [courses, moodleUserId, user]);

  useEffect(() => { ensureRooms(); }, [ensureRooms]);

  // ── Presence channel for online count ──
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel("studium-presence", { config: { presence: { key: String(moodleUserId) } } });
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setOnlineCount(Object.keys(state).length);
    });
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: moodleUserId, name: user?.name || "Estudiante" });
      }
    });
    presenceRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [moodleUserId, user]);

  // ── Load messages for selected room ──
  const loadMessages = useCallback(async (room) => {
    setMsgsLoading(true);
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(data || []);
    setMsgsLoading(false);
    setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  // ── Select room + subscribe to realtime ──
  const selectRoom = useCallback((room) => {
    // Unsubscribe from previous
    if (channelRef.current) { channelRef.current.unsubscribe(); channelRef.current = null; }

    setSelected(room);
    loadMessages(room);

    // Subscribe to new messages in this room
    const channel = supabase
      .channel(`room-${room.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();
    channelRef.current = channel;
  }, [loadMessages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (channelRef.current) channelRef.current.unsubscribe(); };
  }, []);

  // ── Send message ──
  const handleSend = async () => {
    if (!newMsg.trim() || !selected || sending) return;
    setSending(true);
    try {
      await supabase.from("chat_messages").insert({
        room_id: selected.id,
        user_id: moodleUserId,
        user_name: user?.name || "Estudiante",
        user_picture: user?.picture || null,
        message: newMsg.trim(),
      });
      setNewMsg("");
      inputRef.current?.focus();
    } catch (e) { console.error(e); }
    setSending(false);
  };

  // ── Get last message and member count for all rooms at once ──
  const [lastMsgs, setLastMsgs] = useState({});
  const [memberCounts, setMemberCounts] = useState({});
  useEffect(() => {
    if (rooms.length === 0 || !supabase) return;
    const loadPreviews = async () => {
      const roomIds = rooms.map(r => r.id);
      // Get all recent messages in one query
      const { data: allMsgs } = await supabase
        .from("chat_messages")
        .select("room_id, message, user_name, created_at")
        .in("room_id", roomIds)
        .order("created_at", { ascending: false });
      const lm = {};
      for (const msg of (allMsgs || [])) {
        if (!lm[msg.room_id]) lm[msg.room_id] = msg;
      }
      setLastMsgs(lm);

      // Get all members in one query
      const { data: allMembers } = await supabase
        .from("chat_members")
        .select("room_id")
        .in("room_id", roomIds);
      const counts = {};
      for (const m of (allMembers || [])) {
        counts[m.room_id] = (counts[m.room_id] || 0) + 1;
      }
      setMemberCounts(counts);
    };
    loadPreviews();
  }, [rooms]);

  const filtered = filter.trim()
    ? rooms.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()))
    : rooms;

  const showChat = !!selected;

  return (
    <div className="fade-in" style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontFamily: ff.heading, fontSize: 28, color: P.text, fontWeight: 800, display: "flex", alignItems: "center", gap: 10 }}>
            <MessageCircle size={26} color={P.red} /> Chat en vivo
          </h1>
          <p style={{ color: P.textMuted, fontSize: 14, marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
            {rooms.length} salas de materias
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#059669", fontWeight: 600 }}>
              <Wifi size={12} /> {onlineCount} conectado{onlineCount !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 0, background: P.card, borderRadius: 16, border: `1px solid ${P.border}`, overflow: "hidden", minHeight: 0 }}>

        {/* ═══ LEFT: Rooms ═══ */}
        <div style={{ width: showChat ? 300 : "100%", maxWidth: 360, flexShrink: 0, borderRight: `1px solid ${P.borderLight}`, display: "flex", flexDirection: "column", ...(showChat ? {} : { flex: 1 }) }}>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${P.borderLight}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: P.bg, borderRadius: 10, padding: "0 12px", border: `1px solid ${P.border}` }}>
              <Search size={14} color={P.textMuted} />
              <input type="text" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar materia..."
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: P.text, padding: "10px 0", fontFamily: ff.body }} />
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: P.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Loader2 size={18} className="spin" color={P.red} /> Cargando salas...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: P.textMuted }}>
                <Hash size={28} strokeWidth={1.2} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: 13 }}>{filter ? "Sin resultados" : "No hay salas"}</div>
              </div>
            ) : filtered.map((room, i) => {
              const isSelected = selected?.id === room.id;
              const last = lastMsgs[room.id];
              const members = memberCounts[room.id] || 0;
              const course = courses.find(c => c.id === room.course_id);
              const color = course?.color || P.red;
              return (
                <button key={room.id} onClick={() => selectRoom(room)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", textAlign: "left", transition: "all 0.15s",
                    background: isSelected ? `${color}08` : "transparent",
                    borderBottom: `1px solid ${P.borderLight}`,
                    borderLeft: isSelected ? `3px solid ${color}` : "3px solid transparent",
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = P.cream; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? `${color}08` : "transparent"; }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, fontWeight: 700 }}>
                    <Hash size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {room.name}
                      </span>
                      {last && <span style={{ fontSize: 10, color: P.textMuted, flexShrink: 0, marginLeft: 8 }}>{timeStr(last.created_at)}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: P.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {last ? `${last.user_name.split(" ")[0]}: ${last.message}` : "Sin mensajes aún"}
                    </div>
                    {members > 0 && <div style={{ fontSize: 10, color: P.textMuted, marginTop: 2 }}><Users size={9} style={{ verticalAlign: "-1px" }} /> {members} participantes</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ RIGHT: Chat ═══ */}
        {showChat ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Header */}
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${P.borderLight}`, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { setSelected(null); if (channelRef.current) { channelRef.current.unsubscribe(); channelRef.current = null; } }}
                style={{ padding: 4, color: P.textMuted, borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.color = P.text} onMouseLeave={e => e.currentTarget.style.color = P.textMuted}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${courses.find(c => c.id === selected.course_id)?.color || P.red}15`, color: courses.find(c => c.id === selected.course_id)?.color || P.red, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Hash size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: P.textMuted }}>{memberCounts[selected.id] || 0} participantes · Chat en vivo</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
              {msgsLoading ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: P.textMuted, gap: 8 }}>
                  <Loader2 size={18} className="spin" color={P.red} /> Cargando mensajes...
                </div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: P.textMuted }}>
                  <div style={{ textAlign: "center" }}>
                    <Hash size={32} strokeWidth={1.2} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: P.textSec }}>Inicio de la sala</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Sé el primero en escribir en esta sala</div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => {
                    const isMine = msg.user_id === moodleUserId;
                    const showAuthor = !isMine && (i === 0 || messages[i - 1]?.user_id !== msg.user_id);
                    const showDate = i === 0 || dateStr(msg.created_at) !== dateStr(messages[i - 1]?.created_at);
                    return (
                      <div key={msg.id || i}>
                        {showDate && (
                          <div style={{ textAlign: "center", padding: "10px 0 6px", fontSize: 11, color: P.textMuted, fontWeight: 600 }}>
                            {dateStr(msg.created_at)}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start", marginTop: showAuthor && !isMine ? 8 : 0 }}>
                          <div style={{ maxWidth: "75%", display: "flex", gap: 8, flexDirection: isMine ? "row-reverse" : "row", alignItems: "flex-end" }}>
                            {!isMine && showAuthor && (
                              msg.user_picture ? (
                                <img src={msg.user_picture} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} referrerPolicy="no-referrer" />
                              ) : (
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#E0E7FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                  {msg.user_name?.charAt(0).toUpperCase()}
                                </div>
                              )
                            )}
                            {!isMine && !showAuthor && <div style={{ width: 28, flexShrink: 0 }} />}
                            <div style={{
                              padding: "8px 14px", borderRadius: 14,
                              background: isMine ? P.red : P.bg,
                              color: isMine ? "#fff" : P.text,
                              border: isMine ? "none" : `1px solid ${P.border}`,
                              borderBottomRightRadius: isMine ? 4 : 14,
                              borderBottomLeftRadius: isMine ? 14 : 4,
                            }}>
                              {!isMine && showAuthor && (
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", marginBottom: 3 }}>{msg.user_name}</div>
                              )}
                              <div style={{ fontSize: 13, lineHeight: 1.5, wordBreak: "break-word" }}>{msg.message}</div>
                              <div style={{ fontSize: 10, marginTop: 3, opacity: 0.55, textAlign: "right" }}>{timeStr(msg.created_at)}</div>
                            </div>
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
              <div style={{ fontSize: 15, fontWeight: 600, color: P.textSec }}>Seleccioná una sala</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Cada materia tiene su sala de chat en tiempo real</div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}