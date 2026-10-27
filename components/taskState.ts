import { colors } from "../assets/colors/colors";

export type TaskKind = "timer" | "checklist" | "oneshot";
export type Priority = "low" | "normal" | "important" | "urgent";
export type Repeat = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export type ChecklistItem = { id: string; text: string; done: boolean };

export type Task = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  kind?: TaskKind;
  priority?: Priority;
  repeats?: string;
  items?: ChecklistItem[];
  spawnedNext?: boolean;
  seriesId?: string;
  // Timer tasks: how long the person expects the work to take.
  estimateMinutes?: number;
  checkInNotificationIds?: string[];
  // When the next "still working?" prompt is due (set when snoozed).
  nextCheckInAt?: number;
  startNotificationId?: string;
  deadlineNotificationId?: string;
  reminderNotificationId?: string; // legacy single repeating reminder
  reminderNotificationIds?: string[];
  startedAt?: number | null;
  completedAt?: number | null;
};

export const kindOf = (t: Task): TaskKind => t.kind ?? "timer";
export const priorityOf = (t: Task): Priority => t.priority ?? "normal";
export const repeatOf = (t: Task): Repeat => {
  const r = t.repeats as Repeat | undefined;
  return r && r !== "none" && ["daily", "weekdays", "weekly", "monthly"].includes(r)
    ? r
    : "none";
};

// All occurrences of a repeating task share a series key.
export const seriesKey = (t: Task) => t.seriesId ?? t.id;

export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export type TaskState = {
  label: string;
  timeMs: number;
  valueText?: string;
  isOverdue: boolean;
  isOvertime: boolean;
  isDone: boolean;
  // Not finished, and its day is over: it stays on that day as a record.
  isMissed: boolean;
  progress: number | null;
  status: { text: string; color: string; bg: string };
};

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const isSameDay = (a: Date, b: Date) =>
  a.toDateString() === b.toDateString();

export const formatMs = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

export const formatClock = (d: Date) =>
  new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// A task from an earlier day that was never finished and is past its deadline.
export function isMissedTask(task: Task, nowMs: number): boolean {
  if (task.completedAt) return false;
  const startDay = new Date(task.startDate);
  startDay.setHours(0, 0, 0, 0);
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  return startDay.getTime() < today.getTime() && nowMs >= new Date(task.endDate).getTime();
}

