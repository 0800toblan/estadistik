import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Home, Plus, ListChecks, Users, BarChart3, ChevronLeft, Check,
  Pencil, Trash2, X, MapPin, Calendar, Trophy, Minus, Download, Unlock,
  Cloud, CloudOff, Shield, LogIn, LogOut, Loader2, ArrowUpDown, Repeat, Menu as MenuIcon
} from "lucide-react";
import { loadDb, saveDiff } from "./lib/syncDb";

// ============================================================
// CONFIGURACIÓN DE ESTADÍSTICAS
// Para agregar una métrica nueva en el futuro alcanza con sumar
// una entrada acá: aparece sola en la carga, las tablas y Excel.
// ============================================================
const STAT_FIELDS = [
  { key: "puntos", label: "Puntos", short: "Pts" },
  { key: "asistencias", label: "Asistencias", short: "Asist." },
  { key: "rebotes", label: "Rebotes", short: "Reb." },
  { key: "tiros", label: "Tiros", short: "Tiros" },
  { key: "robos", label: "Robos", short: "Robos" },
  { key: "perdidas", label: "Pérdidas", short: "Pérd." },
];

// Reglas del partido en vivo (cambiá estos números si tu liga juega distinto).
const EN_CANCHA = 8;      // jugadores en cancha por equipo (4 en ataque + 4 en defensa)
const POR_ZONA = 4;       // jugadores por zona
const POR_SEXO = 2;       // por zona: 2 varones y 2 mujeres
const MAX_CAMBIOS = 8;    // cambios permitidos por equipo
const SEXO = { varon: { sim: "♂", color: "#2B6CB0", nombre: "Varón" }, mujer: { sim: "♀", color: "#C2185B", nombre: "Mujer" } };

// A qué zona va un jugador que entra a un lugar libre: la que tenga lugar para su sexo.
const elegirZona = (enCancha, sexo) => {
  const cuenta = (z, sx) => enCancha.filter((x) => x.zona === z && (!sx || x.sexo === sx)).length;
  const hayLugar = (z) => cuenta(z) < POR_ZONA && (!sexo || cuenta(z, sexo) < POR_SEXO);
  if (hayLugar("ataque")) return "ataque";
  if (hayLugar("defensa")) return "defensa";
  return cuenta("ataque") <= cuenta("defensa") ? "ataque" : "defensa";
};
const EXTRA_FIELDS = ["free_pass", "penales", "amarillas", "rojas"]; // faltas y tarjetas

const TEAM_SEED = [
  "La Patriada A", "La Patriada B", "Escorpiones",
  "Fosforitos", "Uruguay Korf", "CEF 102",
];

const SAVE_DELAY = 900;

// Errores que NO se arreglan reintentando solos: sesión vencida o sin permiso.
const esErrorDePermiso = (e) => e?.status === 401 || e?.status === 403 || e?.code === "42501" || /jwt|row-level security|permission denied/i.test(e?.message || "");
const explicarError = (e) => {
  if (esErrorDePermiso(e)) return "Tu sesión venció o no tenés permiso. Volvé a ingresar como organizador y se guardan los cambios pendientes.";
  if (/failed to fetch|network|load failed/i.test(e?.message || "")) return "Sin conexión. Se reintenta solo cuando vuelva internet.";
  return `Error de la base de datos: ${e?.message || "desconocido"}.`;
};

const INK = "#0F1B2B";
const PAPER = "#F4F6F5";
const GOLD = "#E3A63E";
const CARD = "#FFFFFF";
const LINE = "#E2E6E4";
const MUTED = "#5A6570";
const FAINT = "#8993A0";
const RED = "#B3261E";
const CHIP = "#EDEFEE";
const GREEN = "#1E8A83";

const COLOR_A = { ring: "#1E8A83", bg: "#EAF6F4", text: "#0F5C56", bar: "#1E8A83" };
const COLOR_B = { ring: "#C4432F", bg: "#FCEEEA", text: "#8A2E1E", bar: "#C4432F" };

const cardStyle = { borderRadius: 12, border: `1px solid ${LINE}`, background: CARD };
const inputStyle = { width: "100%", borderRadius: 8, border: `1px solid ${LINE}`, background: "white", padding: "10px 12px", fontSize: 15, outline: "none", boxSizing: "border-box" };
const labelStyle = { display: "block", marginBottom: 4, fontSize: 14, fontWeight: 600 };
const btnPrimary = { borderRadius: 8, padding: "10px 16px", fontWeight: 700, color: "white", background: INK, border: "none", cursor: "pointer" };
const btnGhost = { borderRadius: 8, padding: "8px 16px", fontWeight: 500, background: CHIP, border: "none", cursor: "pointer" };
const btnDanger = { borderRadius: 8, padding: "8px 16px", fontWeight: 700, color: "white", background: RED, border: "none", cursor: "pointer" };

// ids UUID reales (Supabase los exige); el parámetro se ignora y queda por compatibilidad.
const uid = () => crypto.randomUUID();

const emptyStat = (partidoId, jugadorId) => {
  const s = { id: uid("s"), partido_id: partidoId, jugador_id: jugadorId, dorsal: null, en_cancha: false, zona: null };
  STAT_FIELDS.forEach((f) => { s[f.key] = 0; });
  EXTRA_FIELDS.forEach((k) => { s[k] = 0; });
  return s;
};

// Normaliza estadísticas viejas que no tengan los campos nuevos.
const readStat = (s) => {
  if (!s) { const e = { en_cancha: false, zona: null }; STAT_FIELDS.forEach((f) => { e[f.key] = 0; }); EXTRA_FIELDS.forEach((k) => { e[k] = 0; }); return e; }
  const out = { ...s, en_cancha: !!s.en_cancha, zona: s.zona ?? null };
  STAT_FIELDS.forEach((f) => { if (typeof out[f.key] !== "number") out[f.key] = 0; });
  EXTRA_FIELDS.forEach((k) => { if (typeof out[k] !== "number") out[k] = 0; });
  if (typeof s.tiros !== "number") out.tiros = s.puntos || 0; // partidos previos a la métrica de tiros
  return out;
};

const efectividad = (puntos, tiros) => (tiros > 0 ? (puntos / tiros) * 100 : 0);

const seedDb = () => {
  const ligaId = uid("l");
  return {
    leagues: [{ id: ligaId, nombre: "Liga Bonaerense de Korfball" }],
    teams: TEAM_SEED.map((nombre) => ({ id: uid("t"), nombre, liga_id: ligaId })),
    players: [], matches: [], stats: [],
  };
};

