import { History, dayKey, fromKey, summarize } from "./streak";
import { addDays, Priority, priorityOf, Task } from "./taskState";

// ---------------------------------------------------------------------------
// Earning XP
// ---------------------------------------------------------------------------
export const BASE_XP: Record<Priority, number> = {
  low: 5,
  normal: 10,
  important: 20,
  urgent: 30,
};

// Only a day's most valuable tasks count, so piles of trivial tasks can't be
// farmed for XP.
export const DAILY_TASK_CAP = 10;

// Each day of the streak going INTO a day adds 5%, up to double XP.
export const STREAK_BONUS_PER_DAY = 0.05;
export const MAX_STREAK_BONUS_DAYS = 20;

export const streakMultiplier = (streak: number) =>
  1 + STREAK_BONUS_PER_DAY * Math.min(Math.max(0, streak), MAX_STREAK_BONUS_DAYS);

export const taskXp = (task: Task, multiplier: number) =>
  Math.round(BASE_XP[priorityOf(task)] * multiplier);

// Consecutive finished days ending the day before `day` (same rules as the
// streak: days without tasks are neutral, an unfinished day breaks it).
export function streakBefore(days: History, day: string): number {
  const keys = Object.keys(days);
  if (!keys.length) return 0;
  const earliest = keys.sort()[0];
  let n = 0;
  let d = addDays(fromKey(day), -1);
  for (let i = 0; i < 400 && dayKey(d) >= earliest; i++) {
    const r = days[dayKey(d)];
    if (r) {
      if (r.total > 0 && r.done === r.total) n++;
      else break;
    }
    d = addDays(d, -1);
  }
  return n;
}

// The completed tasks that earn XP on a day, best first, up to the cap.
function counted(tasksOfDay: Task[]) {
  return tasksOfDay
    .filter((t) => !!t.completedAt)
    .sort(
      (a, b) =>
        BASE_XP[priorityOf(b)] - BASE_XP[priorityOf(a)] ||
        (a.completedAt ?? 0) - (b.completedAt ?? 0)
    )
    .slice(0, DAILY_TASK_CAP);
}

export function dayXp(tasksOfDay: Task[], streak: number) {
  const multiplier = streakMultiplier(streak);
  const perTask = new Map<string, number>();
  let total = 0;
  for (const t of counted(tasksOfDay)) {
    const xp = taskXp(t, multiplier);
    perTask.set(t.id, xp);
    total += xp;
  }
  return { total, multiplier, perTask };
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------
// Total XP at which level n begins: 0, 100, 300, 600, 1000, ...
export const xpForLevel = (n: number) => Math.max(0, 50 * (n - 1) * n);

export const LEVEL_TITLES: [number, string][] = [
  [1, "Newcomer"],
  [3, "Getting Started"],
  [5, "Focused"],
  [10, "Dedicated"],
  [15, "Relentless"],
  [25, "Legend"],
];

export const titleForLevel = (level: number) =>
  [...LEVEL_TITLES].reverse().find(([from]) => level >= from)![1];

export function levelFromXp(xp: number) {
  const safe = Math.max(0, Math.floor(xp));
  let level = Math.max(1, Math.floor(0.5 + Math.sqrt(2500 + 200 * safe) / 100));
  // Guard against floating-point error right on a boundary.
  while (xpForLevel(level + 1) <= safe) level++;
  while (level > 1 && xpForLevel(level) > safe) level--;
  const start = xpForLevel(level);
  const span = xpForLevel(level + 1) - start;
  const into = safe - start;
  return {
    level,
    title: titleForLevel(level),
    xpIntoLevel: into,
    xpForNext: span,
    toNext: span - into,
    progress: span > 0 ? into / span : 0,
  };
}

// ---------------------------------------------------------------------------
// Putting it together
// ---------------------------------------------------------------------------
export type XpLedger = Record<string, number>;

const groupByDay = (tasks: Task[]) => {
  const byDay: Record<string, Task[]> = {};
  for (const t of tasks) (byDay[dayKey(new Date(t.startDate))] ??= []).push(t);
  return byDay;
};

// Freeze the XP of every finished day (once). Days that already have an entry
// never change, so deleting or finishing tasks afterwards can't alter them.
// Also fills in days that were finished before XP existed, when their tasks are
// still around.
export function finalizeXp(
  tasks: Task[],
  history: History,
  ledger: XpLedger,
  todayKey: string
): XpLedger {
  const byDay = groupByDay(tasks);
  const days: History = { ...summarize(tasks), ...history };
  let next = ledger;
  for (const [k, list] of Object.entries(byDay)) {
    if (k >= todayKey || ledger[k] !== undefined) continue;
    if (next === ledger) next = { ...ledger };
    next[k] = dayXp(list, streakBefore(days, k)).total;
  }
  return next;
}

export type XpSummary = {
  total: number;
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNext: number;
  toNext: number;
  progress: number;
  today: { xp: number; multiplier: number; streakBefore: number; counted: number };
  // XP breakdown for one day, computed from the tasks as they are now.
  forDay: (key: string) => { total: number; multiplier: number; perTask: Map<string, number> };
};

export function computeXp(
  tasks: Task[],
  history: History,
  ledger: XpLedger,
  todayKey: string
): XpSummary {
  const byDay = groupByDay(tasks);
  const days: History = { ...summarize(tasks), ...history };

  const forDay = (key: string) => dayXp(byDay[key] ?? [], streakBefore(days, key));

  // Finished days use their frozen value; anything else is worked out live.
  let total = 0;
  for (const [k, list] of Object.entries(byDay)) {
    total +=
      k < todayKey && ledger[k] !== undefined
        ? ledger[k]
        : dayXp(list, streakBefore(days, k)).total;
  }
  // Days whose tasks have since been deleted still count.
  for (const [k, xp] of Object.entries(ledger)) if (!byDay[k]) total += xp;

  const today = forDay(todayKey);
  const lvl = levelFromXp(total);
  return {
    total,
    ...lvl,
    today: {
      xp: today.total,
      multiplier: today.multiplier,
      streakBefore: streakBefore(days, todayKey),
      counted: today.perTask.size,
    },
    forDay,
  };
}
