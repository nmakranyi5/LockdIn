import { addDays } from "./taskState";
import { dayKey, fromKey } from "./streak";

// A person's daily goal: how many tasks they must finish for the day to count
// toward the streak. 0 means "all of my tasks" (the original rule).
//
// Goals change at the start of the next day, and past days keep the goal they
// had, so the history is kept as a schedule of "from this date, this goal".
export type GoalEntry = { from: string; goal: number };
export type GoalSchedule = GoalEntry[];

export const MAX_GOAL = 10;
export const ALL_TASKS = 0;

// New accounts start on "at least 1 task a day".
export const DEFAULT_GOAL = 1;
export const DEFAULT_GOAL_SCHEDULE: GoalSchedule = [{ from: "0000-01-01", goal: DEFAULT_GOAL }];

// What the server stores for a profile that never chose a goal: the original
// "all my tasks" rule. Anything else has to be sent to the server.
export const SERVER_DEFAULT_SCHEDULE: GoalSchedule = [{ from: "0000-01-01", goal: ALL_TASKS }];

export const isServerDefaultSchedule = (s: GoalSchedule) =>
  JSON.stringify(s) === JSON.stringify(SERVER_DEFAULT_SCHEDULE);

// Before the default changed everyone was on "all my tasks" without choosing it.
// Someone who never touched the setting moves to the new default from tomorrow
// (past days keep the rule they were played with).
export function migrateLegacySchedule(s: GoalSchedule, todayKey: string): GoalSchedule {
  return isServerDefaultSchedule(s)
    ? [...s, { from: tomorrowKey(todayKey), goal: DEFAULT_GOAL }]
    : s;
}

// Each extra task in the goal adds 10% XP to every task on days it is reached.
export const GOAL_BONUS_PER_TASK = 0.1;

export const goalBonus = (goal: number) =>
  goal > 0 ? 1 + GOAL_BONUS_PER_TASK * (Math.min(goal, MAX_GOAL) - 1) : 1;

// "All my tasks" scales with the day: finishing everything on a day with n
// tasks earns the bonus of a goal of n (up to MAX_GOAL).
export const allTasksBonus = (tasksThatDay: number) => goalBonus(Math.min(tasksThatDay, MAX_GOAL));

export const goalLabel = (goal: number) =>
  goal === ALL_TASKS ? "All my tasks" : `At least ${goal} task${goal === 1 ? "" : "s"} in a day`;

// The short form for chips and counters: "3", "All".
export const goalShort = (goal: number) => (goal === ALL_TASKS ? "All" : String(goal));

const validGoal = (g: unknown): g is number =>
  typeof g === "number" && Number.isInteger(g) && g >= 0 && g <= MAX_GOAL;

// Anything unexpected (old data, a bad value from elsewhere) falls back safely.
export function normalizeSchedule(raw: unknown): GoalSchedule {
  if (!Array.isArray(raw)) return DEFAULT_GOAL_SCHEDULE;
  const entries = raw
    .filter(
      (e): e is GoalEntry =>
        !!e && typeof e.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.from) && validGoal(e.goal)
    )
    .sort((a, b) => a.from.localeCompare(b.from));
  // One entry per date (the last one wins), and there is always a starting entry.
  const byDate = new Map(entries.map((e) => [e.from, e]));
  const out = [...byDate.values()];
  if (!out.length || out[0].from > DEFAULT_GOAL_SCHEDULE[0].from) {
    out.unshift(DEFAULT_GOAL_SCHEDULE[0]);
  }
  return out;
}

export function goalFor(schedule: GoalSchedule, day: string): number {
  let goal = ALL_TASKS;
  for (const e of schedule) if (e.from <= day) goal = e.goal;
  return goal;
}

export const tomorrowKey = (todayKey: string) => dayKey(addDays(fromKey(todayKey), 1));

// The change that is waiting for tomorrow, if any.
export function pendingGoal(schedule: GoalSchedule, todayKey: string): GoalEntry | null {
  const future = schedule.filter((e) => e.from > todayKey);
  return future.length ? future[future.length - 1] : null;
}

// Choose a goal. It starts tomorrow; choosing again before then replaces it,
// and choosing what already applies cancels the change.
export function setGoal(schedule: GoalSchedule, goal: number, todayKey: string): GoalSchedule {
  if (!validGoal(goal)) return schedule;
  const kept = schedule.filter((e) => e.from <= todayKey);
  const next = goalFor(kept, tomorrowKey(todayKey)) === goal
    ? kept
    : [...kept, { from: tomorrowKey(todayKey), goal }];
  // Don't grow forever: drop old entries nothing refers to any more.
  const trimmed = next.length > 60 ? next.slice(next.length - 60) : next;
  return JSON.stringify(trimmed) === JSON.stringify(schedule) ? schedule : trimmed;
}
