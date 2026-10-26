import { colors } from "../assets/colors/colors";

export type Task = {
  title: string;
  startDate: Date;
  endDate: Date;
  repeats?: string;
  startNotificationId?: string;
  deadlineNotificationId?: string;
  reminderNotificationId?: string;
  startedAt?: number | null;
  completedAt?: number | null;
};

export type TaskState = {
  label: string;
  timeMs: number;
  isOverdue: boolean;
  isDone: boolean;
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

export function getTaskState(task: Task, nowMs: number): TaskState {
  const startMs = new Date(task.startDate).setSeconds(0, 0);
  const endMs = new Date(task.endDate).setSeconds(0, 0);

  let label = "";
  let timeMs = 0;
  let isOverdue = false;
  let isDone = false;
  let status = {
    text: "Upcoming",
    color: colors.accent,
    bg: colors.accentSoft,
  };

  if (task.completedAt && task.startedAt) {
    label = "Time spent";
    timeMs = Math.max(0, task.completedAt - task.startedAt);
    isDone = true;
    status = { text: "Done", color: colors.success, bg: colors.successSoft };
  } else if (!task.startedAt && nowMs < startMs) {
    label = "Starts in";
    timeMs = Math.max(0, startMs - nowMs);
  } else if (nowMs < endMs) {
    label = "Time remaining";
    timeMs = Math.max(0, endMs - nowMs);
    status = task.startedAt
      ? { text: "In progress", color: colors.highlight, bg: colors.accentSoft }
      : { text: "Ready", color: colors.warning, bg: colors.accentSoft };
  } else {
    label = "Deadline passed by";
    timeMs = Math.max(0, nowMs - endMs);
    isOverdue = true;
    status = { text: "Overdue", color: colors.danger, bg: colors.dangerSoft };
  }

  const progress =
    task.startedAt && !task.completedAt
      ? Math.min(
          1,
          Math.max(
            0,
            (nowMs - task.startedAt) / Math.max(1, endMs - task.startedAt)
          )
        )
      : null;

  return { label, timeMs, isOverdue, isDone, progress, status };
}