// Adapta bases guardadas con versiones anteriores de la app.
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
  const syncedRef = useRef(null); // última foto confirmada en Supabase

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
        if (esErrorDePermiso(e)) break; // reintentar no sirve: hay que volver a ingresar
      }
      if (!ok) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
    savingRef.current = false;
    if (!ok) {
      if (pendingRef.current === null) pendingRef.current = data; // los cambios no se pierden: quedan pendientes
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

  // Guardar ya mismo (sin esperar la pausa) cuando el usuario se va, bloquea el celu o cambia de app.
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

  // Si había cambios sin guardar y el organizador vuelve a ingresar, se guardan solos.
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
      <div style={{ background: INK, minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "#C9D2DB" }}>No se pudieron cargar los datos. Revisá tu conexión y recargá la página.</p>
          {loadError && <p style={{ marginTop: 12, fontFamily: "monospace", fontSize: 12, color: "#F0A8A0", wordBreak: "break-word" }}>Detalle técnico: {loadError}</p>}
          {/column|schema cache|does not exist/i.test(loadError) && <p style={{ marginTop: 8, fontSize: 13, color: "#C9D2DB" }}>Parece que falta ejecutar una migración SQL en Supabase.</p>}
        </div>
      </div>
    );
  }

  if (status === "loading" || !db) {
    return (
      <div style={{ background: INK, minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ textAlign: "center" }}>
          <div className="animate-spin" style={{ margin: "0 auto 16px", height: 40, width: 40, borderRadius: 9999, border: `3px solid ${GOLD}55`, borderTopColor: "transparent" }} />
          <p style={{ fontSize: 14, color: "#C9D2DB" }}>Cargando datos…</p>
        </div>
      </div>
    );
  }

  const liga = db.leagues.find((l) => l.id === ligaId) || db.leagues[0];
  const ctx = { db, commit, setView, setToast, liga, ligaId: liga.id, canEdit };

  return (
    <div style={{ background: PAPER, minHeight: "100dvh", color: "#10151C" }} className="font-sans">
      <TopNav view={view} setView={setView} saveState={saveState} db={db} liga={liga} setLigaId={setLigaId} canEdit={canEdit} userEmail={userEmail} onLogin={onLogin} onLogout={onLogout} />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "16px 16px 64px" }}>
        {view.name === "home" && <HomeView {...ctx} />}
        {view.name === "new" && <NewMatchView {...ctx} />}
        {view.name === "matches" && <MatchesView {...ctx} />}
        {view.name === "match" && <MatchView {...ctx} matchId={view.matchId} />}
        {view.name === "teams" && <TeamsView {...ctx} teamId={view.teamId} />}
        {view.name === "stats" && <StatsView {...ctx} />}
        {view.name === "leagues" && <LeaguesView {...ctx} setLigaId={setLigaId} />}
      </main>
      {saveState === "error" && (
        <div role="alert" style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 55, maxWidth: 560, margin: "0 auto", borderRadius: 12, background: "#7A1F1A", color: "white", padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          <p style={{ fontSize: 14, fontWeight: 800 }}>Los cambios no se están guardando</p>
          <p style={{ marginTop: 2, fontSize: 13, opacity: 0.9 }}>{saveError}</p>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" onClick={() => { if (timerRef.current) clearTimeout(timerRef.current); flush(); }} style={{ minHeight: 40, borderRadius: 8, border: "none", background: "white", color: "#7A1F1A", padding: "0 14px", fontWeight: 700, cursor: "pointer" }}>Reintentar ahora</button>
            <button type="button" onClick={() => { if (window.confirm("Se van a perder los cambios que no se guardaron. ¿Recargar igual?")) { pendingRef.current = null; window.location.reload(); } }} style={{ minHeight: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.5)", background: "transparent", color: "white", padding: "0 14px", fontWeight: 600, cursor: "pointer" }}>Descartar y recargar</button>
          </div>
        </div>
      )}
      {toast && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 16, display: "flex", justifyContent: "center", padding: "0 16px", zIndex: 50 }}>
          <div style={{ borderRadius: 8, background: "#10151C", padding: "10px 16px", fontSize: 14, color: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>{toast}</div>
        </div>
      )}
    </div>
  );
}

// ---------- nav ----------

