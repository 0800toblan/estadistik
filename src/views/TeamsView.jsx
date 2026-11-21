import React, { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import BackBar from "../components/BackBar";
import { EmptyState, Modal } from "../components/CommonModals";
import { SEXO, LINE, SURFACE, ELEVATED, INK, FLUOR, MUTED, RED } from "../lib/constants";
import { porApellido, verNombre } from "../lib/formatters";

export default function TeamsView({ db, commit, setView, teamId, ligaId, liga, canEdit, isAdmin, isLigaOrganizer, setToast, teamsOf, uid }) {
  const equipos = teamsOf(db, ligaId);
  const selected = equipos.find((t) => t.id === teamId) || equipos[0] || null;
  const gestionaLiga = Boolean(isAdmin || isLigaOrganizer);
  const [form, setForm] = useState({ nombre: "", numero: "", sexo: "" });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [nuevoEquipo, setNuevoEquipo] = useState("");
  const [deleteTeam, setDeleteTeam] = useState(null);

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

  const players = selected ? db.players.filter((p) => p.equipo_id === selected.id).sort(porApellido) : [];
  const resetForm = () => { setForm({ nombre: "", numero: "", sexo: "" }); setEditingId(null); setError(""); };

  const agregarEquipo = () => {
    if (!gestionaLiga) return;
    const nombre = nuevoEquipo.trim();
    if (!nombre) return;
    const id = uid("t");
    commit((prev) => ({ ...prev, teams: [...prev.teams, { id, nombre, liga_id: ligaId }] }));
    setNuevoEquipo("");
    setView({ name: "teams", teamId: id });
  };

  const borrarEquipo = (team) => {
    if (!gestionaLiga) return;
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
    if (!selected || !canEdit) return;
    if (!form.nombre.trim()) { setError("Completá apellido y nombre."); return; }
    const rawNum = String(form.numero ?? "").trim();
    if (rawNum !== "" && !/^\d{1,3}$/.test(rawNum)) { setError("El número debe tener solo dígitos (ej: 00, 7, 12)."); return; }
    const numero = rawNum === "" ? null : rawNum;
    const nombre = verNombre(form.nombre);
    if (editingId) {
      if (!gestionaLiga) {
        setToast("Solo el organizador o administrador puede modificar jugadores existentes.");
        resetForm();
        return;
      }
      commit((prev) => ({ ...prev, players: prev.players.map((p) => (p.id === editingId ? { ...p, nombre, numero, sexo: form.sexo || null } : p)) }));
    } else {
      commit((prev) => ({ ...prev, players: [...prev.players, { id: uid("p"), nombre, numero, sexo: form.sexo || null, equipo_id: selected.id }] }));
      setToast(`Jugador ${nombre} agregado a ${selected.nombre}.`);
    }
    resetForm();
  };

  const removePlayer = (id) => {
    if (!gestionaLiga) return;
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

      {gestionaLiga && (
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
        <EmptyState text={gestionaLiga ? "Esta liga todavía no tiene equipos. Agregá el primero arriba." : "Esta liga todavía no tiene equipos cargados."} />
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
                    {gestionaLiga && (
                      <div style={{ display: "flex", flexShrink: 0, gap: 4 }}>
                        <button type="button" onClick={() => { setEditingId(p.id); setForm({ nombre: verNombre(p.nombre), numero: p.numero == null ? "" : String(p.numero), sexo: p.sexo || "" }); }} aria-label="Editar" style={{ padding: 8, background: "transparent", color: "#F4F4F6", border: "none", cursor: "pointer" }}><Pencil size={15} /></button>
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
              <h3 className="font-display" style={{ marginBottom: 6, fontSize: 17, fontWeight: 900, textTransform: "uppercase" }}>
                {editingId && gestionaLiga ? "Editar jugador" : "Agregar jugador"}
              </h3>
              {!gestionaLiga && (
                <p className="font-mono-tech" style={{ marginBottom: 12, fontSize: 10, color: MUTED, lineHeight: 1.4 }}>
                  [PLANILLERO] ALTA HABILITADA PARA JUGADORES NUEVOS. EDICIÓN O BAJA SOLO POR ORGANIZADOR.
                </p>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Apellido, Nombre</label>
                <input type="text" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} placeholder="Ej: Pérez, Juan" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Número de camiseta (opcional)</label>
                <input type="text" inputMode="numeric" maxLength={3} value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && submit()} style={inputStyle} placeholder="Ej: 00, 7" />
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
                  <Check size={15} /> {editingId && gestionaLiga ? "Guardar" : "Agregar"}
                </button>
                {editingId && gestionaLiga && <button type="button" onClick={resetForm} style={{ ...btnGhost, padding: "10px 12px" }}><X size={15} /></button>}
              </div>
            </div>
          )}
        </div>
      )}

      {deleteTarget && gestionaLiga && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <h3 className="font-display" style={{ marginBottom: 8, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>¿Eliminar jugador?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>Se eliminará a <strong style={{ color: "#F4F4F6" }}>{verNombre(deleteTarget.nombre)}</strong> y sus estadísticas en todos los partidos.</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setDeleteTarget(null)} style={btnGhost}>Cancelar</button>
            <button type="button" onClick={() => removePlayer(deleteTarget.id)} style={btnDanger}>Eliminar</button>
          </div>
        </Modal>
      )}

      {deleteTeam && gestionaLiga && (
        <Modal onClose={() => setDeleteTeam(null)}>
          <h3 className="font-display" style={{ marginBottom: 8, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>¿Borrar equipo?</h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>
            Se eliminará <strong style={{ color: "#F4F4F6" }}>{deleteTeam.nombre}</strong>, todos sus jugadores y los partidos donde participó.
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
