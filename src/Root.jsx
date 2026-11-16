import React, { useEffect, useState } from "react";
import App from "./App";
import { useAuth } from "./lib/useAuth";
import { Analytics } from "@vercel/analytics/react";

export default function Root() {
  const { session, isOrganizer, checking, signIn, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (isOrganizer) setShowLogin(false); }, [isOrganizer]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError("Email o contraseña incorrectos.");
  };

  const input = "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base outline-none focus:border-slate-400";

  return (
    <>
      <App canEdit={isOrganizer} userEmail={session?.user?.email} onLogin={() => setShowLogin(true)} onLogout={signOut} />
      <Analytics />
      {showLogin && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setShowLogin(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-extrabold">Ingreso de organizadores</h2>
            {session && !checking && !isOrganizer ? (
              <>
                <p className="my-3 text-sm text-slate-600">Tu usuario ({session.user.email}) todavía no está habilitado como organizador. Pedile a quien administra la liga que lo agregue.</p>
                <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 font-medium" onClick={signOut}>Cerrar sesión</button>
              </>
            ) : (
              <form onSubmit={submit} className="mt-3 space-y-3">
                <input className={input} type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input className={input} type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
                {error && <p className="text-sm text-red-700">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" className="rounded-lg bg-slate-100 px-4 py-2.5 font-medium" onClick={() => setShowLogin(false)}>Cancelar</button>
                  <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 font-bold text-white disabled:opacity-60">{busy ? "Ingresando…" : "Ingresar"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
