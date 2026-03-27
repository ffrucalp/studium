import { P, ff } from "../styles/theme";

export function Btn({ children, primary, onClick, disabled, style: s, ...rest }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 20px",
        borderRadius: 10,
        background: primary ? P.red : P.card,
        color: primary ? "#fff" : P.text,
        fontSize: 13,
        fontWeight: 600,
        border: primary ? "none" : `1px solid ${P.border}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "all 0.2s",
        opacity: disabled ? 0.6 : 1,
        ...s,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = primary
            ? "0 4px 16px rgba(183,28,28,0.3)"
            : "0 2px 8px rgba(0,0,0,0.06)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "none";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Parse inline markdown: **bold**, *italic*, `code`
 */
function parseInline(text) {
  if (!text) return text;
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Find the next markdown pattern
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    const codeMatch = remaining.match(/`(.+?)`/);

    // Find which comes first
    const candidates = [
      boldMatch && { type: "bold", match: boldMatch },
      italicMatch && { type: "italic", match: italicMatch },
      codeMatch && { type: "code", match: codeMatch },
    ].filter(Boolean).sort((a, b) => a.match.index - b.match.index);

    if (candidates.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = candidates[0];
    const idx = first.match.index;

    // Add text before the match
    if (idx > 0) {
      parts.push(remaining.slice(0, idx));
    }

    // Add formatted element
    const inner = first.match[1];
    if (first.type === "bold") {
      parts.push(<strong key={key++} style={{ fontWeight: 700, color: P.text }}>{inner}</strong>);
    } else if (first.type === "italic") {
      parts.push(<em key={key++}>{inner}</em>);
    } else if (first.type === "code") {
      parts.push(
        <code key={key++} style={{ background: P.borderLight, padding: "2px 6px", borderRadius: 4, fontSize: "0.9em", fontFamily: "monospace" }}>
          {inner}
        </code>
      );
    }

    remaining = remaining.slice(idx + first.match[0].length);
  }

  return parts;
}

export function RenderMarkdown({ text }) {
  if (!text) return null;
  return (
    <>
      {text.split("\n").map((line, i) => {
        // Headers
        if (line.startsWith("## "))
          return (
            <h3 key={i} style={{ fontSize: 18, fontWeight: 700, margin: "20px 0 8px", color: P.red, fontFamily: ff.heading }}>
              {parseInline(line.slice(3))}
            </h3>
          );
        if (line.startsWith("### "))
          return (
            <h4 key={i} style={{ fontSize: 15, fontWeight: 600, margin: "14px 0 6px", color: P.text }}>
              {parseInline(line.slice(4))}
            </h4>
          );
        // Numbered lists (1. 2. etc.)
        const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch)
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, lineHeight: 1.65, color: P.textSec }}>
              <span style={{ color: P.red, fontWeight: 700, flexShrink: 0 }}>{numMatch[1]}.</span>
              <span>{parseInline(numMatch[2])}</span>
            </div>
          );
        // Bullet lists
        if (line.startsWith("- "))
          return (
            <div key={i} style={{ display: "flex", gap: 8, marginLeft: 8, marginBottom: 4, lineHeight: 1.65, color: P.textSec }}>
              <span style={{ color: P.red, flexShrink: 0 }}>•</span>
              <span>{parseInline(line.slice(2))}</span>
            </div>
          );
        // Full bold line
        if (line.startsWith("**") && line.endsWith("**"))
          return (
            <p key={i} style={{ fontWeight: 700, margin: "10px 0 4px", color: P.text }}>
              {line.slice(2, -2)}
            </p>
          );
        // Empty line
        if (line.trim() === "") return <br key={i} />;
        // Normal paragraph with inline formatting
        return (
          <p key={i} style={{ margin: "4px 0", lineHeight: 1.7, color: P.textSec }}>
            {parseInline(line)}
          </p>
        );
      })}
    </>
  );
}
