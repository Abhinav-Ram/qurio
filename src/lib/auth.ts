import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const SESSION_FLAG = "ii.has-session";

/**
 * Synchronous check used inside route `beforeLoad` (where async work is awkward).
 * Mirrors the latest Supabase auth state into localStorage so this can answer
 * without hitting the network. The real source of truth is Supabase; this is a
 * cache for fast routing decisions.
 */
export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SESSION_FLAG) === "1";
}

function setSessionFlag(has: boolean) {
  if (typeof window === "undefined") return;
  if (has) window.localStorage.setItem(SESSION_FLAG, "1");
  else window.localStorage.removeItem(SESSION_FLAG);
}

// Initialise the cache flag on module load + keep it in sync.
if (typeof window !== "undefined") {
  void supabase.auth.getSession().then(({ data }) => {
    setSessionFlag(!!data.session);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    setSessionFlag(!!session);
  });
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  setSessionFlag(false);
}

/**
 * React hook returning the current session (and a loading flag for first hydration).
 */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // IMPORTANT: subscribe BEFORE getSession to avoid missed events.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setSessionFlag(!!s);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionFlag(!!data.session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}
