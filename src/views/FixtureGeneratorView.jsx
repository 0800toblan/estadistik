import React, { useState, useEffect, useMemo } from "react";
import { Sparkles, Shuffle } from "lucide-react";
import BackBar from "../components/BackBar";
import { EmptyState } from "../components/CommonModals";
import { LINE, SURFACE, ELEVATED, INK, FLUOR, GOLD, MUTED, FAINT, COLOR_A, COLOR_B } from "../lib/constants";
import { sumarDiasISO, sumarMinutosHora } from "../lib/formatters";

function generarRondasRoundRobin(teamIds, idaYVuelta = false) {
  if (teamIds.length < 2) return [];
  const lista = [...teamIds];
  if (lista.length % 2 !== 0) lista.push(null); // null = Fecha Libre (BYE)

  const n = lista.length;
  const totalRondas = n - 1;
  const mitad = n / 2;
  const rotables = lista.slice(1);
  const rondasIda = [];

  for (let r = 0; r < totalRondas; r++) {
    const actual = [lista[0], ...rotables];
    const cruces = [];
    let libreId = null;

    for (let i = 0; i < mitad; i++) {
      const a = actual[i];
      const b = actual[n - 1 - i];
      if (a === null) libreId = b;
      else if (b === null) libreId = a;
      else cruces.push(r % 2 === 0 ? { a, b } : { a: b, b: a });
    }

    rondasIda.push({ numero: r + 1, cruces, libreId });
    rotables.unshift(rotables.pop());
  }

  if (!idaYVuelta) return rondasIda;

  const rondasVuelta = rondasIda.map((r, idx) => ({
    numero: totalRondas + idx + 1,
    cruces: r.cruces.map((c) => ({ a: c.b, b: c.a })),
    libreId: r.libreId,
  }));

  return [...rondasIda, ...rondasVuelta];
}

