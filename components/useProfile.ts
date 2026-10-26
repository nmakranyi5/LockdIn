import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  computeStats,
  dayKey,
  finalizeHistory,
  History,
} from "./streak";
import { Task } from "./taskState";

export type Profile = { name: string; avatar: string };

export const AVATARS = ["🦊", "🐼", "🐯", "🦉", "🐙", "🚀", "⚡", "🌵"];

const PROFILE_KEY = "@lockdin_profile";
const HISTORY_KEY = "@lockdin_history";

export const DEFAULT_PROFILE: Profile = { name: "", avatar: AVATARS[0] };

// Profile + frozen day history, plus live streak stats derived from tasks.
export function useProfile(tasks: Task[], tasksLoaded: boolean, now: number) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<History>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, h] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
        ]);
        if (p) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(p) });
        if (h) setHistory(JSON.parse(h));
      } catch (e) {
        console.log("Error loading profile", e);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history, loaded]);

  const todayKey = dayKey(new Date(now));

  // Freeze finished days as soon as they end (also catches up after the app
  // has been closed for a while).
  useEffect(() => {
    if (!loaded || !tasksLoaded) return;
    setHistory((prev) => finalizeHistory(tasks, prev, todayKey));
  }, [tasks, loaded, tasksLoaded, todayKey]);

  const stats = useMemo(
    () => computeStats(tasks, history, todayKey),
    [tasks, history, todayKey]
  );

  return { profile, setProfile, history, setHistory, stats, todayKey, loaded };
}
