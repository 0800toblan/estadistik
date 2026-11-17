import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [checking, setChecking] = useState(true);
  const [orgError, setOrgError] = useState("");
  const [tick, setTick] = useState(0); // sube para volver a verificar sin recargar la página

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setChecking(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsOrganizer(false); setOrgError(""); setChecking(false); return; }
    let cancelled = false;
    setChecking(true);
    supabase.from("organizers").select("user_id").eq("user_id", session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error("organizers:", error); setOrgError(error.message); }
        else setOrgError("");
        setIsOrganizer(!!data);
        setChecking(false);
      });
    return () => { cancelled = true; };
  }, [session, tick]);

  return {
    session, isOrganizer, checking, orgError,
    recheck: () => setTick((n) => n + 1),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };
}