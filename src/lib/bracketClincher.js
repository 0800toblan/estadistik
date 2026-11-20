function canFinishAhead(challenger, defender) {
  if (challenger.maxPts > defender.pts) return true;
  if (challenger.maxPts < defender.pts) return false;

  if (challenger.rem === 0 && defender.rem === 0) {
    if (challenger.dg !== defender.dg) return challenger.dg > defender.dg;
    if (challenger.gf !== defender.gf) return challenger.gf > defender.gf;
    return false;
  }

  return true;
}

export function computeLockedBracket(teams, regularMatches, getScore) {
  const totalTeams = teams.length;
  const matchesPerTeam = Math.max(0, (totalTeams - 1) * 2);
  const totalRegularMatches = (totalTeams * matchesPerTeam) / 2;

  const finishedMatches = regularMatches.filter((m) => m.estado === "finalizado");
  const allRegularFinished =
    totalRegularMatches > 0 && finishedMatches.length >= totalRegularMatches;

  const tableMap = new Map(
    teams.map((t) => [
      t.id,
      {
        team: t,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        dg: 0,
        pts: 0,
        rem: matchesPerTeam,
      },
    ])
  );

  finishedMatches.forEach((m) => {
    const rowA = tableMap.get(m.equipo_a_id);
    const rowB = tableMap.get(m.equipo_b_id);
    if (!rowA || !rowB) return;

    const gA = getScore(m.id, m.equipo_a_id);
    const gB = getScore(m.id, m.equipo_b_id);

    rowA.pj += 1;
    rowB.pj += 1;
    rowA.rem = Math.max(0, matchesPerTeam - rowA.pj);
    rowB.rem = Math.max(0, matchesPerTeam - rowB.pj);

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

  const standings = Array.from(tableMap.values())
    .map((r) => ({
      ...r,
      dg: r.gf - r.gc,
      maxPts: r.pts + r.rem * 3,
    }))
    .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);

  const lockedSlots = {};
  const top2ClinchedIds = new Set();

  standings.forEach((row, idx) => {
    const rank = idx + 1;

    const rivalsThatCanPass = standings.filter(
      (other) => other.team.id !== row.team.id && canFinishAhead(other, row)
    ).length;

    if ((allRegularFinished && rank <= 2) || (rivalsThatCanPass <= 1 && row.pj > 0)) {
      top2ClinchedIds.add(row.team.id);
    }

    if (allRegularFinished) {
      lockedSlots[rank] = { ...row, rank, status: "FINALIZADO" };
      return;
    }

    const canOvertakeAbove = standings
      .slice(0, idx)
      .some((above) => canFinishAhead(row, above));

    const canBeOvertakenBelow = standings
      .slice(idx + 1)
      .some((below) => canFinishAhead(below, row));

    if (!canOvertakeAbove && !canBeOvertakenBelow && row.pj > 0) {
      lockedSlots[rank] = { ...row, rank, status: "ASEGURADO" };
    } else {
      lockedSlots[rank] = null;
    }
  });

  return {
    standings,
    lockedSlots,
    top2ClinchedIds,
    allRegularFinished,
    finishedCount: finishedMatches.length,
    totalRegularMatches,
  };
}