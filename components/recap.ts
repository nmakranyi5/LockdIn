import { goalLabel } from "./goals";
import { dayKey, DayRecord, fromKey, isDayComplete } from "./streak";
import { addDays, formatClock, Priority, priorityOf, Task } from "./taskState";
import { glassesOn, WaterLog } from "./water";

// The morning recap: how yesterday went, and a glance at today.
export type Recap = {
  yesterdayKey: string;
  yesterday: {
    total: number;
    done: Task[];
    notDone: Task[];
    xp: number;
    goal: number;
    // Did the day count for the streak? null when nothing was scheduled.
    kept: boolean | null;
    water: { glasses: number; goal: number };
  };
  streak: number;
  today: {
    tasks: { id: string; title: string; time: string; priority: Priority; kind: string }[];
    total: number;
    goalText: string;
  };
  // Worth showing at all: something happened yesterday.
  hasContent: boolean;
};

type Input = {
  tasks: Task[];
  history: Record<string, DayRecord>;
  water: WaterLog;
  waterGoal: number;
  todayKey: string;
  streak: number;
  xpForDay: (key: string) => number;
  goalFor: (key: string) => number;
};

const onDay = (tasks: Task[], key: string) =>
  tasks
    .filter((t) => dayKey(new Date(t.startDate)) === key)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

export function buildRecap(i: Input): Recap {
  const yesterdayKey = dayKey(addDays(fromKey(i.todayKey), -1));
  const yTasks = onDay(i.tasks, yesterdayKey);
  const done = yTasks.filter((t) => !!t.completedAt);
  const notDone = yTasks.filter((t) => !t.completedAt);
  const goal = i.goalFor(yesterdayKey);
  // The frozen result if there is one, otherwise worked out from the tasks.
  const rec: DayRecord = i.history[yesterdayKey] ?? { total: yTasks.length, done: done.length, goal };
  const glasses = glassesOn(i.water, yesterdayKey);

  const tToday = onDay(i.tasks, i.todayKey);
  return {
    yesterdayKey,
    yesterday: {
      total: yTasks.length,
      done,
      notDone,
      xp: i.xpForDay(yesterdayKey),
      goal,
      kept: yTasks.length === 0 ? null : isDayComplete(rec),
      water: { glasses, goal: i.waterGoal },
    },
    streak: i.streak,
    today: {
      tasks: tToday.map((t) => ({
        id: t.id,
        title: t.title,
        time: formatClock(new Date(t.startDate)),
        priority: priorityOf(t),
        kind: t.kind ?? "timer",
      })),
      total: tToday.length,
      goalText: goalLabel(i.goalFor(i.todayKey)),
    },
    hasContent: yTasks.length > 0 || glasses > 0,
  };
}