export default function FixtureGeneratorView({ db, commit, setView, setToast, liga, ligaId, teamsOf, teamName, uid }) {
  const equiposLiga = useMemo(() => teamsOf(db, ligaId), [db, ligaId, teamsOf]);

  const [selectedIds, setSelectedIds] = useState(() => equiposLiga.map((t) => t.id));
  const [formato, setFormato] = useState("ida"); // "ida" | "ida_vuelta" | "dos_zonas"
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [diasEntreFechas, setDiasEntreFechas] = useState(7);
  const [horaInicio, setHoraInicio] = useState("10:00");
  const [intervaloMin, setIntervaloMin] = useState(50);
  const [canchasSimultaneas, setCanchasSimultaneas] = useState(1);
  const [sedeDefault, setSedeDefault] = useState("");
  const [ordenManual, setOrdenManual] = useState(null);
  const [ediciones, setEdiciones] = useState({});

  const [jornadasAbiertas, setJornadasAbiertas] = useState({ 1: true });

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

  useEffect(() => {
    setSelectedIds(equiposLiga.map((t) => t.id));
    setOrdenManual(null);
    setEdiciones({});
    setJornadasAbiertas({ 1: true });
  }, [ligaId, equiposLiga]);

  const toggleEquipo = (id) => {
    setOrdenManual(null);
    setEdiciones({});
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const mezclarEquipos = () => {
    const base = [...selectedIds];
    for (let i = base.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [base[i], base[j]] = [base[j], base[i]];
    }
    setOrdenManual(base);
    setEdiciones({});
    setToast("Orden de sorteo mezclado.");
  };

  const toggleJornada = (nro) => {
    setJornadasAbiertas((prev) => ({ ...prev, [nro]: !prev[nro] }));
  };

  const expandirTodas = (abrir) => {
    const estado = {};
    rondasCalculadas.forEach((r) => { estado[r.numero] = abrir; });
    setJornadasAbiertas(estado);
  };

  const rondasCalculadas = useMemo(() => {
    const ids = ordenManual ? ordenManual.filter((id) => selectedIds.includes(id)) : selectedIds;
    if (ids.length < 2) return [];

    let rondasBase = [];
    if (formato === "dos_zonas" && ids.length >= 4) {
      const mitad = Math.ceil(ids.length / 2);
      const zonaA = generarRondasRoundRobin(ids.slice(0, mitad), false);
      const zonaB = generarRondasRoundRobin(ids.slice(mitad), false);
      const maxR = Math.max(zonaA.length, zonaB.length);
      for (let i = 0; i < maxR; i++) {
        const cA = (zonaA[i]?.cruces || []).map((c) => ({ ...c, zona: "ZONA A" }));
        const cB = (zonaB[i]?.cruces || []).map((c) => ({ ...c, zona: "ZONA B" }));
        const libres = [zonaA[i]?.libreId, zonaB[i]?.libreId].filter(Boolean);
        rondasBase.push({ numero: i + 1, cruces: [...cA, ...cB], libres });
      }
    } else {
      rondasBase = generarRondasRoundRobin(ids, formato === "ida_vuelta").map((r) => ({
        ...r,
        libres: r.libreId ? [r.libreId] : [],
      }));
    }

    const canchas = Math.max(1, Number(canchasSimultaneas) || 1);
    const pasoDias = Math.max(0, Number(diasEntreFechas) || 0);
    const pasoMin = Math.max(0, Number(intervaloMin) || 0);

    return rondasBase.map((r, rIdx) => {
      const fechaRonda = sumarDiasISO(fechaInicio, rIdx * pasoDias);
      const partidos = r.cruces.map((c, cIdx) => {
        const key = `${rIdx}-${cIdx}`;
        const slotHorario = Math.floor(cIdx / canchas);
        const canchaNro = (cIdx % canchas) + 1;
        const horaAuto = horaInicio ? sumarMinutosHora(horaInicio, slotHorario * pasoMin) : "";
        const sedeAuto = canchas > 1 && sedeDefault.trim()
          ? `${sedeDefault.trim()} (Cancha ${canchaNro})`
          : canchas > 1
            ? `Cancha ${canchaNro}`
            : sedeDefault.trim();

        const ov = ediciones[key] || {};
        return {
          key,
          equipo_a_id: c.a,
          equipo_b_id: c.b,
          zona: c.zona || null,
          fecha: ov.fecha ?? fechaRonda,
          hora: ov.hora ?? horaAuto,
          lugar: ov.lugar ?? sedeAuto,
        };
      });
      return { numero: r.numero, libres: r.libres, partidos, fechaTentativa: sumarDiasISO(fechaInicio, rIdx * pasoDias) };
    });
  }, [selectedIds, ordenManual, formato, fechaInicio, diasEntreFechas, horaInicio, intervaloMin, canchasSimultaneas, sedeDefault, ediciones]);

  const totalPartidos = rondasCalculadas.reduce((acc, r) => acc + r.partidos.length, 0);

  const actualizarPartido = (key, campo, valor) => {
    setEdiciones((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [campo]: valor },
    }));
  };

  const publicarFixture = () => {
    if (totalPartidos === 0) return;
    const nuevosMatches = rondasCalculadas.flatMap((r) =>
      r.partidos.map((p) => ({
        id: uid("m"),
        liga_id: ligaId,
        equipo_a_id: p.equipo_a_id,
        equipo_b_id: p.equipo_b_id,
        fecha: p.fecha || fechaInicio,
        hora: p.hora || null,
        lugar: p.lugar?.trim() || null,
        estado: "pendiente",
        hora_inicio_real: null,
        reloj_segundos: 0,
        reloj_corriendo: false,
        reloj_actualizado_en: null,
        resultado_equipo_a: 0,
        resultado_equipo_b: 0,
      }))
    );

    commit((prev) => ({
      ...prev,
      matches: [...prev.matches, ...nuevosMatches],
    }));

    setToast(`${nuevosMatches.length} partidos creados en ${liga.nombre}.`);
    setView({ name: "matches" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <BackBar
        onBack={() => setView({ name: "matches" })}
        title={`Generador de Fixture · ${liga.nombre}`}
        right={
          <span className="font-mono-tech tabular-nums" style={{ padding: "4px 10px", fontSize: 11, fontWeight: 800, background: `${FLUOR}1A`, color: FLUOR, border: `1px solid ${FLUOR}` }}>
            {selectedIds.length} EQUIPOS · {totalPartidos} PARTIDOS
          </span>
        }
      />

      {equiposLiga.length < 2 ? (
        <EmptyState
          text="Necesitás al menos 2 equipos cargados en esta liga para armar un fixture."
          action={<button type="button" onClick={() => setView({ name: "teams" })} style={{ ...btnPrimary, marginTop: 12 }}>Ir a Equipos</button>}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 20, alignItems: "start" }}>
          {/* Panel de configuración */}
          <div className="col-span-12 lg:col-span-5" style={{ ...cardStyle, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 10 }}>
              <p className="font-mono-tech" style={{ fontSize: 10, color: FLUOR, letterSpacing: "0.1em" }}>[01] PARÁMETROS DEL TORNEO</p>
              <h2 className="font-display" style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", marginTop: 2 }}>
                CONFIGURACIÓN
              </h2>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Equipos incluidos ({selectedIds.length}/{equiposLiga.length})</label>
                <button type="button" onClick={mezclarEquipos} className="font-mono-tech" style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", padding: 0, fontSize: 10, fontWeight: 800, color: FLUOR, cursor: "pointer" }}>
                  <Shuffle size={12} /> SORTEAR ORDEN
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {equiposLiga.map((t) => {
                  const activo = selectedIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleEquipo(t.id)}
                      className="font-mono-tech"
                      style={{
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: `1px solid ${activo ? FLUOR : LINE}`,
                        background: activo ? `${FLUOR}1A` : INK,
                        color: activo ? FLUOR : MUTED,
                      }}
                    >
                      {activo ? "✓ " : "+ "}{t.nombre}
                    </button>
                  );
                })}
              </div>
              {selectedIds.length % 2 !== 0 && selectedIds.length >= 3 && (
                <p className="font-mono-tech" style={{ marginTop: 6, fontSize: 10, color: GOLD }}>
                  * Cantidad impar: se asignará 1 fecha libre por jornada automáticamente.
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle}>Formato de competencia</label>
              <select value={formato} onChange={(e) => { setFormato(e.target.value); setEdiciones({}); }} style={inputStyle}>
                <option value="ida">Todos contra todos — Solo ida</option>
                <option value="ida_vuelta">Todos contra todos — Ida y vuelta</option>
                <option value="dos_zonas" disabled={selectedIds.length < 4}>2 Zonas (A y B) — Solo ida (mín. 4 equipos)</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Fecha de inicio</label>
                <input type="date" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setEdiciones({}); }} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Días entre fechas</label>
                <input type="number" min="0" max="60" value={diasEntreFechas} onChange={(e) => { setDiasEntreFechas(e.target.value); setEdiciones({}); }} style={inputStyle} />
                <span className="font-mono-tech" style={{ fontSize: 10, color: FAINT }}>0 = mismo día / 7 = semanal</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>Hora 1º partido</label>
                <input type="time" value={horaInicio} onChange={(e) => { setHoraInicio(e.target.value); setEdiciones({}); }} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Intervalo (min)</label>
                <input type="number" min="0" max="300" step="5" value={intervaloMin} onChange={(e) => { setIntervaloMin(e.target.value); setEdiciones({}); }} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Canchas</label>
                <input type="number" min="1" max="8" value={canchasSimultaneas} onChange={(e) => { setCanchasSimultaneas(e.target.value); setEdiciones({}); }} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Sede por defecto (opcional)</label>
              <input type="text" value={sedeDefault} onChange={(e) => { setSedeDefault(e.target.value); setEdiciones({}); }} placeholder="Ej: Polideportivo Municipal" style={inputStyle} />
            </div>

            <button
              type="button"
              disabled={totalPartidos === 0}
              onClick={publicarFixture}
              style={{ ...btnPrimary, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "14px 16px", opacity: totalPartidos === 0 ? 0.4 : 1 }}
            >
              <Sparkles size={15} /> CREAR {totalPartidos} PARTIDOS EN LA LIGA
            </button>
          </div>

          {/* Tarjetas generales y desplegables de jornadas */}
          <div className="col-span-12 lg:col-span-7" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...cardStyle, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <p className="font-mono-tech" style={{ fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}>[02] VISTA GENERAL DE JORNADAS</p>
                <h2 className="font-display" style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", marginTop: 2 }}>
                  {rondasCalculadas.length} JORNADAS PLANIFICADAS
                </h2>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => expandirTodas(true)} style={{ ...btnGhost, padding: "6px 10px", fontSize: 10 }}>
                  EXPANDIR TODAS
                </button>
                <button type="button" onClick={() => expandirTodas(false)} style={{ ...btnGhost, padding: "6px 10px", fontSize: 10 }}>
                  CONTRAER
                </button>
              </div>
            </div>

            {rondasCalculadas.length === 0 ? (
              <EmptyState text="Seleccioná al menos 2 equipos para previsualizar los cruces." />
            ) : (
              rondasCalculadas.map((r) => {
                const abierta = !!jornadasAbiertas[r.numero];
                return (
                  <div key={r.numero} style={{ ...cardStyle, overflow: "hidden" }}>
                    <div
                      onClick={() => toggleJornada(r.numero)}
                      style={{
                        padding: "14px 18px",
                        background: abierta ? ELEVATED : INK,
                        borderBottom: abierta ? `1px solid ${LINE}` : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span className="font-mono-tech" style={{ fontSize: 13, fontWeight: 900, color: FLUOR }}>
                          FECHA {String(r.numero).padStart(2, "0")}
                        </span>
                        <span className="font-mono-tech" style={{ fontSize: 11, color: MUTED }}>
                          {r.fechaTentativa} · {r.partidos.length} {r.partidos.length === 1 ? "partido" : "partidos"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {r.libres.length > 0 && (
                          <span className="font-mono-tech" style={{ fontSize: 10, color: GOLD, background: `${GOLD}1A`, padding: "2px 6px", border: `1px solid ${GOLD}40` }}>
                            LIBRE: {r.libres.map((id) => teamName(db, id)).join(", ")}
                          </span>
                        )}
                        <span className="font-mono-tech" style={{ fontSize: 11, fontWeight: 800, color: MUTED }}>
                          {abierta ? "▲ Ocultar" : "▼ Desplegar"}
                        </span>
                      </div>
                    </div>

                    {abierta && (
                      <div>
                        {r.partidos.map((p, idx) => (
                          <div
                            key={p.key}
                            style={{
                              padding: "14px 18px",
                              borderBottom: idx === r.partidos.length - 1 ? "none" : `1px solid ${LINE}`,
                              display: "flex",
                              flexDirection: "column",
                              gap: 10,
                              background: INK,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <span className="font-display" style={{ flex: 1, fontSize: 15, fontWeight: 800, color: COLOR_A.text }}>
                                {teamName(db, p.equipo_a_id)}
                              </span>
                              <span className="font-mono-tech" style={{ fontSize: 11, fontWeight: 800, color: MUTED, padding: "2px 8px", border: `1px solid ${LINE}`, background: ELEVATED }}>
                                {p.zona ? `${p.zona} · VS` : "VS"}
                              </span>
                              <span className="font-display" style={{ flex: 1, textAlign: "right", fontSize: 15, fontWeight: 800, color: COLOR_B.text }}>
                                {teamName(db, p.equipo_b_id)}
                              </span>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "135px 100px 1fr", gap: 8 }}>
                              <div>
                                <label style={{ ...labelStyle, fontSize: 9, marginBottom: 2 }}>Fecha</label>
                                <input
                                  type="date"
                                  value={p.fecha}
                                  onChange={(e) => actualizarPartido(p.key, "fecha", e.target.value)}
                                  style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }}
                                />
                              </div>
                              <div>
                                <label style={{ ...labelStyle, fontSize: 9, marginBottom: 2 }}>Hora</label>
                                <input
                                  type="time"
                                  value={p.hora}
                                  onChange={(e) => actualizarPartido(p.key, "hora", e.target.value)}
                                  style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }}
                                />
                              </div>
                              <div>
                                <label style={{ ...labelStyle, fontSize: 9, marginBottom: 2 }}>Sede / Cancha</label>
                                <input
                                  type="text"
                                  value={p.lugar}
                                  placeholder="Sede"
                                  onChange={(e) => actualizarPartido(p.key, "lugar", e.target.value)}
                                  style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
