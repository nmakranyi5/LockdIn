import { kindOf, Task } from "./taskState";

// What the phone is told about each open task:
//  - heads-ups 60, 30, 15 and 5 minutes before it starts
//  - an alert when it starts
//  - a reminder every 2 minutes after the start time until it is started
//    (timer) or done, up to NAG_MAX of them, and never past the deadline
//  - an alert at the deadline
//  - for a running timer with an estimate: check-ins once it is overrun
export const PRE_START_MIN = [60, 30, 15, 5];
export const NAG_EVERY_MIN = 2;
export const NAG_MAX = 15; // 15 x 2 min = the first half hour
const CHECK_IN_OFFSETS_MIN = [0, 15, 30, 60];

const SOON_MS = 2000; // a trigger must be comfortably in the future
const PREFIX = "lk:";

export type Planned = { id: string; title: string; body: string; date: Date };

// A task's start/deadline as scheduled: whole minutes, deadline after the start.
export function normalizeWindow(task: Pick<Task, "startDate" | "endDate">) {
  const startDate = new Date(task.startDate);
  startDate.setSeconds(0, 0);
  let endDate = new Date(task.endDate);
  endDate.setSeconds(0, 0);
  if (endDate.getTime() <= startDate.getTime()) {
    endDate = new Date(startDate.getTime() + 60_000);
  }
  return { startDate, endDate };
}

const untilText = (m: number) => (m === 60 ? "1 hour" : `${m} minutes`);

// Everything that should be scheduled for these tasks, soonest first.
export function planNotifications(tasks: Task[], now = Date.now()): Planned[] {
  const out: Planned[] = [];
  const add = (taskId: string, slot: string, title: string, body: string, date: Date) => {
    if (date.getTime() > now + SOON_MS) out.push({ id: `${PREFIX}${taskId}:${slot}`, title, body, date });
  };

  for (const task of tasks) {
    if (task.completedAt) continue;
    const { startDate, endDate } = normalizeWindow(task);
    const started = !!task.startedAt;
    const timer = kindOf(task) === "timer";

    if (!started) {
      for (const m of PRE_START_MIN) {
        add(
          task.id,
          `pre${m}`,
          `Starting in ${untilText(m)}`,
          task.title,
          new Date(startDate.getTime() - m * 60_000)
        );
      }
      add(task.id, "start", "Time to start task!", task.title, startDate);
      for (let k = 1; k <= NAG_MAX; k++) {
        const when = new Date(startDate.getTime() + k * NAG_EVERY_MIN * 60_000);
        if (when.getTime() >= endDate.getTime()) break;
        add(
          task.id,
          `nag${k}`,
          timer ? "Hey! Start your task!" : "Don't forget your task!",
          timer ? `You are overdue to start: ${task.title}` : `It's time for: ${task.title}`,
          when
        );
      }
    }

    add(task.id, "end", "Task deadline reached!", task.title, endDate);

    if (started && timer && task.estimateMinutes) {
      for (const offset of CHECK_IN_OFFSETS_MIN) {
        add(
          task.id,
          `chk${offset}`,
          offset === 0 ? "Your estimate is up" : "Still working?",
          offset === 0
            ? `"${task.title}": time's up on your estimate. Still working, or did you forget to stop the timer?`
            : `"${task.title}" is ${offset} min over your estimate. Still on it?`,
          new Date(task.startedAt! + (task.estimateMinutes + offset) * 60_000)
        );
      }
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// The soonest `budget` of the plan.
export const withinBudget = (plan: Planned[], budget: number) => plan.slice(0, budget);