function TopNav({ view, setView, saveState, db, liga, setLigaId, canEdit, userEmail, onLogin, onLogout }) {
  const items = [
    { name: "home", label: "Inicio", icon: Home },
    { name: "new", label: "Nuevo partido", icon: Plus },
    { name: "matches", label: "Partidos", icon: ListChecks },
    { name: "teams", label: "Equipos", icon: Users },
    { name: "stats", label: "Estadísticas", icon: BarChart3 },
    { name: "leagues", label: "Ligas", icon: Shield },
  ];
  const visible = items.filter((it) => canEdit || it.name !== "new");
  const titles = { home: "Inicio", new: "Nuevo partido", matches: "Partidos", match: "Partido", teams: "Equipos", stats: "Estadísticas", leagues: "Ligas" };
  const pageTitle = titles[view.name] || "Estadistik";

  // El botón de sesión también muestra el estado del guardado: rueda mientras guarda, tilde al terminar.
  const st = saveState === "error" ? "error" : saveState === "saved" ? "saved" : saveState === "pending" ? "pending" : "idle";
  const authIcon = (size) => {
    if (!canEdit) return <LogIn size={size} />;
    if (st === "pending") return <Loader2 size={size} className="animate-spin" />;
    if (st === "saved") return <Check size={size} />;
    if (st === "error") return <CloudOff size={size} />;
    return <LogOut size={size} />;
  };
  const authLabel = !canEdit ? "Organizadores" : st === "pending" ? "Guardando…" : st === "saved" ? "Guardado" : st === "error" ? "Sin guardar" : "Salir";
  const authColor = st === "error" ? "#F0A8A0" : st === "saved" ? "#7FD6B0" : "#C9D2DB";
  const authClick = canEdit ? () => {
    if (st === "pending") return; // no salir mientras se están guardando los cambios
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
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); };
  }, [menuOpen]);

  const go = (name) => { setView({ name }); setMenuOpen(false); };
  const menuAuthClick = () => { setMenuOpen(false); authClick(); };
  const iconBtn = { display: "flex", alignItems: "center", justifyContent: "center", height: 44, width: 44, flexShrink: 0, background: "transparent", border: "none", color: "white", cursor: "pointer" };

  return (
    <>
      {/* ---- Compu: barra superior con menú horizontal ---- */}
      <header className="topbar-desktop" style={{ background: INK, position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, padding: "10px 16px" }}>
          <button type="button" onClick={() => setView({ name: "home" })} aria-label="Ir al inicio" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: "transparent", border: "none", cursor: "pointer" }}>
            <span style={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, background: GOLD, color: INK, fontWeight: 900, fontSize: 13 }}>LK</span>
          </button>
          <select value={liga.id} onChange={(e) => { setLigaId(e.target.value); setView({ name: "home" }); }}
            style={{ flexShrink: 0, borderRadius: 8, border: `1px solid #2A3A4E`, background: "#16263A", color: "white", padding: "7px 10px", fontSize: 13, fontWeight: 600, maxWidth: 190, cursor: "pointer" }}>
            {db.leagues.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
          <nav style={{ display: "flex", gap: 4, flex: 1 }}>
            {visible.map((it) => {
              const active = view.name === it.name;
              const Icon = it.icon;
              return (
                <button type="button" key={it.name} onClick={() => setView({ name: it.name })}
                  style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, borderRadius: 8, padding: "8px 12px", fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", background: active ? GOLD : "transparent", color: active ? INK : "#C9D2DB" }}>
                  <Icon size={16} strokeWidth={2.4} /><span>{it.label}</span>
                </button>
              );
            })}
          </nav>
          <button type="button" onClick={authClick} disabled={st === "pending"} aria-busy={st === "pending"} title={canEdit && st === "idle" ? userEmail : undefined}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexShrink: 0, minWidth: 128, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, border: "1px solid #2A3A4E", background: "transparent", color: authColor, cursor: st === "pending" ? "default" : "pointer", transition: "color 150ms" }}>
            {authIcon(15)}<span>{authLabel}</span>
          </button>
        </div>
      </header>

      {/* ---- Celu: hamburguesa + Estadistik a la izquierda, título de la página centrado ---- */}
      <header className="topbar-mobile" style={{ background: INK, position: "sticky", top: 0, zIndex: 40, paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: 4, padding: "4px 8px", minHeight: 52 }}>
          <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <button type="button" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} style={iconBtn}><MenuIcon size={26} /></button>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 16, fontWeight: 900, color: GOLD }}>Estadistik</span>
          </div>
          <span style={{ whiteSpace: "nowrap", fontSize: 15, fontWeight: 700, color: "white", textAlign: "center" }}>{pageTitle}</span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, minWidth: 0 }}>
            <button type="button" aria-label={authLabel} aria-busy={st === "pending"} onClick={authClick} disabled={st === "pending"} style={{ ...iconBtn, color: authColor }}>
              {authIcon(20)}
            </button>
          </div>
        </div>
      </header>

      {/* ---- Celu: menú a pantalla completa, sube desde abajo ---- */}
      <div className={`menu-sheet${menuOpen ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Menú principal" aria-hidden={!menuOpen}
        style={{ background: INK }}
        onTouchStart={(e) => { touchY.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => { if (e.changedTouches[0].clientY - touchY.current > 90) setMenuOpen(false); }}>
        <div className="menu-panel" style={{ display: "flex", flexDirection: "column", padding: "calc(8px + env(safe-area-inset-top, 0px)) 20px calc(20px + env(safe-area-inset-bottom, 0px))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "flex", height: 34, width: 34, alignItems: "center", justifyContent: "center", borderRadius: 8, background: GOLD, color: INK, fontWeight: 900, fontSize: 13 }}>LK</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: "white" }}>Estadistik</span>
            </span>
            <button type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} style={iconBtn}><X size={28} /></button>
          </div>

          <div style={{ flex: 1 }} />

          <label htmlFor="menu-liga" style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9AA7B2" }}>Liga</label>
          <select id="menu-liga" className="menu-select" value={liga.id} onChange={(e) => { setLigaId(e.target.value); go("home"); }}
            style={{ width: "100%", minHeight: 50, borderRadius: 12, border: "1px solid #2A3A4E", background: "#16263A", color: "white", padding: "0 14px", fontWeight: 600 }}>
            {db.leagues.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>

          <nav style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            {visible.map((it) => {
              const active = view.name === it.name || (it.name === "matches" && view.name === "match");
              const Icon = it.icon;
              return (
                <button type="button" key={it.name} onClick={() => go(it.name)} aria-current={active ? "page" : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 16, minHeight: 60, padding: "0 18px", borderRadius: 14, border: "none", textAlign: "left", fontSize: 20, fontWeight: 600, cursor: "pointer", background: active ? GOLD : "#16263A", color: active ? INK : "white" }}>
                  <Icon size={24} strokeWidth={2.2} /><span>{it.label}</span>
                </button>
              );
            })}
          </nav>

          <button type="button" onClick={menuAuthClick}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 52, marginTop: 16, borderRadius: 14, border: "1px solid #2A3A4E", background: "transparent", color: "#C9D2DB", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            {canEdit ? <LogOut size={18} /> : <LogIn size={18} />}<span>{canEdit ? "Cerrar sesión" : "Ingreso de organizadores"}</span>
          </button>
        </div>
      </div>
    </>
  );
}

function BackBar({ onBack, title, right }) {
  return (
    <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 8, padding: "6px 8px", fontSize: 14, fontWeight: 500, color: MUTED, background: "transparent", border: "none", cursor: "pointer" }}>
        <ChevronLeft size={18} /> Volver
      </button>
      {title && <h1 style={{ flex: 1, fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>{title}</h1>}
      {right}
    </div>
  );
}

// ---------- helpers ----------

const teamName = (db, id) => db.teams.find((t) => t.id === id)?.nombre || "—";
// Orden alfabético A-Z en español (ignora mayúsculas y tildes).
const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
// Apellido: lo que va antes de la coma ("Pérez, Juan") o, si no hay coma, la última palabra ("Juan Pérez").
const apellidoDe = (nombre = "") => {
  const n = nombre.trim();
  if (n.includes(",")) return n.split(",")[0].trim();
  const partes = n.split(/\s+/);
  return partes[partes.length - 1] || "";
};
const porApellido = (a, b) => collator.compare(apellidoDe(a.nombre), apellidoDe(b.nombre)) || collator.compare(a.nombre, b.nombre);
const porNombre = (a, b) => collator.compare(a.nombre, b.nombre);
// Cómo se muestra (y se guarda) un jugador: "Apellido, Nombre". "Juan Pérez" pasa a "Pérez, Juan".
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
    <div style={{ borderRadius: 10, border: `1px dashed ${LINE}`, padding: 24, textAlign: "center", fontSize: 14, color: MUTED }}>
      <p>{text}</p>{action}
    </div>
  );
}

function Modal({ children, onClose, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 16, overflowY: "auto" }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: wide ? 460 : 360, borderRadius: 12, background: "white", padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ---------- home ----------

function HomeView({ db, setView, liga, ligaId, canEdit }) {
  const partidos = matchesOf(db, ligaId);
  const enCurso = partidos.filter((m) => m.estado === "en_curso");
  const recientes = [...partidos].sort((a, b) => (b.fecha + (b.hora || "")).localeCompare(a.fecha + (a.hora || ""))).slice(0, 4);
  const equipos = teamsOf(db, ligaId);

  return (
    <div>
      <section style={{ marginBottom: 32, paddingTop: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: GOLD }}>{liga.nombre}</p>
        <h1 style={{ marginTop: 4, fontSize: 30, fontWeight: 900, letterSpacing: "-0.01em" }}>Estadísticas de partido, en tiempo real.</h1>
        <p style={{ marginTop: 8, maxWidth: 560, color: MUTED }}>{canEdit ? "Cargá puntos, asistencias, rebotes, tiros, robos y pérdidas de cada jugador durante el partido." : "Seguí los partidos, los equipos y las estadísticas de cada jugador de la liga."}</p>
        <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 12 }}>
          {canEdit && (
          <button type="button" onClick={() => setView({ name: "new" })} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 10 }}>
            <Plus size={18} /> Crear nuevo partido
          </button>
          )}
          <button type="button" onClick={() => setView({ name: "matches" })} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 10, padding: "12px 20px", fontWeight: 600, border: `1px solid ${LINE}`, background: CARD, cursor: "pointer" }}>
            <ListChecks size={18} /> Ver partidos
          </button>
        </div>
      </section>

      {enCurso.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: MUTED }}>En curso ahora</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {enCurso.map((m) => <MatchCard key={m.id} db={db} match={m} onClick={() => setView({ name: "match", matchId: m.id })} />)}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: MUTED }}>Últimos partidos</h2>
          <button type="button" onClick={() => setView({ name: "matches" })} style={{ fontSize: 14, fontWeight: 600, color: COLOR_A.text, background: "transparent", border: "none", cursor: "pointer" }}>Ver todos</button>
        </div>
        {recientes.length === 0
          ? <EmptyState text="Todavía no se registraron partidos en esta liga." />
          : <div className="grid gap-3 sm:grid-cols-2">{recientes.map((m) => <MatchCard key={m.id} db={db} match={m} onClick={() => setView({ name: "match", matchId: m.id })} />)}</div>}
      </section>

      <section>
        <h2 style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: MUTED }}>Equipos</h2>
        {equipos.length === 0 ? (
          <EmptyState text="Esta liga no tiene equipos todavía."
            action={canEdit ? <button type="button" onClick={() => setView({ name: "teams" })} style={{ ...btnPrimary, marginTop: 12, fontSize: 14 }}>Agregar equipos</button> : null} />
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {equipos.map((t) => (
              <button type="button" key={t.id} onClick={() => setView({ name: "teams", teamId: t.id })} style={{ borderRadius: 9999, border: `1px solid ${LINE}`, background: CARD, padding: "8px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
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
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: MUTED }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} /> {fmtFecha(match.fecha)} {match.hora ? `· ${match.hora}` : ""}</span>
        <span style={{ borderRadius: 9999, padding: "2px 8px", fontWeight: 700, background: finalized ? "#E9EEF0" : `${GOLD}33`, color: finalized ? MUTED : "#8A6410" }}>
          {finalized ? "Finalizado" : "En curso"}
        </span>
      </div>
      <button type="button" onClick={onClick} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700, color: COLOR_A.text }}>{teamName(db, match.equipo_a_id)}</span>
          <span style={{ flexShrink: 0, borderRadius: 6, background: INK, padding: "4px 10px", fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "white" }}>{scoreA} - {scoreB}</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", fontWeight: 700, color: COLOR_B.text }}>{teamName(db, match.equipo_b_id)}</span>
        </div>
        {match.lugar && <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED }}><MapPin size={12} /> {match.lugar}</div>}
      </button>
      {(onEdit || onDelete) && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
          {onEdit && <button type="button" onClick={onEdit} style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 6, padding: "6px 10px", fontSize: 13, fontWeight: 600, background: CHIP, border: "none", cursor: "pointer" }}><Pencil size={14} /> Editar</button>}
          {onDelete && <button type="button" onClick={onDelete} style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 6, padding: "6px 10px", fontSize: 13, fontWeight: 600, background: "transparent", color: RED, border: `1px solid ${LINE}`, cursor: "pointer" }}><Trash2 size={14} /> Borrar</button>}
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
    <div style={{ maxWidth: 520 }}>
      <BackBar onBack={() => setView({ name: "home" })} title="Nuevo partido" />
      {equipos.length < 2 ? (
        <EmptyState text="Necesitás al menos dos equipos en esta liga para crear un partido."
          action={<button type="button" onClick={() => setView({ name: "teams" })} style={{ ...btnPrimary, marginTop: 12, fontSize: 14 }}>Ir a Equipos</button>} />
      ) : (
        <div style={{ ...cardStyle, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Equipo local</label>
            <select value={equipoA} onChange={(e) => setEquipoA(e.target.value)} style={inputStyle}>
              <option value="">Seleccionar equipo…</option>
              {equipos.map((t) => <option key={t.id} value={t.id} disabled={t.id === equipoB}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Equipo visitante</label>
            <select value={equipoB} onChange={(e) => setEquipoB(e.target.value)} style={inputStyle}>
              <option value="">Seleccionar equipo…</option>
              {equipos.map((t) => <option key={t.id} value={t.id} disabled={t.id === equipoA}>{t.nombre}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hora (opcional)</label>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Lugar (opcional)</label>
            <input type="text" value={lugar} onChange={(e) => setLugar(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Ej: Polideportivo Municipal" style={inputStyle} />
          </div>
          {error && <p style={{ fontSize: 14, fontWeight: 500, color: RED }}>{error}</p>}
          <button type="button" onClick={submit} style={{ ...btnPrimary, width: "100%", padding: "12px 0", borderRadius: 10 }}>Crear partido y empezar a cargar</button>
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
      <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 800 }}>Editar partido</h3>
      {finalized && (
        <div style={{ marginBottom: 16, borderRadius: 8, background: `${GOLD}22`, padding: "10px 12px" }}>
          <p style={{ fontSize: 13, color: "#8A6410", marginBottom: 8 }}>
            Este partido está finalizado. Acá podés cambiar equipos, fecha, hora y lugar. Para corregir los puntos, asistencias u otras estadísticas de los jugadores, primero hay que reabrirlo.
          </p>
          <button type="button" onClick={() => { onReopen(); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, color: INK, background: "white", border: `1px solid ${GOLD}`, cursor: "pointer" }}>
            <Unlock size={15} /> Reabrir para editar estadísticas
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
        {cambioDeEquipos && <p style={{ fontSize: 13, color: "#8A6410", background: `${GOLD}22`, padding: "8px 10px", borderRadius: 6 }}>Al cambiar los equipos se borrarán las estadísticas de los equipos que salen del partido.</p>}
        {error && <p style={{ fontSize: 14, fontWeight: 500, color: RED }}>{error}</p>}
      </div>
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
      <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 800 }}>¿Borrar partido?</h3>
      <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>
        Se eliminará <strong>{teamName(db, match.equipo_a_id)} vs {teamName(db, match.equipo_b_id)}</strong> del {fmtFecha(match.fecha)} con todas sus estadísticas. No se puede deshacer.
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
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        {[["todos", "Todos"], ["en_curso", "En curso"], ["finalizado", "Finalizados"]].map(([val, label]) => (
          <button type="button" key={val} onClick={() => setFilter(val)}
            style={{ borderRadius: 9999, padding: "6px 12px", fontSize: 14, fontWeight: 500, cursor: "pointer", background: filter === val ? INK : "transparent", color: filter === val ? "white" : MUTED, border: `1px solid ${filter === val ? INK : LINE}` }}>
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

  // Dorsal de un jugador en ESTE partido: el fijado para hoy o, si no hay, el habitual.
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
        // Un gol es siempre un tiro convertido: el tiro se suma (o resta) junto con el punto.
        const puntos = Math.max(0, base.puntos + delta);
        const realDelta = puntos - base.puntos;
        base.puntos = puntos;
        base.tiros = Math.max(puntos, base.tiros + realDelta);
      } else if (field === "tiros") {
        base.tiros = Math.max(base.puntos, base.tiros + delta); // nunca menos tiros que goles
      } else {
        base[field] = Math.max(0, base[field] + delta);
      }

      if (field === "rojas" && delta > 0) { base.en_cancha = false; base.zona = null; } // la roja saca al jugador de la cancha

      if (idx === -1) stats.push(base); else stats[idx] = base;
      return { ...prev, stats };
    });
  };

  // Entra un jugador del banco. Si sale otro (saleId) cuenta como cambio y ocupa su zona;
  // si entra a un lugar libre, no cuenta como cambio y se ubica en la zona que tenga lugar para su sexo.
  const entrar = (jugadorId, saleId) => {
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
      let zona;
      if (saleId) {
        const i = buscar(saleId);
        zona = i === -1 ? null : stats[i].zona ?? null;
        tocar(saleId, { en_cancha: false, zona: null });
      } else {
        const adentro = stats
          .filter((st) => st.partido_id === matchId && st.en_cancha)
          .map((st) => { const pl = prev.players.find((x) => x.id === st.jugador_id); return pl && pl.equipo_id === jugador?.equipo_id ? { zona: st.zona, sexo: pl.sexo } : null; })
          .filter(Boolean);
        zona = elegirZona(adentro, jugador?.sexo);
      }
      tocar(jugadorId, { en_cancha: true, zona });
      const key = jugador?.equipo_id === match.equipo_a_id ? "cambios_a" : "cambios_b";
      const matches = saleId ? prev.matches.map((m) => (m.id === matchId ? { ...m, [key]: (m[key] || 0) + 1 } : m)) : prev.matches;
      return { ...prev, stats, matches };
    });
  };

  // Sacar de la cancha sin registrar cambio (corregir un error de carga).
  const sacar = (jugadorId) => {
    if (finalized) return;
    commit((prev) => ({
      ...prev,
      stats: prev.stats.map((st) => (st.partido_id === matchId && st.jugador_id === jugadorId ? { ...st, en_cancha: false, zona: null } : st)),
    }));
  };

  // Rotación de zonas: los de ataque pasan a defensa y al revés.
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
      // Al finalizar, el dorsal de cada jugador queda fijo en la historia del partido.
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
            <span style={{ borderRadius: 9999, padding: "4px 12px", fontSize: 12, fontWeight: 700, background: finalized ? "#E9EEF0" : `${GOLD}33`, color: finalized ? MUTED : "#8A6410" }}>{finalized ? "Finalizado" : "En curso"}</span>
            {canEdit && finalized && (
              <button type="button" onClick={reabrir} title="Reabrir para editar estadísticas" style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 6, padding: "8px 10px", fontSize: 12, fontWeight: 700, color: INK, background: `${GOLD}33`, border: "none", cursor: "pointer" }}>
                <Unlock size={14} /> Editar estadísticas
              </button>
            )}
            {canEdit && <button type="button" onClick={() => setEditOpen(true)} title="Editar datos del partido" style={{ borderRadius: 6, padding: 8, background: CHIP, border: "none", cursor: "pointer" }}><Pencil size={16} /></button>}
            {canEdit && <button type="button" onClick={() => setDeleteOpen(true)} title="Borrar partido" style={{ borderRadius: 6, padding: 8, background: "transparent", border: `1px solid ${LINE}`, cursor: "pointer" }}><Trash2 size={16} color={RED} /></button>}
          </div>
        } />

      <div className="live-scoreboard" style={{ marginBottom: 16, overflow: "hidden", borderRadius: 16, background: INK }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 16px", fontSize: 12, color: "#9AA7B2" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} /> {fmtFecha(match.fecha)} {match.hora ? `· ${match.hora}` : ""}</span>
          {match.lugar && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {match.lugar}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, padding: "8px 16px 20px" }}>
          <div style={{ textAlign: "left", minWidth: 0 }}><p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700, color: COLOR_A.ring }}>{teamName(db, match.equipo_a_id)}</p></div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <span style={{ fontFamily: "monospace", fontSize: 40, fontWeight: 900, color: "white" }}>{scoreA}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#5A6570" }}>–</span>
            <span style={{ fontFamily: "monospace", fontSize: 40, fontWeight: 900, color: "white" }}>{scoreB}</span>
          </div>
          <div style={{ textAlign: "right", minWidth: 0 }}><p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700, color: COLOR_B.ring }}>{teamName(db, match.equipo_b_id)}</p></div>
        </div>
      </div>

      {canEdit && !finalized && <p style={{ marginBottom: 12, fontSize: 13, color: MUTED }}>Tocá un jugador en cancha y después la acción. Para cambiar un número, tocá su dorsal.</p>}

      <div className="team-tabs" role="tablist">
        {[["a", match.equipo_a_id, COLOR_A], ["b", match.equipo_b_id, COLOR_B]].map(([k, tid, col]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            style={{ flex: 1, minWidth: 0, minHeight: 44, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRadius: 10, padding: "0 10px", fontWeight: 700, cursor: "pointer", border: tab === k ? `2px solid ${col.ring}` : `1px solid ${LINE}`, background: tab === k ? col.bg : "white", color: tab === k ? col.text : MUTED }}>
            {teamName(db, tid)}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2" style={{ alignItems: "start" }}>
        <div className="team-panel" data-active={tab === "a"}>
          <LiveTeamPanel db={db} match={match} teamId={match.equipo_a_id} equipoKey="a" color={COLOR_A} readOnly={finalized || !canEdit}
            getStat={getStat} bump={bump} entrar={entrar} sacar={sacar} ajustarCambios={ajustarCambios} onEditDorsal={setDorsalTarget} setView={setView} setToast={setToast} rotarZonas={rotarZonas} moverZona={moverZona} setSexo={setSexo} />
        </div>
        <div className="team-panel" data-active={tab === "b"}>
          <LiveTeamPanel db={db} match={match} teamId={match.equipo_b_id} equipoKey="b" color={COLOR_B} readOnly={finalized || !canEdit}
            getStat={getStat} bump={bump} entrar={entrar} sacar={sacar} ajustarCambios={ajustarCambios} onEditDorsal={setDorsalTarget} setView={setView} setToast={setToast} rotarZonas={rotarZonas} moverZona={moverZona} setSexo={setSexo} />
        </div>
      </div>

      <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
        {!canEdit ? null : finalized ? (
          <button type="button" onClick={reabrir} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 12, padding: "12px 20px", fontSize: 15, fontWeight: 700, color: INK, background: CHIP, border: `1px solid ${LINE}`, cursor: "pointer" }}>
            <Unlock size={18} /> Reabrir para corregir estadísticas
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 12, padding: "14px 24px", fontSize: 16, fontWeight: 700, color: "white", background: RED, border: "none", cursor: "pointer" }}>
            <Trophy size={18} /> Finalizar partido
          </button>
        )}
      </div>

      {confirmOpen && (
        <Modal onClose={() => setConfirmOpen(false)}>
          <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 800 }}>¿Finalizar el partido?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>¿Está seguro de que desea finalizar el partido? Las estadísticas quedarán guardadas. Si necesitás corregir algo, vas a poder reabrirlo desde esta misma pantalla.</p>
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
  const carta = (bg, k) => <span key={k} style={{ display: "inline-block", width: 9, height: 13, borderRadius: 2, background: bg, border: "1px solid rgba(0,0,0,0.25)" }} />;
  return (
    <span style={{ display: "inline-flex", gap: 3, marginLeft: 6, verticalAlign: "middle" }} aria-label={`${s.amarillas} amarilla(s), ${s.rojas} roja(s)`}>
      {Array.from({ length: s.amarillas }, (_, i) => carta("#F2C200", `a${i}`))}
      {Array.from({ length: s.rojas }, (_, i) => carta("#D32F2F", `r${i}`))}
    </span>
  );
}

function FilaJugador({ p, s, color, selected, onSelect, onEditDorsal, right, atenuado }) {
  const dorsal = s.dorsal ?? p.numero;
  const cambiado = s.dorsal != null && s.dorsal !== p.numero;
  const badge = { display: "flex", height: 34, minWidth: 38, padding: "0 6px", flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 8, boxSizing: "border-box", background: color.bg, color: color.text, fontFamily: "monospace", fontSize: 15, fontWeight: 800, border: cambiado ? `2px solid ${GOLD}` : "2px solid transparent" };
  return (
    <div onClick={onSelect} tabIndex={onSelect ? 0 : undefined} onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } } : undefined}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 10, boxSizing: "border-box", cursor: onSelect ? "pointer" : "default", opacity: atenuado ? 0.6 : 1,
        border: selected ? `2px solid ${color.ring}` : `1px solid ${LINE}`, background: selected ? color.bg : "white" }}>
      {onEditDorsal ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onEditDorsal(p); }} title="Cambiar el dorsal solo en este partido" aria-label={`Dorsal de ${verNombre(p.nombre)}: tocar para cambiarlo`} style={{ ...badge, cursor: "pointer" }}>{dorsal ?? "–"}</button>
      ) : <span style={badge}>{dorsal ?? "–"}</span>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14, fontWeight: 700 }}>{SEXO[p.sexo] && <span aria-label={SEXO[p.sexo].nombre} style={{ marginRight: 4, color: SEXO[p.sexo].color, fontWeight: 800 }}>{SEXO[p.sexo].sim}</span>}{verNombre(p.nombre)}<Tarjetas s={s} /></p>
        <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: MUTED }}>{cambiado ? `habitual ${p.numero ?? "–"} · ` : ""}{resumenStats(s)}</p>
      </div>
      {right}
    </div>
  );
}

function LiveTeamPanel({ db, match, teamId, equipoKey, color, readOnly, getStat, bump, entrar, sacar, ajustarCambios, onEditDorsal, setView, setToast, rotarZonas, moverZona, setSexo }) {
  const [selId, setSelId] = useState(null);
  const [corregir, setCorregir] = useState(false);
  const [entraId, setEntraId] = useState(null);
  const [verTodos, setVerTodos] = useState(false);

  const players = db.players.filter((p) => p.equipo_id === teamId).sort(porApellido);
  const info = players.map((p) => ({ p, s: getStat(p.id), jugo: db.stats.some((st) => st.partido_id === match.id && st.jugador_id === p.id) }));
  const enCancha = info.filter((x) => x.s.en_cancha);
  const resto = info.filter((x) => !x.s.en_cancha);
  const cambios = match[`cambios_${equipoKey}`] || 0;
  const sel = enCancha.find((x) => x.p.id === selId) || null;
  const ataque = enCancha.filter((x) => x.s.zona === "ataque");
  const defensa = enCancha.filter((x) => x.s.zona === "defensa");
  const sinZona = enCancha.filter((x) => x.s.zona !== "ataque" && x.s.zona !== "defensa");
  const tot = info.reduce((a, x) => ({ fp: a.fp + x.s.free_pass, pen: a.pen + x.s.penales, am: a.am + x.s.amarillas, ro: a.ro + x.s.rojas }), { fp: 0, pen: 0, am: 0, ro: 0 });
  const dorsalDe = (x) => x.s.dorsal ?? x.p.numero ?? "–";

  const aplicar = (a) => {
    if (!sel) return;
    const delta = corregir ? -1 : 1;
    bump(sel.p.id, a.field, delta);
    if (corregir) setCorregir(false);
    if (delta > 0 && a.field === "rojas") { setToast?.(`Roja para ${verNombre(sel.p.nombre)}: sale de la cancha y no puede volver.`); setSelId(null); }
    if (delta > 0 && a.field === "amarillas" && sel.s.amarillas + 1 >= 2) setToast?.(`2ª amarilla para ${verNombre(sel.p.nombre)}.`);
  };

  const pedirEntrada = (x) => {
    if (enCancha.length < EN_CANCHA) { entrar(x.p.id, null); setSelId(x.p.id); } // lugar libre: no cuenta como cambio
    else { setVerTodos(false); setEntraId(x.p.id); }
  };

  const filaEnCancha = (x) => (
    <FilaJugador key={x.p.id} p={x.p} s={x.s} color={color} selected={sel?.p.id === x.p.id}
      onSelect={readOnly ? undefined : () => setSelId(sel?.p.id === x.p.id ? null : x.p.id)} onEditDorsal={readOnly ? undefined : onEditDorsal}
      right={readOnly ? null : (
        <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button type="button" aria-label={`Pasar a ${x.s.zona === "ataque" ? "defensa" : "ataque"} a ${verNombre(x.p.nombre)}`} title={`Pasar a ${x.s.zona === "ataque" ? "defensa" : "ataque"}`} onClick={(e) => { e.stopPropagation(); moverZona(x.p.id); }} style={{ ...chico, background: CHIP }}><ArrowUpDown size={15} /></button>
          <button type="button" aria-label={`Sacar de la cancha a ${verNombre(x.p.nombre)} sin contar cambio`} title="Sacar de la cancha (sin contar cambio)" onClick={(e) => { e.stopPropagation(); sacar(x.p.id); }} style={{ ...chico, background: CHIP }}><X size={15} /></button>
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
        <p style={{ margin: "2px 2px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: FAINT }}>
          <span>{titulo}{conTope ? ` (${lista.length}/${POR_ZONA})` : ""}</span>
          {conTope && <span style={{ color: excedido ? RED : completo ? GREEN : MUTED }}>{SEXO.varon.sim} {v}/{POR_SEXO} · {SEXO.mujer.sim} {m}/{POR_SEXO}</span>}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{lista.map(filaEnCancha)}</div>
      </div>
    );
  };

  const chico = { display: "flex", alignItems: "center", justifyContent: "center", height: 30, width: 30, borderRadius: 8, border: "none", background: "white", cursor: "pointer" };
  const entraJugador = entraId ? players.find((p) => p.id === entraId) : null;
  const mismoSexo = (x) => !entraJugador?.sexo || !x.p.sexo || x.p.sexo === entraJugador.sexo;
  const candidatos = verTodos ? enCancha : enCancha.filter(mismoSexo);

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${LINE}`, background: "white" }}>
      <div style={{ borderTopLeftRadius: 11, borderTopRightRadius: 11, padding: "10px 12px", background: color.bg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h3 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 800, color: color.text }}>{teamName(db, teamId)}</h3>
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: color.text }}>En cancha {enCancha.length}/{EN_CANCHA}</span>
        </div>
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, color: color.text }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Cambios <strong style={{ color: cambios > MAX_CAMBIOS ? RED : color.text }}>{cambios}/{MAX_CAMBIOS}</strong>
            {!readOnly && <>
              <button type="button" aria-label="Restar un cambio" disabled={cambios === 0} onClick={() => ajustarCambios(equipoKey, -1)} style={{ ...chico, opacity: cambios === 0 ? 0.4 : 1 }}><Minus size={14} /></button>
              <button type="button" aria-label="Sumar un cambio" onClick={() => ajustarCambios(equipoKey, 1)} style={chico}><Plus size={14} /></button>
            </>}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>FP {tot.fp} · Pen {tot.pen} · 🟨 {tot.am} · 🟥 {tot.ro}</span>
        </div>
        {!readOnly && enCancha.length > 0 && (
          <button type="button" onClick={() => rotarZonas(teamId)} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, minHeight: 36, borderRadius: 8, border: "none", background: "white", padding: "0 12px", fontSize: 13, fontWeight: 700, color: color.text, cursor: "pointer" }}>
            <Repeat size={15} /> Rotar zonas (ataque ⇄ defensa)
          </button>
        )}
      </div>

      {players.length === 0 ? (
        <div style={{ padding: 16 }}>
          <EmptyState text="Este equipo todavía no tiene jugadores cargados."
            action={!readOnly ? <button type="button" onClick={() => setView({ name: "teams", teamId })} style={{ ...btnPrimary, marginTop: 12, fontSize: 14 }}>Agregar jugadores</button> : null} />
        </div>
      ) : (
        <div style={{ padding: 10 }}>
          {enCancha.length === 0 && !readOnly && <p style={{ padding: "4px 4px 10px", fontSize: 13, color: MUTED }}>Elegí quiénes arrancan: tocá <strong>Entrar</strong> en los jugadores del banco (hasta {EN_CANCHA}: {POR_SEXO} varones y {POR_SEXO} mujeres en ataque, y lo mismo en defensa). Se ubican solos en cada zona.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(!readOnly || ataque.length > 0) && bloque("Ataque", ataque)}
            {(!readOnly || defensa.length > 0) && bloque("Defensa", defensa)}
            {sinZona.length > 0 && bloque("En cancha (sin zona)", sinZona, false)}
          </div>

          {readOnly ? (
            <>
              {resto.some((x) => x.jugo) && <p style={{ margin: "14px 2px 6px", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: FAINT }}>Jugaron</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {resto.filter((x) => x.jugo).map((x) => <FilaJugador key={x.p.id} p={x.p} s={x.s} color={color} />)}
              </div>
              {resto.some((x) => !x.jugo) && <p style={{ margin: "14px 2px 0", fontSize: 12, color: MUTED }}>No jugaron: {resto.filter((x) => !x.jugo).map((x) => verNombre(x.p.nombre)).join(" · ")}</p>}
            </>
          ) : (
            <>
              <p style={{ margin: "14px 2px 6px", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: FAINT }}>Banco ({resto.length})</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {resto.map((x) => {
                  const expulsado = x.s.rojas > 0;
                  return (
                    <FilaJugador key={x.p.id} p={x.p} s={x.s} color={color} atenuado={expulsado} onEditDorsal={onEditDorsal}
                      right={expulsado
                        ? <span style={{ flexShrink: 0, padding: "0 8px", fontSize: 12, fontWeight: 700, color: RED }}>Expulsado</span>
                        : <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {!x.p.sexo && ["varon", "mujer"].map((k) => (
                            <button key={k} type="button" aria-label={`Es ${SEXO[k].nombre.toLowerCase()}`} title={`Marcar como ${SEXO[k].nombre.toLowerCase()}`} onClick={() => setSexo(x.p.id, k)} style={{ ...chico, background: CHIP, color: SEXO[k].color, fontSize: 16, fontWeight: 800 }}>{SEXO[k].sim}</button>
                          ))}
                          <button type="button" onClick={() => pedirEntrada(x)} style={{ minHeight: 40, borderRadius: 8, border: "none", padding: "0 14px", fontWeight: 700, color: "white", background: color.bar, cursor: "pointer" }}>Entrar</button>
                        </span>} />
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {!readOnly && players.length > 0 && (
        <div style={{ position: "sticky", bottom: 0, zIndex: 20, borderTop: `1px solid ${LINE}`, borderBottomLeftRadius: 11, borderBottomRightRadius: 11, background: "white", boxShadow: "0 -6px 16px rgba(0,0,0,0.08)", padding: "8px 10px calc(8px + env(safe-area-inset-bottom, 0px))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
            <p style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: sel ? "#10151C" : MUTED }}>
              {sel ? <><strong style={{ fontFamily: "monospace" }}>{dorsalDe(sel)}</strong> · {verNombre(sel.p.nombre)}</> : "Tocá un jugador en cancha"}
            </p>
            <button type="button" disabled={!sel} aria-pressed={corregir} onClick={() => setCorregir(!corregir)}
              style={{ flexShrink: 0, minHeight: 34, borderRadius: 8, padding: "0 12px", fontSize: 12, fontWeight: 700, cursor: sel ? "pointer" : "default", opacity: sel ? 1 : 0.4, border: corregir ? `1px solid ${RED}` : "1px solid transparent", background: corregir ? "#FBE3E1" : CHIP, color: corregir ? RED : "#10151C" }}>
              − Corregir
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {ACCIONES.map((a) => {
              const bg = corregir ? "#FBE3E1" : a.tono === "gol" ? color.bar : a.tono === "amarilla" ? "#FFF1B8" : a.tono === "roja" ? "#FBE3E1" : a.tono === "falta" ? "#FDF0D5" : CHIP;
              const borde = corregir ? RED : a.tono === "amarilla" ? "#E0B400" : a.tono === "roja" ? RED : "transparent";
              return (
                <button key={a.id} type="button" disabled={!sel} onClick={() => aplicar(a)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, minHeight: 54, minWidth: 0, borderRadius: 10, padding: "4px 2px", border: `1px solid ${borde}`, background: bg, color: !corregir && a.tono === "gol" ? "white" : "#10151C", cursor: sel ? "pointer" : "default", opacity: sel ? 1 : 0.45, touchAction: "manipulation" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{corregir ? "− " : ""}{a.label}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800 }}>{sel ? a.val(sel.s) : "–"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {entraJugador && (
        <Modal onClose={() => setEntraId(null)}>
          <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 800 }}>Cambio</h3>
          <p style={{ marginBottom: 4, fontSize: 14 }}>Entra <strong>{verNombre(entraJugador.nombre)}</strong>. ¿Quién sale?</p>
          <p style={{ marginBottom: 12, fontSize: 13, color: cambios >= MAX_CAMBIOS ? RED : MUTED }}>
            Cambios usados: {cambios} de {MAX_CAMBIOS}{cambios >= MAX_CAMBIOS ? ". Ya no quedan: si elegís a alguien, se registra igual." : "."}
          </p>
          {candidatos.length < enCancha.length && (
            <p style={{ marginBottom: 10, fontSize: 13, color: MUTED }}>Solo se muestran los del mismo sexo ({SEXO[entraJugador.sexo]?.sim}). <button type="button" onClick={() => setVerTodos(true)} style={{ border: "none", background: "transparent", padding: 0, fontWeight: 700, color: color.text, textDecoration: "underline", cursor: "pointer" }}>Ver todos</button></p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {candidatos.map((x) => (
              <button key={x.p.id} type="button" onClick={() => { entrar(entraJugador.id, x.p.id); setSelId(entraJugador.id); setEntraId(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, borderRadius: 10, border: `1px solid ${LINE}`, background: "white", padding: "0 12px", textAlign: "left", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                <span style={{ fontFamily: "monospace", fontWeight: 800, color: color.text }}>{dorsalDe(x)}</span>
                <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{SEXO[x.p.sexo] && <span style={{ marginRight: 4, color: SEXO[x.p.sexo].color }}>{SEXO[x.p.sexo].sim}</span>}Sale {verNombre(x.p.nombre)}{x.s.zona ? ` · ${x.s.zona}` : ""}</span>
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
      <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 800 }}>Dorsal en este partido</h3>
      <p style={{ marginBottom: 14, fontSize: 14, color: MUTED }}>{verNombre(player.nombre)} · habitual: <strong>{habitual ?? "sin número"}</strong>. El cambio vale solo para este partido.</p>
      <input type="number" inputMode="numeric" min="0" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardar()}
        placeholder={habitual != null ? `Habitual: ${habitual}` : "Número de hoy"} style={{ ...inputStyle, fontSize: 18, fontFamily: "monospace" }} />
      {invalido && <p style={{ marginTop: 8, fontSize: 13, color: RED }}>Ingresá un número entero, 0 o mayor.</p>}
      {repetidos.length > 0 && <p style={{ marginTop: 8, fontSize: 13, color: "#8A6410" }}>Ojo: ese número lo tiene {repetidos.map((o) => verNombre(o.nombre)).join(", ")} en este partido. Podés guardarlo igual.</p>}
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

      <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {equipos.map((t) => (
          <button type="button" key={t.id} onClick={() => { setView({ name: "teams", teamId: t.id }); resetForm(); }}
            style={{ borderRadius: 9999, padding: "6px 14px", fontSize: 14, fontWeight: 500, cursor: "pointer", background: selected?.id === t.id ? INK : "transparent", color: selected?.id === t.id ? "white" : MUTED, border: `1px solid ${selected?.id === t.id ? INK : LINE}` }}>
            {t.nombre}
          </button>
        ))}
      </div>

      {canEdit && (
      <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input type="text" value={nuevoEquipo} onChange={(e) => setNuevoEquipo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarEquipo()}
          placeholder="Nombre del nuevo equipo" style={{ ...inputStyle, width: 240, padding: "8px 12px", fontSize: 14 }} />
        <button type="button" onClick={agregarEquipo} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 14 }}>
          <Plus size={16} /> Agregar equipo
        </button>
        {selected && (
          <button type="button" onClick={() => setDeleteTeam(selected)} style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 600, color: RED, background: "transparent", border: `1px solid ${LINE}`, cursor: "pointer" }}>
            <Trash2 size={16} /> Borrar {selected.nombre}
          </button>
        )}
      </div>
      )}

      {!selected ? (
        <EmptyState text="Esta liga todavía no tiene equipos. Agregá el primero arriba." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="lg:flex-row lg:items-start">
          <div style={{ ...cardStyle, flex: 1, minWidth: 0 }}>
            <div style={{ borderBottom: `1px solid ${LINE}`, padding: "12px 16px" }}><h3 style={{ fontWeight: 800 }}>Plantel de {selected.nombre}</h3></div>
            {players.length === 0 ? (
              <div style={{ padding: 16 }}><EmptyState text="Todavía no hay jugadores cargados para este equipo." /></div>
            ) : (
              <div>
                {players.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderBottom: i === players.length - 1 ? "none" : `1px solid ${LINE}` }}>
                    <div style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 8 }}>
                      <span style={{ display: "flex", height: 28, width: 28, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 6, background: CHIP, fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{p.numero ?? "–"}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{SEXO[p.sexo] ? `${SEXO[p.sexo].sim} ` : ""}{verNombre(p.nombre)}</span>
                    </div>
                    {canEdit && (
                    <div style={{ display: "flex", flexShrink: 0, gap: 4 }}>
                      <button type="button" onClick={() => { setEditingId(p.id); setForm({ nombre: verNombre(p.nombre), numero: p.numero == null ? "" : String(p.numero), sexo: p.sexo || "" }); }} aria-label="Editar" style={{ borderRadius: 6, padding: 8, background: "transparent", border: "none", cursor: "pointer" }}><Pencil size={16} /></button>
                      <button type="button" onClick={() => setDeleteTarget(p)} aria-label="Eliminar" style={{ borderRadius: 6, padding: 8, background: "transparent", border: "none", cursor: "pointer" }}><Trash2 size={16} color={RED} /></button>
                    </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
          <div style={{ ...cardStyle, padding: 16, width: "100%" }} className="lg:w-80 lg:shrink-0">
            <h3 style={{ marginBottom: 12, fontWeight: 800 }}>{editingId ? "Editar jugador" : "Agregar jugador"}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Apellido, Nombre</label>
              <input type="text" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} placeholder="Ej: Pérez, Juan" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Número de camiseta (opcional)</label>
              <input type="number" min="0" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} placeholder="Ej: 7 (o vacío)" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Sexo (para ataque y defensa)</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["varon", "♂ Varón"], ["mujer", "♀ Mujer"]].map(([k, t]) => (
                  <button key={k} type="button" aria-pressed={form.sexo === k} onClick={() => setForm((f) => ({ ...f, sexo: f.sexo === k ? "" : k }))}
                    style={{ flex: 1, minHeight: 42, borderRadius: 8, fontWeight: 700, cursor: "pointer", border: form.sexo === k ? `2px solid ${INK}` : `1px solid ${LINE}`, background: form.sexo === k ? CHIP : "white" }}>{t}</button>
                ))}
              </div>
            </div>
            {error && <p style={{ marginBottom: 12, fontSize: 14, fontWeight: 500, color: RED }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={submit} style={{ ...btnPrimary, display: "flex", flex: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 0" }}>
                <Check size={16} /> {editingId ? "Guardar" : "Agregar"}
              </button>
              {editingId && <button type="button" onClick={resetForm} style={{ ...btnGhost, padding: "10px 12px" }}><X size={16} /></button>}
            </div>
          </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 800 }}>¿Eliminar jugador?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>Se eliminará a <strong>{verNombre(deleteTarget.nombre)}</strong> y sus estadísticas en todos los partidos.</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setDeleteTarget(null)} style={btnGhost}>Cancelar</button>
            <button type="button" onClick={() => removePlayer(deleteTarget.id)} style={btnDanger}>Eliminar</button>
          </div>
        </Modal>
      )}

      {deleteTeam && (
        <Modal onClose={() => setDeleteTeam(null)}>
          <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 800 }}>¿Borrar equipo?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>
            Se eliminará <strong>{deleteTeam.nombre}</strong>, todos sus jugadores y los partidos donde participó. No se puede deshacer.
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
    <div style={{ maxWidth: 640 }}>
      <BackBar onBack={() => setView({ name: "home" })} title="Ligas" />
      <p style={{ marginBottom: 16, fontSize: 14, color: MUTED }}>
        Cada liga tiene sus propios equipos, jugadores, partidos y estadísticas. Cambiá de liga desde el selector del menú superior.
      </p>

      {canEdit && (
      <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && crear()}
          placeholder="Nombre de la nueva liga" style={{ ...inputStyle, width: 260, padding: "8px 12px", fontSize: 14 }} />
        <button type="button" onClick={crear} style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 14 }}>
          <Plus size={16} /> Crear liga
        </button>
      </div>
      )}

      <div style={cardStyle}>
        {db.leagues.map((l, i) => {
          const equipos = teamsOf(db, l.id).length;
          const partidos = matchesOf(db, l.id).length;
          const activa = l.id === ligaId;
          return (
            <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", borderBottom: i === db.leagues.length - 1 ? "none" : `1px solid ${LINE}`, background: activa ? "#F7FBFA" : "transparent" }}>
              {editando === l.id ? (
                <div style={{ display: "flex", gap: 8, flex: 1 }}>
                  <input type="text" value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guardarNombre()} style={{ ...inputStyle, padding: "8px 12px", fontSize: 14 }} />
                  <button type="button" onClick={guardarNombre} style={{ ...btnPrimary, padding: "8px 12px" }}><Check size={16} /></button>
                  <button type="button" onClick={() => setEditando(null)} style={{ ...btnGhost, padding: "8px 12px" }}><X size={16} /></button>
                </div>
              ) : (
                <>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                      {l.nombre}
                      {activa && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", background: `${GREEN}22`, color: GREEN, padding: "2px 6px", borderRadius: 4 }}>Activa</span>}
                    </p>
                    <p style={{ fontSize: 12, color: MUTED }}>{equipos} equipo{equipos === 1 ? "" : "s"} · {partidos} partido{partidos === 1 ? "" : "s"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {!activa && <button type="button" onClick={() => { setLigaId(l.id); setView({ name: "home" }); }} style={{ ...btnGhost, fontSize: 13, padding: "6px 12px" }}>Usar</button>}
                    {canEdit && <button type="button" onClick={() => { setEditando(l.id); setNombreEdit(l.nombre); }} style={{ borderRadius: 6, padding: 8, background: "transparent", border: "none", cursor: "pointer" }}><Pencil size={16} /></button>}
                    {canEdit && db.leagues.length > 1 && <button type="button" onClick={() => setDeleteTarget(l)} style={{ borderRadius: 6, padding: 8, background: "transparent", border: "none", cursor: "pointer" }}><Trash2 size={16} color={RED} /></button>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 800 }}>¿Borrar liga?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>
            Se eliminará <strong>{deleteTarget.nombre}</strong> con todos sus equipos, jugadores, partidos y estadísticas. No se puede deshacer.
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

// ---------- estadísticas ----------

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
          byPlayer.set(player.id, { player, partidos: 0, ...Object.fromEntries(STAT_FIELDS.map((f) => [f.key, 0])), ...Object.fromEntries(EXTRA_FIELDS.map((k) => [k, 0])) });
        }
        const agg = byPlayer.get(player.id);
        agg.partidos += 1;
        STAT_FIELDS.forEach((f) => { agg[f.key] += s[f.key]; });
        EXTRA_FIELDS.forEach((k) => { agg[k] += s[k]; });
      }
    }
    return Array.from(byPlayer.values()).sort((a, b) => b.puntos - a.puntos);
  }, [db, teamFilter, playerFilter, seasonFilter, finalizedMatches]);

  const playersForFilter = db.players.filter((p) => {
    const t = db.teams.find((tt) => tt.id === p.equipo_id);
    if (!t || t.liga_id !== ligaId) return false;
    return teamFilter === "todos" || p.equipo_id === teamFilter;
  }).sort(porApellido);

  const selectStyle = { borderRadius: 8, border: `1px solid ${LINE}`, background: "white", padding: "8px 12px", fontSize: 14, outline: "none" };
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
        <button type="button" onClick={exportarAcumuladas} style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 700, color: "white", background: GREEN, border: "none", cursor: "pointer" }}>
          <Download size={16} /> Exportar acumuladas a Excel
        </button>
        <button type="button" onClick={exportarPartidoPorPartido} style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 600, background: CARD, border: `1px solid ${LINE}`, cursor: "pointer" }}>
          <Download size={16} /> Exportar partido por partido
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
                <div key={label} style={{ borderRadius: 8, background: PAPER, padding: "8px 4px", textAlign: "center" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: FAINT }}>{label}</p>
                  <p style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: color || "#10151C" }}>{value}</p>
                  <p style={{ fontFamily: "monospace", fontSize: 11, color: MUTED }}>{sub}</p>
                </div>
              );
              return (
                <div key={r.player.id} style={{ ...cardStyle, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ display: "flex", height: 32, width: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 8, background: i === 0 ? GOLD : CHIP, color: INK, fontFamily: "monospace", fontSize: 14, fontWeight: 800 }}>{i + 1}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{verNombre(r.player.nombre)}</p>
                      <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: MUTED }}>{teamName(db, r.player.equipo_id)} · {r.partidos} PJ</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{r.puntos}</p>
                      <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: FAINT }}>Pts · {(r.puntos / r.partidos).toFixed(1)}/P</p>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {STAT_FIELDS.filter((f) => f.key !== "puntos" && f.key !== "tiros").map((f) => cell(f.short, r[f.key], `${(r[f.key] / r.partidos).toFixed(1)}/P`))}
                    {cell("Tiros", r.tiros, `${(r.tiros / r.partidos).toFixed(1)}/P`)}
                    {cell("Efect.", efect, `${r.puntos}/${r.tiros}`, r.tiros > 0 ? GREEN : FAINT)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="stats-table" style={{ ...cardStyle, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 940, fontSize: 14, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${LINE}`, textAlign: "left", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: FAINT }}>
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
                <tr key={r.player.id} style={{ borderBottom: i === rows.length - 1 ? "none" : `1px solid ${LINE}` }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600 }}>{verNombre(r.player.nombre)}</td>
                  <td style={{ padding: "10px 16px", color: MUTED }}>{teamName(db, r.player.equipo_id)}</td>
                  <td style={{ padding: 10, textAlign: "center", fontFamily: "monospace" }}>{r.partidos}</td>
                  {STAT_FIELDS.map((f) => (
                    <td key={f.key} style={{ padding: 10, textAlign: "center", fontFamily: "monospace", fontWeight: f.key === "puntos" ? 700 : 400 }}>{r[f.key]}</td>
                  ))}
                  <td style={{ padding: 10, textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: r.tiros > 0 ? GREEN : FAINT }}>
                    {r.tiros > 0 ? `${efectividad(r.puntos, r.tiros).toFixed(0)}%` : "—"}
                  </td>
                  {STAT_FIELDS.map((f) => (
                    <td key={`p-${f.key}`} style={{ padding: 10, textAlign: "center", fontFamily: "monospace", color: MUTED }}>{(r[f.key] / r.partidos).toFixed(1)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      <p style={{ marginTop: 8, fontSize: 12, color: FAINT }}>
        Las columnas con "/P" son promedios por partido. La efectividad es goles sobre tiros intentados. Los archivos exportados respetan los filtros aplicados.
      </p>
    </div>
  );
}