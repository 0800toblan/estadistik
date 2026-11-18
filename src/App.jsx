import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Home, Plus, ListChecks, Users, BarChart3, ChevronLeft, Check,
  Pencil, Trash2, X, MapPin, Calendar, Trophy, Minus, Download, Unlock,
  CloudOff, Shield, LogIn, LogOut, Loader2, ArrowUpDown, Repeat, Menu as MenuIcon,
  RotateCcw, AlertTriangle
} from "lucide-react";
import { loadDb, saveDiff } from "./lib/syncDb";

// ============================================================
// CONFIGURACIÓN DE ESTADÍSTICAS (100% compatible con syncDb.js)
// ============================================================
const STAT_FIELDS = [
  { key: "puntos", label: "Puntos", short: "Pts" },
  { key: "asistencias", label: "Asistencias", short: "Asist." },
  { key: "rebotes", label: "Rebotes", short: "Reb." },
  { key: "tiros", label: "Tiros", short: "Tiros" },
  { key: "robos", label: "Robos", short: "Robos" },
  { key: "perdidas", label: "Pérdidas", short: "Pérd." },
];

const EN_CANCHA = 8;
const POR_ZONA = 4;
const POR_SEXO = 2;
const MAX_CAMBIOS = 8;
const SEXO = {
  varon: { sim: "♂", color: "#38BDF8", nombre: "Varón" },
  mujer: { sim: "♀", color: "#F472B6", nombre: "Mujer" },
};

const elegirZona = (enCancha, sexo) => {
  const cuenta = (z, sx) => enCancha.filter((x) => x.zona === z && (!sx || x.sexo === sx)).length;
  const hayLugar = (z) => cuenta(z) < POR_ZONA && (!sexo || cuenta(z, sexo) < POR_SEXO);
  if (hayLugar("ataque")) return "ataque";
  if (hayLugar("defensa")) return "defensa";
  return cuenta("ataque") <= cuenta("defensa") ? "ataque" : "defensa";
};

const EXTRA_FIELDS = ["free_pass", "penales", "amarillas", "rojas"];

const TEAM_SEED = [
  "La Patriada A", "La Patriada B", "Escorpiones",
  "Fosforitos", "Uruguay Korf", "CEF 102",
];

const SAVE_DELAY = 900;

const esErrorDePermiso = (e) =>
  e?.status === 401 ||
  e?.status === 403 ||
  e?.code === "42501" ||
  /jwt|row-level security|permission denied/i.test(e?.message || "");

const explicarError = (e) => {
  if (esErrorDePermiso(e)) return "Tu sesión venció o no tenés permiso. Volvé a ingresar como organizador y se guardan los cambios pendientes.";
  if (/failed to fetch|network|load failed/i.test(e?.message || "")) return "Sin conexión. Se reintenta solo cuando vuelva internet.";
  return `Error de la base de datos: ${e?.message || "desconocido"}.`;
};

// Tokens de paleta 60-30-10 (Estilo Suizo Oscuro + Flúor)
const INK = "#0B0C0E";
const SURFACE = "#111317";
const ELEVATED = "#16191F";
const LINE = "#24272E";
const CLUB = "#1E40AF";
const FLUOR = "#CCFF00";
const GOLD = "#E3A63E";
const TEXT = "#F4F4F6";
const MUTED = "#8E939E";
const FAINT = "#5C6270";
const RED = "#FF4D4D";

const COLOR_A = { ring: "#2DD4BF", bg: "#0D2927", text: "#5EEAD4", bar: "#14B8A6" };
const COLOR_B = { ring: "#F97316", bg: "#2E170B", text: "#FDBA74", bar: "#EA580C" };

const cardStyle = { borderRadius: 0, border: `1px solid ${LINE}`, background: SURFACE };
const inputStyle = {
  width: "100%",
  borderRadius: 0,
  border: `1px solid ${LINE}`,
  background: INK,
  color: TEXT,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "'JetBrains Mono', monospace",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: MUTED,
};
const btnPrimary = {
  borderRadius: 0,
  padding: "10px 16px",
  fontWeight: 800,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: INK,
  background: FLUOR,
  border: "none",
  cursor: "pointer",
};
const btnGhost = {
  borderRadius: 0,
  padding: "8px 16px",
  fontWeight: 600,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 12,
  textTransform: "uppercase",
  color: TEXT,
  background: ELEVATED,
  border: `1px solid ${LINE}`,
  cursor: "pointer",
};
const btnDanger = {
  borderRadius: 0,
  padding: "8px 16px",
  fontWeight: 800,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 12,
  textTransform: "uppercase",
  color: "white",
  background: "#B91C1C",
  border: "none",
  cursor: "pointer",
};

const uid = () => crypto.randomUUID();

const emptyStat = (partidoId, jugadorId) => {
  const s = { id: uid("s"), partido_id: partidoId, jugador_id: jugadorId, dorsal: null, en_cancha: false, zona: null };
  STAT_FIELDS.forEach((f) => { s[f.key] = 0; });
  EXTRA_FIELDS.forEach((k) => { s[k] = 0; });
  return s;
};

const readStat = (s) => {
  if (!s) {
    const e = { en_cancha: false, zona: null };
    STAT_FIELDS.forEach((f) => { e[f.key] = 0; });
    EXTRA_FIELDS.forEach((k) => { e[k] = 0; });
    return e;
  }
  const out = { ...s, en_cancha: !!s.en_cancha, zona: s.zona ?? null };
  STAT_FIELDS.forEach((f) => { if (typeof out[f.key] !== "number") out[f.key] = 0; });
  EXTRA_FIELDS.forEach((k) => { if (typeof out[k] !== "number") out[k] = 0; });
  if (typeof s.tiros !== "number") out.tiros = s.puntos || 0;
  return out;
};

const estaExpulsado = (s) => (s?.rojas || 0) > 0 || (s?.amarillas || 0) >= 2;
const efectividad = (puntos, tiros) => (tiros > 0 ? (puntos / tiros) * 100 : 0);

const seedDb = () => {
  const ligaId = uid("l");
  return {
    leagues: [{ id: ligaId, nombre: "Liga Bonaerense de Korfball" }],
    teams: TEAM_SEED.map((nombre) => ({ id: uid("t"), nombre, liga_id: ligaId })),
    players: [],
    matches: [],
    stats: [],
  };
};

const migrate = (db) => {
  if (!db) return seedDb();
  const next = { leagues: [], teams: [], players: [], matches: [], stats: [], ...db };
  if (!next.leagues || next.leagues.length === 0) {
    const ligaId = uid("l");
    next.leagues = [{ id: ligaId, nombre: "Liga Bonaerense de Korfball" }];
    next.teams = (next.teams || []).map((t) => ({ ...t, liga_id: t.liga_id || ligaId }));
  }
  const fallback = next.leagues[0].id;
  next.teams = next.teams.map((t) => ({ ...t, liga_id: t.liga_id || fallback }));
  next.matches = next.matches.map((m) => ({
    ...m,
    liga_id: m.liga_id || next.teams.find((t) => t.id === m.equipo_a_id)?.liga_id || fallback,
  }));
  return next;
};

// ---------- root ----------

