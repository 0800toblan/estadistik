import React, { useState, useEffect, useCallback } from "react";
import { UserPlus, Eye, EyeOff, Copy, KeyRound, Trash2 } from "lucide-react";
import BackBar from "../components/BackBar";
import { Modal, EmptyState } from "../components/CommonModals";
import { supabase } from "../lib/supabase";
import { isSuperAdmin, LINE, SURFACE, ELEVATED, INK, FLUOR, GOLD, MUTED, RED } from "../lib/constants";
import { fmtFecha, verNombre } from "../lib/formatters";

export default function UsersAdminView({ db, commit, setView, setToast, userEmail }) {
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rolInicial, setRolInicial] = useState("planillero");
  const [ligaInicial, setLigaInicial] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [ultimoCreado, setUltimoCreado] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPass, setNewPass] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyAction, setBusyAction] = useState(false);

  const ligas = db?.leagues || [];

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

  const callAdminFn = useCallback(async (body) => {
    const { data, error: fnErr } = await supabase.functions.invoke("manage-organizers", { body });
    if (fnErr) {
      throw new Error(fnErr.message || "No se pudo conectar con la función manage-organizers.");
    }
    if (data?.error) {
      throw new Error(data.error);
    }
    return data;
  }, []);

  const cargarOrganizadores = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [res, rolesRes] = await Promise.all([
        callAdminFn({ action: "list" }),
        supabase.from("organizers").select("user_id, rol"),
      ]);
      const rolMap = new Map((rolesRes.data || []).map((r) => [r.user_id, r.rol || "planillero"]));
      const lista = (res.organizers || []).map((o) => ({
        ...o,
        rol: rolMap.get(o.user_id) || o.rol || "planillero",
      }));
      setOrganizers(lista);
      return lista;
    } catch (e) {
      setError(e.message || "Error al cargar los usuarios.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [callAdminFn]);

  useEffect(() => {
    cargarOrganizadores();
  }, [cargarOrganizadores]);

  const generarClave = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnprstuvwxyz23456789";
    let out = "Korf-";
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setPassword(out);
    setShowPass(true);
  };

  const cambiarRolUsuario = async (targetUserId, nuevoRol) => {
    const { data, error: upErr } = await supabase
      .from("organizers")
      .upsert({ user_id: targetUserId, rol: nuevoRol }, { onConflict: "user_id" })
      .select("user_id, rol");

    if (upErr || !data || data.length === 0) {
      setToast(`No se pudo guardar el rol: ${upErr?.message || "verificá permisos RLS en Supabase."}`);
      return;
    }

    setOrganizers((prev) =>
      prev.map((o) => (o.user_id === targetUserId ? { ...o, rol: nuevoRol } : o))
    );

    if (nuevoRol === "planillero" && commit) {
      commit((prev) => ({
        ...prev,
        leagues: prev.leagues.map((l) =>
          l.organizador_id === targetUserId ? { ...l, organizador_id: null } : l
        ),
      }));
    }

    setToast(`Rol actualizado a ${nuevoRol.toUpperCase()}.`);
  };

  const asignarLigaAOrganizador = async (targetUserId, targetLigaId) => {
    if (!commit) return;
    const { data, error: upErr } = await supabase
      .from("organizers")
      .upsert({ user_id: targetUserId, rol: "organizador" }, { onConflict: "user_id" })
      .select("user_id, rol");

    if (upErr || !data || data.length === 0) {
      setToast(`Error al asignar rol: ${upErr?.message || "sin permisos RLS."}`);
      return;
    }

    setOrganizers((prev) =>
      prev.map((o) => (o.user_id === targetUserId ? { ...o, rol: "organizador" } : o))
    );

    commit((prev) => ({
      ...prev,
      leagues: prev.leagues.map((l) =>
        l.id === targetLigaId ? { ...l, organizador_id: targetUserId } : l
      ),
    }));
    setToast("Liga asignada al organizador.");
  };

  const quitarLigaDeOrganizador = (targetLigaId) => {
    if (!commit) return;
    commit((prev) => ({
      ...prev,
      leagues: prev.leagues.map((l) =>
        l.id === targetLigaId ? { ...l, organizador_id: null } : l
      ),
    }));
    setToast("Liga desvinculada.");
  };

  const crearUsuario = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Ingresá un correo electrónico válido.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setCreating(true);
    setError("");
    try {
      await callAdminFn({ action: "create", email: cleanEmail, password });
      const listaActualizada = await cargarOrganizadores();
      const creado = listaActualizada.find((o) => (o.email || "").toLowerCase() === cleanEmail);

      if (creado && rolInicial === "organizador") {
        await supabase.from("organizers").update({ rol: "organizador" }).eq("user_id", creado.user_id);
        if (ligaInicial && commit) {
          commit((prev) => ({
            ...prev,
            leagues: prev.leagues.map((l) =>
              l.id === ligaInicial ? { ...l, organizador_id: creado.user_id } : l
            ),
          }));
        }
        await cargarOrganizadores();
      }

      setUltimoCreado({ email: cleanEmail, password, rol: rolInicial });
      setEmail("");
      setPassword("");
      setRolInicial("planillero");
      setLigaInicial("");
      setToast(`${rolInicial === "organizador" ? "Organizador" : "Planillero"} ${cleanEmail} habilitado.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const guardarNuevaClave = async () => {
    if (!resetTarget) return;
    if (newPass.length < 6) {
      setToast("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setBusyAction(true);
    try {
      await callAdminFn({ action: "reset_password", user_id: resetTarget.user_id, password: newPass });
      setToast(`Contraseña actualizada para ${resetTarget.email}.`);
      setUltimoCreado({ email: resetTarget.email, password: newPass, rol: resetTarget.rol || "planillero" });
      setResetTarget(null);
      setNewPass("");
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setBusyAction(false);
    }
  };

  const eliminarUsuario = async () => {
    if (!deleteTarget) return;
    setBusyAction(true);
    try {
      await callAdminFn({ action: "delete", user_id: deleteTarget.user_id });
      if (commit) {
        commit((prev) => ({
          ...prev,
          leagues: prev.leagues.map((l) =>
            l.organizador_id === deleteTarget.user_id ? { ...l, organizador_id: null } : l
          ),
        }));
      }
      setToast(`Acceso revocado para ${deleteTarget.email}.`);
      setDeleteTarget(null);
      await cargarOrganizadores();
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setBusyAction(false);
    }
  };

  const copiarCredenciales = (cred) => {
    const etiqueta = cred.rol === "organizador" ? "Organizador" : "Planillero";
    const texto = `Acceso ESTADISTIK (${etiqueta})\nEmail: ${cred.email}\nContraseña: ${cred.password}`;
    navigator.clipboard?.writeText(texto);
    setToast("Credenciales copiadas al portapapeles.");
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <BackBar
        onBack={() => setView({ name: "home" })}
        title="Organizadores y Planilleros"
        right={
          <span className="font-mono-tech" style={{ padding: "4px 10px", fontSize: 11, fontWeight: 800, background: `${FLUOR}1A`, color: FLUOR, border: `1px solid ${FLUOR}` }}>
            ADMIN // {userEmail}
          </span>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 20, alignItems: "start" }}>
        <form onSubmit={crearUsuario} className="col-span-12 lg:col-span-5" style={{ ...cardStyle, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ borderBottom: `1px solid ${LINE}`, paddingBottom: 10 }}>
            <p className="font-mono-tech" style={{ fontSize: 10, color: FLUOR, letterSpacing: "0.1em" }}>[01] ALTA DE CUENTA</p>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", marginTop: 2 }}>
              NUEVO USUARIO
            </h2>
          </div>

          <div>
            <label style={labelStyle}>Rol asignado</label>
            <select
              value={rolInicial}
              onChange={(e) => setRolInicial(e.target.value)}
              className="font-mono-tech"
              style={{ ...inputStyle, fontWeight: 700, color: rolInicial === "organizador" ? FLUOR : "#F4F4F6" }}
            >
              <option value="planillero">PLANILLERO (Carga puntos en cancha)</option>
              <option value="organizador">ORGANIZADOR (Gestiona liga y fixture)</option>
            </select>
          </div>

          {rolInicial === "organizador" && ligas.length > 0 && (
            <div>
              <label style={labelStyle}>Asignar a liga (opcional)</label>
              <select
                value={ligaInicial}
                onChange={(e) => setLigaInicial(e.target.value)}
                style={inputStyle}
              >
                <option value="">Seleccionar liga más tarde...</option>
                {ligas.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Email asignado</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@club.com"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Contraseña (mín. 6 caracteres)</label>
              <button
                type="button"
                onClick={generarClave}
                className="font-mono-tech"
                style={{ background: "transparent", border: "none", padding: 0, fontSize: 10, fontWeight: 800, color: FLUOR, cursor: "pointer", textDecoration: "underline" }}
              >
                [GENERAR CLAVE]
              </button>
            </div>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type={showPass ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 40, fontFamily: "'JetBrains Mono', monospace" }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                style={{ position: "absolute", right: 8, background: "transparent", border: "none", color: MUTED, cursor: "pointer", padding: 4 }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="font-mono-tech" style={{ border: `1px solid ${RED}`, background: "#2A1010", padding: "10px 12px", fontSize: 11, color: RED, wordBreak: "break-word" }}>
              [ERR] {error}
            </div>
          )}

          <button type="submit" disabled={creating} style={{ ...btnPrimary, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 16px", opacity: creating ? 0.6 : 1 }}>
            <UserPlus size={15} /> {creating ? "CREANDO CUENTA..." : "CREAR Y HABILITAR"}
          </button>

          {ultimoCreado && (
            <div style={{ border: `1px solid ${FLUOR}`, background: INK, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="font-mono-tech" style={{ fontSize: 10, fontWeight: 800, color: FLUOR }}>CREDENCIALES LISTAS</span>
                <button
                  type="button"
                  onClick={() => copiarCredenciales(ultimoCreado)}
                  className="font-mono-tech"
                  style={{ display: "flex", alignItems: "center", gap: 4, background: FLUOR, color: INK, border: "none", padding: "4px 8px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                >
                  <Copy size={11} /> COPIAR
                </button>
              </div>
              <p className="font-mono-tech" style={{ fontSize: 12, color: "#F4F4F6" }}>Email: <strong>{ultimoCreado.email}</strong></p>
              <p className="font-mono-tech" style={{ fontSize: 12, color: FLUOR }}>Clave: <strong>{ultimoCreado.password}</strong></p>
            </div>
          )}
        </form>

        <div className="col-span-12 lg:col-span-7" style={cardStyle}>
          <div style={{ borderBottom: `1px solid ${LINE}`, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p className="font-mono-tech" style={{ fontSize: 10, color: MUTED, letterSpacing: "0.1em" }}>[02] TABLA PUBLIC.ORGANIZERS</p>
              <h2 className="font-display" style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", marginTop: 2 }}>
                CUENTAS HABILITADAS ({organizers.length})
              </h2>
            </div>
            <button type="button" onClick={cargarOrganizadores} disabled={loading} style={{ ...btnGhost, padding: "6px 10px", fontSize: 11 }}>
              {loading ? "..." : "ACTUALIZAR"}
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 28, textAlign: "center" }}>
              <p className="font-mono-tech" style={{ fontSize: 12, color: MUTED }}>CARGANDO USUARIOS...</p>
            </div>
          ) : organizers.length === 0 ? (
            <div style={{ padding: 18 }}>
              <EmptyState text="No se encontraron usuarios registrados." />
            </div>
          ) : (
            <div>
              {organizers.map((org, idx) => {
                const esPrincipal = isSuperAdmin(org.email);
                const rolActual = esPrincipal ? "admin" : (org.rol || "planillero");
                const ligasACargo = ligas.filter((l) => l.organizador_id === org.user_id);
                const ligasLibres = ligas.filter((l) => l.organizador_id !== org.user_id);

                return (
                  <div
                    key={org.user_id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      padding: "14px 18px",
                      borderBottom: idx === organizers.length - 1 ? "none" : `1px solid ${LINE}`,
                      background: esPrincipal ? ELEVATED : rolActual === "organizador" ? `${FLUOR}08` : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#F4F4F6", wordBreak: "break-all" }}>{org.email}</span>
                          {esPrincipal && (
                            <span className="font-mono-tech" style={{ fontSize: 10, fontWeight: 800, background: FLUOR, color: INK, padding: "2px 6px" }}>
                              ADMIN PRINCIPAL
                            </span>
                          )}
                        </div>
                        <p className="font-mono-tech" style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                          ID: {org.user_id.slice(0, 8)}… · Último acceso: {org.last_sign_in_at ? fmtFecha(org.last_sign_in_at.slice(0, 10)) : "Nunca"}
                        </p>
                      </div>

                      {!esPrincipal && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <select
                            value={rolActual}
                            onChange={(e) => cambiarRolUsuario(org.user_id, e.target.value)}
                            className="font-mono-tech"
                            style={{
                              padding: "6px 10px",
                              fontSize: 11,
                              fontWeight: 800,
                              background: ELEVATED,
                              color: rolActual === "organizador" ? FLUOR : "#F4F4F6",
                              border: `1px solid ${rolActual === "organizador" ? FLUOR : LINE}`,
                              cursor: "pointer",
                            }}
                          >
                            <option value="planillero">PLANILLERO</option>
                            <option value="organizador">ORGANIZADOR</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => { setResetTarget(org); setNewPass(""); }}
                            title="Cambiar contraseña"
                            className="font-mono-tech"
                            style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 10px", fontSize: 11, fontWeight: 700, background: ELEVATED, color: "#F4F4F6", border: `1px solid ${LINE}`, cursor: "pointer" }}
                          >
                            <KeyRound size={13} /> CLAVE
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(org)}
                            title="Revocar acceso y eliminar usuario"
                            style={{ padding: "7px 10px", background: "transparent", border: `1px solid ${LINE}`, cursor: "pointer" }}
                          >
                            <Trash2 size={14} color={RED} />
                          </button>
                        </div>
                      )}
                    </div>

                    {!esPrincipal && rolActual === "organizador" && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", paddingTop: 8, borderTop: `1px dashed ${LINE}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span className="font-mono-tech" style={{ fontSize: 10, color: MUTED }}>LIGAS A CARGO:</span>
                          {ligasACargo.length === 0 ? (
                            <span className="font-mono-tech" style={{ fontSize: 10, color: GOLD }}>Ninguna asignada</span>
                          ) : (
                            ligasACargo.map((l) => (
                              <span key={l.id} className="font-mono-tech" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, background: `${FLUOR}1A`, color: FLUOR, border: `1px solid ${FLUOR}`, padding: "2px 6px" }}>
                                {l.nombre}
                                <button
                                  type="button"
                                  onClick={() => quitarLigaDeOrganizador(l.id)}
                                  style={{ background: "transparent", border: "none", color: FLUOR, cursor: "pointer", padding: 0, fontWeight: 900 }}
                                  title="Quitar liga"
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          )}
                        </div>

                        {ligasLibres.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) asignarLigaAOrganizador(org.user_id, e.target.value); }}
                            className="font-mono-tech"
                            style={{ padding: "4px 8px", fontSize: 11, background: INK, color: "#F4F4F6", border: `1px solid ${LINE}`, cursor: "pointer" }}
                          >
                            <option value="">+ Asignar liga...</option>
                            {ligasLibres.map((l) => (
                              <option key={l.id} value={l.id}>{l.nombre}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {resetTarget && (
        <Modal onClose={() => setResetTarget(null)}>
          <h3 className="font-display" style={{ marginBottom: 6, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>
            Cambiar contraseña
          </h3>
          <p style={{ marginBottom: 14, fontSize: 13, color: MUTED }}>
            Nueva clave de acceso para <strong style={{ color: "#F4F4F6" }}>{resetTarget.email}</strong>:
          </p>
          <input
            type="text"
            minLength={6}
            autoFocus
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardarNuevaClave()}
            placeholder="Mínimo 6 caracteres"
            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
          />
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setResetTarget(null)} style={btnGhost}>Cancelar</button>
            <button type="button" disabled={busyAction} onClick={guardarNuevaClave} style={btnPrimary}>
              {busyAction ? "GUARDANDO..." : "ACTUALIZAR CLAVE"}
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <h3 className="font-display" style={{ marginBottom: 8, fontSize: 20, fontWeight: 900, textTransform: "uppercase" }}>
            ¿Eliminar usuario?
          </h3>
          <p style={{ marginBottom: 20, fontSize: 14, color: MUTED }}>
            Se revocará el permiso de edición y se eliminará la cuenta de <strong style={{ color: "#F4F4F6" }}>{deleteTarget.email}</strong>. Los partidos que haya cargado no se borran.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={() => setDeleteTarget(null)} style={btnGhost}>Cancelar</button>
            <button type="button" disabled={busyAction} onClick={eliminarUsuario} style={btnDanger}>
              {busyAction ? "ELIMINANDO..." : "ELIMINAR USUARIO"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
