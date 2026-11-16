import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setChecking(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsOrganizer(false); setChecking(false); return; }
    setChecking(true);
    supabase.from("organizers").select("user_id").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => { setIsOrganizer(!!data); setChecking(false); });
  }, [session]);

  return {
    session, isOrganizer, checking,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };
}