export default function App({ canEdit = false, userEmail = null, onLogin, onLogout }) {
  const [db, setDb] = useState(null);
  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState({ name: "home" });
  const [toast, setToast] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [saveError, setSaveError] = useState("");
  const [ligaId, setLigaId] = useState(null);

  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const savingRef = useRef(false);
  const syncedRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let raw = null;
      try { raw = await loadDb(); } catch (e) { console.error(e); setLoadError(e?.message || String(e)); }
      if (cancelled) return;
      if (!raw) { setStatus("error"); return; }
      syncedRef.current = raw;
      const migrated = migrate(raw);
      setDb(migrated);
      setLigaId(migrated.leagues[0].id);
      setStatus("ready");
    })();
    return () => { cancelled = true; };
  }, []);

  const flush = useCallback(async () => {
    if (savingRef.current) return;
    const data = pendingRef.current;
    if (data === null) return;
    savingRef.current = true;
    pendingRef.current = null;
    let ok = false, lastErr = null;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        await saveDiff(syncedRef.current, data);
        syncedRef.current = data;
        ok = true;
      } catch (e) {
        lastErr = e;
        console.error("Error al guardar:", e);
        if (esErrorDePermiso(e)) break;
      }
      if (!ok) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
    savingRef.current = false;
    if (!ok) {
      if (pendingRef.current === null) pendingRef.current = data;
      setSaveError(explicarError(lastErr));
      setSaveState("error");
      if (!esErrorDePermiso(lastErr)) timerRef.current = setTimeout(flush, 4000);
      return;
    }
    setSaveError("");
    if (pendingRef.current !== null) {
      timerRef.current = setTimeout(flush, SAVE_DELAY);
      setSaveState("pending");
    } else {
      setSaveState("saved");
      setTimeout(() => setSaveState((st) => (st === "saved" ? "idle" : st)), 2500);
    }
  }, []);

  useEffect(() => {
    const guardarYa = () => {
      if (pendingRef.current === null) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      flush();
    };
    const alOcultar = () => { if (document.visibilityState === "hidden") guardarYa(); };
    const alCerrar = (e) => {
      if (pendingRef.current !== null || savingRef.current) { guardarYa(); e.preventDefault(); e.returnValue = ""; }
    };
    document.addEventListener("visibilitychange", alOcultar);
    window.addEventListener("pagehide", guardarYa);
    window.addEventListener("beforeunload", alCerrar);
    return () => {
      document.removeEventListener("visibilitychange", alOcultar);
      window.removeEventListener("pagehide", guardarYa);
      window.removeEventListener("beforeunload", alCerrar);
    };
  }, [flush]);

  useEffect(() => {
    if (canEdit && pendingRef.current !== null && !savingRef.current) flush();
  }, [canEdit, flush]);

  const commit = useCallback((updater) => {
    if (!canEdit) { setToast("Ingresá como organizador para editar."); return; }
    setDb((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      pendingRef.current = next;
      setSaveState("pending");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, SAVE_DELAY);
      return next;
    });
  }, [flush, canEdit]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (status === "error") {
    return (
      <div style={{ background: INK, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ maxWidth: 480, border: `1px solid ${LINE}`, background: SURFACE, padding: 28 }}>
          <p className="font-mono-tech" style={{ fontSize: 11, color: RED, letterSpacing: "0.12em" }}>SYS.ERROR // CONNECTION_FAILED</p>
          <p style={{ marginTop: 8, fontSize: 15, color: TEXT }}>No se pudieron cargar los datos de Supabase. Revisá tu conexión y recargá la página.</p>
          {loadError && <p className="font-mono-tech" style={{ marginTop: 12, fontSize: 12, color: RED, wordBreak: "break-word" }}>{loadError}</p>}
        </div>
      </div>
    );
  }

  if (status === "loading" || !db) {
    return (
      <div style={{ background: INK, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <div className="animate-spin" style={{ margin: "0 auto 16px", height: 36, width: 36, borderRadius: 9999, border: `2px solid ${FLUOR}`, borderTopColor: "transparent" }} />
          <p className="font-mono-tech" style={{ fontSize: 12, letterSpacing: "0.14em", color: MUTED }}>SYNCING SUPABASE_DB...</p>
        </div>
      </div>
    );
  }

  const liga = db.leagues.find((l) => l.id === ligaId) || db.leagues[0];
  const ctx = { db, commit, setView, setToast, liga, ligaId: liga.id, canEdit };

  return (
    <div style={{ background: INK, minHeight: "100dvh", color: TEXT }}>
      <TopNav view={view} setView={setView} saveState={saveState} db={db} liga={liga} setLigaId={setLigaId} canEdit={canEdit} userEmail={userEmail} onLogin={onLogin} onLogout={onLogout} />
      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "20px 16px 72px" }}>
        {view.name === "home" && <HomeView {...ctx} />}
        {view.name === "new" && <NewMatchView {...ctx} />}
        {view.name === "matches" && <MatchesView {...ctx} />}
        {view.name === "match" && <MatchView {...ctx} matchId={view.matchId} />}
        {view.name === "teams" && <TeamsView {...ctx} teamId={view.teamId} />}
        {view.name === "stats" && <StatsView {...ctx} />}
        {view.name === "leagues" && <LeaguesView {...ctx} setLigaId={setLigaId} />}
      </main>

      {saveState === "error" && (
        <div role="alert" style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 55, maxWidth: 560, margin: "0 auto", border: `1px solid ${RED}`, background: "#1F0D0D", color: "white", padding: "14px 16px" }}>
          <p className="font-mono-tech" style={{ fontSize: 12, fontWeight: 800, color: RED }}>SYNC_ERROR // CAMBIOS PENDIENTES</p>
          <p style={{ marginTop: 4, fontSize: 13, color: "#E5E7EB" }}>{saveError}</p>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={() => { if (timerRef.current) clearTimeout(timerRef.current); flush(); }} style={{ ...btnPrimary, padding: "8px 14px" }}>Reintentar ahora</button>
            <button type="button" onClick={() => { if (window.confirm("Se van a perder los cambios que no se guardaron. ¿Recargar igual?")) { pendingRef.current = null; window.location.reload(); } }} style={btnGhost}>Descartar y recargar</button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 16, display: "flex", justifyContent: "center", padding: "0 16px", zIndex: 50 }}>
          <div className="font-mono-tech" style={{ border: `1px solid ${FLUOR}`, background: INK, padding: "10px 16px", fontSize: 12, color: FLUOR }}>
            [SYS] {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- nav ----------

function TopNav({ view, setView, saveState, db, liga, setLigaId, canEdit, userEmail, onLogin, onLogout }) {
  const items = [
    { name: "home", label: "Inicio", icon: Home },
    { name: "new", label: "Nuevo", icon: Plus },
    { name: "matches", label: "Partidos", icon: ListChecks },
    { name: "teams", label: "Equipos", icon: Users },
    { name: "stats", label: "Estadísticas", icon: BarChart3 },
    { name: "leagues", label: "Ligas", icon: Shield },
  ];
  const visible = items.filter((it) => canEdit || it.name !== "new");
  const titles = { home: "INICIO", new: "NUEVO PARTIDO", matches: "PARTIDOS", match: "EN VIVO", teams: "EQUIPOS", stats: "ESTADÍSTICAS", leagues: "LIGAS" };
  const pageTitle = titles[view.name] || "ESTADISTIK";

  const st = saveState === "error" ? "error" : saveState === "saved" ? "saved" : saveState === "pending" ? "pending" : "idle";
  const authIcon = (size) => {
    if (!canEdit) return <LogIn size={size} />;
    if (st === "pending") return <Loader2 size={size} className="animate-spin" />;
    if (st === "saved") return <Check size={size} />;
    if (st === "error") return <CloudOff size={size} />;
    return <LogOut size={size} />;
  };
  const authLabel = !canEdit ? "ORGANIZADORES" : st === "pending" ? "GUARDANDO..." : st === "saved" ? "SYNC_OK" : st === "error" ? "ERR_SYNC" : "SALIR";
  const authColor = st === "error" ? RED : st === "saved" ? FLUOR : canEdit ? FLUOR : MUTED;
  const authClick = canEdit ? () => {
    if (st === "pending") return;
    if (st === "error" && !window.confirm("Hay cambios sin guardar. Si salís ahora se pierden. ¿Salir igual?")) return;
    onLogout();
  } : onLogin;

  const [menuOpen, setMenuOpen] = useState(false);
  const touchY = useRef(0);
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [menuOpen]);

  const go = (name) => { setView({ name }); setMenuOpen(false); };
  const menuAuthClick = () => { setMenuOpen(false); authClick(); };
  const iconBtn = { display: "flex", alignItems: "center", justifyContent: "center", height: 44, width: 44, flexShrink: 0, background: "transparent", border: "none", color: TEXT, cursor: "pointer" };

  return (
    <>
      <header className="topbar-desktop" style={{ background: SURFACE, borderBottom: `1px solid ${LINE}`, position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" }}>
          <button type="button" onClick={() => setView({ name: "home" })} aria-label="Ir al inicio" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
            <span className="font-mono-tech" style={{ display: "flex", height: 32, padding: "0 8px", alignItems: "center", justifyContent: "center", background: FLUOR, color: INK, fontWeight: 900, fontSize: 12 }}>EST</span>
          </button>
          <select value={liga.id} onChange={(e) => { setLigaId(e.target.value); setView({ name: "home" }); }}
            className="font-mono-tech"
            style={{ flexShrink: 0, border: `1px solid ${LINE}`, background: INK, color: TEXT, padding: "7px 10px", fontSize: 12, fontWeight: 600, maxWidth: 220, cursor: "pointer" }}>
            {db.leagues.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
          <nav style={{ display: "flex", gap: 2, flex: 1 }}>
            {visible.map((it) => {
              const active = view.name === it.name || (it.name === "matches" && view.name === "match");
              const Icon = it.icon;
              return (
                <button type="button" key={it.name} onClick={() => setView({ name: it.name })}
                  className="font-mono-tech"
                  style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "8px 12px", fontSize: 12, fontWeight: active ? 800 : 500, textTransform: "uppercase", border: "none", cursor: "pointer", background: active ? FLUOR : "transparent", color: active ? INK : MUTED }}>
                  <Icon size={14} strokeWidth={2.3} /><span>{it.label}</span>
                </button>
              );
            })}
          </nav>
          <button type="button" onClick={authClick} disabled={st === "pending"} aria-busy={st === "pending"} title={canEdit && st === "idle" ? userEmail : undefined}
            className="font-mono-tech"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexShrink: 0, minWidth: 140, padding: "8px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", border: `1px solid ${canEdit ? FLUOR : LINE}`, background: INK, color: authColor, cursor: st === "pending" ? "default" : "pointer" }}>
            {authIcon(14)}<span>{authLabel}</span>
          </button>
        </div>
      </header>

      <header className="topbar-mobile" style={{ background: SURFACE, borderBottom: `1px solid ${LINE}`, position: "sticky", top: 0, zIndex: 40, paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: 4, padding: "4px 8px", minHeight: 52 }}>
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <button type="button" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} style={iconBtn}><MenuIcon size={24} /></button>
            <span className="font-display" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15, fontWeight: 900, letterSpacing: "-0.02em", color: FLUOR }}>ESTADISTIK</span>
          </div>
          <span className="font-mono-tech" style={{ whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: TEXT, textAlign: "center" }}>{pageTitle}</span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, minWidth: 0 }}>
            <button type="button" aria-label={authLabel} aria-busy={st === "pending"} onClick={authClick} disabled={st === "pending"} style={{ ...iconBtn, color: authColor }}>
              {authIcon(19)}
            </button>
          </div>
        </div>
      </header>

      <div className={`menu-sheet${menuOpen ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Menú principal" aria-hidden={!menuOpen}
        style={{ background: INK }}
        onTouchStart={(e) => { touchY.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => { if (e.changedTouches[0].clientY - touchY.current > 90) setMenuOpen(false); }}>
        <div className="menu-panel" style={{ display: "flex", flexDirection: "column", padding: "calc(8px + env(safe-area-inset-top, 0px)) 20px calc(20px + env(safe-area-inset-bottom, 0px))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${LINE}`, paddingBottom: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="font-mono-tech" style={{ display: "flex", height: 32, padding: "0 8px", alignItems: "center", justifyContent: "center", background: FLUOR, color: INK, fontWeight: 900, fontSize: 12 }}>EST</span>
              <span className="font-display" style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em", color: TEXT }}>ESTADISTIK</span>
            </span>
            <button type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} style={iconBtn}><X size={26} /></button>
          </div>

          <div style={{ flex: 1 }} />

          <label htmlFor="menu-liga" className="font-mono-tech" style={{ marginBottom: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED }}>LIGA_ACTIVA</label>
          <select id="menu-liga" className="menu-select font-mono-tech" value={liga.id} onChange={(e) => { setLigaId(e.target.value); go("home"); }}
            style={{ width: "100%", minHeight: 48, border: `1px solid ${LINE}`, background: SURFACE, color: TEXT, padding: "0 14px", fontWeight: 600 }}>
            {db.leagues.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>

          <nav style={{ display: "flex", flexDirection: "column", gap: 1, background: LINE, border: `1px solid ${LINE}`, marginTop: 16 }}>
            {visible.map((it) => {
              const active = view.name === it.name || (it.name === "matches" && view.name === "match");
              const Icon = it.icon;
              return (
                <button type="button" key={it.name} onClick={() => go(it.name)} aria-current={active ? "page" : undefined}
                  className="font-mono-tech"
                  style={{ display: "flex", alignItems: "center", gap: 16, minHeight: 56, padding: "0 18px", border: "none", textAlign: "left", fontSize: 15, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", background: active ? FLUOR : SURFACE, color: active ? INK : TEXT }}>
                  <Icon size={20} strokeWidth={2.2} /><span>{it.label}</span>
                </button>
              );
            })}
          </nav>

          <button type="button" onClick={menuAuthClick}
            className="font-mono-tech"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 50, marginTop: 16, border: `1px solid ${canEdit ? FLUOR : LINE}`, background: SURFACE, color: canEdit ? FLUOR : TEXT, fontSize: 13, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>
            {canEdit ? <LogOut size={16} /> : <LogIn size={16} />}<span>{canEdit ? "CERRAR SESIÓN" : "INGRESO ORGANIZADORES"}</span>
          </button>
        </div>
      </div>
    </>
  );
}

function BackBar({ onBack, title, right }) {
  return (
    <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: `1px solid ${LINE}`, paddingBottom: 12 }}>
      <button type="button" onClick={onBack} className="font-mono-tech" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: MUTED, background: SURFACE, border: `1px solid ${LINE}`, cursor: "pointer" }}>
        <ChevronLeft size={16} /> VOLVER
      </button>
      {title && <h1 className="font-display" style={{ flex: 1, fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", textTransform: "uppercase" }}>{title}</h1>}
      {right}
    </div>
  );
}

// ---------- helpers ----------

const teamName = (db, id) => db.teams.find((t) => t.id === id)?.nombre || "—";
const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
const apellidoDe = (nombre = "") => {
  const n = nombre.trim();
  if (n.includes(",")) return n.split(",")[0].trim();
  const partes = n.split(/\s+/);
  return partes[partes.length - 1] || "";
};
const porApellido = (a, b) => collator.compare(apellidoDe(a.nombre), apellidoDe(b.nombre)) || collator.compare(a.nombre, b.nombre);
const porNombre = (a, b) => collator.compare(a.nombre, b.nombre);
const verNombre = (nombre = "") => {
  const n = nombre.trim();
  if (n.includes(",")) return n.replace(/\s*,\s*/, ", ");
  const partes = n.split(/\s+/);
  if (partes.length < 2) return n;
  return `${partes[partes.length - 1]}, ${partes.slice(0, -1).join(" ")}`;
};

const teamsOf = (db, ligaId) => db.teams.filter((t) => t.liga_id === ligaId).sort(porNombre);
const matchesOf = (db, ligaId) => db.matches.filter((m) => m.liga_id === ligaId);

function matchScore(db, matchId, teamId) {
  return db.stats
    .filter((s) => s.partido_id === matchId)
    .filter((s) => db.players.find((pl) => pl.id === s.jugador_id)?.equipo_id === teamId)
    .reduce((sum, s) => sum + (s.puntos || 0), 0);
}

function fmtFecha(fecha) {
  if (!fecha) return "";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

function descargarCSV(nombreArchivo, filas) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const contenido = "\uFEFF" + filas.map((f) => f.map(esc).join(";")).join("\r\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombreArchivo;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function EmptyState({ text, action }) {
  return (
    <div style={{ border: `1px dashed ${LINE}`, background: SURFACE, padding: 28, textAlign: "center", fontSize: 14, color: MUTED }}>
      <p>{text}</p>{action}
    </div>
  );
}

function Modal({ children, onClose, wide, disableBackdropClose = false }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.8)", padding: 16, overflowY: "auto" }}
      onClick={disableBackdropClose ? undefined : onClose}
    >
      <div style={{ width: "100%", maxWidth: wide ? 480 : 400, border: `1px solid ${LINE}`, background: SURFACE, color: TEXT, padding: 22 }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ---------- home (Bento Grid Suizo) ----------

function HomeView({ db, setView, liga, ligaId, canEdit }) {
  const partidos = matchesOf(db, ligaId);
  const enCurso = partidos.filter((m) => m.estado === "en_curso");
  const finalizados = partidos.filter((m) => m.estado === "finalizado");
  const recientes = [...partidos].sort((a, b) => (b.fecha + (b.hora || "")).localeCompare(a.fecha + (a.hora || ""))).slice(0, 4);
  const equipos = teamsOf(db, ligaId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 1, background: LINE, border: `1px solid ${LINE}` }}>
        <div className="col-span-12 lg:col-span-8" style={{ background: SURFACE, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <p className="font-mono-tech" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: FLUOR }}>
              01 // {liga.nombre}
            </p>
            <h1 className="font-display" style={{ marginTop: 8, fontSize: 34, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", textTransform: "uppercase" }}>
              TELEMETRÍA DE PARTIDO EN TIEMPO REAL.
            </h1>
            <p style={{ marginTop: 10, maxWidth: 540, fontSize: 14, color: MUTED }}>
              {canEdit
                ? "Registrá puntos, tiros, asistencias, rebotes, robos, pérdidas y rotaciones de zona por jugador en vivo."
                : "Consultá marcadores en curso, resultados oficiales y planillas acumuladas de la liga."}
            </p>
          </div>
          <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {canEdit && (
              <button type="button" onClick={() => setView({ name: "new" })} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 8, padding: "12px 18px" }}>
                <Plus size={16} /> CREAR PARTIDO
              </button>
            )}
            <button type="button" onClick={() => setView({ name: "matches" })} style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 8, padding: "12px 18px" }}>
              <ListChecks size={16} /> VER PARTIDOS
            </button>
            <button type="button" onClick={() => setView({ name: "stats" })} style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 8, padding: "12px 18px" }}>
              <BarChart3 size={16} /> TABLA GENERAL
            </button>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4" style={{ background: CLUB, color: "white", padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 12 }}>
            <span className="font-mono-tech" style={{ fontSize: 11, letterSpacing: "0.12em", opacity: 0.8 }}>02 // RESUMEN LIGA</span>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>ESTADO DE COMPETENCIA</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "18px 0" }}>
            <div>
              <span className="font-mono-tech" style={{ fontSize: 10, opacity: 0.75 }}>PARTIDOS</span>
              <p className="font-display tabular-nums" style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{partidos.length}</p>
            </div>
            <div>
              <span className="font-mono-tech" style={{ fontSize: 10, opacity: 0.75 }}>CLUBES</span>
              <p className="font-display tabular-nums" style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{equipos.length}</p>
            </div>
          </div>
          <div className="font-mono-tech tabular-nums" style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 12, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
            <span>EN VIVO: <strong style={{ color: FLUOR }}>{enCurso.length}</strong></span>
            <span>FINALIZADOS: <strong>{finalizados.length}</strong></span>
          </div>
        </div>
      </section>

      {enCurso.length > 0 && (
        <section>
          <h2 className="font-mono-tech" style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: FLUOR }}>
            ● EN CURSO AHORA
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {enCurso.map((m) => <MatchCard key={m.id} db={db} match={m} onClick={() => setView({ name: "match", matchId: m.id })} />)}
          </div>
        </section>
      )}

      <section>
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="font-mono-tech" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED }}>03 // ÚLTIMOS PARTIDOS</h2>
          <button type="button" onClick={() => setView({ name: "matches" })} className="font-mono-tech" style={{ fontSize: 11, fontWeight: 700, color: FLUOR, background: "transparent", border: "none", cursor: "pointer" }}>VER TODOS →</button>
        </div>
        {recientes.length === 0
          ? <EmptyState text="Todavía no se registraron partidos en esta liga." />
          : <div className="grid gap-3 sm:grid-cols-2">{recientes.map((m) => <MatchCard key={m.id} db={db} match={m} onClick={() => setView({ name: "match", matchId: m.id })} />)}</div>}
      </section>

      <section>
        <h2 className="font-mono-tech" style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: MUTED }}>04 // EQUIPOS DE LA LIGA</h2>
        {equipos.length === 0 ? (
          <EmptyState text="Esta liga no tiene equipos todavía."
            action={canEdit ? <button type="button" onClick={() => setView({ name: "teams" })} style={{ ...btnPrimary, marginTop: 12 }}>Agregar equipos</button> : null} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 1, background: LINE, border: `1px solid ${LINE}` }}>
            {equipos.map((t) => (
              <button type="button" key={t.id} onClick={() => setView({ name: "teams", teamId: t.id })}
                className="font-display"
                style={{ background: SURFACE, color: TEXT, padding: "14px 16px", fontSize: 15, fontWeight: 800, textAlign: "left", border: "none", cursor: "pointer" }}>
                {t.nombre}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MatchCard({ db, match, onClick, onEdit, onDelete }) {
  const scoreA = matchScore(db, match.id, match.equipo_a_id);
  const scoreB = matchScore(db, match.id, match.equipo_b_id);
  const finalized = match.estado === "finalizado";
  return (
    <div style={{ ...cardStyle, padding: 16 }}>
      <div className="font-mono-tech" style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: MUTED }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Calendar size={12} /> {fmtFecha(match.fecha)} {match.hora ? `· ${match.hora}` : ""}</span>
        <span style={{ padding: "2px 8px", fontWeight: 700, background: finalized ? ELEVATED : `${FLUOR}1A`, color: finalized ? MUTED : FLUOR, border: `1px solid ${finalized ? LINE : FLUOR}` }}>
          {finalized ? "FINALIZADO" : "EN VIVO"}
        </span>
      </div>
      <button type="button" onClick={onClick} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span className="font-display" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 16, fontWeight: 800, color: COLOR_A.text }}>{teamName(db, match.equipo_a_id)}</span>
          <span className="font-mono-tech tabular-nums" style={{ flexShrink: 0, border: `1px solid ${LINE}`, background: INK, padding: "5px 12px", fontSize: 15, fontWeight: 800, color: TEXT }}>{scoreA} - {scoreB}</span>
          <span className="font-display" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", fontSize: 16, fontWeight: 800, color: COLOR_B.text }}>{teamName(db, match.equipo_b_id)}</span>
        </div>
        {match.lugar && <div className="font-mono-tech" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: MUTED }}><MapPin size={12} /> {match.lugar}</div>}
      </button>
      {(onEdit || onDelete) && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
          {onEdit && <button type="button" onClick={onEdit} className="font-mono-tech" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", fontSize: 11, fontWeight: 700, color: TEXT, background: ELEVATED, border: `1px solid ${LINE}`, cursor: "pointer" }}><Pencil size={13} /> EDITAR</button>}
          {onDelete && <button type="button" onClick={onDelete} className="font-mono-tech" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", fontSize: 11, fontWeight: 700, background: "transparent", color: RED, border: `1px solid ${LINE}`, cursor: "pointer" }}><Trash2 size={13} /> BORRAR</button>}
        </div>
      )}
    </div>
  );
}

