import { useState, useEffect, useRef } from "react";
import { P, ff } from "../styles/theme";
import { Btn } from "../components/UI";
import { CONFIG } from "../config";
import {
  Search, BookOpen, ExternalLink, Star, StarOff, Clock, X, Loader2, BookMarked,
  ChevronDown, ChevronUp, ArrowRight, Building2, Globe, Hash, CheckCircle,
  GraduationCap, Trash2, FileText, Quote, Users, Sparkles, ArrowLeft, User,
} from "lucide-react";

const ELIBRO_BASE = "https://elibro.net/es/lc/ucalp";
const ELIBRO_SEARCH = `${ELIBRO_BASE}/busqueda_avanzada`;
const ELIBRO_HOME = `${ELIBRO_BASE}/inicio/`;
const GOOGLE_BOOKS_API = "https://www.googleapis.com/books/v1/volumes";
const BIBLIO_URL = `${CONFIG.API_BASE}/api/biblio/search`;
const S2_URL = `${CONFIG.API_BASE}/api/scholar`;
const GSCHOLAR_URL = "https://scholar.google.com/scholar";

// ── Helpers ─────────────────────────────────────────────────────────
const getFavs = () => { try { return JSON.parse(localStorage.getItem("studium_library_favs") || "[]"); } catch { return []; } };
const saveFavs = (f) => localStorage.setItem("studium_library_favs", JSON.stringify(f));
const getRecent = () => { try { return JSON.parse(localStorage.getItem("studium_library_recent") || "[]"); } catch { return []; } };
const saveRecent = (t) => { const r = getRecent().filter(x => x !== t); r.unshift(t); localStorage.setItem("studium_library_recent", JSON.stringify(r.slice(0, 8))); };
const removeRecent = (t) => { const r = getRecent().filter(x => x !== t); localStorage.setItem("studium_library_recent", JSON.stringify(r)); return r; };
const clearRecent = () => localStorage.removeItem("studium_library_recent");
const strip = (h) => h ? h.replace(/<[^>]*>/g, "") : "";
const elibroUrl = (q) => `${ELIBRO_SEARCH}?as_all=${encodeURIComponent(q)}&as_all_op=unaccent__icontains&prev=as`;
const gscholarUrl = (q) => `${GSCHOLAR_URL}?q=${encodeURIComponent(q)}`;

