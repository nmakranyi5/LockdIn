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
  migrateLegacySchedule,
  SERVER_DEFAULT_SCHEDULE,
} from "./goals";
import { normalizeAvatar } from "./avatar";
import {
  addGlasses,
  DEFAULT_WATER_GOAL,
  normalizeWater,
  normalizeWaterGoal,
  WaterLog,
} from "./water";
import { computeXp, finalizeXp, XpLedger } from "./xp";
import { Task } from "./taskState";

export type Profile = {
  name: string;
  avatar: string;
  goalSchedule: GoalSchedule;
  // Glasses of water a day to aim for.
  waterGoal: number;
};

export const AVATARS = ["🦊", "🐼", "🐯", "🦉", "🐙", "🚀", "⚡", "🌵"];

const PROFILE_KEY = "@lockdin_profile";
const HISTORY_KEY = "@lockdin_history";
const XP_KEY = "@lockdin_xp";
const WATER_KEY = "@lockdin_water";

export const DEFAULT_PROFILE: Profile = {
  name: "",
  avatar: AVATARS[0],
  goalSchedule: DEFAULT_GOAL_SCHEDULE,
  waterGoal: DEFAULT_WATER_GOAL,
};

// Profile + frozen day history, plus live streak stats derived from tasks.
export function useProfile(tasks: Task[], tasksLoaded: boolean, now: number) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<History>({});
  const [xpLedger, setXpLedger] = useState<XpLedger>({});
  const [water, setWater] = useState<WaterLog>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, h, x, w] = await Promise.all([
          AsyncStorage.getItem(PROFILE_KEY),
          AsyncStorage.getItem(HISTORY_KEY),
          AsyncStorage.getItem(XP_KEY),
          AsyncStorage.getItem(WATER_KEY),
        ]);
        if (p) {
          const saved = JSON.parse(p);
          setProfile({
            ...DEFAULT_PROFILE,
            ...saved,
            avatar: normalizeAvatar(saved.avatar, AVATARS[0]),
            // A profile saved before goals existed was on "all my tasks".
            goalSchedule: migrateLegacySchedule(
              normalizeSchedule(saved.goalSchedule ?? SERVER_DEFAULT_SCHEDULE),
              dayKey(new Date())
            ),
            waterGoal: normalizeWaterGoal(saved.waterGoal ?? DEFAULT_WATER_GOAL),
          });
        }
        if (h) setHistory(JSON.parse(h));
        if (x) setXpLedger(JSON.parse(x));
        if (w) setWater(normalizeWater(JSON.parse(w)));
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

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(WATER_KEY, JSON.stringify(water));
  }, [water, loaded]);

  const todayKey = dayKey(new Date(now));

  // + / undo for today's glasses of water.
  const addWater = useCallback(
    (delta: number) => setWater((w) => addGlasses(w, todayKey, delta)),
    [todayKey]
  );
  const changeWaterGoal = useCallback(
    (goal: number) => setProfile((p) => ({ ...p, waterGoal: normalizeWaterGoal(goal) })),
    []
  );

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
    water,
    setWater,
    addWater,
    changeWaterGoal,
    stats,
    xp,
    goalFor,
    changeGoal,
    todayKey,
    loaded,
  };
}
