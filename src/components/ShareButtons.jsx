import { useState } from "react";
import { P, ff } from "../styles/theme";
import { useApp } from "../context/AppContext";
import { sendMessage } from "../services/moodle";
import {
  Share2, Copy, CheckCircle, Mail, MessageCircle, X,
  Send, Loader2, Search, User,
} from "lucide-react";

/**
 * ShareButtons - share text content via multiple channels
 * Props:
 *   text: string - the content to share
 *   title: string - title for the share (used in email subject, etc)
 *   compact: boolean - show only icons without labels
 */
export default function ShareButtons({ text, title = "Desde Studium UCALP", compact = false }) {
  const [copied, setCopied] = useState(false);
  const [showMoodleModal, setShowMoodleModal] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(`*${title}*\n\n${text.substring(0, 3000)}\n\n_Compartido desde Studium UCALP_`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${text.substring(0, 5000)}\n\n---\nCompartido desde Studium UCALP`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const btnStyle = {
    display: "inline-flex", alignItems: "center", gap: compact ? 0 : 5,
    padding: compact ? "6px" : "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600,
    border: `1px solid ${P.border}`, background: P.card, color: P.textSec,
    cursor: "pointer", transition: "all 0.15s",
  };

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: P.textMuted, marginRight: 2 }}><Share2 size={12} style={{ verticalAlign: "-2px" }} /></span>

        {/* Copy */}
        <button onClick={copyToClipboard} style={{ ...btnStyle, color: copied ? "#059669" : P.textSec, borderColor: copied ? "#059669" : P.border }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#059669"} onMouseLeave={e => e.currentTarget.style.borderColor = copied ? "#059669" : P.border}>
          {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
          {!compact && (copied ? "Copiado" : "Copiar")}
        </button>

        {/* WhatsApp */}
        <button onClick={shareWhatsApp} style={{ ...btnStyle, color: "#25D366" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#25D366"} onMouseLeave={e => e.currentTarget.style.borderColor = P.border}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          {!compact && "WhatsApp"}
        </button>

        {/* Email */}
        <button onClick={shareEmail} style={btnStyle}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#2563eb"} onMouseLeave={e => e.currentTarget.style.borderColor = P.border}>
          <Mail size={13} />
          {!compact && "Email"}
        </button>

        {/* Moodle Message */}
        <button onClick={() => setShowMoodleModal(true)} style={{ ...btnStyle, color: "#B71C1C" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#B71C1C"} onMouseLeave={e => e.currentTarget.style.borderColor = P.border}>
          <MessageCircle size={13} />
          {!compact && "Moodle"}
        </button>
      </div>

      {/* Moodle send modal */}
      {showMoodleModal && (
        <MoodleSendModal text={text} title={title} onClose={() => setShowMoodleModal(false)} />
      )}
    </>
  );
}

function MoodleSendModal({ text, title, onClose }) {
  const { moodleToken, moodleUserId, courses } = useApp();
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Search contacts from conversations
  const searchContacts = async () => {
    if (!search.trim()) return;
    setLoading(true);
    try {
      const { getConversations } = await import("../services/moodle");
      const data = await getConversations(moodleToken, moodleUserId);
      if (data?.conversations) {
        const users = [];
        for (const conv of data.conversations) {
          for (const m of (conv.members || [])) {
            if (m.id !== moodleUserId && m.fullname?.toLowerCase().includes(search.toLowerCase())) {
              if (!users.find(u => u.id === m.id)) {
                users.push({ id: m.id, name: m.fullname, picture: m.profileimageurl });
              }
            }
          }
        }
        setContacts(users.slice(0, 10));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!selectedUser || sending) return;
    setSending(true);
    try {
      const msg = `📚 *${title}*\n\n${text.substring(0, 4000)}\n\n— Compartido desde Studium UCALP`;
      await sendMessage(moodleToken, selectedUser.id, msg);
      setSent(true);
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      alert("Error al enviar: " + e.message);
    }
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: "90%", maxWidth: 420, background: P.bg, borderRadius: 18, border: `1px solid ${P.border}`, boxShadow: "0 20px 50px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${P.borderLight}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={18} color="#B71C1C" />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, fontFamily: ff.heading }}>Enviar por Moodle</h3>
          </div>
          <button onClick={onClose} style={{ padding: 4, color: P.textMuted }}><X size={18} /></button>
        </div>

        {sent ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <CheckCircle size={40} color="#059669" strokeWidth={1.5} style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: P.text }}>Mensaje enviado</div>
          </div>
        ) : (
          <div style={{ padding: "14px 18px" }}>
            {/* Preview */}
            <div style={{ padding: "10px 14px", background: P.borderLight, borderRadius: 10, marginBottom: 14, maxHeight: 80, overflow: "auto" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.text, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: P.textMuted, lineHeight: 1.4 }}>{text.substring(0, 150)}...</div>
            </div>

            {/* Search contacts */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: P.card, borderRadius: 10, padding: "0 10px", border: `1px solid ${P.border}` }}>
                <Search size={14} color={P.textMuted} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar compañero..."
                  onKeyDown={e => e.key === "Enter" && searchContacts()}
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: P.text, padding: "9px 0", fontFamily: ff.body }}
                />
              </div>
              <button onClick={searchContacts} disabled={!search.trim() || loading}
                style={{ padding: "8px 14px", borderRadius: 10, background: P.red, color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer" }}>
                {loading ? <Loader2 size={14} className="spin" /> : "Buscar"}
              </button>
            </div>

            {/* Selected user */}
            {selectedUser && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#ECFDF5", borderRadius: 8, marginBottom: 12 }}>
                <CheckCircle size={14} color="#059669" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#059669", flex: 1 }}>{selectedUser.name}</span>
                <button onClick={() => setSelectedUser(null)} style={{ color: P.textMuted, padding: 2 }}><X size={14} /></button>
              </div>
            )}

            {/* Contact list */}
            {contacts.length > 0 && !selectedUser && (
              <div style={{ maxHeight: 180, overflow: "auto", marginBottom: 12 }}>
                {contacts.map(u => (
                  <button key={u.id} onClick={() => setSelectedUser(u)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, transition: "all 0.15s", textAlign: "left" }}
                    onMouseEnter={e => e.currentTarget.style.background = P.cream} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    {u.picture && !u.picture.includes("/u/f2") ? (
                      <img src={u.picture} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover" }} referrerPolicy="no-referrer" />
                    ) : (
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: P.redSoft, color: P.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                        {u.name.charAt(0)}
                      </div>
                    )}
                    <span style={{ fontSize: 13, color: P.text }}>{u.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Send button */}
            <button onClick={handleSend} disabled={!selectedUser || sending}
              style={{
                width: "100%", padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                background: !selectedUser ? P.border : P.red, color: !selectedUser ? P.textMuted : "#fff",
                border: "none", cursor: !selectedUser ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
              {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              {sending ? "Enviando..." : "Enviar mensaje"}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}