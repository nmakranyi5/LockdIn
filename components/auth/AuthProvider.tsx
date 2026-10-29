import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authStorageKey, isSupabaseConfigured, supabase } from "../sync/client";
import { friendlyError } from "../sync/errors";

type Result = { error?: string };

type AuthContextValue = {
  // False when no Supabase credentials are set: the app runs local-only.
  configured: boolean;
  loading: boolean;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (
    email: string,
    password: string,
    username?: string
  ) => Promise<Result & { needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<Result>;
  resendConfirmation: (email: string) => Promise<Result>;
  deleteAccount: () => Promise<Result>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const friendlyAuthError = friendlyError;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Stays false without credentials so the static web pre-render matches.
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      // 1. Open straight away with the session saved on this device. Waiting for
      //    the network here left the app on a black screen when offline.
      try {
        const raw = authStorageKey ? await AsyncStorage.getItem(authStorageKey) : null;
        const saved = raw ? JSON.parse(raw) : null;
        if (alive && saved?.user?.id) setSession(saved as Session);
      } catch {}
      if (alive) setLoading(false);
      // 2. Then check it with the server in the background. If that can't be
      //    reached, keep using the saved session: being offline isn't signing out.
      try {
        const { data, error } = await supabase!.auth.getSession();
        if (!alive) return;
        if (data.session) setSession(data.session);
        else if (!error) setSession(null);
      } catch {}
    })();
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // A failed refresh while offline reports "no session"; only a real
      // sign-out (or the server rejecting the session) should log you out.
      if (next || event === "SIGNED_OUT") setSession(next);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (email, password) => {
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: friendlyAuthError(error) } : {};
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(async (email, password, username) => {
    const { data, error } = await supabase!.auth.signUp({
      email: email.trim(),
      password,
      // Stored with the account so the database can create the profile with it,
      // even when email confirmation means there is no session yet.
      options: username ? { data: { username } } : undefined,
    });
    if (error) return { error: friendlyAuthError(error) };
    // With email confirmation on, there is no session until the link is used.
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const resetPassword = useCallback<AuthContextValue["resetPassword"]>(async (email) => {
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim());
    return error ? { error: friendlyAuthError(error) } : {};
  }, []);

  const resendConfirmation = useCallback<AuthContextValue["resendConfirmation"]>(async (email) => {
    const { error } = await supabase!.auth.resend({ type: "signup", email: email.trim() });
    return error ? { error: friendlyAuthError(error) } : {};
  }, []);

  const deleteAccount = useCallback<AuthContextValue["deleteAccount"]>(async () => {
    // Removes the account and (by cascade) all of its data. The caller clears
    // the local copy and then signs out.
    const { error } = await supabase!.rpc("delete_my_account");
    return error ? { error: friendlyAuthError(error) } : {};
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      signIn,
      signUp,
      signOut,
      resetPassword,
      resendConfirmation,
      deleteAccount,
    }),
    [loading, session, signIn, signUp, signOut, resetPassword, resendConfirmation, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
