import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  computeStats,
  dayKey,
  finalizeHistory,
  History,
} from "./streak";
import {
  DEFAULT_GOAL_SCHEDULE,
  goalFor as scheduleGoalFor,
  GoalSchedule,
  normalizeSchedule,
  setGoal as scheduleSetGoal,
} from "./goals";
import { computeXp, finalizeXp, XpLedger } from "./xp";
import { Task } from "./taskState";

export type Profile = { name: string; avatar: string; goalSchedule: GoalSchedule };

export const AVATARS = ["🦊", "🐼", "🐯", "🦉", "🐙", "🚀", "⚡", "🌵"];

const PROFILE_KEY = "@lockdin_profile";
const HISTORY_KEY = "@lockdin_history";
const XP_KEY = "@lockdin_xp";

export const DEFAULT_PROFILE: Profile = {
  name: "",
  avatar: AVATARS[0],
  goalSchedule: DEFAULT_GOAL_SCHEDULE,
};

// Profile + frozen day history, plus live streak stats derived from tasks.
export function useProfile(tasks: Task[], tasksLoaded: boolean, now: number) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<History>({});
  const [xpLedger, setXpLedger] = useState<XpLedger>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, h, x] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
          AsyncStorage.getItem(XP_KEY),
        ]);
        if (p) {
          const saved = JSON.parse(p);
          setProfile({
            ...DEFAULT_PROFILE,
            ...saved,
            goalSchedule: normalizeSchedule(saved.goalSchedule),
          });
        }
        if (h) setHistory(JSON.parse(h));
        if (x) setXpLedger(JSON.parse(x));
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

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(XP_KEY, JSON.stringify(xpLedger));
  }, [xpLedger, loaded]);

  const todayKey = dayKey(new Date(now));

  // The daily goal in force on any given day (changes start tomorrow).
  const goalFor = useCallback(
    (day: string) => scheduleGoalFor(profile.goalSchedule, day),
    [profile.goalSchedule]
  );
  const changeGoal = useCallback(
    (goal: number) =>
      setProfile((p) => ({ ...p, goalSchedule: scheduleSetGoal(p.goalSchedule, goal, todayKey) })),
    [todayKey]
  );

  // Freeze finished days as soon as they end (also catches up after the app
  // has been closed for a while).
  useEffect(() => {
    if (!loaded || !tasksLoaded) return;
    setHistory((prev) => finalizeHistory(tasks, prev, todayKey, goalFor));
    setXpLedger((prev) => finalizeXp(tasks, history, prev, todayKey, goalFor));
  }, [tasks, history, loaded, tasksLoaded, todayKey, goalFor]);

  const stats = useMemo(
    () => computeStats(tasks, history, todayKey, goalFor),
    [tasks, history, todayKey, goalFor]
  );

  const xp = useMemo(
    () => computeXp(tasks, history, xpLedger, todayKey, goalFor),
    [tasks, history, xpLedger, todayKey, goalFor]
  );

  return {
    profile,
    setProfile,
    history,
    setHistory,
    xpLedger,
    setXpLedger,
    stats,
    xp,
    goalFor,
    changeGoal,
    todayKey,
    loaded,
  };
}
