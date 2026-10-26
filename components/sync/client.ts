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
