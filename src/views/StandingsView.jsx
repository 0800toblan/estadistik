import React, { useMemo } from "react";
import BackBar from "../components/BackBar";
import { EmptyState } from "../components/CommonModals";
import { computeStandings } from "../lib/standings";
import { LINE, SURFACE, FLUOR, MUTED, FAINT, RED, TEXT } from "../lib/constants";

export default function StandingsView({ db, setView, ligaId, liga, teamsOf, matchesOf, matchScore }) {
  const cardStyle = { borderRadius: 0, border: `1px solid ${LINE}`, background: SURFACE };
  const equipos = useMemo(() => teamsOf(db, ligaId), [db, ligaId, teamsOf]);
  const partidosLiga = useMemo(() => matchesOf(db, ligaId), [db, ligaId, matchesOf]);

  const tabla = useMemo(
    () => computeStandings(equipos, partidosLiga, (mId, tId) => matchScore(db, mId, tId)),
    [equipos, partidosLiga, db, matchScore]
  );

  const partidosFinalizados = partidosLiga.filter((m) => m.estado === "finalizado").length;

  return (
    <div>
      <BackBar
        onBack={() => setView({ name: "home" })}
        title={`Posiciones · ${liga.nombre}`}
        right={
          <span
            className="font-mono-tech tabular-nums"
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 800,
              background: `${FLUOR}1A`,
              color: FLUOR,
              border: `1px solid ${FLUOR}`,
            }}
          >
            {partidosFinalizados} PARTIDOS OFICIALES
          </span>
        }
      />

      <p style={{ marginBottom: 16, fontSize: 14, color: MUTED }}>
        Tabla calculada automáticamente en base a los partidos finalizados de la liga (3 puntos por victoria, 1 por empate).
      </p>

      {equipos.length === 0 ? (
        <EmptyState text="Esta liga no tiene equipos cargados." />
      ) : tabla.length === 0 ? (
        <EmptyState text="No hay equipos en la tabla." />
      ) : (
        <div style={{ ...cardStyle, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 640, fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr
                className="font-mono-tech"
                style={{
                  borderBottom: `1px solid ${LINE}`,
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: MUTED,
                }}
              >
                <th style={{ padding: "12px 16px", width: 50, textAlign: "center" }}>#</th>
                <th style={{ padding: "12px 16px" }}>Equipo</th>
                <th style={{ padding: 10, textAlign: "center" }}>PJ</th>
                <th style={{ padding: 10, textAlign: "center" }}>PG</th>
                <th style={{ padding: 10, textAlign: "center" }}>PE</th>
                <th style={{ padding: 10, textAlign: "center" }}>PP</th>
                <th style={{ padding: 10, textAlign: "center" }}>GF</th>
                <th style={{ padding: 10, textAlign: "center" }}>GC</th>
                <th style={{ padding: 10, textAlign: "center" }}>DIF</th>
                <th style={{ padding: 10, textAlign: "center", color: FLUOR }}>PTS</th>
              </tr>
            </thead>
            <tbody>
              {tabla.map((r, i) => (
                <tr
                  key={r.equipoId}
                  style={{
                    borderBottom: i === tabla.length - 1 ? "none" : `1px solid ${LINE}`,
                    background: i === 0 ? `${FLUOR}0A` : "transparent",
                  }}
                >
                  <td
                    className="font-mono-tech tabular-nums"
                    style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontWeight: 800,
                      color: i === 0 ? FLUOR : MUTED,
                    }}
                  >
                    {i + 1}
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 800, color: TEXT }}>
                    {r.nombre}
                  </td>
                  <td className="font-mono-tech tabular-nums" style={{ padding: 10, textAlign: "center" }}>
                    {r.pj}
                  </td>
                  <td className="font-mono-tech tabular-nums" style={{ padding: 10, textAlign: "center" }}>
                    {r.pg}
                  </td>
                  <td className="font-mono-tech tabular-nums" style={{ padding: 10, textAlign: "center" }}>
                    {r.pe}
                  </td>
                  <td className="font-mono-tech tabular-nums" style={{ padding: 10, textAlign: "center" }}>
                    {r.pp}
                  </td>
                  <td className="font-mono-tech tabular-nums" style={{ padding: 10, textAlign: "center" }}>
                    {r.gf}
                  </td>
                  <td className="font-mono-tech tabular-nums" style={{ padding: 10, textAlign: "center" }}>
                    {r.gc}
                  </td>
                  <td
                    className="font-mono-tech tabular-nums"
                    style={{
                      padding: 10,
                      textAlign: "center",
                      color: r.dif > 0 ? FLUOR : r.dif < 0 ? RED : MUTED,
                    }}
                  >
                    {r.dif > 0 ? `+${r.dif}` : r.dif}
                  </td>
                  <td
                    className="font-mono-tech tabular-nums"
                    style={{
                      padding: 10,
                      textAlign: "center",
                      fontWeight: 900,
                      fontSize: 15,
                      color: FLUOR,
                    }}
                  >
                    {r.pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="font-mono-tech" style={{ marginTop: 10, fontSize: 11, color: FAINT }}>
        [CRITERIO] 3 PTS POR VICTORIA · 1 PT POR EMPATE · DESEMPATE POR DIFERENCIA DE GOLES Y GOLES A FAVOR.
      </p>
    </div>
  );
}
