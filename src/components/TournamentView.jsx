// src/components/TournamentView.jsx
import React, { useMemo } from "react";
import { Trophy, Calendar, Lock, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { computeLockedBracket } from "../lib/bracketClincher";

const INK = "#0B0C0E";
const SURFACE = "#111317";
const LINE = "#24272E";
const FLUOR = "#CCFF00";
const GOLD = "#D4AF37";
const TEXT = "#F4F4F6";
const MUTED = "#8E939E";
const FAINT = "#525866";

function BracketSeedSlot({ rankLabel, lockedEntry, provisionalEntry, accent = GOLD }) {
  const isLocked = Boolean(lockedEntry);
  const activeRow = lockedEntry || provisionalEntry;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "9px 11px",
        border: `1px solid ${isLocked ? accent : LINE}`,
        background: isLocked ? `${accent}12` : INK,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span
          className="font-mono-tech"
          style={{
            padding: "2px 6px",
            fontSize: 10,
            fontWeight: 800,
            background: isLocked ? accent : SURFACE,
            color: isLocked ? INK : MUTED,
            border: isLocked ? "none" : `1px solid ${LINE}`,
            flexShrink: 0,
          }}
        >
          {rankLabel}
        </span>

        {isLocked ? (
          <span
            className="font-display"
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: TEXT,
              textTransform: "uppercase",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeRow.team.nombre}
          </span>
        ) : (
          <span
            className="font-mono-tech"
            style={{
              fontSize: 11,
              color: MUTED,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeRow ? `Parcial: ${activeRow.team.nombre}` : `${rankLabel} de la Liga`}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {isLocked ? (
          <span
            className="font-mono-tech tabular-nums"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 800,
              color: accent,
            }}
            title={`Puesto ${lockedEntry.status} (${lockedEntry.pts} PTS)`}
          >
            <Lock size={11} /> {lockedEntry.pts}P
          </span>
        ) : (
          <span className="font-mono-tech" style={{ fontSize: 10, color: FAINT }}>
            EN DISPUTA
          </span>
        )}
      </div>
    </div>
  );
}

