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
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { readAuthParams } from "./linkParams";
import {
  authStorageKey,
  isSupabaseConfigured,
  startupAuthParams,
  supabase,
} from "../sync/client";
import { friendlyError } from "../sync/errors";

type Result = { error?: string };

type AuthContextValue = {
  // False when no Supabase credentials are set: the app runs local-only.
  configured: boolean;
  loading: boolean;
  session: Session | null;
  // Using the app without an account: everything stays on this device.
  guest: boolean;
  continueAsGuest: () => void;
  // Back to the sign-in screen (e.g. to make an account and back up).
  leaveGuest: () => void;
  // Arrived from a "reset your password" email: choose a new password now.
  recovery: boolean;
  updatePassword: (password: string) => Promise<Result>;
  cancelRecovery: () => Promise<void>;
  // An email link that didn't work (expired, already used).
  linkError: string | null;
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

const GUEST_KEY = "@lockdin_guest";

const AuthContext = createContext<AuthContextValue | null>(null);

export const friendlyAuthError = friendlyError;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuest] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  // Stays false without credentials so the static web pre-render matches.
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    (async () => {
      // 1. Open straight away with the session saved on this device. Waiting for
      //    the network here left the app on a black screen when offline.
      try {
        if ((await AsyncStorage.getItem(GUEST_KEY)) === "true" && alive) setGuest(true);
      } catch {}
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
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (next || event === "SIGNED_OUT") setSession(next);
      if (next) {
        // Signed in: no longer a guest. What was made as a guest is kept and uploaded.
        setGuest(false);
        AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Links from emails. On the web supabase-js signs the person in from the
  // address itself; on a phone the link opens the app and we do it here.
  useEffect(() => {
    if (!supabase) return;
    const handle = async (params: Record<string, string>, native: boolean) => {
      if (params.error_description || params.error) {
        const expired = /expired|invalid/i.test(`${params.error_description ?? ""} ${params.error_code ?? ""}`);
        setLinkError(
          expired
            ? "That link has expired or was already used. Request a new one."
            : params.error_description || "That link didn't work. Request a new one."
        );
        return;
      }
      if (params.type === "recovery" && params.access_token) {
        if (native && params.refresh_token) {
          const { error } = await supabase!.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
          if (error) return setLinkError("That link has expired or was already used. Request a new one.");
        }
        setRecovery(true);
      }
    };
    if (Platform.OS === "web") {
      handle(startupAuthParams, false);
      return;
    }
    Linking.getInitialURL()
      .then((u) => {
        if (u) handle(readAuthParams(u), true);
      })
      .catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => handle(readAuthParams(url), true));
    return () => sub.remove();
  }, []);

  const updatePassword = useCallback<AuthContextValue["updatePassword"]>(async (password) => {
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) return { error: friendlyAuthError(error) };
    setRecovery(false);
    return {};
  }, []);

  const cancelRecovery = useCallback(async () => {
    setRecovery(false);
    await supabase?.auth.signOut();
  }, []);

  const continueAsGuest = useCallback(() => {
    setGuest(true);
    AsyncStorage.setItem(GUEST_KEY, "true").catch(() => {});
  }, []);

  const leaveGuest = useCallback(() => {
    setGuest(false);
    AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
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
    // The link in the email brings the person back here: the site itself on the
    // web, the app (lockdin://) on a phone. Supabase must list it as a redirect URL.
    const redirectTo =
      Platform.OS === "web" && typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}`
        : Linking.createURL("/");
    const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo });
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
      guest,
      continueAsGuest,
      leaveGuest,
      recovery,
      updatePassword,
      cancelRecovery,
      linkError,
      signIn,
      signUp,
      signOut,
      resetPassword,
      resendConfirmation,
      deleteAccount,
    }),
    [loading, session, guest, continueAsGuest, leaveGuest, recovery, updatePassword, cancelRecovery, linkError, signIn, signUp, signOut, resetPassword, resendConfirmation, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
