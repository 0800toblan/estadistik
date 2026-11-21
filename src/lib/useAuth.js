import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { isSuperAdmin } from "./constants";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [userRol, setUserRol] = useState("planillero");
  const [checking, setChecking] = useState(true);
  const [orgError, setOrgError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (!data.session) setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setIsOrganizer(false);
      setUserRol("planillero");
      setOrgError("");
      setChecking(false);
      return;
    }

    const admin = isSuperAdmin(session.user.email);
    let cancelled = false;
    setChecking(true);

    supabase
      .from("organizers")
      .select("user_id, rol")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error && !admin) {
          console.error("organizers:", error);
          setOrgError(error.message);
        } else {
          setOrgError("");
        }
        setIsOrganizer(admin || !!data);
        setUserRol(admin ? "organizador" : data?.rol || "planillero");
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, tick]);

  return {
    session,
    userId: session?.user?.id || null,
    userRol,
    isOrganizer,
    checking,
    orgError,
    recheck: () => setTick((n) => n + 1),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };
}