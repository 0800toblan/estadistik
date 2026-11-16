import { supabase } from "./supabase";

// Columnas de cada tabla. Si sumás una métrica nueva en STAT_FIELDS (App.jsx),
// agregá también la columna en "stats" acá y en una migración SQL nueva.
const COLUMNS = {
  leagues: ["id", "nombre"],
  teams: ["id", "liga_id", "nombre"],
  players: ["id", "equipo_id", "nombre", "numero"],
  matches: ["id", "liga_id", "equipo_a_id", "equipo_b_id", "fecha", "hora", "lugar", "estado", "resultado_equipo_a", "resultado_equipo_b"],
  stats: ["id", "partido_id", "jugador_id", "puntos", "asistencias", "rebotes", "tiros", "robos", "perdidas"],
};
const TABLES = Object.keys(COLUMNS); // orden: padres primero

const pick = (row, cols) => Object.fromEntries(cols.map((c) => [c, row[c] ?? null]));
const same = (a, b) => !!b && Object.keys(a).every((k) => a[k] === b[k]);

// Carga todo en la misma forma que usaba la app: { leagues, teams, players, matches, stats }
export async function loadDb() {
  const out = {};
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select(COLUMNS[t].join(",")).limit(10000);
    if (error) throw error;
    out[t] = data;
  }
  return out;
}

// Guarda solo lo que cambió entre dos fotos de la base (altas/ediciones y bajas).
export async function saveDiff(prev, next) {
  const before = prev || { leagues: [], teams: [], players: [], matches: [], stats: [] };

  for (const t of TABLES) {
    const old = new Map((before[t] || []).map((r) => [r.id, pick(r, COLUMNS[t])]));
    const changed = (next[t] || []).map((r) => pick(r, COLUMNS[t])).filter((r) => !same(r, old.get(r.id)));
    if (changed.length) {
      const { error } = await supabase.from(t).upsert(changed);
      if (error) throw error;
    }
  }

  for (const t of [...TABLES].reverse()) {
    const keep = new Set((next[t] || []).map((r) => r.id));
    const removed = (before[t] || []).map((r) => r.id).filter((id) => !keep.has(id));
    for (let i = 0; i < removed.length; i += 50) {
      const { error } = await supabase.from(t).delete().in("id", removed.slice(i, i + 50));
      if (error) throw error;
    }
  }
}
