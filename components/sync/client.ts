import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import "react-native-url-polyfill/auto";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Without credentials the app runs purely local, exactly as before.
export const isSupabaseConfigured = !!url && !!anonKey;

if (__DEV__ && !isSupabaseConfigured) {
  console.warn(
    "[LockdIn] Supabase is not configured, so the app is running local-only with no sign-in. " +
      "Create a .env file in the project root with EXPO_PUBLIC_SUPABASE_URL and " +
      "EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart with: npx expo start -c"
  );
}

// Where supabase-js keeps the signed-in session (its default key), so the app can
// read it straight away without waiting for the network.
export const authStorageKey = isSupabaseConfigured
  ? `sb-${new URL(url!).hostname.split(".")[0]}-auth-token`
  : null;

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        // Skipped during the static web pre-render, where there is no storage.
        persistSession: typeof window !== "undefined",
        detectSessionInUrl: Platform.OS === "web",
      },
    })
  : null;

// Only refresh tokens while the app is in the foreground.
if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// A quick check that the server can be reached at all. Without it, a sync that
// starts offline sits waiting for the library's own long retries before the app
// finds out it has no connection.
export async function canReachServer(timeoutMs = 5000): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey! }, signal: controller.signal });
    return true; // any answer, even an error status, means we are online
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
