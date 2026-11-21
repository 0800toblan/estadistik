import { collator } from "./formatters";

/**
 * Calcula la tabla de posiciones estándar de una liga (puntos, PJ, PG, PE, PP, GF, GC, DIF).
 * @param {Array} teams Lista de equipos de la liga
 * @param {Array} matches Lista de partidos de la liga
 * @param {Function} getScore Función (matchId, teamId) => goles
 * @returns {Array} Filas ordenadas de la tabla de posiciones
 */
export function computeStandings(teams, matches, getScore) {
  const tableMap = new Map(
    teams.map((t) => [
      t.id,
      {
        equipoId: t.id,
        nombre: t.nombre,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        dif: 0,
        pts: 0,
      },
    ])
  );

  const finishedMatches = matches.filter((m) => m.estado === "finalizado");

  finishedMatches.forEach((m) => {
    const rowA = tableMap.get(m.equipo_a_id);
    const rowB = tableMap.get(m.equipo_b_id);
    if (!rowA || !rowB) return;

    const gA = getScore(m.id, m.equipo_a_id);
    const gB = getScore(m.id, m.equipo_b_id);

    rowA.pj += 1;
    rowB.pj += 1;
    rowA.gf += gA;
    rowA.gc += gB;
    rowB.gf += gB;
    rowB.gc += gA;

    if (gA > gB) {
      rowA.pg += 1;
      rowA.pts += 3;
      rowB.pp += 1;
    } else if (gB > gA) {
      rowB.pg += 1;
      rowB.pts += 3;
      rowA.pp += 1;
    } else {
      rowA.pe += 1;
      rowB.pe += 1;
      rowA.pts += 1;
      rowB.pts += 1;
    }
  });

  const rows = Array.from(tableMap.values()).map((r) => ({
    ...r,
    dif: r.gf - r.gc,
  }));

  rows.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.dif !== a.dif) return b.dif - a.dif;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return collator.compare(a.nombre, b.nombre);
  });

  return rows;
}
