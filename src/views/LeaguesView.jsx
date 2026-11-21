import React, { useState, useEffect } from "react";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";
import BackBar from "../components/BackBar";
import { Modal } from "../components/CommonModals";
import { supabase } from "../lib/supabase";
import { isSuperAdmin, LINE, SURFACE, ELEVATED, INK, FLUOR, MUTED, RED } from "../lib/constants";

export default function LeaguesView({ db, commit, setView, setLigaId, ligaId, setToast, isAdmin, isLigaOrganizer, userId, teamsOf, matchesOf, uid }) {
  const [nombre, setNombre] = useState("");
  const [editando, setEditando] = useState(null);
  const [nombreEdit, setNombreEdit] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cuentas, setCuentas] = useState([]);

  const cardStyle = { borderRadius: 0, border: `1px solid ${LINE}`, background: SURFACE };
  const inputStyle = {
    width: "100%",
    borderRadius: 0,
    border: `1px solid ${LINE}`,
    background: INK,
    color: "#F4F4F6",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
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
    color: "#F4F4F6",
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

  useEffect(() => {
    if (!isAdmin) return;
    supabase.functions
      .invoke("manage-organizers", { body: { action: "list" } })
      .then(({ data }) => {
        if (data?.organizers) {
          setCuentas(data.organizers.filter((o) => !isSuperAdmin(o.email)));
        }
      });
  }, [isAdmin]);

  const crear = () => {
    if (!isAdmin) return;
    const n = nombre.trim();
    if (!n) return;
    const id = uid("l");
    commit((prev) => ({ ...prev, leagues: [...prev.leagues, { id, nombre: n, organizador_id: null }] }));
    setNombre("");
    setLigaId(id);
    setView({ name: "teams" });
    setToast("Liga creada. Cargá sus equipos.");
  };

  const asignarOrganizador = async (targetLigaId, targetUserId) => {
    if (!isAdmin) return;
    if (targetUserId) {
      await supabase.from("organizers").update({ rol: "organizador" }).eq("user_id", targetUserId);
    }
    commit((prev) => ({
      ...prev,
      leagues: prev.leagues.map((l) =>
        l.id === targetLigaId ? { ...l, organizador_id: targetUserId || null } : l
      ),
    }));
    setToast(targetUserId ? "Organizador asignado a la liga." : "Organizador quitado de la liga.");
  };

  const guardarNombre = () => {
    const target = db.leagues.find((l) => l.id === editando);
    const puedeRenombrar = isAdmin || (isLigaOrganizer && target && (target.organizador_id === userId || !target.organizador_id));
    if (!puedeRenombrar) return;
    const n = nombreEdit.trim();
    if (!n) return;
    commit((prev) => ({ ...prev, leagues: prev.leagues.map((l) => (l.id === editando ? { ...l, nombre: n } : l)) }));
    setEditando(null);
  };

  const borrar = (liga) => {
    if (!isAdmin) return;
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

      {isAdmin && (
        <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crear()}
            placeholder="Nombre de la nueva liga"
            style={{ ...inputStyle, width: 280, padding: "8px 12px" }}
          />
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
          const orgAsignado = cuentas.find((c) => c.user_id === l.organizador_id);
          const puedeEditarEsta = isAdmin || (isLigaOrganizer && (l.organizador_id === userId || !l.organizador_id));

          return (
            <div
              key={l.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "14px 16px",
                borderBottom: i === db.leagues.length - 1 ? "none" : `1px solid ${LINE}`,
                background: activa ? ELEVATED : "transparent",
              }}
            >
              {editando === l.id && puedeEditarEsta ? (
                <div style={{ display: "flex", gap: 8, flex: 1 }}>
                  <input
                    type="text"
                    value={nombreEdit}
                    onChange={(e) => setNombreEdit(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && guardarNombre()}
                    style={{ ...inputStyle, padding: "8px 12px" }}
                  />
                  <button type="button" onClick={guardarNombre} style={{ ...btnPrimary, padding: "8px 12px" }}>
                    <Check size={15} />
                  </button>
                  <button type="button" onClick={() => setEditando(null)} style={{ ...btnGhost, padding: "8px 12px" }}>
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <p className="font-display" style={{ fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                        {l.nombre}
                        {activa && (
                          <span className="font-mono-tech" style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", background: FLUOR, color: INK, padding: "2px 6px" }}>
                            ACTIVA
                          </span>
                        )}
                      </p>
                      <p className="font-mono-tech tabular-nums" style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                        {equipos} EQUIPO{equipos === 1 ? "" : "S"} · {partidos} PARTIDO{partidos === 1 ? "" : "S"}
                        {orgAsignado ? ` · ORG: ${orgAsignado.email}` : ""}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {!activa && (
                        <button type="button" onClick={() => { setLigaId(l.id); setView({ name: "home" }); }} style={{ ...btnGhost, fontSize: 11, padding: "6px 12px" }}>
                          USAR
                        </button>
                      )}
                      {puedeEditarEsta && (
                        <button type="button" onClick={() => { setEditando(l.id); setNombreEdit(l.nombre); }} style={{ padding: 8, background: "transparent", color: "#F4F4F6", border: "none", cursor: "pointer" }}>
                          <Pencil size={15} />
                        </button>
                      )}
                      {isAdmin && db.leagues.length > 1 && (
                        <button type="button" onClick={() => setDeleteTarget(l)} style={{ padding: 8, background: "transparent", border: "none", cursor: "pointer" }}>
                          <Trash2 size={15} color={RED} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isAdmin && cuentas.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: `1px dashed ${LINE}` }}>
                      <span className="font-mono-tech" style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>ORGANIZADOR:</span>
                      <select
                        value={l.organizador_id || ""}
                        onChange={(e) => asignarOrganizador(l.id, e.target.value)}
                        className="font-mono-tech"
                        style={{ ...inputStyle, padding: "5px 8px", fontSize: 11, color: l.organizador_id ? FLUOR : MUTED }}
                      >
                        <option value="">Sin organizador específico</option>
                        {cuentas.map((c) => (
                          <option key={c.user_id} value={c.user_id}>{c.email}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {deleteTarget && isAdmin && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <h3 className="font-display" style={{ marginBottom: 8, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>¿Borrar liga?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>
            Se eliminará <strong style={{ color: "#F4F4F6" }}>{deleteTarget.nombre}</strong> con todos sus equipos, jugadores, partidos y estadísticas.
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
