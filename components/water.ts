import { addDays } from "./taskState";
import { dayKey, fromKey } from "./streak";

// Hydration: glasses of water per day. Each day's entry remembers when it was
// last changed so the newest edit wins when two devices disagree.
export type WaterEntry = { n: number; at: number };
export type WaterLog = Record<string, WaterEntry>;

export const DEFAULT_WATER_GOAL = 8;
export const MIN_WATER_GOAL = 1;
export const MAX_WATER_GOAL = 30;
export const MAX_GLASSES = 99;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const normalizeWaterGoal = (g: unknown) =>
  typeof g === "number" && Number.isFinite(g)
    ? clamp(Math.round(g), MIN_WATER_GOAL, MAX_WATER_GOAL)
    : DEFAULT_WATER_GOAL;

// Anything unexpected in storage is dropped rather than trusted.
export function normalizeWater(raw: unknown): WaterLog {
  const out: WaterLog = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [day, e] of Object.entries(raw as Record<string, any>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !e) continue;
    if (!Number.isInteger(e.n) || e.n < 0 || e.n > MAX_GLASSES) continue;
    out[day] = { n: e.n, at: Number.isFinite(e.at) ? e.at : 0 };
  }
  return out;
}

export const glassesOn = (log: WaterLog, day: string) => log[day]?.n ?? 0;

// Add (or, with a negative amount, take back) glasses on a day.
export function addGlasses(log: WaterLog, day: string, delta: number, at = Date.now()): WaterLog {
  const next = clamp(glassesOn(log, day) + delta, 0, MAX_GLASSES);
  if (next === glassesOn(log, day)) return log;
  return { ...log, [day]: { n: next, at } };
}

// Combine another copy of the log into this one: per day, the newer edit wins.
export function mergeWater(local: WaterLog, remote: WaterLog): WaterLog {
  let out = local;
  for (const [day, r] of Object.entries(remote)) {
    const l = local[day];
    if (!l || r.at > l.at) {
      if (out === local) out = { ...local };
      out[day] = r;
    }
  }
  return out;
}

// The last `count` days ending today, oldest first.
export function lastDays(todayKey: string, count: number): string[] {
  const today = fromKey(todayKey);
  return Array.from({ length: count }, (_, i) => dayKey(addDays(today, i - (count - 1))));
}