export function getTaskState(task: Task, nowMs: number): TaskState {
  const kind = kindOf(task);
  const startMs = new Date(task.startDate).setSeconds(0, 0);
  const endMs = new Date(task.endDate).setSeconds(0, 0);
  const items = task.items ?? [];
  const checked = items.filter((i) => i.done).length;

  let label = "";
  let timeMs = 0;
  let valueText: string | undefined;
  let isOverdue = false;
  let isOvertime = false;
  let isDone = false;
  let isMissed = false;
  let status = {
    text: "Upcoming",
    color: colors.accent,
    bg: colors.accentSoft,
  };

  if (task.completedAt) {
    isDone = true;
    status = { text: "Done", color: colors.success, bg: colors.successSoft };
    if (kind === "timer" && task.startedAt) {
      label = "Time spent";
      timeMs = Math.max(0, task.completedAt - task.startedAt);
    } else {
      label = "Completed at";
      valueText = formatClock(new Date(task.completedAt));
    }
  } else if (isMissedTask(task, nowMs)) {
    isMissed = true;
    isOverdue = true;
    label = "Deadline was";
    valueText = formatClock(new Date(task.endDate));
    status = { text: "Missed", color: colors.danger, bg: colors.dangerSoft };
  } else if (kind === "timer" && task.startedAt && task.estimateMinutes) {
    // Running against an estimate: count it down, then count the overtime up.
    const estimateMs = task.estimateMinutes * 60_000;
    const elapsed = Math.max(0, nowMs - task.startedAt);
    isOverdue = nowMs >= endMs;
    isOvertime = elapsed >= estimateMs;
    if (isOvertime) {
      label = "Over estimate by";
      timeMs = elapsed - estimateMs;
    } else {
      label = "Estimate remaining";
      timeMs = estimateMs - elapsed;
    }
    status = isOverdue
      ? { text: "Overdue", color: colors.danger, bg: colors.dangerSoft }
      : isOvertime
      ? { text: "Overtime", color: colors.warning, bg: colors.warningSoft }
      : { text: "In progress", color: colors.highlight, bg: colors.accentSoft };
  } else if (!task.startedAt && nowMs < startMs) {
    label = "Starts in";
    timeMs = Math.max(0, startMs - nowMs);
  } else if (nowMs < endMs) {
    label = kind === "timer" ? "Time remaining" : "Due in";
    timeMs = Math.max(0, endMs - nowMs);
    if (kind === "timer") {
      status = task.startedAt
        ? { text: "In progress", color: colors.highlight, bg: colors.accentSoft }
        : { text: "Ready", color: colors.warning, bg: colors.accentSoft };
    } else {
      status =
        checked > 0
          ? { text: "In progress", color: colors.highlight, bg: colors.accentSoft }
          : { text: "Open", color: colors.warning, bg: colors.accentSoft };
    }
  } else {
    label = kind === "timer" ? "Deadline passed by" : "Overdue by";
    timeMs = Math.max(0, nowMs - endMs);
    isOverdue = true;
    status = { text: "Overdue", color: colors.danger, bg: colors.dangerSoft };
  }

  let progress: number | null = null;
  if (kind === "timer" && task.startedAt && !task.completedAt) {
    const span = task.estimateMinutes
      ? task.estimateMinutes * 60_000
      : endMs - task.startedAt;
    progress = Math.min(1, Math.max(0, (nowMs - task.startedAt) / Math.max(1, span)));
  } else if (kind === "checklist" && items.length > 0) {
    progress = checked / items.length;
  }

  return {
    label,
    timeMs,
    valueText,
    isOverdue,
    isOvertime,
    isDone,
    isMissed,
    progress,
    status,
  };
}

const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

function advance(d: Date, repeat: Repeat): Date {
  const x = new Date(d);
  if (repeat === "daily") x.setDate(x.getDate() + 1);
  else if (repeat === "weekly") x.setDate(x.getDate() + 7);
  else if (repeat === "weekdays") {
    do x.setDate(x.getDate() + 1);
    while (x.getDay() === 0 || x.getDay() === 6);
  } else if (repeat === "monthly") {
    const day = x.getDate();
    x.setDate(1);
    x.setMonth(x.getMonth() + 1);
    x.setDate(Math.min(day, daysInMonth(x.getFullYear(), x.getMonth())));
  }
  return x;
}

// Next occurrence of a repeating task whose deadline is still in the future.
export function nextOccurrence(task: Task, nowMs: number) {
  const repeat = repeatOf(task);
  if (repeat === "none") return null;
  const duration =
    new Date(task.endDate).getTime() - new Date(task.startDate).getTime();
  let start = new Date(task.startDate);
  for (let i = 0; i < 400; i++) {
    start = advance(start, repeat);
    if (start.getTime() + duration > nowMs) {
      return {
        startDate: start,
        endDate: new Date(start.getTime() + duration),
      };
    }
  }
  return null;
}

export const CHECK_IN_INTERVAL_MIN = 15;
// A finish this far under the estimate gets a "did you really finish?" prompt.
export const EARLY_FINISH_RATIO = 0.8;

// A running timer task is due a "still working?" check-in once it passes its
// estimate, and again every CHECK_IN_INTERVAL_MIN after the person snoozes it.
export function isCheckInDue(task: Task, nowMs: number) {
  if (kindOf(task) !== "timer" || !task.estimateMinutes) return false;
  if (!task.startedAt || task.completedAt) return false;
  const due = task.nextCheckInAt ?? task.startedAt + task.estimateMinutes * 60_000;
  return nowMs >= due;
}

export function isEarlyFinish(task: Task, nowMs: number) {
  if (!task.startedAt || !task.estimateMinutes) return false;
  return nowMs - task.startedAt < task.estimateMinutes * 60_000 * EARLY_FINISH_RATIO;
}

// "1h 20m", "45m", "under a minute"
export function humanDuration(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "under a minute";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}
