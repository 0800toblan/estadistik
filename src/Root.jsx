import React, { useEffect, useState } from "react";
import { Terminal, ShieldAlert, KeyRound, X, Check, LogOut } from "lucide-react";
import App from "./App";
import { useAuth } from "./lib/useAuth";

const loginError = (err) => {
  const m = (err.message || "").toLowerCase();
  if (m.includes("email not confirmed")) return "Tu email todavía no está confirmado. Confirmalo en Supabase: Authentication → Users.";
  if (m.includes("invalid login")) return "Credenciales inválidas: email o contraseña incorrectos.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sin conexión con Supabase. Revisá las variables de entorno.";
  return err.message || "Error de autenticación.";
};

export default function Root() {
  const { session, userId, userRol, isOrganizer, checking, orgError, recheck, signIn, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (isOrganizer) setShowLogin(false);
  }, [isOrganizer]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(loginError(err));
  };

  const copyUid = () => {
    if (!session?.user?.id) return;
    navigator.clipboard?.writeText(session.user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <>
      <App
        canEdit={Boolean(isOrganizer)}
        userEmail={session?.user?.email ?? null}
        userId={userId ?? session?.user?.id ?? null}
        userRol={userRol ?? "planillero"}
        onLogin={() => setShowLogin(true)}
        onLogout={signOut}
      />

      {showLogin && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-[2px] p-4 sm:items-center"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="w-full max-w-md border border-[#24272E] bg-[#0B0C0E] text-[#F4F4F6] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera técnica Suiza / Terminal */}
            <div className="flex items-center justify-between border-b border-[#24272E] bg-[#111317] px-5 py-3.5">
              <div className="flex items-center gap-2.5 font-mono-tech text-[11px] tracking-[0.14em] uppercase">
                <span className="inline-block h-2 w-2 bg-[#CCFF00]" />
                <span className="text-[#CCFF00] font-bold">SYS.AUTH</span>
                <span className="text-[#525866]">//</span>
                <span className="text-[#8E939E]">SUPABASE_RLS</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLogin(false)}
                aria-label="Cerrar ventana de acceso"
                className="flex h-8 w-8 items-center justify-center border border-[#24272E] bg-[#0B0C0E] text-[#8E939E] hover:border-[#CCFF00] hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 border-b border-[#24272E] pb-4">
                <p className="font-mono-tech text-[11px] tracking-[0.12em] text-[#8E939E] uppercase">
                  [00] CONTROL DE ACCESO
                </p>
                <h2 className="font-display mt-1 text-2xl font-black tracking-[-0.03em] uppercase text-white">
                  INGRESO ORGANIZADORES<span className="cursor-blink text-[#CCFF00]">_</span>
                </h2>
              </div>

              {session && !checking && !isOrganizer ? (
                <div className="space-y-4">
                  <div className="border border-[#FF4D4D]/40 bg-[#FF4D4D]/10 p-3.5">
                    <div className="flex items-center gap-2 font-mono-tech text-xs font-bold text-[#FF4D4D] uppercase">
                      <ShieldAlert size={16} />
                      <span>ACCESS_DENIED // PERMISO PENDIENTE</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[#D1D5DB]">
                      Sesión iniciada como <strong className="text-white">{session.user.email}</strong>, pero tu usuario aún no figura en la tabla <code className="font-mono-tech text-[#CCFF00]">public.organizers</code>.
                    </p>
                    {orgError && (
                      <p className="mt-2 font-mono-tech text-[11px] text-[#FF4D4D]">ERR: {orgError}</p>
                    )}
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between font-mono-tech text-[10px] tracking-[0.12em] text-[#8E939E] uppercase">
                      <span>USER_UUID (ENVIAR AL ADMIN)</span>
                      <button
                        type="button"
                        onClick={copyUid}
                        className="text-[#CCFF00] hover:underline cursor-pointer"
                      >
                        {copiedId ? "[COPIADO]" : "[COPIAR_ID]"}
                      </button>
                    </div>
                    <p className="select-all break-all border border-[#24272E] bg-[#111317] p-2.5 font-mono-tech text-xs text-[#CCFF00]">
                      {session.user.id}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex items-center justify-center gap-2 border border-[#24272E] bg-[#111317] px-4 py-3 font-mono-tech text-xs font-bold uppercase text-[#8E939E] hover:text-white cursor-pointer"
                    >
                      <LogOut size={14} /> SALIR
                    </button>
                    <button
                      type="button"
                      onClick={recheck}
                      className="flex items-center justify-center gap-2 bg-[#CCFF00] px-4 py-3 font-mono-tech text-xs font-extrabold uppercase text-[#0B0C0E] hover:bg-[#d8ff33] cursor-pointer"
                    >
                      <Check size={14} /> VERIFICAR
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 flex items-center justify-between font-mono-tech text-[11px] tracking-[0.1em] text-[#8E939E] uppercase">
                      <span>[01] IDENTIFICADOR_EMAIL</span>
                      <Terminal size={13} className="text-[#CCFF00]" />
                    </label>
                    <div className="relative flex items-center border border-[#24272E] bg-[#111317] focus-within:border-[#CCFF00]">
                      <span className="pl-3 font-mono-tech text-sm font-bold text-[#CCFF00]">&gt;</span>
                      <input
                        className="w-full bg-transparent px-3 py-3 font-mono-tech text-sm text-white outline-none placeholder:text-[#525866]"
                        type="email"
                        autoComplete="email"
                        placeholder="organizador@club.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center justify-between font-mono-tech text-[11px] tracking-[0.1em] text-[#8E939E] uppercase">
                      <span>[02] CLAVE_ACCESO</span>
                      <KeyRound size={13} className="text-[#8E939E]" />
                    </label>
                    <div className="relative flex items-center border border-[#24272E] bg-[#111317] focus-within:border-[#CCFF00]">
                      <span className="pl-3 font-mono-tech text-sm font-bold text-[#CCFF00]">&gt;</span>
                      <input
                        className="w-full bg-transparent px-3 py-3 font-mono-tech text-sm text-white outline-none placeholder:text-[#525866]"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="border border-[#FF4D4D]/50 bg-[#FF4D4D]/10 px-3 py-2 font-mono-tech text-xs text-[#FF4D4D]">
                      [ERR] {error}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowLogin(false)}
                      className="col-span-1 border border-[#24272E] bg-[#111317] py-3 font-mono-tech text-xs font-bold uppercase text-[#8E939E] hover:text-white cursor-pointer"
                    >
                      ABORTAR
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="col-span-2 bg-[#CCFF00] py-3 font-mono-tech text-xs font-extrabold tracking-[0.08em] uppercase text-[#0B0C0E] hover:bg-[#d8ff33] disabled:opacity-50 cursor-pointer"
                    >
                      {busy ? "AUTENTICANDO..." : "EJECUTAR_ACCESO →"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}