async function s2Post(endpoint, body) {
  const r = await fetch(`${S2_URL}/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
async function oaPost(endpoint, body) {
  const r = await fetch(`${CONFIG.API_BASE}/api/openalex/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

const SOURCES = [
  { id: "ucalp", label: "Catálogo UCALP", icon: Building2, color: P.red },
  { id: "google", label: "Google Books", icon: Globe, color: "#4285F4" },
  { id: "gscholar", label: "Google Scholar", icon: GraduationCap, color: "#4d90fe" },
  { id: "scholar", label: "Semantic Scholar", icon: GraduationCap, color: "#2563eb" },
  { id: "openalex", label: "OpenAlex", icon: BookOpen, color: "#e16b31" },
];
const UCALP_FIELDS = [
  { value: "13", label: "Título" }, { value: "12", label: "Apellido del Autor" },
  { value: "18", label: "Nombre del Autor" }, { value: "14", label: "Tema" },
];
const UCALP_BRANCHES = [
  { value: "0", label: "Todas las bibliotecas" }, { value: "6", label: "Ciencias Exactas e Ingeniería" },
  { value: "1", label: "Central" }, { value: "11", label: "Humanidades" },
  { value: "9", label: "Ciencias Económicas" }, { value: "14", label: "Derecho" },
  { value: "8", label: "Arquitectura y Diseño" }, { value: "12", label: "Ciencias de la Salud" },
  { value: "13", label: "Ciencias Políticas y Sociales" }, { value: "7", label: "Odontología" },
  { value: "10", label: "San Martín" }, { value: "2", label: "Bernal" }, { value: "5", label: "Bahía Blanca" },
];
const S2_MODES = [{ id: "papers", label: "Papers" }, { id: "authors", label: "Autores" }];

function mapPaper(p) {
  return {
    id: `s2-${p.paperId}`, paperId: p.paperId, title: p.title || "Sin título",
    authors: (p.authors || []).map(a => ({ name: a.name, id: a.authorId })),
    year: p.year, venue: p.venue || "", citationCount: p.citationCount || 0,
    influentialCitations: p.influentialCitationCount || 0, referenceCount: p.referenceCount || 0,
    tldr: p.tldr?.text || "", abstract: p.abstract || "",
    url: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
    openAccessPdf: p.openAccessPdf?.url || null, publicationTypes: p.publicationTypes || [],
    doi: p.externalIds?.DOI || null,
  };
}

// ── Main Component ──────────────────────────────────────────────────
export default function Library() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("ucalp");
  const [gResults, setGResults] = useState([]);
  const [uResults, setUResults] = useState([]);
  const [sResults, setSResults] = useState([]);
  const [oaResults, setOaResults] = useState([]);
  const [authorResults, setAuthorResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [favorites, setFavorites] = useState(getFavs);
  const [showFavs, setShowFavs] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [gTotal, setGTotal] = useState(0); const [gStart, setGStart] = useState(0);
  const [uPage, setUPage] = useState(1); const [uMore, setUMore] = useState(false);
  const [uField, setUField] = useState("13"); const [uBranch, setUBranch] = useState("0"); const [uError, setUError] = useState(null);
  const [sOffset, setSOffset] = useState(0); const [sTotal, setSTotal] = useState(0);
  const [oaPage, setOaPage] = useState(1); const [oaTotal, setOaTotal] = useState(0);
  const [gsResults, setGsResults] = useState([]); const [gsStart, setGsStart] = useState(0); const [gsTotal, setGsTotal] = useState(0); const [gsMore, setGsMore] = useState(false);
  // Filters
  const [yearFrom, setYearFrom] = useState(""); const [yearTo, setYearTo] = useState(""); const [sortBy, setSortBy] = useState("relevance");
  const [s2Mode, setS2Mode] = useState("papers");
  const [recoData, setRecoData] = useState(null); const [recoLoading, setRecoLoading] = useState(false);
  const [authorDetail, setAuthorDetail] = useState(null); const [authorLoading, setAuthorLoading] = useState(false);
  const [rk, setRk] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // ── Google Books ──────────────────────────────────────────────
  const searchG = async (q, start = 0) => {
    setLoading(true); setSearched(true); if (start === 0) setGResults([]);
    try {
      const p = new URLSearchParams({ q, maxResults: "12", startIndex: String(start), langRestrict: "es", printType: "books", orderBy: "relevance" });
      const k = import.meta.env.VITE_GOOGLE_BOOKS_KEY; if (k) p.append("key", k);
      const d = await (await fetch(`${GOOGLE_BOOKS_API}?${p}`)).json();
      const items = (d.items || []).map(it => { const v = it.volumeInfo || {}; return {
        id: it.id, title: v.title || "", subtitle: v.subtitle || "", authors: v.authors || [],
        publisher: v.publisher || "", publishedDate: v.publishedDate || "", description: strip(v.description || ""),
        pageCount: v.pageCount, categories: v.categories || [],
        thumbnail: v.imageLinks?.thumbnail?.replace("http:", "https:") || null,
        previewLink: v.previewLink, isbn: (v.industryIdentifiers || []).find(i => i.type === "ISBN_13")?.identifier || (v.industryIdentifiers || []).find(i => i.type === "ISBN_10")?.identifier || null,
      }; });
      start === 0 ? setGResults(items) : setGResults(p => [...p, ...items]);
      setGTotal(d.totalItems || 0); setGStart(start);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ── UCALP ─────────────────────────────────────────────────────
  const searchU = async (q, page = 1) => {
    setLoading(true); setSearched(true); setUError(null); if (page === 1) setUResults([]);
    try {
      const d = await (await fetch(BIBLIO_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, page, type: "avanzado", field: uField, sucursal: uBranch }) })).json();
      if (d.error) { setUError(d.error); return; }
      const books = (d.books || []).map((b, i) => ({ ...b, id: `ucalp-${page}-${i}` }));
      page === 1 ? setUResults(books) : setUResults(p => [...p, ...books]);
      setUPage(page); setUMore(d.hasMore || false);
    } catch (e) { setUError("No se pudo conectar con el catálogo."); } finally { setLoading(false); }
  };

  // ── Semantic Scholar Papers ───────────────────────────────────
  const searchS = async (q, offset = 0) => {
    setLoading(true); setSearched(true); if (offset === 0) setSResults([]);
    try {
      const d = await s2Post("search", { query: q, offset, limit: 10 });
      const papers = (d.data || []).map(mapPaper);
      offset === 0 ? setSResults(papers) : setSResults(p => [...p, ...papers]);
      setSOffset(offset); setSTotal(d.total || 0);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ── Semantic Scholar Authors ──────────────────────────────────
  const searchAuthors = async (q) => {
    setLoading(true); setSearched(true); setAuthorResults([]);
    try {
      const d = await s2Post("author", { query: q });
      setAuthorResults(d.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadAuthorDetail = async (authorId) => {
    setAuthorLoading(true); setAuthorDetail(null);
    try {
      const d = await s2Post("author", { authorId });
      setAuthorDetail(d);
    } catch (e) { console.error(e); } finally { setAuthorLoading(false); }
  };

  // ── Recommendations ──────────────────────────────────────────
  const loadRecos = async (paperId, title) => {
    setRecoLoading(true); setRecoData(null);
    try {
      const d = await s2Post("recommend", { paperId, limit: 8 });
      setRecoData({ title, papers: (d.recommendedPapers || []).map(mapPaper) });
    } catch (e) { console.error(e); } finally { setRecoLoading(false); }
  };

  // ── OpenAlex ──────────────────────────────────────────────────
  const searchOa = async (q, page = 1) => {
    setLoading(true); setSearched(true); if (page === 1) setOaResults([]);
    try {
      const d = await oaPost("search", { query: q, page, perPage: 10 });
      const works = (d.works || []).map(w => ({ ...w, id: `oa-${w.id}` }));
      page === 1 ? setOaResults(works) : setOaResults(p => [...p, ...works]);
      setOaPage(page); setOaTotal(d.total || 0);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ── Google Scholar (SerpApi) ──────────────────────────────────
  const searchGs = async (q, start = 0) => {
    setLoading(true); setSearched(true); if (start === 0) setGsResults([]);
    try {
      const body = { query: q, start };
      if (yearFrom) body.yearFrom = yearFrom;
      if (yearTo) body.yearTo = yearTo;
      if (sortBy === "date") body.sortBy = "date";
      const r = await fetch(`${CONFIG.API_BASE}/api/serpapi/scholar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (d.error) { console.error(d.error); setLoading(false); return; }
      const items = (d.results || []).map((r, i) => ({ ...r, id: `gs-${start}-${i}` }));
      start === 0 ? setGsResults(items) : setGsResults(p => [...p, ...items]);
      setGsStart(start); setGsTotal(d.total || 0); setGsMore(d.hasMore || false);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ── Unified ───────────────────────────────────────────────────
  const doSearch = (q, src) => {
    if (!q.trim()) return;
    saveRecent(q.trim()); setRk(k => k + 1); setShowFavs(false); setSearched(true);
    setRecoData(null); setAuthorDetail(null);
    if (src === "google") { setGStart(0); searchG(q, 0); }
    else if (src === "scholar") { s2Mode === "authors" ? searchAuthors(q) : (setSOffset(0), searchS(q, 0)); }
    else if (src === "openalex") { setOaPage(1); searchOa(q, 1); }
    else if (src === "gscholar") { setGsStart(0); searchGs(q, 0); }
    else { searchU(q, 1); }
  };
  const handleSearch = (e) => { e?.preventDefault(); doSearch(query, source); };

  const toggleFav = (b) => { setFavorites(p => { const x = p.some(f => f.id === b.id); const n = x ? p.filter(f => f.id !== b.id) : [...p, b]; saveFavs(n); return n; }); };
  const isFav = (id) => favorites.some(f => f.id === id);
  const recent = getRecent();
  const curResults = source === "google" ? gResults : source === "scholar" ? sResults : source === "openalex" ? oaResults : source === "gscholar" ? gsResults : uResults;

  return (
    <div className="fade-in" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: ff.heading, fontSize: 30, color: P.text, fontWeight: 800, marginBottom: 6 }}>Biblioteca</h1>
        <p style={{ color: P.textMuted, fontSize: 15 }}>Buscá en el catálogo UCALP, Google Books, Semantic Scholar y eLibro</p>
      </div>

      {/* Banners */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { href: ELIBRO_HOME, icon: BookMarked, title: "eLibro UCALP", sub: "Textos completos", bg: `linear-gradient(135deg,${P.sidebar},${P.redDark})` },
          { href: "https://biblio.ucalp.edu.ar/", icon: Building2, title: "Catálogo UCALP", sub: "Biblioteca física", bg: "linear-gradient(135deg,#1a365d,#2c5282)" },
          { href: "https://www.semanticscholar.org/", icon: GraduationCap, title: "Semantic Scholar", sub: "200M+ papers", bg: "linear-gradient(135deg,#1e3a5f,#2563eb)" },
          { href: "https://openalex.org/", icon: BookOpen, title: "OpenAlex", sub: "250M+ trabajos", bg: "linear-gradient(135deg,#7c2d12,#e16b31)" },
        ].map((b, i) => (
          <a key={i} href={b.href} target="_blank" rel="noopener noreferrer"
            style={{ background: b.bg, borderRadius: 14, padding: "16px 18px", textDecoration: "none", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><b.icon size={18} color="#fff" /></div>
            <div style={{ flex: 1 }}><div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{b.title}</div><div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{b.sub}</div></div>
            <ExternalLink size={14} color="rgba(255,255,255,0.4)" />
          </a>
        ))}
      </div>

      {/* Source tabs + favs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {SOURCES.map(s => (
          <button key={s.id} onClick={() => { setSource(s.id); setSearched(false); setRecoData(null); setAuthorDetail(null); }}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: source === s.id ? `${s.color}12` : "transparent", color: source === s.id ? s.color : P.textMuted, border: `1.5px solid ${source === s.id ? s.color : P.border}`, transition: "all 0.2s" }}>
            <s.icon size={15} /> {s.label}
          </button>
        ))}
        <button onClick={() => { setShowFavs(!showFavs); setRecoData(null); setAuthorDetail(null); }}
          style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: showFavs ? "#fef3c710" : "transparent", color: showFavs ? "#d97706" : P.textMuted, border: `1.5px solid ${showFavs ? "#d97706" : P.border}` }}>
          <Star size={14} /> Guardados {favorites.length > 0 && `(${favorites.length})`}
        </button>
      </div>

      {/* Scholar sub-modes */}
      {source === "scholar" && (
        <div style={{ display: "flex", gap: 4, marginBottom: 10, background: P.borderLight, borderRadius: 8, padding: 3, width: "fit-content" }}>
          {S2_MODES.map(m => (
            <button key={m.id} onClick={() => { setS2Mode(m.id); setSearched(false); setAuthorDetail(null); }}
              style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: s2Mode === m.id ? P.card : "transparent", color: s2Mode === m.id ? "#2563eb" : P.textMuted, boxShadow: s2Mode === m.id ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}>
              {m.id === "authors" ? <><User size={12} style={{ marginRight: 4, verticalAlign: "-2px" }} />{m.label}</> : m.label}
            </button>
          ))}
        </div>
      )}

      {/* UCALP filters */}
      {source === "ucalp" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <select value={uField} onChange={(e) => setUField(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 13, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontFamily: ff.body }}>
            {UCALP_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select value={uBranch} onChange={(e) => setUBranch(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, fontSize: 13, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontFamily: ff.body }}>
            {UCALP_BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
      )}

      {/* Academic filters (Scholar, OpenAlex, Google Scholar) */}
      {(source === "gscholar" || source === "scholar" || source === "openalex") && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: P.textMuted, fontWeight: 600 }}>Filtros:</span>
          <input type="number" placeholder="Año desde" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} min="1900" max="2026"
            style={{ width: 100, padding: "7px 10px", borderRadius: 8, fontSize: 13, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontFamily: ff.body }} />
          <input type="number" placeholder="Año hasta" value={yearTo} onChange={(e) => setYearTo(e.target.value)} min="1900" max="2026"
            style={{ width: 100, padding: "7px 10px", borderRadius: 8, fontSize: 13, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontFamily: ff.body }} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, fontSize: 13, border: `1px solid ${P.border}`, background: P.card, color: P.text, fontFamily: ff.body }}>
            <option value="relevance">Más relevantes</option>
            <option value="date">Más recientes</option>
          </select>
          {(yearFrom || yearTo || sortBy !== "relevance") && (
            <button onClick={() => { setYearFrom(""); setYearTo(""); setSortBy("relevance"); }}
              style={{ fontSize: 12, color: P.red, fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
              <X size={12} /> Limpiar
            </button>
          )}
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: P.card, border: `1.5px solid ${P.border}`, borderRadius: 12, padding: "0 14px" }}>
          <Search size={18} color={P.textMuted} />
          <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={source === "scholar" && s2Mode === "authors" ? "Buscar autores académicos..." : source === "ucalp" ? "Buscar en catálogo UCALP..." : source === "scholar" ? "Buscar papers (Semantic Scholar)..." : source === "openalex" ? "Buscar en OpenAlex..." : source === "gscholar" ? "Buscar en Google Scholar..." : "Buscar por título, autor, tema..."}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: P.text, padding: "12px 0", fontFamily: ff.body }} />
          {query && <button type="button" onClick={() => { setQuery(""); setSearched(false); inputRef.current?.focus(); }} style={{ color: P.textMuted, display: "flex", padding: 2 }}><X size={16} /></button>}
        </div>
        <Btn primary onClick={handleSearch} disabled={!query.trim() || loading} style={{ padding: "10px 22px", borderRadius: 12 }}>
          {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Buscar
        </Btn>
      </form>

      {/* Recent */}
      {!searched && !showFavs && !recoData && !authorDetail && recent.length > 0 && (
        <div style={{ marginBottom: 20 }} key={rk}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Clock size={14} color={P.textMuted} />
            <span style={{ fontSize: 12, color: P.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Búsquedas recientes</span>
            <button onClick={() => { clearRecent(); setRk(k => k + 1); }} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: P.textMuted, padding: "3px 8px", borderRadius: 6, transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#DC2626"; e.currentTarget.style.background = "#FEF2F2"; }} onMouseLeave={(e) => { e.currentTarget.style.color = P.textMuted; e.currentTarget.style.background = "transparent"; }}>
              <Trash2 size={12} /> Borrar todo
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {recent.map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", borderRadius: 20, background: P.redSoft }}>
                <button onClick={() => { setQuery(t); doSearch(t, source); }} style={{ padding: "6px 4px 6px 14px", color: P.red, fontSize: 13, fontWeight: 500 }}>{t}</button>
                <button onClick={() => { removeRecent(t); setRk(k => k + 1); }} style={{ padding: "4px 10px 4px 4px", color: P.textMuted, display: "flex" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#DC2626"; }} onMouseLeave={(e) => { e.currentTarget.style.color = P.textMuted; }}><X size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested topics */}
      {!searched && !showFavs && !recoData && !authorDetail && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: P.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Temas sugeridos</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {[{ l: "Gobernanza de datos", e: "📊" }, { l: "Protección de datos", e: "🔒" }, { l: "Inteligencia artificial", e: "🤖" }, { l: "Base de datos", e: "🗄️" }, { l: "Estadística", e: "📈" }, { l: "Ética tecnológica", e: "⚖️" }].map((t, i) => (
              <button key={i} onClick={() => { setQuery(t.l); doSearch(t.l, source); }} className="slide-in"
                style={{ animationDelay: `${i * 0.05}s`, padding: "14px 16px", borderRadius: 12, background: P.card, border: `1px solid ${P.border}`, display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 500, color: P.text, transition: "all 0.2s", textAlign: "left" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = P.red; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.border; e.currentTarget.style.transform = "none"; }}>
                <span style={{ fontSize: 20 }}>{t.e}</span> {t.l}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ RECOMMENDATIONS VIEW ═══ */}
      {recoData && (
        <div>
          <button onClick={() => setRecoData(null)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 16 }}>
            <ArrowLeft size={16} /> Volver a resultados
          </button>
          <div style={{ padding: "16px 20px", borderRadius: 12, background: "#EFF6FF", border: "1px solid #BFDBFE", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#1e40af", fontWeight: 700 }}>
              <Sparkles size={16} /> Papers similares a: "{recoData.title}"
            </div>
          </div>
          {recoLoading && <div style={{ textAlign: "center", padding: 40 }}><Loader2 size={28} color="#2563eb" className="spin" /></div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {recoData.papers.map((p, i) => <ScholarCard key={p.id} paper={p} i={i} isFav={isFav} toggleFav={toggleFav} expandedId={expandedId} setExpandedId={setExpandedId} onRecos={loadRecos} />)}
          </div>
          {recoData.papers.length === 0 && !recoLoading && <div style={{ textAlign: "center", padding: 40, color: P.textMuted }}>No se encontraron recomendaciones</div>}
        </div>
      )}

      {/* ═══ AUTHOR DETAIL VIEW ═══ */}
      {authorDetail && (
        <div>
          <button onClick={() => setAuthorDetail(null)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: P.red, fontWeight: 600, marginBottom: 16 }}>
            <ArrowLeft size={16} /> Volver a resultados
          </button>
          <div style={{ background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, padding: 22, marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: P.text, fontFamily: ff.heading, marginBottom: 8 }}>{authorDetail.author?.name}</h2>
            {authorDetail.author?.affiliations?.length > 0 && <div style={{ fontSize: 13, color: P.textSec, marginBottom: 12 }}>{authorDetail.author.affiliations.join(" · ")}</div>}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[{ l: "Papers", v: authorDetail.author?.paperCount }, { l: "Citas", v: authorDetail.author?.citationCount?.toLocaleString() }, { l: "h-index", v: authorDetail.author?.hIndex }].map((s, i) => (
                <div key={i} style={{ padding: "10px 18px", borderRadius: 10, background: P.borderLight, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#2563eb" }}>{s.v ?? "-"}</div>
                  <div style={{ fontSize: 11, color: P.textMuted, fontWeight: 600 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {authorDetail.author?.url && <a href={authorDetail.author.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}><GraduationCap size={14} /> Ver en Semantic Scholar <ExternalLink size={12} /></a>}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: P.text, marginBottom: 12, fontFamily: ff.heading }}>Papers más citados</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(authorDetail.papers || []).map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                style={{ background: P.card, borderRadius: 12, border: `1px solid ${P.border}`, padding: "14px 18px", textDecoration: "none", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 3px 12px rgba(0,0,0,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: P.text, marginBottom: 4 }}>{p.title}</div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: P.textMuted }}>
                  {p.year && <span>{p.year}</span>} {p.venue && <span>· {p.venue}</span>}
                  <span style={{ color: "#16a34a", fontWeight: 700 }}>{p.citationCount} citas</span>
                  {p.openAccessPdf?.url && <span style={{ color: "#059669", fontWeight: 600 }}>PDF gratis</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ═══ FAVORITES ═══ */}
      {showFavs && !recoData && !authorDetail && (
        favorites.length === 0 ? <div style={{ textAlign: "center", padding: "60px 20px", color: P.textMuted }}><Star size={40} strokeWidth={1.2} style={{ marginBottom: 12 }} /><div style={{ fontSize: 15, fontWeight: 600, color: P.textSec }}>No tenés guardados</div></div>
        : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {favorites.map((b, i) => b.id?.startsWith("s2-") ? <ScholarCard key={b.id} paper={b} i={i} isFav={isFav} toggleFav={toggleFav} expandedId={expandedId} setExpandedId={setExpandedId} onRecos={loadRecos} />
              : b.id?.startsWith("oa-") ? <OACard key={b.id} work={b} i={i} isFav={isFav} toggleFav={toggleFav} expandedId={expandedId} setExpandedId={setExpandedId} />
              : b.id?.startsWith("gs-") ? <GSCard key={b.id} result={b} i={i} isFav={isFav} toggleFav={toggleFav} />
              : b.id?.startsWith("ucalp") ? <UcalpCard key={b.id} book={b} i={i} isFav={isFav} toggleFav={toggleFav} />
              : <GBookCard key={b.id} book={b} i={i} expandedId={expandedId} setExpandedId={setExpandedId} isFav={isFav} toggleFav={toggleFav} />)}
          </div>
      )}

      {/* ═══ MAIN RESULTS ═══ */}
      {!showFavs && searched && !recoData && !authorDetail && (
        <div>
          {uError && source === "ucalp" && <div style={{ padding: "16px 20px", borderRadius: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 14, marginBottom: 16 }}>{uError}</div>}

          {/* Author results */}
          {source === "scholar" && s2Mode === "authors" && authorResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {authorResults.map((a, i) => (
                <div key={a.authorId} className="slide-in" style={{ animationDelay: `${i * 0.04}s`, background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, padding: 18, display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "all 0.2s" }}
                  onClick={() => loadAuthorDetail(a.authorId)}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.04)"; e.currentTarget.style.borderColor = "#2563eb"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = P.border; }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><User size={22} color="#2563eb" /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: P.text }}>{a.name}</div>
                    {a.affiliations?.length > 0 && <div style={{ fontSize: 12, color: P.textMuted, marginTop: 2 }}>{a.affiliations.join(", ")}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: P.textMuted }}>
                    <div style={{ textAlign: "center" }}><div style={{ fontWeight: 800, color: "#2563eb", fontSize: 16 }}>{a.paperCount ?? "-"}</div><div>Papers</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontWeight: 800, color: "#2563eb", fontSize: 16 }}>{a.hIndex ?? "-"}</div><div>h-index</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontWeight: 800, color: "#2563eb", fontSize: 16 }}>{a.citationCount?.toLocaleString() ?? "-"}</div><div>Citas</div></div>
                  </div>
                  <ArrowRight size={16} color={P.textMuted} />
                </div>
              ))}
            </div>
          )}

          {/* Paper/book results */}
          {!(source === "scholar" && s2Mode === "authors") && (
            <>
              {!loading && curResults.length > 0 && (
                <div style={{ fontSize: 13, color: P.textMuted, marginBottom: 14 }}>
                  {source === "ucalp" && <>{uResults.length} resultado{uResults.length !== 1 ? "s" : ""}</>}
                  {source === "google" && <>{gTotal.toLocaleString()} resultados</>}
                  {source === "scholar" && <>{sTotal.toLocaleString()} papers</>}
                  {source === "openalex" && <>{oaTotal.toLocaleString()} trabajos académicos</>}
                  {source === "gscholar" && <>{gsTotal.toLocaleString()} resultados de Google Scholar</>}
                  <span style={{ marginLeft: 8 }}>· <a href={elibroUrl(query)} target="_blank" rel="noopener noreferrer" style={{ color: P.red, fontWeight: 600, textDecoration: "none" }}>eLibro →</a></span>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: source === "scholar" || source === "openalex" || source === "gscholar" ? 14 : 10 }}>
                {source === "ucalp" && uResults.map((b, i) => <UcalpCard key={b.id} book={b} i={i} isFav={isFav} toggleFav={toggleFav} />)}
                {source === "google" && gResults.map((b, i) => <GBookCard key={b.id} book={b} i={i} expandedId={expandedId} setExpandedId={setExpandedId} isFav={isFav} toggleFav={toggleFav} />)}
                {source === "scholar" && sResults.map((p, i) => <ScholarCard key={p.id} paper={p} i={i} isFav={isFav} toggleFav={toggleFav} expandedId={expandedId} setExpandedId={setExpandedId} onRecos={loadRecos} />)}
                {source === "openalex" && oaResults.map((w, i) => <OACard key={w.id} work={w} i={i} isFav={isFav} toggleFav={toggleFav} expandedId={expandedId} setExpandedId={setExpandedId} />)}
                {source === "gscholar" && gsResults.map((r, i) => <GSCard key={r.id} result={r} i={i} isFav={isFav} toggleFav={toggleFav} />)}
              </div>
              {!loading && curResults.length > 0 && (
                <>
                  {source === "ucalp" && uMore && <div style={{ textAlign: "center", marginTop: 20 }}><Btn onClick={() => searchU(query, uPage + 1)} style={{ margin: "0 auto", padding: "10px 28px", borderRadius: 12 }}><ArrowRight size={16} /> Más</Btn></div>}
                  {source === "google" && gResults.length < gTotal && <div style={{ textAlign: "center", marginTop: 20 }}><Btn onClick={() => searchG(query, gStart + 12)} style={{ margin: "0 auto", padding: "10px 28px", borderRadius: 12 }}><ArrowRight size={16} /> Más</Btn></div>}
                  {source === "scholar" && sResults.length < sTotal && <div style={{ textAlign: "center", marginTop: 20 }}><Btn onClick={() => searchS(query, sOffset + 10)} style={{ margin: "0 auto", padding: "10px 28px", borderRadius: 12 }}><ArrowRight size={16} /> Más</Btn></div>}
                  {source === "openalex" && oaResults.length < oaTotal && <div style={{ textAlign: "center", marginTop: 20 }}><Btn onClick={() => searchOa(query, oaPage + 1)} style={{ margin: "0 auto", padding: "10px 28px", borderRadius: 12 }}><ArrowRight size={16} /> Más</Btn></div>}
                  {source === "gscholar" && gsMore && <div style={{ textAlign: "center", marginTop: 20 }}><Btn onClick={() => searchGs(query, gsStart + 10)} style={{ margin: "0 auto", padding: "10px 28px", borderRadius: 12 }}><ArrowRight size={16} /> Más</Btn></div>}
                </>
              )}
              {!loading && curResults.length === 0 && !(uError && source === "ucalp") && !(source === "scholar" && s2Mode === "authors") && (
                <div style={{ textAlign: "center", padding: "50px 20px", color: P.textMuted }}>
                  <Search size={40} strokeWidth={1.2} style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 15, fontWeight: 600, color: P.textSec, marginBottom: 8 }}>No se encontraron resultados</div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
                    <a href={elibroUrl(query)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: P.red, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}><BookMarked size={15} /> eLibro</a>
                    <a href={gscholarUrl(query)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}><GraduationCap size={15} /> Google Scholar</a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && curResults.length === 0 && authorResults.length === 0 && (
        <div style={{ textAlign: "center", padding: "50px 20px" }}>
          <Loader2 size={32} color={P.red} className="spin" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: P.textMuted }}>Buscando...</div>
        </div>
      )}
      {authorLoading && <div style={{ textAlign: "center", padding: "50px 20px" }}><Loader2 size={32} color="#2563eb" className="spin" /><div style={{ fontSize: 14, color: P.textMuted, marginTop: 12 }}>Cargando perfil del autor...</div></div>}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}`}</style>
    </div>
  );
}


// ═══ Scholar Card ════════════════════════════════════════════════
function ScholarCard({ paper, i, isFav, toggleFav, expandedId, setExpandedId, onRecos }) {
  const isExp = expandedId === paper.id;
  const desc = paper.tldr || paper.abstract || "";
  return (
    <div className="slide-in" style={{ animationDelay: `${i * 0.04}s`, background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, transition: "all 0.2s" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, lineHeight: 1.4, fontFamily: ff.heading }}>{paper.title}</h3>
          <button onClick={() => toggleFav(paper)} style={{ color: isFav(paper.id) ? "#f59e0b" : P.textMuted, padding: 4, flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
            {isFav(paper.id) ? <Star size={18} fill="#f59e0b" /> : <StarOff size={18} />}
          </button>
        </div>
        {paper.authors?.length > 0 && <div style={{ fontSize: 13, color: P.textSec, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}><Users size={13} /><span>{paper.authors.slice(0, 4).map(a => a.name || a).join(", ")}{paper.authors.length > 4 ? ` +${paper.authors.length - 4}` : ""}</span></div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {paper.year && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: P.borderLight, color: P.textSec }}>{paper.year}</span>}
          {paper.venue && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "#EFF6FF", color: "#2563eb" }}>{paper.venue}</span>}
          <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: paper.citationCount > 0 ? "#F0FDF4" : P.borderLight, color: paper.citationCount > 0 ? "#16a34a" : P.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
            <Quote size={10} /> {paper.citationCount.toLocaleString()} cita{paper.citationCount !== 1 ? "s" : ""}
          </span>
          {paper.influentialCitations > 0 && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#FEF3C7", color: "#d97706" }}>⭐ {paper.influentialCitations} influyentes</span>}
          {paper.openAccessPdf && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#ECFDF5", color: "#059669" }}>Acceso abierto</span>}
        </div>
        {desc && (
          <div style={{ marginBottom: 10 }}>
            {paper.tldr && <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>TLDR — Resumen IA</div>}
            <p style={{ fontSize: 13, color: P.textSec, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: isExp ? "unset" : 3, WebkitBoxOrient: "vertical", overflow: isExp ? "visible" : "hidden" }}>{desc}</p>
            {desc.length > 200 && <button onClick={() => setExpandedId(isExp ? null : paper.id)} style={{ fontSize: 12, color: P.red, fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>{isExp ? <><ChevronUp size={14} /> Ver menos</> : <><ChevronDown size={14} /> Ver más</>}</button>}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <a href={paper.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#3b82f6"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#2563eb"; }}><GraduationCap size={13} /> Semantic Scholar</a>
          {paper.openAccessPdf && <a href={paper.openAccessPdf} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#059669", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#10b981"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#059669"; }}><FileText size={13} /> PDF gratis</a>}
          <a href={elibroUrl(paper.title)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: P.red, color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.redLight; }} onMouseLeave={(e) => { e.currentTarget.style.background = P.red; }}><BookMarked size={13} /> eLibro</a>
          <a href={gscholarUrl(paper.title)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: P.borderLight, color: P.textSec, fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.border; }} onMouseLeave={(e) => { e.currentTarget.style.background = P.borderLight; }}><Globe size={13} /> Google Scholar</a>
          {onRecos && paper.paperId && <button onClick={() => onRecos(paper.paperId, paper.title)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#FEF3C7", color: "#92400e", fontSize: 12, fontWeight: 600, transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#FDE68A"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#FEF3C7"; }}><Sparkles size={13} /> Similares</button>}
          {paper.doi && <span style={{ fontSize: 11, color: P.textMuted, alignSelf: "center" }}>DOI: {paper.doi}</span>}
        </div>
      </div>
    </div>
  );
}

// ═══ UCALP Card ═════════════════════════════════════════════════
function UcalpCard({ book, i, isFav, toggleFav }) {
  return (
    <div className="slide-in" style={{ animationDelay: `${i * 0.04}s`, background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, transition: "all 0.2s" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ display: "flex", gap: 16, padding: 18 }}>
        <div style={{ width: 56, height: 72, borderRadius: 8, flexShrink: 0, background: `linear-gradient(135deg,${P.redSoft},${P.borderLight})`, display: "flex", alignItems: "center", justifyContent: "center" }}><BookOpen size={24} color={P.red} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, lineHeight: 1.35, fontFamily: ff.heading }}>{book.title}</h3>
            <button onClick={() => toggleFav(book)} style={{ color: isFav(book.id) ? "#f59e0b" : P.textMuted, padding: 4, flexShrink: 0 }}>{isFav(book.id) ? <Star size={18} fill="#f59e0b" /> : <StarOff size={18} />}</button>
          </div>
          <div style={{ fontSize: 13, color: P.textSec, marginTop: 6 }}>{book.author && <span style={{ fontWeight: 500 }}>{book.author}</span>}{book.publicationData && <span style={{ color: P.textMuted }}> · {book.publicationData}</span>}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {book.signature && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: P.borderLight, color: P.textSec }}><Hash size={11} style={{ display: "inline", verticalAlign: "-2px" }} /> {book.signature}</span>}
            <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: book.availableCopies > 0 ? "#ECFDF5" : "#FEF2F2", color: book.availableCopies > 0 ? "#059669" : "#DC2626" }}>{book.availableCopies > 0 ? `${book.availableCopies} ej. disponible` : "No disponible"}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <a href={elibroUrl(book.title)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: P.red, color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}><BookMarked size={13} /> eLibro</a>
            <a href={gscholarUrl(book.title)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}><GraduationCap size={13} /> Scholar</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ Google Books Card ══════════════════════════════════════════
function GBookCard({ book, i, expandedId, setExpandedId, isFav, toggleFav }) {
  const isExp = expandedId === book.id;
  return (
    <div className="slide-in" style={{ animationDelay: `${i * 0.04}s`, background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, transition: "all 0.2s" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ display: "flex", gap: 16, padding: 18 }}>
        <div style={{ width: 80, minHeight: 110, borderRadius: 8, flexShrink: 0, overflow: "hidden", background: book.thumbnail ? "transparent" : `linear-gradient(135deg,${P.redSoft},${P.borderLight})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {book.thumbnail ? <img src={book.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} /> : <BookOpen size={28} color={P.textMuted} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div><h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, lineHeight: 1.35, fontFamily: ff.heading }}>{book.title}</h3>{book.subtitle && <div style={{ fontSize: 13, color: P.textSec }}>{book.subtitle}</div>}</div>
            <button onClick={() => toggleFav(book)} style={{ color: isFav(book.id) ? "#f59e0b" : P.textMuted, padding: 4, flexShrink: 0 }}>{isFav(book.id) ? <Star size={18} fill="#f59e0b" /> : <StarOff size={18} />}</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 6, fontSize: 12, color: P.textMuted }}>
            {book.authors?.length > 0 && <span>{book.authors.join(", ")}</span>}{book.publisher && <span>· {book.publisher}</span>}{book.publishedDate && <span>· {book.publishedDate.substring(0, 4)}</span>}
          </div>
          {book.categories?.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>{book.categories.slice(0, 3).map((c, ci) => <span key={ci} style={{ padding: "2px 10px", borderRadius: 12, background: P.redSoft, color: P.red, fontSize: 11, fontWeight: 600 }}>{c}</span>)}</div>}
          {book.description && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 13, color: P.textSec, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: isExp ? "unset" : 2, WebkitBoxOrient: "vertical", overflow: isExp ? "visible" : "hidden" }}>{book.description}</p>
              {book.description.length > 150 && <button onClick={() => setExpandedId(isExp ? null : book.id)} style={{ fontSize: 12, color: P.red, fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>{isExp ? <><ChevronUp size={14} /> Menos</> : <><ChevronDown size={14} /> Más</>}</button>}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <a href={elibroUrl(book.title)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: P.red, color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}><BookMarked size={13} /> eLibro</a>
            <a href={gscholarUrl(book.title)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}><GraduationCap size={13} /> Scholar</a>
            {book.previewLink && <a href={book.previewLink} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: P.borderLight, color: P.textSec, fontSize: 12, fontWeight: 600, textDecoration: "none" }}><ExternalLink size={13} /> Vista previa</a>}
            {book.isbn && <span style={{ fontSize: 11, color: P.textMuted, alignSelf: "center" }}>ISBN: {book.isbn}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ OpenAlex Card ══════════════════════════════════════════════
function OACard({ work, i, isFav, toggleFav, expandedId, setExpandedId }) {
  const isExp = expandedId === work.id;
  const typeLabel = { article: "Artículo", "book-chapter": "Capítulo", book: "Libro", dissertation: "Tesis", dataset: "Dataset", preprint: "Preprint" };
  return (
    <div className="slide-in" style={{ animationDelay: `${i * 0.04}s`, background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, transition: "all 0.2s" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, lineHeight: 1.4, fontFamily: ff.heading }}>{work.title}</h3>
          <button onClick={() => toggleFav(work)} style={{ color: isFav(work.id) ? "#f59e0b" : P.textMuted, padding: 4, flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
            {isFav(work.id) ? <Star size={18} fill="#f59e0b" /> : <StarOff size={18} />}
          </button>
        </div>
        {work.authors?.length > 0 && (
          <div style={{ fontSize: 13, color: P.textSec, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <Users size={13} style={{ flexShrink: 0 }} />
            <span>{work.authors.slice(0, 4).map(a => a.name).join(", ")}{work.authors.length > 4 ? ` +${work.authors.length - 4}` : ""}</span>
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {work.year && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: P.borderLight, color: P.textSec }}>{work.year}</span>}
          {work.source && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "#FFF7ED", color: "#e16b31" }}>{work.source}</span>}
          <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: work.citedByCount > 0 ? "#F0FDF4" : P.borderLight, color: work.citedByCount > 0 ? "#16a34a" : P.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
            <Quote size={10} /> {work.citedByCount.toLocaleString()} cita{work.citedByCount !== 1 ? "s" : ""}
          </span>
          {work.isOa && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#ECFDF5", color: "#059669" }}>Acceso abierto</span>}
          {work.type && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "#FFF7ED", color: "#c2410c" }}>{typeLabel[work.type] || work.type}</span>}
          {work.language && work.language !== "en" && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: P.borderLight, color: P.textMuted }}>{work.language.toUpperCase()}</span>}
        </div>
        {work.topics?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {work.topics.map((t, ti) => <span key={ti} style={{ padding: "2px 10px", borderRadius: 12, background: "#FFF7ED", color: "#9a3412", fontSize: 10, fontWeight: 600 }}>{t}</span>)}
          </div>
        )}
        {work.abstract && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 13, color: P.textSec, lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: isExp ? "unset" : 3, WebkitBoxOrient: "vertical", overflow: isExp ? "visible" : "hidden" }}>{work.abstract}</p>
            {work.abstract.length > 200 && <button onClick={() => setExpandedId(isExp ? null : work.id)} style={{ fontSize: 12, color: P.red, fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>{isExp ? <><ChevronUp size={14} /> Ver menos</> : <><ChevronDown size={14} /> Ver más</>}</button>}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {work.oaUrl && <a href={work.oaUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#059669", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#10b981"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#059669"; }}><FileText size={13} /> Acceso libre</a>}
          {work.doi && <a href={work.doi} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#e16b31", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#ea580c"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#e16b31"; }}><ExternalLink size={13} /> DOI</a>}
          <a href={elibroUrl(work.title)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: P.red, color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.redLight; }} onMouseLeave={(e) => { e.currentTarget.style.background = P.red; }}><BookMarked size={13} /> eLibro</a>
          <a href={gscholarUrl(work.title)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: P.borderLight, color: P.textSec, fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.border; }} onMouseLeave={(e) => { e.currentTarget.style.background = P.borderLight; }}><Globe size={13} /> Google Scholar</a>
        </div>
      </div>
    </div>
  );
}

// ═══ Google Scholar Card (SerpApi) ══════════════════════════════
function GSCard({ result: r, i, isFav, toggleFav }) {
  return (
    <div className="slide-in" style={{ animationDelay: `${i * 0.04}s`, background: P.card, borderRadius: 14, border: `1px solid ${P.border}`, transition: "all 0.2s" }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, fontWeight: 700, color: P.text, lineHeight: 1.4, fontFamily: ff.heading, textDecoration: "none" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#4d90fe"; }} onMouseLeave={(e) => { e.currentTarget.style.color = P.text; }}>
            {r.title}
          </a>
          <button onClick={() => toggleFav(r)} style={{ color: isFav(r.id) ? "#f59e0b" : P.textMuted, padding: 4, flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}>
            {isFav(r.id) ? <Star size={18} fill="#f59e0b" /> : <StarOff size={18} />}
          </button>
        </div>
        {r.publishedInfo && <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 6 }}>{r.publishedInfo}</div>}
        {r.snippet && <p style={{ fontSize: 13, color: P.textSec, lineHeight: 1.55, marginBottom: 10 }}>{r.snippet}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {r.citedBy > 0 && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#F0FDF4", color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}><Quote size={10} /> {r.citedBy.toLocaleString()} citas</span>}
          {r.pdfLink && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#ECFDF5", color: "#059669" }}>PDF disponible</span>}
          {r.type && <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "#EFF6FF", color: "#4d90fe" }}>{r.type}</span>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <a href={r.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#4d90fe", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#357ae8"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#4d90fe"; }}><ExternalLink size={13} /> Ver paper</a>
          {r.pdfLink && <a href={r.pdfLink} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "#059669", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#10b981"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#059669"; }}><FileText size={13} /> PDF</a>}
          {r.citedByLink && <a href={r.citedByLink} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: P.borderLight, color: P.textSec, fontSize: 12, fontWeight: 600, textDecoration: "none" }}><Quote size={13} /> Citado por</a>}
          <a href={elibroUrl(r.title)} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: P.red, color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = P.redLight; }} onMouseLeave={(e) => { e.currentTarget.style.background = P.red; }}><BookMarked size={13} /> eLibro</a>
        </div>
      </div>
    </div>
  );
}
