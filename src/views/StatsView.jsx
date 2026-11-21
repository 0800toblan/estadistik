import React, { useState, useMemo } from "react";
import { Download } from "lucide-react";
import BackBar from "../components/BackBar";
import { EmptyState } from "../components/CommonModals";
import {
  STAT_FIELDS,
  EXTRA_FIELDS,
  LINE,
  SURFACE,
  INK,
  FLUOR,
  MUTED,
  FAINT,
  CLUB,
  TEXT,
} from "../lib/constants";
import {
  porApellido,
  verNombre,
  fmtFecha,
  descargarCSV,
} from "../lib/formatters";

export default function StatsView({ db, setView, setToast, ligaId, liga, matchesOf, teamsOf, teamName, matchScore, readStat, efectividad }) {
  const [teamFilter, setTeamFilter] = useState("todos");
  const [playerFilter, setPlayerFilter] = useState("todos");
  const [seasonFilter, setSeasonFilter] = useState("todas");

  const cardStyle = { borderRadius: 0, border: `1px solid ${LINE}`, background: SURFACE };
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
  }, [db, teamFilter, playerFilter, seasonFilter, finalizedMatches, readStat]);

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
        [NOTA] &quot;/P&quot; = PROMEDIOS POR PARTIDO · EFECTIVIDAD = GOLES / TIROS INTENTADOS.
      </p>
    </div>
  );
}