// ---------- new match ----------

function NewMatchView({ db, commit, setView, ligaId }) {
  const equipos = teamsOf(db, ligaId);
  const [equipoA, setEquipoA] = useState("");
  const [equipoB, setEquipoB] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("");
  const [lugar, setLugar] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (!equipoA || !equipoB) { setError("Elegí los dos equipos."); return; }
    if (equipoA === equipoB) { setError("El equipo local y el visitante no pueden ser el mismo."); return; }
    const match = {
      id: uid("m"), liga_id: ligaId, equipo_a_id: equipoA, equipo_b_id: equipoB,
      fecha, hora: hora || null, lugar: lugar || null, estado: "en_curso",
      resultado_equipo_a: 0, resultado_equipo_b: 0,
    };
    commit((prev) => ({ ...prev, matches: [...prev.matches, match] }));
    setView({ name: "match", matchId: match.id });
  };

  return (
    <div style={{ maxWidth: 540 }}>
      <BackBar onBack={() => setView({ name: "home" })} title="Nuevo partido" />
      {equipos.length < 2 ? (
        <EmptyState text="Necesitás al menos dos equipos en esta liga para crear un partido."
          action={<button type="button" onClick={() => setView({ name: "teams" })} style={{ ...btnPrimary, marginTop: 12 }}>Ir a Equipos</button>} />
      ) : (
        <div style={{ ...cardStyle, padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>[01] Equipo local</label>
            <select value={equipoA} onChange={(e) => setEquipoA(e.target.value)} style={inputStyle}>
              <option value="">Seleccionar equipo…</option>
              {equipos.map((t) => <option key={t.id} value={t.id} disabled={t.id === equipoB}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>[02] Equipo visitante</label>
            <select value={equipoB} onChange={(e) => setEquipoB(e.target.value)} style={inputStyle}>
              <option value="">Seleccionar equipo…</option>
              {equipos.map((t) => <option key={t.id} value={t.id} disabled={t.id === equipoA}>{t.nombre}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>[03] Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>[04] Hora (opcional)</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>[05] Sede / Lugar (opcional)</label>
            <input type="text" value={lugar} onChange={(e) => setLugar(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Ej: Polideportivo Municipal" style={inputStyle} />
          </div>
          {error && <p className="font-mono-tech" style={{ fontSize: 12, color: RED }}>[ERR] {error}</p>}
          <button type="button" onClick={submit} style={{ ...btnPrimary, width: "100%", padding: "14px 0" }}>CREAR PARTIDO Y ABRIR PLANILLA →</button>
        </div>
      )}
    </div>
  );
}

// ---------- edit / delete match ----------

function EditMatchModal({ db, match, commit, onClose, onReopen }) {
  const equipos = teamsOf(db, match.liga_id);
  const finalized = match.estado === "finalizado";
  const [equipoA, setEquipoA] = useState(match.equipo_a_id);
  const [equipoB, setEquipoB] = useState(match.equipo_b_id);
  const [fecha, setFecha] = useState(match.fecha);
  const [hora, setHora] = useState(match.hora || "");
  const [lugar, setLugar] = useState(match.lugar || "");
  const [error, setError] = useState("");
  const cambioDeEquipos = equipoA !== match.equipo_a_id || equipoB !== match.equipo_b_id;

  const guardar = () => {
    if (!equipoA || !equipoB) { setError("Elegí los dos equipos."); return; }
    if (equipoA === equipoB) { setError("El equipo local y el visitante no pueden ser el mismo."); return; }
    commit((prev) => ({
      ...prev,
      stats: cambioDeEquipos
        ? prev.stats.filter((s) => {
            if (s.partido_id !== match.id) return true;
            const p = prev.players.find((pl) => pl.id === s.jugador_id);
            return p && (p.equipo_id === equipoA || p.equipo_id === equipoB);
          })
        : prev.stats,
      matches: prev.matches.map((m) => m.id === match.id
        ? { ...m, equipo_a_id: equipoA, equipo_b_id: equipoB, fecha, hora: hora || null, lugar: lugar || null }
        : m),
    }));
    onClose();
  };

  return (
    <Modal onClose={onClose} wide>
      <h3 className="font-display" style={{ marginBottom: 12, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>Editar partido</h3>
      {finalized && (
        <div style={{ marginBottom: 16, border: `1px solid ${GOLD}`, background: `${GOLD}18`, padding: "10px 12px" }}>
          <p style={{ fontSize: 13, color: GOLD, marginBottom: 8 }}>
            Partido finalizado. Para corregir puntos o estadísticas de jugadores, primero debés reabrirlo.
          </p>
          <button type="button" onClick={() => { onReopen(); onClose(); }} className="font-mono-tech" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 11, fontWeight: 700, color: INK, background: GOLD, border: "none", cursor: "pointer" }}>
            <Unlock size={14} /> REABRIR PARA EDITAR ESTADÍSTICAS
          </button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelStyle}>Equipo local</label>
          <select value={equipoA} onChange={(e) => setEquipoA(e.target.value)} style={inputStyle}>
            {equipos.map((t) => <option key={t.id} value={t.id} disabled={t.id === equipoB}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Equipo visitante</label>
          <select value={equipoB} onChange={(e) => setEquipoB(e.target.value)} style={inputStyle}>
            {equipos.map((t) => <option key={t.id} value={t.id} disabled={t.id === equipoA}>{t.nombre}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={labelStyle}>Fecha</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Hora</label><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={inputStyle} /></div>
        </div>
        <div><label style={labelStyle}>Lugar</label><input type="text" value={lugar} onChange={(e) => setLugar(e.target.value)} style={inputStyle} /></div>
        {cambioDeEquipos && <p style={{ fontSize: 12, color: GOLD, border: `1px solid ${GOLD}`, padding: "8px 10px" }}>Al cambiar los equipos se borrarán las estadísticas de los equipos que salen del partido.</p>}
        {error && <p className="font-mono-tech" style={{ fontSize: 12, color: RED }}>{error}</p>}
      </div>
      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onClose} style={btnGhost}>Cancelar</button>
        <button type="button" onClick={guardar} style={btnPrimary}>Guardar cambios</button>
      </div>
    </Modal>
  );
}

function DeleteMatchModal({ db, match, commit, onClose, afterDelete }) {
  const borrar = () => {
    commit((prev) => ({
      ...prev,
      matches: prev.matches.filter((m) => m.id !== match.id),
      stats: prev.stats.filter((s) => s.partido_id !== match.id),
    }));
    onClose();
    if (afterDelete) afterDelete();
  };
  return (
    <Modal onClose={onClose}>
      <h3 className="font-display" style={{ marginBottom: 8, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>¿Borrar partido?</h3>
      <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>
        Se eliminará <strong style={{ color: TEXT }}>{teamName(db, match.equipo_a_id)} vs {teamName(db, match.equipo_b_id)}</strong> del {fmtFecha(match.fecha)} con todas sus estadísticas.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onClose} style={btnGhost}>Cancelar</button>
        <button type="button" onClick={borrar} style={btnDanger}>Borrar partido</button>
      </div>
    </Modal>
  );
}

// ---------- matches list ----------

function MatchesView({ db, commit, setView, ligaId, canEdit }) {
  const [filter, setFilter] = useState("todos");
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const reabrirDesdeListado = (matchId) => commit((prev) => ({ ...prev, matches: prev.matches.map((m) => (m.id === matchId ? { ...m, estado: "en_curso" } : m)) }));
  const sorted = [...matchesOf(db, ligaId)].sort((a, b) => (b.fecha + (b.hora || "")).localeCompare(a.fecha + (a.hora || "")));
  const list = sorted.filter((m) => (filter === "todos" ? true : m.estado === filter));

  return (
    <div>
      <BackBar onBack={() => setView({ name: "home" })} title="Partidos" />
      <div style={{ marginBottom: 16, display: "inline-flex", border: `1px solid ${LINE}`, background: SURFACE, padding: 3 }}>
        {[["todos", "Todos"], ["en_curso", "En curso"], ["finalizado", "Finalizados"]].map(([val, label]) => (
          <button type="button" key={val} onClick={() => setFilter(val)}
            className="font-mono-tech"
            style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", background: filter === val ? FLUOR : "transparent", color: filter === val ? INK : MUTED, border: "none" }}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState text="No hay partidos para este filtro." /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((m) => (
            <MatchCard key={m.id} db={db} match={m}
              onClick={() => setView({ name: "match", matchId: m.id })}
              onEdit={canEdit ? () => setEditTarget(m) : undefined} onDelete={canEdit ? () => setDeleteTarget(m) : undefined} />
          ))}
        </div>
      )}
      {editTarget && <EditMatchModal db={db} match={db.matches.find((m) => m.id === editTarget.id) || editTarget} commit={commit} onClose={() => setEditTarget(null)} onReopen={() => reabrirDesdeListado(editTarget.id)} />}
      {deleteTarget && <DeleteMatchModal db={db} match={deleteTarget} commit={commit} onClose={() => setDeleteTarget(null)} />}
    </div>
  );
}

// ---------- live match ----------

function MatchView({ db, commit, matchId, setView, canEdit, setToast }) {
  const match = db.matches.find((m) => m.id === matchId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dorsalTarget, setDorsalTarget] = useState(null);
  const [tab, setTab] = useState("a");

  if (!match) {
    return (<div><BackBar onBack={() => setView({ name: "matches" })} title="Partido" /><EmptyState text="Este partido ya no existe." /></div>);
  }

  const finalized = match.estado === "finalizado";
  const scoreA = matchScore(db, match.id, match.equipo_a_id);
  const scoreB = matchScore(db, match.id, match.equipo_b_id);

  const getStat = (jugadorId) => readStat(db.stats.find((st) => st.partido_id === matchId && st.jugador_id === jugadorId));

  const dorsalDe = (pl) => db.stats.find((st) => st.partido_id === matchId && st.jugador_id === pl.id)?.dorsal ?? pl.numero ?? null;
  const otrosDe = (pl) => db.players.filter((o) => o.equipo_id === pl.equipo_id && o.id !== pl.id)
    .map((o) => ({ nombre: o.nombre, dorsal: dorsalDe(o) })).filter((o) => o.dorsal !== null);

  const setDorsal = (jugadorId, dorsal) => commit((prev) => {
    const stats = [...prev.stats];
    const idx = stats.findIndex((st) => st.partido_id === matchId && st.jugador_id === jugadorId);
    if (idx === -1) {
      if (dorsal === null) return prev;
      stats.push({ ...emptyStat(matchId, jugadorId), dorsal });
    } else {
      stats[idx] = { ...readStat(stats[idx]), dorsal };
    }
    return { ...prev, stats };
  });

  const bump = (jugadorId, field, delta) => {
    if (finalized) return;
    commit((prev) => {
      const stats = [...prev.stats];
      const idx = stats.findIndex((s) => s.partido_id === matchId && s.jugador_id === jugadorId);
      if (idx === -1 && delta < 0) return prev;
      const base = idx === -1 ? emptyStat(matchId, jugadorId) : readStat(stats[idx]);

      if (field === "puntos") {
        const puntos = Math.max(0, base.puntos + delta);
        const realDelta = puntos - base.puntos;
        base.puntos = puntos;
        base.tiros = Math.max(puntos, base.tiros + realDelta);
      } else if (field === "tiros") {
        base.tiros = Math.max(base.puntos, base.tiros + delta);
      } else {
        base[field] = Math.max(0, base[field] + delta);
      }

      // Expulsión automática: tarjeta roja directa o acumulación de 2 amarillas
      if (delta > 0 && (field === "rojas" || (field === "amarillas" && base.amarillas >= 2))) {
        base.en_cancha = false;
        base.zona = null;
      }

      if (idx === -1) stats.push(base); else stats[idx] = base;
      return { ...prev, stats };
    });
  };

  // Revierte roja directa o segunda amarilla y reincorpora si hay lugar en cancha
  const revertirExpulsion = (jugadorId) => {
    if (finalized) return;
    let reingresoCancha = false;
    const jugador = db.players.find((x) => x.id === jugadorId);

    commit((prev) => {
      const stats = [...prev.stats];
      const idx = stats.findIndex((s) => s.partido_id === matchId && s.jugador_id === jugadorId);
      if (idx === -1) return prev;
      const base = readStat(stats[idx]);

      if (base.rojas > 0) {
        base.rojas = Math.max(0, base.rojas - 1);
      } else if (base.amarillas >= 2) {
        base.amarillas = Math.max(0, base.amarillas - 1);
      }

      if (!estaExpulsado(base)) {
        const adentro = stats
          .filter((st) => st.partido_id === matchId && st.en_cancha && st.jugador_id !== jugadorId)
          .map((st) => {
            const pl = prev.players.find((x) => x.id === st.jugador_id);
            return pl && pl.equipo_id === jugador?.equipo_id ? { zona: st.zona, sexo: pl.sexo } : null;
          })
          .filter(Boolean);

        if (adentro.length < EN_CANCHA) {
          base.en_cancha = true;
          base.zona = elegirZona(adentro, jugador?.sexo);
          reingresoCancha = true;
        }
      }

      stats[idx] = base;
      return { ...prev, stats };
    });

    if (jugador) {
      setToast(
        reingresoCancha
          ? `Expulsión revertida: ${verNombre(jugador.nombre)} vuelve a cancha.`
          : `Expulsión revertida: ${verNombre(jugador.nombre)} habilitado en banco (cancha completa).`
      );
    }
  };

  // Envía a un jugador al banco liberando su zona (el reemplazo se decide en el modal obligatorio)
  const mandarABanca = (jugadorId) => {
    if (finalized) return;
    commit((prev) => ({
      ...prev,
      stats: prev.stats.map((st) =>
        st.partido_id === matchId && st.jugador_id === jugadorId ? { ...st, en_cancha: false, zona: null } : st
      ),
    }));
  };

  // Ingreso a cancha desde banco: con zona explícita (si viene de un cambio) o calculada automáticamente
  const entrar = (jugadorId, saleId, zonaDestino = null, contarCambio = false) => {
    if (finalized) return;
    commit((prev) => {
      const stats = [...prev.stats];
      const buscar = (pid) => stats.findIndex((st) => st.partido_id === matchId && st.jugador_id === pid);
      const tocar = (pid, cambios) => {
        const i = buscar(pid);
        const base = i === -1 ? emptyStat(matchId, pid) : readStat(stats[i]);
        const nuevo = { ...base, ...cambios };
        if (i === -1) stats.push(nuevo); else stats[i] = nuevo;
      };
      const jugador = prev.players.find((x) => x.id === jugadorId);
      let zona = zonaDestino;

      if (saleId) {
        const i = buscar(saleId);
        zona = zona ?? (i === -1 ? null : stats[i].zona ?? null);
        tocar(saleId, { en_cancha: false, zona: null });
      }
      if (!zona) {
        const adentro = stats
          .filter((st) => st.partido_id === matchId && st.en_cancha)
          .map((st) => {
            const pl = prev.players.find((x) => x.id === st.jugador_id);
            return pl && pl.equipo_id === jugador?.equipo_id ? { zona: st.zona, sexo: pl.sexo } : null;
          })
          .filter(Boolean);
        zona = elegirZona(adentro, jugador?.sexo);
      }

      tocar(jugadorId, { en_cancha: true, zona });
      const key = jugador?.equipo_id === match.equipo_a_id ? "cambios_a" : "cambios_b";
      const sumaCambio = Boolean(saleId) || contarCambio;
      const matches = sumaCambio
        ? prev.matches.map((m) => (m.id === matchId ? { ...m, [key]: (m[key] || 0) + 1 } : m))
        : prev.matches;
      return { ...prev, stats, matches };
    });
  };

  const rotarZonas = (teamId) => {
    if (finalized) return;
    commit((prev) => ({
      ...prev,
      stats: prev.stats.map((st) => {
        if (st.partido_id !== matchId || !st.en_cancha) return st;
        if (prev.players.find((x) => x.id === st.jugador_id)?.equipo_id !== teamId) return st;
        return { ...st, zona: st.zona === "ataque" ? "defensa" : st.zona === "defensa" ? "ataque" : st.zona };
      }),
    }));
  };

  const moverZona = (jugadorId) => {
    if (finalized) return;
    commit((prev) => ({
      ...prev,
      stats: prev.stats.map((st) => (st.partido_id === matchId && st.jugador_id === jugadorId ? { ...st, zona: st.zona === "ataque" ? "defensa" : "ataque" } : st)),
    }));
  };

  const setSexo = (jugadorId, sexo) => commit((prev) => ({ ...prev, players: prev.players.map((x) => (x.id === jugadorId ? { ...x, sexo } : x)) }));

  const ajustarCambios = (equipoKey, delta) => {
    if (finalized) return;
    commit((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => (m.id === matchId ? { ...m, [`cambios_${equipoKey}`]: Math.max(0, (m[`cambios_${equipoKey}`] || 0) + delta) } : m)),
    }));
  };

  const finalize = () => {
    commit((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => m.id === matchId
        ? { ...m, estado: "finalizado", resultado_equipo_a: matchScore(prev, matchId, m.equipo_a_id), resultado_equipo_b: matchScore(prev, matchId, m.equipo_b_id) }
        : m),
      stats: prev.stats.map((st) => (st.partido_id === matchId ? { ...st, en_cancha: false, zona: null, dorsal: st.dorsal ?? prev.players.find((pl) => pl.id === st.jugador_id)?.numero ?? null } : st)),
    }));
    setConfirmOpen(false);
  };

  const reabrir = () => commit((prev) => ({ ...prev, matches: prev.matches.map((m) => (m.id === matchId ? { ...m, estado: "en_curso" } : m)) }));

  return (
    <div>
      <BackBar onBack={() => setView({ name: "matches" })}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="font-mono-tech" style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, background: finalized ? SURFACE : `${FLUOR}1A`, color: finalized ? MUTED : FLUOR, border: `1px solid ${finalized ? LINE : FLUOR}` }}>
              {finalized ? "FINALIZADO" : "EN CURSO"}
            </span>
            {canEdit && finalized && (
              <button type="button" onClick={reabrir} title="Reabrir para editar estadísticas" className="font-mono-tech" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", fontSize: 11, fontWeight: 700, color: INK, background: FLUOR, border: "none", cursor: "pointer" }}>
                <Unlock size={13} /> REABRIR
              </button>
            )}
            {canEdit && <button type="button" onClick={() => setEditOpen(true)} title="Editar datos del partido" style={{ padding: 8, background: SURFACE, color: TEXT, border: `1px solid ${LINE}`, cursor: "pointer" }}><Pencil size={15} /></button>}
            {canEdit && <button type="button" onClick={() => setDeleteOpen(true)} title="Borrar partido" style={{ padding: 8, background: "transparent", border: `1px solid ${LINE}`, cursor: "pointer" }}><Trash2 size={15} color={RED} /></button>}
          </div>
        } />

      <div className="live-scoreboard" style={{ marginBottom: 16, border: `1px solid ${LINE}`, background: SURFACE }}>
        <div className="font-mono-tech" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${LINE}`, padding: "6px 16px", fontSize: 11, color: MUTED }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} /> {fmtFecha(match.fecha)} {match.hora ? `· ${match.hora}` : ""}</span>
          {match.lugar && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {match.lugar}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12, padding: "14px 16px" }}>
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <p className="font-display" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 20, fontWeight: 900, textTransform: "uppercase", color: COLOR_A.text }}>{teamName(db, match.equipo_a_id)}</p>
          </div>
          <div className="font-mono-tech tabular-nums" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, border: `1px solid ${LINE}`, background: INK, padding: "6px 16px" }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: "white", lineHeight: 1 }}>{scoreA}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: FAINT }}>:</span>
            <span style={{ fontSize: 36, fontWeight: 900, color: "white", lineHeight: 1 }}>{scoreB}</span>
          </div>
          <div style={{ textAlign: "right", minWidth: 0 }}>
            <p className="font-display" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 20, fontWeight: 900, textTransform: "uppercase", color: COLOR_B.text }}>{teamName(db, match.equipo_b_id)}</p>
          </div>
        </div>
      </div>

      {canEdit && !finalized && (
        <p className="font-mono-tech" style={{ marginBottom: 12, fontSize: 11, color: MUTED }}>
          [TIP] TOCÁ UN JUGADOR EN CANCHA Y LUEGO LA ACCIÓN EN EL PAD INFERIOR. TOCÁ &quot;CAMBIO&quot; EN CANCHA PARA ENVIARLO AL BANCO Y ELEGIR SU REEMPLAZO.
        </p>
      )}

      <div className="team-tabs" role="tablist">
        {[["a", match.equipo_a_id, COLOR_A], ["b", match.equipo_b_id, COLOR_B]].map(([k, tid, col]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className="font-display"
            style={{ flex: 1, minWidth: 0, minHeight: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 10px", fontWeight: 800, textTransform: "uppercase", cursor: "pointer", border: tab === k ? `1px solid ${col.ring}` : `1px solid ${LINE}`, background: tab === k ? col.bg : SURFACE, color: tab === k ? col.text : MUTED }}>
            {teamName(db, tid)}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2" style={{ alignItems: "start" }}>
        <div className="team-panel" data-active={tab === "a"}>
          <LiveTeamPanel db={db} match={match} teamId={match.equipo_a_id} equipoKey="a" color={COLOR_A} readOnly={finalized || !canEdit}
            getStat={getStat} bump={bump} entrar={entrar} mandarABanca={mandarABanca} revertirExpulsion={revertirExpulsion} ajustarCambios={ajustarCambios} onEditDorsal={setDorsalTarget} setView={setView} setToast={setToast} rotarZonas={rotarZonas} moverZona={moverZona} setSexo={setSexo} />
        </div>
        <div className="team-panel" data-active={tab === "b"}>
          <LiveTeamPanel db={db} match={match} teamId={match.equipo_b_id} equipoKey="b" color={COLOR_B} readOnly={finalized || !canEdit}
            getStat={getStat} bump={bump} entrar={entrar} mandarABanca={mandarABanca} revertirExpulsion={revertirExpulsion} ajustarCambios={ajustarCambios} onEditDorsal={setDorsalTarget} setView={setView} setToast={setToast} rotarZonas={rotarZonas} moverZona={moverZona} setSexo={setSexo} />
        </div>
      </div>

      <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
        {!canEdit ? null : finalized ? (
          <button type="button" onClick={reabrir} style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 8, padding: "12px 20px" }}>
            <Unlock size={16} /> Reabrir para corregir estadísticas
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmOpen(true)} style={{ ...btnDanger, display: "flex", alignItems: "center", gap: 8, padding: "14px 24px", fontSize: 13 }}>
            <Trophy size={16} /> Finalizar partido
          </button>
        )}
      </div>

      {confirmOpen && (
        <Modal onClose={() => setConfirmOpen(false)}>
          <h3 className="font-display" style={{ marginBottom: 8, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>¿Finalizar el partido?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>Las estadísticas quedarán guardadas en Supabase. Si necesitás corregir algo más adelante, vas a poder reabrirlo desde esta pantalla.</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setConfirmOpen(false)} style={btnGhost}>Cancelar</button>
            <button type="button" onClick={finalize} style={btnDanger}>Finalizar partido</button>
          </div>
        </Modal>
      )}
      {dorsalTarget && (
        <DorsalModal player={dorsalTarget} habitual={dorsalTarget.numero} actual={db.stats.find((st) => st.partido_id === matchId && st.jugador_id === dorsalTarget.id)?.dorsal ?? null}
          otros={otrosDe(dorsalTarget)} onClose={() => setDorsalTarget(null)}
          onSave={(d) => { setDorsal(dorsalTarget.id, d); setDorsalTarget(null); }} />
      )}
      {editOpen && <EditMatchModal db={db} match={match} commit={commit} onClose={() => setEditOpen(false)} onReopen={reabrir} />}
      {deleteOpen && <DeleteMatchModal db={db} match={match} commit={commit} onClose={() => setDeleteOpen(false)} afterDelete={() => setView({ name: "matches" })} />}
    </div>
  );
}

// ---------- Partido en vivo ----------
const ACCIONES = [
  { id: "gol", label: "Gol", field: "puntos", val: (x) => x.puntos, tono: "gol" },
  { id: "fallo", label: "Fallo", field: "tiros", val: (x) => x.tiros - x.puntos },
  { id: "asist", label: "Asist.", field: "asistencias", val: (x) => x.asistencias },
  { id: "reb", label: "Reb.", field: "rebotes", val: (x) => x.rebotes },
  { id: "robo", label: "Robo", field: "robos", val: (x) => x.robos },
  { id: "perd", label: "Pérd.", field: "perdidas", val: (x) => x.perdidas },
  { id: "fp", label: "Free pass", field: "free_pass", val: (x) => x.free_pass, tono: "falta" },
  { id: "pen", label: "Penal", field: "penales", val: (x) => x.penales, tono: "falta" },
  { id: "am", label: "Amarilla", field: "amarillas", val: (x) => x.amarillas, tono: "amarilla" },
  { id: "ro", label: "Roja", field: "rojas", val: (x) => x.rojas, tono: "roja" },
];

const resumenStats = (x) => {
  const partes = [];
  if (x.puntos) partes.push(`${x.puntos} pts`);
  if (x.tiros) partes.push(`tiros ${x.puntos}/${x.tiros}`);
  [[x.asistencias, "as"], [x.rebotes, "reb"], [x.robos, "rob"], [x.perdidas, "pér"], [x.free_pass, "FP"], [x.penales, "pen"]].forEach(([n, l]) => { if (n) partes.push(`${n} ${l}`); });
  return partes.length ? partes.join(" · ") : "Sin acciones";
};

function Tarjetas({ s }) {
  if (!s.amarillas && !s.rojas) return null;
  const carta = (bg, k) => <span key={k} style={{ display: "inline-block", width: 8, height: 12, background: bg, border: "1px solid rgba(255,255,255,0.3)" }} />;
  return (
    <span style={{ display: "inline-flex", gap: 3, marginLeft: 6, verticalAlign: "middle" }} aria-label={`${s.amarillas} amarilla(s), ${s.rojas} roja(s)`}>
      {Array.from({ length: s.amarillas }, (_, i) => carta("#FACC15", `a${i}`))}
      {Array.from({ length: s.rojas }, (_, i) => carta("#EF4444", `r${i}`))}
    </span>
  );
}

function FilaJugador({ p, s, color, selected, onSelect, onEditDorsal, right, atenuado }) {
  const dorsal = s.dorsal ?? p.numero;
  const cambiado = s.dorsal != null && s.dorsal !== p.numero;
  const badge = {
    display: "flex",
    height: 34,
    minWidth: 38,
    padding: "0 6px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    background: selected ? FLUOR : INK,
    color: selected ? INK : color.text,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 14,
    fontWeight: 800,
    border: cambiado ? `1px solid ${GOLD}` : `1px solid ${LINE}`,
  };
  return (
    <div onClick={onSelect} tabIndex={onSelect ? 0 : undefined} onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } } : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 8px",
        boxSizing: "border-box",
        cursor: onSelect ? "pointer" : "default",
        opacity: atenuado ? 0.65 : 1,
        border: selected ? `1px solid ${FLUOR}` : `1px solid ${LINE}`,
        background: selected ? ELEVATED : INK,
      }}>
      {onEditDorsal ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onEditDorsal(p); }} title="Cambiar el dorsal solo en este partido" aria-label={`Dorsal de ${verNombre(p.nombre)}: tocar para cambiarlo`} style={{ ...badge, cursor: "pointer" }}>{dorsal ?? "–"}</button>
      ) : <span style={badge}>{dorsal ?? "–"}</span>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: 700, color: TEXT }}>
          {SEXO[p.sexo] && <span aria-label={SEXO[p.sexo].nombre} style={{ marginRight: 5, color: SEXO[p.sexo].color, fontWeight: 800 }}>{SEXO[p.sexo].sim}</span>}
          {verNombre(p.nombre)}
          <Tarjetas s={s} />
        </p>
        <p className="font-mono-tech tabular-nums" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: MUTED }}>
          {cambiado ? `hab. ${p.numero ?? "–"} · ` : ""}{resumenStats(s)}
        </p>
      </div>
      {right}
    </div>
  );
}

function LiveTeamPanel({
  db, match, teamId, equipoKey, color, readOnly,
  getStat, bump, entrar, mandarABanca, revertirExpulsion,
  ajustarCambios, onEditDorsal, setView, setToast, rotarZonas, moverZona, setSexo
}) {
  const [selId, setSelId] = useState(null);
  const [corregir, setCorregir] = useState(false);
  const [entraId, setEntraId] = useState(null);
  const [cambioPendiente, setCambioPendiente] = useState(null); // { sale: Player, zona: "ataque" | "defensa" | null }
  const [verTodos, setVerTodos] = useState(false);

  const players = db.players.filter((p) => p.equipo_id === teamId).sort(porApellido);
  const info = players.map((p) => ({
    p,
    s: getStat(p.id),
    jugo: db.stats.some((st) => st.partido_id === match.id && st.jugador_id === p.id),
  }));
  const enCancha = info.filter((x) => x.s.en_cancha);
  const resto = info.filter((x) => !x.s.en_cancha);
  const cambios = match[`cambios_${equipoKey}`] || 0;
  const sel = enCancha.find((x) => x.p.id === selId) || null;
  const ataque = enCancha.filter((x) => x.s.zona === "ataque");
  const defensa = enCancha.filter((x) => x.s.zona === "defensa");
  const sinZona = enCancha.filter((x) => x.s.zona !== "ataque" && x.s.zona !== "defensa");
  const tot = info.reduce(
    (a, x) => ({ fp: a.fp + x.s.free_pass, pen: a.pen + x.s.penales, am: a.am + x.s.amarillas, ro: a.ro + x.s.rojas }),
    { fp: 0, pen: 0, am: 0, ro: 0 }
  );
  const dorsalDe = (x) => x.s.dorsal ?? x.p.numero ?? "–";

  const aplicar = (a) => {
    if (!sel) return;
    const delta = corregir ? -1 : 1;
    bump(sel.p.id, a.field, delta);
    if (corregir) setCorregir(false);
    if (delta > 0 && a.field === "rojas") {
      setToast?.(`Roja directa para ${verNombre(sel.p.nombre)}: sale de la cancha.`);
      setSelId(null);
    }
    if (delta > 0 && a.field === "amarillas" && sel.s.amarillas + 1 >= 2) {
      setToast?.(`2ª amarilla para ${verNombre(sel.p.nombre)}: expulsado, sale de la cancha.`);
      setSelId(null);
    }
  };

  // Inicia un cambio desde la cancha: envía al jugador al banco y exige elegir reemplazo (o confirmar jugar con 1 menos)
  const iniciarCambio = (x) => {
    const zonaActual = x.s.zona || null;
    mandarABanca(x.p.id);
    if (selId === x.p.id) setSelId(null);
    setVerTodos(false);
    setCambioPendiente({ sale: x.p, zona: zonaActual });
  };

  const confirmarIngresoCambio = (jugadorEntraId) => {
    if (!cambioPendiente) return;
    entrar(jugadorEntraId, null, cambioPendiente.zona, true);
    setSelId(jugadorEntraId);
    setCambioPendiente(null);
  };

  const anularCambio = () => {
    if (!cambioPendiente) return;
    entrar(cambioPendiente.sale.id, null, cambioPendiente.zona, false);
    setCambioPendiente(null);
  };

  const pedirEntrada = (x) => {
    if (enCancha.length < EN_CANCHA) {
      entrar(x.p.id, null);
      setSelId(x.p.id);
    } else {
      setVerTodos(false);
      setEntraId(x.p.id);
    }
  };

  const chico = { display: "flex", alignItems: "center", justifyContent: "center", height: 30, width: 30, border: `1px solid ${LINE}`, background: SURFACE, color: TEXT, cursor: "pointer" };

  const filaEnCancha = (x) => (
    <FilaJugador key={x.p.id} p={x.p} s={x.s} color={color} selected={sel?.p.id === x.p.id}
      onSelect={readOnly ? undefined : () => setSelId(sel?.p.id === x.p.id ? null : x.p.id)} onEditDorsal={readOnly ? undefined : onEditDorsal}
      right={readOnly ? null : (
        <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button type="button" aria-label={`Pasar a ${x.s.zona === "ataque" ? "defensa" : "ataque"} a ${verNombre(x.p.nombre)}`} title={`Pasar a ${x.s.zona === "ataque" ? "defensa" : "ataque"}`} onClick={(e) => { e.stopPropagation(); moverZona(x.p.id); }} style={chico}><ArrowUpDown size={14} /></button>
          <button
            type="button"
            aria-label={`Cambiar a ${verNombre(x.p.nombre)}`}
            title="Enviar a la banca y pedir reemplazo"
            onClick={(e) => { e.stopPropagation(); iniciarCambio(x); }}
            className="font-mono-tech"
            style={{ height: 30, padding: "0 8px", border: `1px solid ${LINE}`, background: ELEVATED, color: FLUOR, fontSize: 10, fontWeight: 800, textTransform: "uppercase", cursor: "pointer" }}
          >
            CAMBIO
          </button>
        </span>
      )} />
  );

  const bloque = (titulo, lista, conTope = true) => {
    const v = lista.filter((x) => x.p.sexo === "varon").length;
    const m = lista.filter((x) => x.p.sexo === "mujer").length;
    const completo = lista.length === POR_ZONA && v === POR_SEXO && m === POR_SEXO;
    const excedido = lista.length > POR_ZONA || v > POR_SEXO || m > POR_SEXO;
    return (
      <div key={titulo}>
        <p className="font-mono-tech tabular-nums" style={{ margin: "2px 2px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>
          <span>{titulo}{conTope ? ` (${lista.length}/${POR_ZONA})` : ""}</span>
          {conTope && <span style={{ color: excedido ? RED : completo ? FLUOR : MUTED }}>{SEXO.varon.sim} {v}/{POR_SEXO} · {SEXO.mujer.sim} {m}/{POR_SEXO}</span>}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{lista.map(filaEnCancha)}</div>
      </div>
    );
  };

  // Candidatos para modal de ingreso desde banco (cuando ya hay 8 en cancha)
  const entraJugador = entraId ? players.find((p) => p.id === entraId) : null;
  const mismoSexoEntra = (x) => !entraJugador?.sexo || !x.p.sexo || x.p.sexo === entraJugador.sexo;
  const candidatosSalida = verTodos ? enCancha : enCancha.filter(mismoSexoEntra);

  // Candidatos para modal obligatorio cuando sale alguien de cancha hacia el banco
  const suplentesHabilitados = resto.filter((x) => !estaExpulsado(x.s) && x.p.id !== cambioPendiente?.sale.id);
  const mismoSexoCambio = (x) => !cambioPendiente?.sale.sexo || !x.p.sexo || x.p.sexo === cambioPendiente.sale.sexo;
  const candidatosIngreso = verTodos ? suplentesHabilitados : suplentesHabilitados.filter(mismoSexoCambio);

  return (
    <div style={{ border: `1px solid ${LINE}`, background: SURFACE }}>
      <div style={{ borderBottom: `1px solid ${LINE}`, padding: "12px 14px", background: color.bg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h3 className="font-display" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 18, fontWeight: 900, textTransform: "uppercase", color: color.text }}>{teamName(db, teamId)}</h3>
          <span className="font-mono-tech tabular-nums" style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: enCancha.length < EN_CANCHA && enCancha.length > 0 ? GOLD : color.text }}>
            CANCHA {enCancha.length}/{EN_CANCHA}
          </span>
        </div>
        <div className="font-mono-tech tabular-nums" style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11, color: TEXT }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            CAMBIOS <strong style={{ color: cambios > MAX_CAMBIOS ? RED : FLUOR }}>{cambios}/{MAX_CAMBIOS}</strong>
            {!readOnly && <>
              <button type="button" aria-label="Restar un cambio" disabled={cambios === 0} onClick={() => ajustarCambios(equipoKey, -1)} style={{ ...chico, opacity: cambios === 0 ? 0.35 : 1 }}><Minus size={13} /></button>
              <button type="button" aria-label="Sumar un cambio" onClick={() => ajustarCambios(equipoKey, 1)} style={chico}><Plus size={13} /></button>
            </>}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>FP {tot.fp} · PEN {tot.pen} · 🟨 {tot.am} · 🟥 {tot.ro}</span>
        </div>
        {!readOnly && enCancha.length > 0 && (
          <button type="button" onClick={() => rotarZonas(teamId)} className="font-mono-tech" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, minHeight: 34, border: `1px solid ${color.ring}`, background: INK, padding: "0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: color.text, cursor: "pointer" }}>
            <Repeat size={14} /> ROTAR ZONAS (ATAQUE ⇄ DEFENSA)
          </button>
        )}
      </div>

      {players.length === 0 ? (
        <div style={{ padding: 16 }}>
          <EmptyState text="Este equipo todavía no tiene jugadores cargados."
            action={!readOnly ? <button type="button" onClick={() => setView({ name: "teams", teamId })} style={{ ...btnPrimary, marginTop: 12 }}>Agregar jugadores</button> : null} />
        </div>
      ) : (
        <div style={{ padding: 12 }}>
          {enCancha.length === 0 && !readOnly && (
            <p style={{ padding: "4px 2px 12px", fontSize: 13, color: MUTED }}>
              Elegí quiénes arrancan: tocá <strong style={{ color: TEXT }}>ENTRAR</strong> en los jugadores del banco (hasta {EN_CANCHA}: {POR_SEXO} varones y {POR_SEXO} mujeres por zona).
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {(!readOnly || ataque.length > 0) && bloque("Ataque", ataque)}
            {(!readOnly || defensa.length > 0) && bloque("Defensa", defensa)}
            {sinZona.length > 0 && bloque("En cancha (sin zona)", sinZona, false)}
          </div>

          {readOnly ? (
            <>
              {resto.some((x) => x.jugo) && <p className="font-mono-tech" style={{ margin: "14px 2px 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>JUGARON</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {resto.filter((x) => x.jugo).map((x) => <FilaJugador key={x.p.id} p={x.p} s={x.s} color={color} />)}
              </div>
              {resto.some((x) => !x.jugo) && <p style={{ margin: "14px 2px 0", fontSize: 12, color: MUTED }}>No jugaron: {resto.filter((x) => !x.jugo).map((x) => verNombre(x.p.nombre)).join(" · ")}</p>}
            </>
          ) : (
            <>
              <p className="font-mono-tech" style={{ margin: "16px 2px 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>BANCO ({resto.length})</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {resto.map((x) => {
                  const expulsado = estaExpulsado(x.s);
                  const motivoExp = x.s.rojas > 0 ? "EXPULSADO (🟥)" : "EXPULSADO (2🟨)";
                  return (
                    <FilaJugador key={x.p.id} p={x.p} s={x.s} color={color} atenuado={expulsado} onEditDorsal={onEditDorsal}
                      right={expulsado
                        ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <span className="font-mono-tech" style={{ padding: "0 4px", fontSize: 10, fontWeight: 800, color: RED }}>{motivoExp}</span>
                            <button
                              type="button"
                              onClick={() => revertirExpulsion(x.p.id)}
                              title="Revertir expulsión y reincorporar"
                              className="font-mono-tech"
                              style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 32, padding: "0 8px", border: `1px solid ${GOLD}`, background: `${GOLD}18`, color: GOLD, fontSize: 10, fontWeight: 800, textTransform: "uppercase", cursor: "pointer" }}
                            >
                              <RotateCcw size={12} /> REVERTIR
                            </button>
                          </span>
                        )
                        : (
                          <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {!x.p.sexo && ["varon", "mujer"].map((k) => (
                              <button key={k} type="button" aria-label={`Es ${SEXO[k].nombre.toLowerCase()}`} title={`Marcar como ${SEXO[k].nombre.toLowerCase()}`} onClick={() => setSexo(x.p.id, k)} style={{ ...chico, color: SEXO[k].color, fontSize: 15, fontWeight: 800 }}>{SEXO[k].sim}</button>
                            ))}
                            <button type="button" onClick={() => pedirEntrada(x)} className="font-mono-tech" style={{ minHeight: 36, border: "none", padding: "0 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "white", background: color.bar, cursor: "pointer" }}>ENTRAR</button>
                          </span>
                        )} />
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {!readOnly && players.length > 0 && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 20, borderTop: `1px solid ${LINE}`, background: SURFACE, padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <p className="font-mono-tech" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: sel ? FLUOR : MUTED }}>
              {sel ? <><strong>#{dorsalDe(sel)}</strong> · {verNombre(sel.p.nombre)}</> : "[SELECCIONÁ UN JUGADOR EN CANCHA]"}
            </p>
            <button type="button" disabled={!sel} aria-pressed={corregir} onClick={() => setCorregir(!corregir)}
              className="font-mono-tech"
              style={{ flexShrink: 0, minHeight: 32, padding: "0 10px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", cursor: sel ? "pointer" : "default", opacity: sel ? 1 : 0.35, border: corregir ? `1px solid ${RED}` : `1px solid ${LINE}`, background: corregir ? "#3A1212" : INK, color: corregir ? RED : TEXT }}>
              − CORREGIR
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
            {ACCIONES.map((a) => {
              const isGol = !corregir && a.tono === "gol";
              const bg = corregir ? "#2E1111" : isGol ? FLUOR : a.tono === "amarilla" ? "#332B00" : a.tono === "roja" ? "#331111" : a.tono === "falta" ? "#2E200B" : INK;
              const borde = corregir ? RED : isGol ? FLUOR : a.tono === "amarilla" ? "#EAB308" : a.tono === "roja" ? RED : LINE;
              const fg = isGol ? INK : a.tono === "amarilla" ? "#FACC15" : a.tono === "roja" ? RED : TEXT;
              return (
                <button key={a.id} type="button" disabled={!sel} onClick={() => aplicar(a)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, minHeight: 52, minWidth: 0, padding: "4px 2px", border: `1px solid ${borde}`, background: bg, color: fg, cursor: sel ? "pointer" : "default", opacity: sel ? 1 : 0.4, touchAction: "manipulation" }}>
                  <span className="font-mono-tech" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" }}>{corregir ? "− " : ""}{a.label}</span>
                  <span className="font-mono-tech tabular-nums" style={{ fontSize: 16, fontWeight: 800 }}>{sel ? a.val(sel.s) : "–"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL OBLIGATORIO AL MANDAR UN JUGADOR DE CANCHA A LA BANCA */}
      {cambioPendiente && (
        <Modal onClose={() => {}} disableBackdropClose>
          <div className="font-mono-tech" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: FLUOR, marginBottom: 4 }}>
            <AlertTriangle size={14} />
            <span>SUSTITUCIÓN EN CURSO</span>
          </div>
          <h3 className="font-display" style={{ marginBottom: 4, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>
            Salió {verNombre(cambioPendiente.sale.nombre)}
          </h3>
          <p style={{ marginBottom: 10, fontSize: 13, color: MUTED }}>
            Pasó a la banca{cambioPendiente.zona ? <> desde <strong style={{ color: TEXT, textTransform: "uppercase" }}>{cambioPendiente.zona}</strong></> : ""}. Elegí qué jugador ingresa en su lugar:
          </p>

          {suplentesHabilitados.length === 0 ? (
            <div style={{ border: `1px solid ${GOLD}`, background: `${GOLD}18`, padding: 12, marginBottom: 14 }}>
              <p className="font-mono-tech" style={{ fontSize: 11, fontWeight: 800, color: GOLD }}>SIN SUPLENTES DISPONIBLES</p>
              <p style={{ fontSize: 13, color: TEXT, marginTop: 4 }}>
                No quedan jugadores habilitados en la banca. El equipo continuará jugando con uno menos ({enCancha.length}/{EN_CANCHA}).
              </p>
            </div>
          ) : (
            <>
              {candidatosIngreso.length < suplentesHabilitados.length && (
                <p style={{ marginBottom: 10, fontSize: 12, color: MUTED }}>
                  Filtrado por mismo sexo ({SEXO[cambioPendiente.sale.sexo]?.sim}).{" "}
                  <button type="button" onClick={() => setVerTodos(true)} className="font-mono-tech" style={{ border: "none", background: "transparent", padding: 0, fontWeight: 700, color: FLUOR, textDecoration: "underline", cursor: "pointer" }}>
                    VER TODOS ({suplentesHabilitados.length})
                  </button>
                </p>
              )}

              {candidatosIngreso.length === 0 ? (
                <p style={{ fontSize: 13, color: GOLD, marginBottom: 12 }}>
                  No hay suplentes del mismo sexo disponibles. Tocá &quot;VER TODOS&quot; o confirmá jugar con uno menos.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto", marginBottom: 14 }}>
                  {candidatosIngreso.map((x) => (
                    <button key={x.p.id} type="button" onClick={() => confirmarIngresoCambio(x.p.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 46, border: `1px solid ${LINE}`, background: INK, color: TEXT, padding: "0 12px", textAlign: "left", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                      <span className="font-mono-tech" style={{ fontWeight: 800, color: FLUOR }}>#{dorsalDe(x)}</span>
                      <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {SEXO[x.p.sexo] && <span style={{ marginRight: 4, color: SEXO[x.p.sexo].color }}>{SEXO[x.p.sexo].sim}</span>}
                        Entra {verNombre(x.p.nombre)}
                      </span>
                      <span className="font-mono-tech" style={{ fontSize: 10, color: FLUOR }}>INGRESAR →</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
            <button
              type="button"
              onClick={() => {
                setToast?.(`${teamName(db, teamId)} continúa con ${enCancha.length} jugadores en cancha.`);
                setCambioPendiente(null);
              }}
              style={suplentesHabilitados.length === 0 ? { ...btnPrimary, width: "100%" } : { ...btnGhost, width: "100%", color: GOLD, borderColor: GOLD }}
            >
              {suplentesHabilitados.length === 0 ? "CONFIRMAR JUGAR CON UNO MENOS" : `JUGAR CON UNO MENOS (${enCancha.length}/${EN_CANCHA})`}
            </button>
            <button type="button" onClick={anularCambio} style={{ ...btnGhost, width: "100%" }}>
              ANULAR CAMBIO (REINGRESAR A #{cambioPendiente.sale.numero ?? "–"})
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL DE INGRESO DESDE BANCO CUANDO YA HAY 8 EN CANCHA */}
      {entraJugador && (
        <Modal onClose={() => setEntraId(null)}>
          <h3 className="font-display" style={{ marginBottom: 4, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>Sustitución</h3>
          <p style={{ marginBottom: 4, fontSize: 14 }}>Entra <strong>{verNombre(entraJugador.nombre)}</strong>. ¿Quién sale?</p>
          <p className="font-mono-tech" style={{ marginBottom: 12, fontSize: 12, color: cambios >= MAX_CAMBIOS ? RED : MUTED }}>
            CAMBIOS: {cambios}/{MAX_CAMBIOS}{cambios >= MAX_CAMBIOS ? " (LÍMITE ALCANZADO)" : ""}
          </p>
          {candidatosSalida.length < enCancha.length && (
            <p style={{ marginBottom: 10, fontSize: 13, color: MUTED }}>
              Filtrado por mismo sexo ({SEXO[entraJugador.sexo]?.sim}).{" "}
              <button type="button" onClick={() => setVerTodos(true)} className="font-mono-tech" style={{ border: "none", background: "transparent", padding: 0, fontWeight: 700, color: FLUOR, textDecoration: "underline", cursor: "pointer" }}>VER TODOS</button>
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {candidatosSalida.map((x) => (
              <button key={x.p.id} type="button" onClick={() => { entrar(entraJugador.id, x.p.id); setSelId(entraJugador.id); setEntraId(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 46, border: `1px solid ${LINE}`, background: INK, color: TEXT, padding: "0 12px", textAlign: "left", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                <span className="font-mono-tech" style={{ fontWeight: 800, color: FLUOR }}>#{dorsalDe(x)}</span>
                <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {SEXO[x.p.sexo] && <span style={{ marginRight: 4, color: SEXO[x.p.sexo].color }}>{SEXO[x.p.sexo].sim}</span>}
                  Sale {verNombre(x.p.nombre)}{x.s.zona ? ` · ${x.s.zona}` : ""}
                </span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setEntraId(null)} style={btnGhost}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DorsalModal({ player, habitual, actual, otros, onSave, onClose }) {
  const [valor, setValor] = useState(actual == null ? "" : String(actual));
  const n = valor === "" ? null : Number(valor);
  const invalido = valor !== "" && (!Number.isInteger(n) || n < 0);
  const repetidos = n !== null && !invalido ? otros.filter((o) => o.dorsal === n) : [];
  const guardar = () => { if (!invalido) onSave(n); };
  return (
    <Modal onClose={onClose}>
      <h3 className="font-display" style={{ marginBottom: 4, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>Dorsal en este partido</h3>
      <p style={{ marginBottom: 14, fontSize: 14, color: MUTED }}>{verNombre(player.nombre)} · habitual: <strong style={{ color: TEXT }}>{habitual ?? "sin número"}</strong>. El cambio vale solo para hoy.</p>
      <input type="number" inputMode="numeric" min="0" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardar()}
        placeholder={habitual != null ? `Habitual: ${habitual}` : "Número de hoy"} style={{ ...inputStyle, fontSize: 20, fontFamily: "'JetBrains Mono', monospace" }} />
      {invalido && <p className="font-mono-tech" style={{ marginTop: 8, fontSize: 12, color: RED }}>Ingresá un número entero, 0 o mayor.</p>}
      {repetidos.length > 0 && <p style={{ marginTop: 8, fontSize: 13, color: GOLD }}>Ojo: ese número ya lo usa {repetidos.map((o) => verNombre(o.nombre)).join(", ")} en este partido.</p>}
      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onClose} style={btnGhost}>Cancelar</button>
        {actual != null && <button type="button" onClick={() => onSave(null)} style={btnGhost}>Volver al habitual</button>}
        <button type="button" onClick={guardar} style={btnPrimary}>Guardar</button>
      </div>
    </Modal>
  );
}

// ---------- teams / players ----------

function TeamsView({ db, commit, setView, teamId, ligaId, liga, canEdit }) {
  const equipos = teamsOf(db, ligaId);
  const selected = equipos.find((t) => t.id === teamId) || equipos[0] || null;
  const [form, setForm] = useState({ nombre: "", numero: "", sexo: "" });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [nuevoEquipo, setNuevoEquipo] = useState("");
  const [deleteTeam, setDeleteTeam] = useState(null);

  const players = selected ? db.players.filter((p) => p.equipo_id === selected.id).sort(porApellido) : [];
  const resetForm = () => { setForm({ nombre: "", numero: "", sexo: "" }); setEditingId(null); setError(""); };

  const agregarEquipo = () => {
    const nombre = nuevoEquipo.trim();
    if (!nombre) return;
    const id = uid("t");
    commit((prev) => ({ ...prev, teams: [...prev.teams, { id, nombre, liga_id: ligaId }] }));
    setNuevoEquipo("");
    setView({ name: "teams", teamId: id });
  };

  const borrarEquipo = (team) => {
    commit((prev) => {
      const jugadores = prev.players.filter((p) => p.equipo_id === team.id).map((p) => p.id);
      const partidos = prev.matches.filter((m) => m.equipo_a_id === team.id || m.equipo_b_id === team.id).map((m) => m.id);
      return {
        ...prev,
        teams: prev.teams.filter((t) => t.id !== team.id),
        players: prev.players.filter((p) => p.equipo_id !== team.id),
        matches: prev.matches.filter((m) => !partidos.includes(m.id)),
        stats: prev.stats.filter((s) => !jugadores.includes(s.jugador_id) && !partidos.includes(s.partido_id)),
      };
    });
    setDeleteTeam(null);
    setView({ name: "teams" });
  };

  const submit = () => {
    if (!selected) return;
    if (!form.nombre.trim()) { setError("Completá apellido y nombre."); return; }
    const numero = form.numero === "" ? null : Number(form.numero);
    if (numero !== null && (!Number.isInteger(numero) || numero < 0)) { setError("El número debe ser válido."); return; }
    const nombre = verNombre(form.nombre);
    if (editingId) {
      commit((prev) => ({ ...prev, players: prev.players.map((p) => (p.id === editingId ? { ...p, nombre, numero, sexo: form.sexo || null } : p)) }));
    } else {
      commit((prev) => ({ ...prev, players: [...prev.players, { id: uid("p"), nombre, numero, sexo: form.sexo || null, equipo_id: selected.id }] }));
    }
    resetForm();
  };

  const removePlayer = (id) => {
    commit((prev) => ({ ...prev, players: prev.players.filter((p) => p.id !== id), stats: prev.stats.filter((s) => s.jugador_id !== id) }));
    setDeleteTarget(null);
    if (editingId === id) resetForm();
  };

  return (
    <div>
      <BackBar onBack={() => setView({ name: "home" })} title={`Equipos · ${liga.nombre}`} />

      <div style={{ marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {equipos.map((t) => (
          <button type="button" key={t.id} onClick={() => { setView({ name: "teams", teamId: t.id }); resetForm(); }}
            className="font-mono-tech"
            style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", background: selected?.id === t.id ? FLUOR : SURFACE, color: selected?.id === t.id ? INK : MUTED, border: `1px solid ${selected?.id === t.id ? FLUOR : LINE}` }}>
            {t.nombre}
          </button>
        ))}
      </div>

      {canEdit && (
        <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" value={nuevoEquipo} onChange={(e) => setNuevoEquipo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarEquipo()}
            placeholder="Nombre del nuevo equipo" style={{ ...inputStyle, width: 250, padding: "8px 12px" }} />
          <button type="button" onClick={agregarEquipo} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> AGREGAR EQUIPO
          </button>
          {selected && (
            <button type="button" onClick={() => setDeleteTeam(selected)} className="font-mono-tech" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: RED, background: "transparent", border: `1px solid ${LINE}`, cursor: "pointer" }}>
              <Trash2 size={15} /> BORRAR {selected.nombre}
            </button>
          )}
        </div>
      )}

      {!selected ? (
        <EmptyState text="Esta liga todavía no tiene equipos. Agregá el primero arriba." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="lg:flex-row lg:items-start">
          <div style={{ ...cardStyle, flex: 1, minWidth: 0 }}>
            <div style={{ borderBottom: `1px solid ${LINE}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 900, textTransform: "uppercase" }}>PLANTEL // {selected.nombre}</h3>
              <span className="font-mono-tech tabular-nums" style={{ fontSize: 11, color: MUTED }}>{players.length} JUGADORES</span>
            </div>
            {players.length === 0 ? (
              <div style={{ padding: 16 }}><EmptyState text="Todavía no hay jugadores cargados para este equipo." /></div>
            ) : (
              <div>
                {players.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 16px", borderBottom: i === players.length - 1 ? "none" : `1px solid ${LINE}` }}>
                    <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 10 }}>
                      <span className="font-mono-tech tabular-nums" style={{ display: "flex", height: 28, width: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", border: `1px solid ${LINE}`, background: INK, color: FLUOR, fontSize: 12, fontWeight: 800 }}>{p.numero ?? "–"}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>
                        {SEXO[p.sexo] ? <span style={{ color: SEXO[p.sexo].color, marginRight: 5 }}>{SEXO[p.sexo].sim}</span> : ""}
                        {verNombre(p.nombre)}
                      </span>
                    </div>
                    {canEdit && (
                      <div style={{ display: "flex", flexShrink: 0, gap: 4 }}>
                        <button type="button" onClick={() => { setEditingId(p.id); setForm({ nombre: verNombre(p.nombre), numero: p.numero == null ? "" : String(p.numero), sexo: p.sexo || "" }); }} aria-label="Editar" style={{ padding: 8, background: "transparent", color: TEXT, border: "none", cursor: "pointer" }}><Pencil size={15} /></button>
                        <button type="button" onClick={() => setDeleteTarget(p)} aria-label="Eliminar" style={{ padding: 8, background: "transparent", border: "none", cursor: "pointer" }}><Trash2 size={15} color={RED} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
            <div style={{ ...cardStyle, padding: 18, width: "100%" }} className="lg:w-80 lg:shrink-0">
              <h3 className="font-display" style={{ marginBottom: 14, fontSize: 17, fontWeight: 900, textTransform: "uppercase" }}>{editingId ? "Editar jugador" : "Agregar jugador"}</h3>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Apellido, Nombre</label>
                <input type="text" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} placeholder="Ej: Pérez, Juan" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Número de camiseta (opcional)</label>
                <input type="number" min="0" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} placeholder="Ej: 7" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Sexo (para ataque y defensa)</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["varon", "♂ Varón"], ["mujer", "♀ Mujer"]].map(([k, t]) => (
                    <button key={k} type="button" aria-pressed={form.sexo === k} onClick={() => setForm((f) => ({ ...f, sexo: f.sexo === k ? "" : k }))}
                      className="font-mono-tech"
                      style={{ flex: 1, minHeight: 40, fontSize: 12, fontWeight: 700, cursor: "pointer", border: form.sexo === k ? `1px solid ${FLUOR}` : `1px solid ${LINE}`, background: form.sexo === k ? ELEVATED : INK, color: form.sexo === k ? FLUOR : MUTED }}>{t}</button>
                  ))}
                </div>
              </div>
              {error && <p className="font-mono-tech" style={{ marginBottom: 12, fontSize: 12, color: RED }}>{error}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={submit} style={{ ...btnPrimary, display: "flex", flex: 1, alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Check size={15} /> {editingId ? "Guardar" : "Agregar"}
                </button>
                {editingId && <button type="button" onClick={resetForm} style={{ ...btnGhost, padding: "10px 12px" }}><X size={15} /></button>}
              </div>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <h3 className="font-display" style={{ marginBottom: 8, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>¿Eliminar jugador?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>Se eliminará a <strong style={{ color: TEXT }}>{verNombre(deleteTarget.nombre)}</strong> y sus estadísticas en todos los partidos.</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setDeleteTarget(null)} style={btnGhost}>Cancelar</button>
            <button type="button" onClick={() => removePlayer(deleteTarget.id)} style={btnDanger}>Eliminar</button>
          </div>
        </Modal>
      )}

      {deleteTeam && (
        <Modal onClose={() => setDeleteTeam(null)}>
          <h3 className="font-display" style={{ marginBottom: 8, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>¿Borrar equipo?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>
            Se eliminará <strong style={{ color: TEXT }}>{deleteTeam.nombre}</strong>, todos sus jugadores y los partidos donde participó.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setDeleteTeam(null)} style={btnGhost}>Cancelar</button>
            <button type="button" onClick={() => borrarEquipo(deleteTeam)} style={btnDanger}>Borrar equipo</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- ligas ----------

function LeaguesView({ db, commit, setView, setLigaId, ligaId, setToast, canEdit }) {
  const [nombre, setNombre] = useState("");
  const [editando, setEditando] = useState(null);
  const [nombreEdit, setNombreEdit] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const crear = () => {
    const n = nombre.trim();
    if (!n) return;
    const id = uid("l");
    commit((prev) => ({ ...prev, leagues: [...prev.leagues, { id, nombre: n }] }));
    setNombre("");
    setLigaId(id);
    setView({ name: "teams" });
    setToast("Liga creada. Cargá sus equipos.");
  };

  const guardarNombre = () => {
    const n = nombreEdit.trim();
    if (!n) return;
    commit((prev) => ({ ...prev, leagues: prev.leagues.map((l) => (l.id === editando ? { ...l, nombre: n } : l)) }));
    setEditando(null);
  };

  const borrar = (liga) => {
    commit((prev) => {
      const equipos = prev.teams.filter((t) => t.liga_id === liga.id).map((t) => t.id);
      const jugadores = prev.players.filter((p) => equipos.includes(p.equipo_id)).map((p) => p.id);
      const partidos = prev.matches.filter((m) => m.liga_id === liga.id).map((m) => m.id);
      return {
        ...prev,
        leagues: prev.leagues.filter((l) => l.id !== liga.id),
        teams: prev.teams.filter((t) => t.liga_id !== liga.id),
        players: prev.players.filter((p) => !jugadores.includes(p.id)),
        matches: prev.matches.filter((m) => !partidos.includes(m.id)),
        stats: prev.stats.filter((s) => !partidos.includes(s.partido_id) && !jugadores.includes(s.jugador_id)),
      };
    });
    const queda = db.leagues.find((l) => l.id !== liga.id);
    if (queda) setLigaId(queda.id);
    setDeleteTarget(null);
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <BackBar onBack={() => setView({ name: "home" })} title="Ligas" />
      <p style={{ marginBottom: 16, fontSize: 14, color: MUTED }}>
        Cada liga tiene sus propios equipos, jugadores, partidos y estadísticas. Cambiá de liga desde el selector del menú superior.
      </p>

      {canEdit && (
        <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && crear()}
            placeholder="Nombre de la nueva liga" style={{ ...inputStyle, width: 280, padding: "8px 12px" }} />
          <button type="button" onClick={crear} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> CREAR LIGA
          </button>
        </div>
      )}

      <div style={cardStyle}>
        {db.leagues.map((l, i) => {
          const equipos = teamsOf(db, l.id).length;
          const partidos = matchesOf(db, l.id).length;
          const activa = l.id === ligaId;
          return (
            <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderBottom: i === db.leagues.length - 1 ? "none" : `1px solid ${LINE}`, background: activa ? ELEVATED : "transparent" }}>
              {editando === l.id ? (
                <div style={{ display: "flex", gap: 8, flex: 1 }}>
                  <input type="text" value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardarNombre()} style={{ ...inputStyle, padding: "8px 12px" }} />
                  <button type="button" onClick={guardarNombre} style={{ ...btnPrimary, padding: "8px 12px" }}><Check size={15} /></button>
                  <button type="button" onClick={() => setEditando(null)} style={{ ...btnGhost, padding: "8px 12px" }}><X size={15} /></button>
                </div>
              ) : (
                <>
                  <div style={{ minWidth: 0 }}>
                    <p className="font-display" style={{ fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                      {l.nombre}
                      {activa && <span className="font-mono-tech" style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", background: FLUOR, color: INK, padding: "2px 6px" }}>ACTIVA</span>}
                    </p>
                    <p className="font-mono-tech tabular-nums" style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{equipos} EQUIPO{equipos === 1 ? "" : "S"} · {partidos} PARTIDO{partidos === 1 ? "" : "S"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {!activa && <button type="button" onClick={() => { setLigaId(l.id); setView({ name: "home" }); }} style={{ ...btnGhost, fontSize: 11, padding: "6px 12px" }}>USAR</button>}
                    {canEdit && <button type="button" onClick={() => { setEditando(l.id); setNombreEdit(l.nombre); }} style={{ padding: 8, background: "transparent", color: TEXT, border: "none", cursor: "pointer" }}><Pencil size={15} /></button>}
                    {canEdit && db.leagues.length > 1 && <button type="button" onClick={() => setDeleteTarget(l)} style={{ padding: 8, background: "transparent", border: "none", cursor: "pointer" }}><Trash2 size={15} color={RED} /></button>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <h3 className="font-display" style={{ marginBottom: 8, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>¿Borrar liga?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>
            Se eliminará <strong style={{ color: TEXT }}>{deleteTarget.nombre}</strong> con todos sus equipos, jugadores, partidos y estadísticas.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setDeleteTarget(null)} style={btnGhost}>Cancelar</button>
            <button type="button" onClick={() => borrar(deleteTarget)} style={btnDanger}>Borrar liga</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- estadísticas (Bento + Tabla Tabular Suiza) ----------

function StatsView({ db, setView, setToast, ligaId, liga }) {
  const [teamFilter, setTeamFilter] = useState("todos");
  const [playerFilter, setPlayerFilter] = useState("todos");
  const [seasonFilter, setSeasonFilter] = useState("todas");

  const partidosLiga = matchesOf(db, ligaId);
  const equipos = teamsOf(db, ligaId);

  const seasons = useMemo(() => {
    const years = new Set(partidosLiga.map((m) => m.fecha?.slice(0, 4)).filter(Boolean));
    return Array.from(years).sort().reverse();
  }, [partidosLiga]);

  const finalizedMatches = partidosLiga.filter((m) => m.estado === "finalizado");

  const rows = useMemo(() => {
    const byPlayer = new Map();
    for (const match of finalizedMatches) {
      if (seasonFilter !== "todas" && match.fecha?.slice(0, 4) !== seasonFilter) continue;
      for (const raw of db.stats.filter((st) => st.partido_id === match.id)) {
        const player = db.players.find((p) => p.id === raw.jugador_id);
        if (!player) continue;
        if (teamFilter !== "todos" && player.equipo_id !== teamFilter) continue;
        if (playerFilter !== "todos" && player.id !== playerFilter) continue;
        const s = readStat(raw);
        if (!byPlayer.has(player.id)) {
          byPlayer.set(player.id, {
            player,
            partidos: 0,
            ...Object.fromEntries(STAT_FIELDS.map((f) => [f.key, 0])),
            ...Object.fromEntries(EXTRA_FIELDS.map((k) => [k, 0])),
          });
        }
        const agg = byPlayer.get(player.id);
        agg.partidos += 1;
        STAT_FIELDS.forEach((f) => { agg[f.key] += s[f.key]; });
        EXTRA_FIELDS.forEach((k) => { agg[k] += s[k]; });
      }
    }
    return Array.from(byPlayer.values()).sort((a, b) => b.puntos - a.puntos);
  }, [db, teamFilter, playerFilter, seasonFilter, finalizedMatches]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        puntos: acc.puntos + r.puntos,
        tiros: acc.tiros + r.tiros,
        rebotes: acc.rebotes + r.rebotes,
        asistencias: acc.asistencias + r.asistencias,
      }),
      { puntos: 0, tiros: 0, rebotes: 0, asistencias: 0 }
    );
  }, [rows]);

  const playersForFilter = db.players.filter((p) => {
    const t = db.teams.find((tt) => tt.id === p.equipo_id);
    if (!t || t.liga_id !== ligaId) return false;
    return teamFilter === "todos" || p.equipo_id === teamFilter;
  }).sort(porApellido);

  const selectStyle = { border: `1px solid ${LINE}`, background: SURFACE, color: TEXT, padding: "9px 12px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: "none" };
  const num = (n) => String(n).replace(".", ",");

  const exportarAcumuladas = () => {
    if (rows.length === 0) { setToast("No hay datos para exportar."); return; }
    const filas = [[
      "Liga", "Jugador", "Nº", "Equipo", "PJ",
      ...STAT_FIELDS.map((f) => f.label), "% Efectividad",
      ...STAT_FIELDS.map((f) => `Prom. ${f.label.toLowerCase()}`),
      "Free pass", "Penales", "Amarillas", "Rojas",
    ]];
    rows.forEach((r) => filas.push([
      liga.nombre, verNombre(r.player.nombre), r.player.numero ?? "", teamName(db, r.player.equipo_id), r.partidos,
      ...STAT_FIELDS.map((f) => r[f.key]),
      num(efectividad(r.puntos, r.tiros).toFixed(1)),
      ...STAT_FIELDS.map((f) => num((r[f.key] / r.partidos).toFixed(1))),
      ...EXTRA_FIELDS.map((k) => r[k]),
    ]));
    descargarCSV("korfball-estadisticas-acumuladas.csv", filas);
    setToast("Archivo descargado. Se abre directo en Excel.");
  };

  const exportarPartidoPorPartido = () => {
    const filas = [[
      "Liga", "Fecha", "Hora", "Lugar", "Equipo local", "Equipo visitante", "Resultado", "Estado",
      "Jugador", "Nº", "Equipo del jugador", ...STAT_FIELDS.map((f) => f.label), "% Efectividad",
      "Free pass", "Penales", "Amarillas", "Rojas",
    ]];
    const ordenados = [...partidosLiga].sort((a, b) => (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || "")));
    for (const m of ordenados) {
      if (seasonFilter !== "todas" && m.fecha?.slice(0, 4) !== seasonFilter) continue;
      const sa = matchScore(db, m.id, m.equipo_a_id);
      const sb = matchScore(db, m.id, m.equipo_b_id);
      for (const raw of db.stats.filter((st) => st.partido_id === m.id)) {
        const p = db.players.find((pl) => pl.id === raw.jugador_id);
        if (!p) continue;
        if (teamFilter !== "todos" && p.equipo_id !== teamFilter) continue;
        if (playerFilter !== "todos" && p.id !== playerFilter) continue;
        const s = readStat(raw);
        filas.push([
          liga.nombre, fmtFecha(m.fecha), m.hora || "", m.lugar || "",
          teamName(db, m.equipo_a_id), teamName(db, m.equipo_b_id), `${sa}-${sb}`,
          m.estado === "finalizado" ? "Finalizado" : "En curso",
          verNombre(p.nombre), s.dorsal ?? p.numero ?? "", teamName(db, p.equipo_id),
          ...STAT_FIELDS.map((f) => s[f.key]),
          num(efectividad(s.puntos, s.tiros).toFixed(1)),
          ...EXTRA_FIELDS.map((k) => s[k]),
        ]);
      }
    }
    if (filas.length === 1) { setToast("No hay datos para exportar."); return; }
    descargarCSV("korfball-partido-por-partido.csv", filas);
    setToast("Archivo descargado. Se abre directo en Excel.");
  };

  return (
    <div>
      <BackBar onBack={() => setView({ name: "home" })} title={`Estadísticas · ${liga.nombre}`} />

      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1, background: LINE, border: `1px solid ${LINE}`, marginBottom: 16 }}>
          <div style={{ background: SURFACE, padding: 16 }}>
            <span className="font-mono-tech" style={{ fontSize: 10, color: MUTED }}>EFICACIA DE TIRO</span>
            <p className="font-display tabular-nums" style={{ fontSize: 34, fontWeight: 900, color: FLUOR, lineHeight: 1.1, marginTop: 4 }}>
              {totals.tiros > 0 ? `${efectividad(totals.puntos, totals.tiros).toFixed(1)}%` : "—"}
            </p>
            <span className="font-mono-tech tabular-nums" style={{ fontSize: 11, color: MUTED }}>{totals.puntos}/{totals.tiros} TIROS</span>
          </div>
          <div style={{ background: SURFACE, padding: 16 }}>
            <span className="font-mono-tech" style={{ fontSize: 10, color: MUTED }}>GOLES TOTALES</span>
            <p className="font-display tabular-nums" style={{ fontSize: 34, fontWeight: 900, color: TEXT, lineHeight: 1.1, marginTop: 4 }}>{totals.puntos}</p>
            <span className="font-mono-tech" style={{ fontSize: 11, color: MUTED }}>ACUMULADOS FILTRO</span>
          </div>
          <div style={{ background: SURFACE, padding: 16 }}>
            <span className="font-mono-tech" style={{ fontSize: 10, color: MUTED }}>REBOTES TOTALES</span>
            <p className="font-display tabular-nums" style={{ fontSize: 34, fontWeight: 900, color: TEXT, lineHeight: 1.1, marginTop: 4 }}>{totals.rebotes}</p>
            <span className="font-mono-tech" style={{ fontSize: 11, color: MUTED }}>CAPTURAS DE TABLERO</span>
          </div>
          <div style={{ background: CLUB, padding: 16, color: "white" }}>
            <span className="font-mono-tech" style={{ fontSize: 10, opacity: 0.8 }}>ASISTENCIAS</span>
            <p className="font-display tabular-nums" style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, marginTop: 4 }}>{totals.asistencias}</p>
            <span className="font-mono-tech" style={{ fontSize: 11, opacity: 0.8 }}>PASES DE GOL</span>
          </div>
        </div>
      )}

      <div className="stats-filters" style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <select value={teamFilter} onChange={(e) => { setTeamFilter(e.target.value); setPlayerFilter("todos"); }} style={selectStyle}>
          <option value="todos">Todos los equipos</option>
          {equipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <select value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)} style={selectStyle}>
          <option value="todos">Todos los jugadores</option>
          {playersForFilter.map((p) => <option key={p.id} value={p.id}>{verNombre(p.nombre)}</option>)}
        </select>
        <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} style={selectStyle}>
          <option value="todas">Todas las temporadas</option>
          {seasons.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="stats-export" style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" onClick={exportarAcumuladas} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}>
          <Download size={15} /> EXPORTAR ACUMULADAS (.CSV)
        </button>
        <button type="button" onClick={exportarPartidoPorPartido} style={{ ...btnGhost, display: "flex", alignItems: "center", gap: 6 }}>
          <Download size={15} /> EXPORTAR PARTIDO POR PARTIDO
        </button>
      </div>

      {finalizedMatches.length === 0 ? (
        <EmptyState text="Todavía no hay partidos finalizados en esta liga." />
      ) : rows.length === 0 ? (
        <EmptyState text="No hay datos para los filtros seleccionados." />
      ) : (
        <>
          <div className="stats-cards">
            {rows.map((r, i) => {
              const efect = r.tiros > 0 ? `${efectividad(r.puntos, r.tiros).toFixed(0)}%` : "—";
              const cell = (label, value, sub, color) => (
                <div key={label} style={{ background: INK, border: `1px solid ${LINE}`, padding: "8px 4px", textAlign: "center" }}>
                  <p className="font-mono-tech" style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: MUTED }}>{label}</p>
                  <p className="font-mono-tech tabular-nums" style={{ fontSize: 18, fontWeight: 800, color: color || TEXT }}>{value}</p>
                  <p className="font-mono-tech tabular-nums" style={{ fontSize: 10, color: FAINT }}>{sub}</p>
                </div>
              );
              return (
                <div key={r.player.id} style={{ background: SURFACE, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span className="font-mono-tech tabular-nums" style={{ display: "flex", height: 32, width: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", background: i === 0 ? FLUOR : INK, color: i === 0 ? INK : MUTED, border: `1px solid ${LINE}`, fontSize: 13, fontWeight: 800 }}>{i + 1}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className="font-display" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 16, fontWeight: 800 }}>{verNombre(r.player.nombre)}</p>
                      <p className="font-mono-tech tabular-nums" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: MUTED }}>{teamName(db, r.player.equipo_id)} · {r.partidos} PJ</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p className="font-mono-tech tabular-nums" style={{ fontSize: 24, fontWeight: 900, lineHeight: 1, color: i === 0 ? FLUOR : TEXT }}>{r.puntos}</p>
                      <p className="font-mono-tech tabular-nums" style={{ fontSize: 10, color: MUTED }}>PTS · {(r.puntos / r.partidos).toFixed(1)}/P</p>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {STAT_FIELDS.filter((f) => f.key !== "puntos" && f.key !== "tiros").map((f) => cell(f.short, r[f.key], `${(r[f.key] / r.partidos).toFixed(1)}/P`))}
                    {cell("Tiros", r.tiros, `${(r.tiros / r.partidos).toFixed(1)}/P`)}
                    {cell("Efect.", efect, `${r.puntos}/${r.tiros}`, r.tiros > 0 ? FLUOR : FAINT)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="stats-table" style={{ ...cardStyle, overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 960, fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr className="font-mono-tech" style={{ borderBottom: `1px solid ${LINE}`, textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: MUTED }}>
                  <th style={{ padding: "12px 16px" }}>Jugador</th>
                  <th style={{ padding: "12px 16px" }}>Equipo</th>
                  <th style={{ padding: 10, textAlign: "center" }}>PJ</th>
                  {STAT_FIELDS.map((f) => <th key={f.key} style={{ padding: 10, textAlign: "center" }}>{f.short}</th>)}
                  <th style={{ padding: 10, textAlign: "center" }}>% Efect.</th>
                  {STAT_FIELDS.map((f) => <th key={`p-${f.key}`} style={{ padding: 10, textAlign: "center" }}>{f.short}/P</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.player.id} style={{ borderBottom: i === rows.length - 1 ? "none" : `1px solid ${LINE}`, background: i === 0 ? `${FLUOR}0A` : "transparent" }}>
                    <td style={{ padding: "11px 16px", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="font-mono-tech tabular-nums" style={{ fontSize: 11, padding: "1px 5px", background: i === 0 ? FLUOR : INK, color: i === 0 ? INK : MUTED, border: `1px solid ${LINE}` }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{verNombre(r.player.nombre)}</span>
                    </td>
                    <td style={{ padding: "11px 16px", color: MUTED }}>{teamName(db, r.player.equipo_id)}</td>
                    <td className="font-mono-tech tabular-nums" style={{ padding: 10, textAlign: "center" }}>{r.partidos}</td>
                    {STAT_FIELDS.map((f) => (
                      <td key={f.key} className="font-mono-tech tabular-nums" style={{ padding: 10, textAlign: "center", fontWeight: f.key === "puntos" ? 800 : 400, color: f.key === "puntos" && i === 0 ? FLUOR : TEXT }}>{r[f.key]}</td>
                    ))}
                    <td className="font-mono-tech tabular-nums" style={{ padding: 10, textAlign: "center", fontWeight: 800, color: r.tiros > 0 ? FLUOR : FAINT }}>
                      {r.tiros > 0 ? `${efectividad(r.puntos, r.tiros).toFixed(0)}%` : "—"}
                    </td>
                    {STAT_FIELDS.map((f) => (
                      <td key={`p-${f.key}`} className="font-mono-tech tabular-nums" style={{ padding: 10, textAlign: "center", color: MUTED }}>{(r[f.key] / r.partidos).toFixed(1)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="font-mono-tech" style={{ marginTop: 10, fontSize: 11, color: FAINT }}>
        [NOTA] "/P" = PROMEDIOS POR PARTIDO · EFECTIVIDAD = GOLES / TIROS INTENTADOS.
      </p>
    </div>
  );
}