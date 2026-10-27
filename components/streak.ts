import { addDays, Task } from "./taskState";

// A day's tasks are the ones that START on that day.
// `goal` is the day's goal (tasks to finish); 0/absent means all of the day's tasks.
export type DayRecord = { total: number; done: number; goal?: number };
export type History = Record<string, DayRecord>;

export type DayStatus = "complete" | "missed" | "pending" | "empty" | "future";

const pad = (n: number) => n.toString().padStart(2, "0");

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// A day counts when its goal is met: finishing at least `goal` tasks, or every
// task if the goal is "all". Days without tasks don't count either way.
export const isDayComplete = (r: DayRecord) =>
  (r.goal ?? 0) > 0 ? r.done >= r.goal! : r.total > 0 && r.done === r.total;
const isComplete = isDayComplete;

export type GoalLookup = (day: string) => number;

// Tasks grouped per day as they stand right now.
export function summarize(tasks: Task[], goalFor?: GoalLookup): History {
  const out: History = {};
  for (const t of tasks) {
    const k = dayKey(new Date(t.startDate));
    const rec = (out[k] ??= { total: 0, done: 0 });
    rec.total++;
    if (t.completedAt) rec.done++;
  }
  if (goalFor) {
    for (const k of Object.keys(out)) {
      const g = goalFor(k);
      if (g > 0) out[k].goal = g;
    }
  }
  return out;
}

// Freeze the result of every day that has ended. Once a day is recorded it
// never changes, so deleting or finishing tasks afterwards can't alter it.
export function finalizeHistory(
  tasks: Task[],
  history: History,
  todayKey: string,
  goalFor?: GoalLookup
): History {
  const live = summarize(tasks, goalFor);
  let next = history;
  for (const k of Object.keys(live)) {
    if (k < todayKey && !history[k]) {
      if (next === history) next = { ...history };
      next[k] = live[k];
    }
  }
  return next;
}

export type StreakStats = {
  current: number;
  longest: number;
  totalCompleted: number;
  weekDone: number;
  weekTotal: number;
  today: "none" | "pending" | "complete";
  statusOf: (key: string) => DayStatus;
  recordOf: (key: string) => DayRecord | undefined;
};

// Rules: a day counts when it has tasks and all are done. A day with tasks
// that ended unfinished breaks the streak. Days without tasks are neutral,
// and so is today while it is still in progress.
export function computeStats(
  tasks: Task[],
  history: History,
  todayKey: string,
  goalFor?: GoalLookup
): StreakStats {
  const days: History = { ...summarize(tasks, goalFor), ...history };
  const keys = Object.keys(days).sort();

  const todayRec = days[todayKey];
  const todayComplete = !!todayRec && isComplete(todayRec);

  let current = 0;
  if (keys.length) {
    let d = addDays(fromKey(todayKey), -1);
    while (dayKey(d) >= keys[0]) {
      const r = days[dayKey(d)];
      if (r) {
        if (isComplete(r)) current++;
        else break;
      }
      d = addDays(d, -1);
    }
  }
  if (todayComplete) current++;

  let longest = 0;
  let run = 0;
  for (const k of keys) {
    const r = days[k];
    if (isComplete(r)) {
      run++;
      longest = Math.max(longest, run);
    } else if (k !== todayKey) {
      run = 0;
    }
  }

  let totalCompleted = 0;
  for (const k of keys) totalCompleted += days[k].done;

  let weekDone = 0;
  let weekTotal = 0;
  for (let i = 0; i < 7; i++) {
    const r = days[dayKey(addDays(fromKey(todayKey), -i))];
    if (r) {
      weekDone += r.done;
      weekTotal += r.total;
    }
  }

  const statusOf = (key: string): DayStatus => {
    if (key > todayKey) return "future";
    const r = days[key];
    if (!r || r.total === 0) return "empty";
    if (isComplete(r)) return "complete";
    return key === todayKey ? "pending" : "missed";
  };

  return {
    current,
    longest,
    totalCompleted,
    weekDone,
    weekTotal,
    today: !todayRec ? "none" : todayComplete ? "complete" : "pending",
    statusOf,
    recordOf: (k) => days[k],
  };
}

export const MILESTONES = [3, 7, 14, 30, 100];