export default function TournamentView({
  liga,
  teams,
  matches,
  getScore,
  canEdit,
  onOpenMatch,
  onGenerateCupMatches,
}) {
  const regularMatches = useMemo(
    () => matches.filter((m) => (!m.fase || m.fase === "liga") && Number(m.ronda || 1) <= 10),
    [matches]
  );

  const cupMatches = useMemo(
    () => matches.filter((m) => m.fase === "copa" || Number(m.ronda) > 10),
    [matches]
  );

  const {
    standings,
    lockedSlots,
    allRegularFinished,
    finishedCount,
    totalRegularMatches,
  } = useMemo(
    () => computeLockedBracket(teams, regularMatches, getScore),
    [teams, regularMatches, getScore]
  );

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const jornadas = useMemo(() => {
    return Array.from({ length: 10 }, (_, idx) => {
      const rondaNum = idx + 1;
      const list = regularMatches.filter((m) => Number(m.ronda) === rondaNum);
      return {
        numero: rondaNum,
        partidos: list,
      };
    });
  }, [regularMatches]);

  const findCupMatch = (etapa, fallbackRonda, indexInRonda = 0) => {
    const byEtapa = cupMatches.find((m) => m.etapa === etapa);
    if (byEtapa) return byEtapa;
    const byRonda = cupMatches.filter((m) => Number(m.ronda) === fallbackRonda);
    return byRonda[indexInRonda] || null;
  };

  const cf1Match = findCupMatch("CF1", 11, 0);
  const cf2Match = findCupMatch("CF2", 11, 1);
  const sf1Match = findCupMatch("SF1", 12, 0);
  const sf2Match = findCupMatch("SF2", 12, 1);
  const finalMatch = findCupMatch("FINAL", 13, 0);

  const getWinnerTeam = (match) => {
    if (!match || match.estado !== "finalizado") return null;
    const gA = getScore(match.id, match.equipo_a_id);
    const gB = getScore(match.id, match.equipo_b_id);
    if (gA === gB) return null;
    const winId = gA > gB ? match.equipo_a_id : match.equipo_b_id;
    return teamById.get(winId) || null;
  };

  const winnerCF1 = getWinnerTeam(cf1Match);
  const winnerCF2 = getWinnerTeam(cf2Match);
  const winnerSF1 = getWinnerTeam(sf1Match);
  const winnerSF2 = getWinnerTeam(sf2Match);
  const cupChampion = getWinnerTeam(finalMatch);

  const progressPct =
    totalRegularMatches > 0 ? Math.round((finishedCount / totalRegularMatches) * 100) : 0;

  const cuartosReady =
    Boolean(lockedSlots[3] && lockedSlots[6]) || Boolean(lockedSlots[4] && lockedSlots[5]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Encabezado del Torneo */}
      <section
        style={{
          border: `1px solid ${LINE}`,
          background: SURFACE,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <span
              className="font-mono-tech"
              style={{
                display: "inline-block",
                padding: "3px 8px",
                background: FLUOR,
                color: INK,
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.08em",
              }}
            >
              FORMATO OFICIAL // LIGA + COPA
            </span>
            <h1
              className="font-display"
              style={{
                fontSize: "clamp(26px, 4vw, 38px)",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "-0.03em",
                marginTop: 8,
              }}
            >
              {liga.nombre}
            </h1>
            <p className="font-mono-tech" style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
              {teams.length} EQUIPOS · 10 JORNADAS (IDA Y VUELTA) · PLAYOFFS DE COPA
            </p>
          </div>

          <div
            style={{
              minWidth: 230,
              border: `1px solid ${LINE}`,
              background: INK,
              padding: "10px 14px",
            }}
          >
            <div
              className="font-mono-tech tabular-nums"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                marginBottom: 6,
              }}
            >
              <span style={{ color: MUTED }}>FASE REGULAR</span>
              <span style={{ color: allRegularFinished ? FLUOR : TEXT, fontWeight: 800 }}>
                {finishedCount}/{totalRegularMatches} ({progressPct}%)
              </span>
            </div>
            <div style={{ height: 4, background: SURFACE, width: "100%" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: FLUOR,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            borderTop: `1px solid ${LINE}`,
            paddingTop: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Trophy size={18} color={FLUOR} />
            <div>
              <div className="font-display" style={{ fontSize: 14, fontWeight: 800 }}>
                1.° Y 2.° DE LA LIGA
              </div>
              <div className="font-mono-tech" style={{ fontSize: 11, color: MUTED }}>
                Clasifican directo a Semifinales
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Calendar size={18} color={GOLD} />
            <div>
              <div className="font-display" style={{ fontSize: 14, fontWeight: 800 }}>
                3.° VS 6.° Y 4.° VS 5.°
              </div>
              <div className="font-mono-tech" style={{ fontSize: 11, color: MUTED }}>
                Disputan Cuartos de Final a partido único
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={18} color={FLUOR} />
            <div>
              <div className="font-display" style={{ fontSize: 14, fontWeight: 800 }}>
                LLENADO AUTOMÁTICO
              </div>
              <div className="font-mono-tech" style={{ fontSize: 11, color: MUTED }}>
                Bloqueo inmediato por ventaja matemática
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grilla Principal */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* IZQUIERDA: Calendario de 10 Jornadas */}
        <section
          className="col-span-12 xl:col-span-7"
          style={{
            border: `1px solid ${LINE}`,
            background: SURFACE,
            padding: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `1px solid ${LINE}`,
              paddingBottom: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={16} color={FLUOR} />
              <h2
                className="font-display"
                style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase" }}
              >
                CALENDARIO DE LA LIGA (10 JORNADAS)
              </h2>
            </div>
            <span className="font-mono-tech" style={{ fontSize: 11, color: MUTED }}>
              3 PARTIDOS / FECHA
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {jornadas.map((j) => {
              const allDone =
                j.partidos.length === 3 &&
                j.partidos.every((m) => m.estado === "finalizado");

              return (
                <div
                  key={j.numero}
                  style={{
                    border: `1px solid ${allDone ? `${FLUOR}55` : LINE}`,
                    background: INK,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: `1px solid ${LINE}`,
                      paddingBottom: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span
                      className="font-mono-tech"
                      style={{ fontSize: 12, fontWeight: 800, color: FLUOR }}
                    >
                      JORNADA {String(j.numero).padStart(2, "0")}
                    </span>
                    <span
                      className="font-mono-tech"
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        background: allDone ? `${FLUOR}1A` : SURFACE,
                        color: allDone ? FLUOR : MUTED,
                        border: `1px solid ${allDone ? FLUOR : LINE}`,
                      }}
                    >
                      {allDone ? "COMPLETA" : "3 PARTIDOS"}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[0, 1, 2].map((slotIdx) => {
                      const m = j.partidos[slotIdx];
                      if (!m) {
                        return (
                          <div
                            key={slotIdx}
                            className="font-mono-tech"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "6px 8px",
                              background: SURFACE,
                              fontSize: 11,
                              color: FAINT,
                            }}
                          >
                            <span>PARTIDO {slotIdx + 1}</span>
                            <span>POR DEFINIR</span>
                          </div>
                        );
                      }

                      const eqA = teamById.get(m.equipo_a_id)?.nombre || "Equipo A";
                      const eqB = teamById.get(m.equipo_b_id)?.nombre || "Equipo B";
                      const played = m.estado === "finalizado" || m.estado === "en_curso";
                      const scoreA = played ? getScore(m.id, m.equipo_a_id) : "-";
                      const scoreB = played ? getScore(m.id, m.equipo_b_id) : "-";

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onOpenMatch?.(m.id)}
                          className="font-mono-tech tabular-nums"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 6,
                            width: "100%",
                            padding: "6px 8px",
                            background: SURFACE,
                            border: `1px solid ${m.estado === "en_curso" ? FLUOR : "transparent"}`,
                            color: TEXT,
                            fontSize: 11,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {eqA}
                          </span>
                          <span
                            style={{
                              padding: "1px 6px",
                              background: INK,
                              color: m.estado === "en_curso" ? FLUOR : MUTED,
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {scoreA} - {scoreB}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              textAlign: "right",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {eqB}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* DERECHA: Fase de Copa */}
        <aside
          className="col-span-12 xl:col-span-5"
          style={{
            border: `1px solid ${GOLD}66`,
            background: SURFACE,
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `1px solid ${LINE}`,
              paddingBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Trophy size={18} color={GOLD} />
              <div>
                <h2
                  className="font-display"
                  style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase" }}
                >
                  FASE DE COPA // PLAYOFFS
                </h2>
                <p className="font-mono-tech" style={{ fontSize: 10, color: GOLD }}>
                  SE COMPLETA AUTOMÁTICAMENTE AL DEFINIRSE CADA PUESTO
                </p>
              </div>
            </div>
          </div>

          {/* 1. CUARTOS DE FINAL */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              className="font-mono-tech"
              style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: "0.08em" }}
            >
              [01] CUARTOS DE FINAL (3.° AL 6.°)
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ border: `1px solid ${LINE}`, background: "#0E1014", padding: 10 }}>
                <div
                  className="font-mono-tech"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: MUTED,
                    marginBottom: 6,
                  }}
                >
                  <span>CUARTO DE FINAL 1</span>
                  {cf1Match && (
                    <span style={{ color: GOLD }}>
                      {getScore(cf1Match.id, cf1Match.equipo_a_id)} -{" "}
                      {getScore(cf1Match.id, cf1Match.equipo_b_id)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <BracketSeedSlot
                    rankLabel="3.°"
                    lockedEntry={lockedSlots[3]}
                    provisionalEntry={standings[2]}
                    accent={GOLD}
                  />
                  <BracketSeedSlot
                    rankLabel="6.°"
                    lockedEntry={lockedSlots[6]}
                    provisionalEntry={standings[5]}
                    accent={GOLD}
                  />
                </div>
              </div>

              <div style={{ border: `1px solid ${LINE}`, background: "#0E1014", padding: 10 }}>
                <div
                  className="font-mono-tech"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: MUTED,
                    marginBottom: 6,
                  }}
                >
                  <span>CUARTO DE FINAL 2</span>
                  {cf2Match && (
                    <span style={{ color: GOLD }}>
                      {getScore(cf2Match.id, cf2Match.equipo_a_id)} -{" "}
                      {getScore(cf2Match.id, cf2Match.equipo_b_id)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <BracketSeedSlot
                    rankLabel="4.°"
                    lockedEntry={lockedSlots[4]}
                    provisionalEntry={standings[3]}
                    accent={GOLD}
                  />
                  <BracketSeedSlot
                    rankLabel="5.°"
                    lockedEntry={lockedSlots[5]}
                    provisionalEntry={standings[4]}
                    accent={GOLD}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. SEMIFINALES */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              className="font-mono-tech"
              style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: "0.08em" }}
            >
              [02] SEMIFINALES (1.° Y 2.° ESPERAN RIVAL)
            </div>

            <div style={{ border: `1px solid ${LINE}`, background: "#0E1014", padding: 10 }}>
              <div
                className="font-mono-tech"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: MUTED,
                  marginBottom: 6,
                }}
              >
                <span>SEMIFINAL 1</span>
                {sf1Match && (
                  <span style={{ color: GOLD }}>
                    {getScore(sf1Match.id, sf1Match.equipo_a_id)} -{" "}
                    {getScore(sf1Match.id, sf1Match.equipo_b_id)}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <BracketSeedSlot
                  rankLabel="1.°"
                  lockedEntry={lockedSlots[1]}
                  provisionalEntry={standings[0]}
                  accent={FLUOR}
                />
                <div
                  style={{
                    padding: "8px 11px",
                    border: `1px dashed ${winnerCF1 ? GOLD : LINE}`,
                    background: winnerCF1 ? `${GOLD}14` : INK,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span className="font-mono-tech" style={{ fontSize: 11, color: winnerCF1 ? TEXT : MUTED }}>
                    {winnerCF1 ? winnerCF1.nombre.toUpperCase() : "GANADOR CUARTO DE FINAL 1"}
                  </span>
                  <span className="font-mono-tech" style={{ fontSize: 10, color: GOLD }}>
                    CF1
                  </span>
                </div>
              </div>
            </div>

            <div style={{ border: `1px solid ${LINE}`, background: "#0E1014", padding: 10 }}>
              <div
                className="font-mono-tech"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: MUTED,
                  marginBottom: 6,
                }}
              >
                <span>SEMIFINAL 2</span>
                {sf2Match && (
                  <span style={{ color: GOLD }}>
                    {getScore(sf2Match.id, sf2Match.equipo_a_id)} -{" "}
                    {getScore(sf2Match.id, sf2Match.equipo_b_id)}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <BracketSeedSlot
                  rankLabel="2.°"
                  lockedEntry={lockedSlots[2]}
                  provisionalEntry={standings[1]}
                  accent={FLUOR}
                />
                <div
                  style={{
                    padding: "8px 11px",
                    border: `1px dashed ${winnerCF2 ? GOLD : LINE}`,
                    background: winnerCF2 ? `${GOLD}14` : INK,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span className="font-mono-tech" style={{ fontSize: 11, color: winnerCF2 ? TEXT : MUTED }}>
                    {winnerCF2 ? winnerCF2.nombre.toUpperCase() : "GANADOR CUARTO DE FINAL 2"}
                  </span>
                  <span className="font-mono-tech" style={{ fontSize: 10, color: GOLD }}>
                    CF2
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. FINAL */}
          <div
            style={{
              border: `1px solid ${GOLD}`,
              background: `${GOLD}12`,
              padding: 12,
            }}
          >
            <div
              className="font-mono-tech"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                fontWeight: 800,
                color: GOLD,
                marginBottom: 6,
              }}
            >
              <span>[03] FINAL DE COPA</span>
              {finalMatch && (
                <span>
                  {getScore(finalMatch.id, finalMatch.equipo_a_id)} -{" "}
                  {getScore(finalMatch.id, finalMatch.equipo_b_id)}
                </span>
              )}
            </div>
            <div className="font-display" style={{ fontSize: 15, fontWeight: 800, color: TEXT }}>
              {winnerSF1 ? winnerSF1.nombre.toUpperCase() : "Ganador Semifinal 1"}{" "}
              <span style={{ color: GOLD }}>VS</span>{" "}
              {winnerSF2 ? winnerSF2.nombre.toUpperCase() : "Ganador Semifinal 2"}
            </div>
          </div>

          {/* 4. CUADRO DE CAMPEONES */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div
              style={{
                border: `1px solid ${FLUOR}`,
                background: lockedSlots[1] ? FLUOR : `${FLUOR}14`,
                color: lockedSlots[1] ? INK : TEXT,
                padding: 12,
              }}
            >
              <div className="font-mono-tech" style={{ fontSize: 9, fontWeight: 800, opacity: 0.85 }}>
                CAMPEÓN TEMPORADA REGULAR
              </div>
              <div
                className="font-display"
                style={{ fontSize: 15, fontWeight: 900, textTransform: "uppercase", marginTop: 4 }}
              >
                {lockedSlots[1] ? lockedSlots[1].team.nombre : "1.° DE LA LIGA"}
              </div>
            </div>

            <div
              style={{
                border: `1px solid ${GOLD}`,
                background: cupChampion ? GOLD : `${GOLD}14`,
                color: cupChampion ? INK : TEXT,
                padding: 12,
              }}
            >
              <div className="font-mono-tech" style={{ fontSize: 9, fontWeight: 800, opacity: 0.85 }}>
                CAMPEÓN DE LA COPA
              </div>
              <div
                className="font-display"
                style={{ fontSize: 15, fontWeight: 900, textTransform: "uppercase", marginTop: 4 }}
              >
                {cupChampion ? cupChampion.nombre : "GANADOR PLAYOFFS"}
              </div>
            </div>
          </div>

          {canEdit && cuartosReady && cupMatches.length === 0 && onGenerateCupMatches && (
            <button
              type="button"
              onClick={() => onGenerateCupMatches(lockedSlots)}
              className="font-mono-tech"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "12px 14px",
                background: GOLD,
                color: INK,
                border: "none",
                fontSize: 11,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              <Sparkles size={14} /> CREAR PARTIDOS DE CUARTOS EN PLANILLA <ArrowRight size={14} />
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}