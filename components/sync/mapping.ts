import { History } from "../streak";
import { ChecklistItem, Task, kindOf, priorityOf, repeatOf } from "../taskState";

// Row shape of public.tasks as the client reads it.
export type TaskRow = {
  id: string;
  title: string;
  kind: string;
  priority: string;
  repeats: string;
  start_at: string;
  end_at: string;
  started_at: string | null;
  completed_at: string | null;
  estimate_minutes: number | null;
  items: ChecklistItem[];
  series_id: string | null;
  spawned_next: boolean;
  deleted_at: string | null;
  updated_at: string;
};

// Per-device state. Notification ids only mean something on the device that
// scheduled them, so they never leave it.
export const LOCAL_ONLY_FIELDS = [
  "startNotificationId",
  "deadlineNotificationId",
  "reminderNotificationId",
  "reminderNotificationIds",
  "checkInNotificationIds",
  "nextCheckInAt",
] as const;

const iso = (ms: number | null | undefined) =>
  ms ? new Date(ms).toISOString() : null;
const ms = (s: string | null) => (s ? new Date(s).getTime() : null);

// Columns we write. deleted_at is deliberately absent: an edit made on one
// device must never un-delete a task another device deleted.
export function taskToRow(t: Task) {
  return {
    id: t.id,
    title: t.title ?? "",
    kind: kindOf(t),
    priority: priorityOf(t),
    repeats: repeatOf(t),
    start_at: new Date(t.startDate).toISOString(),
    end_at: new Date(t.endDate).toISOString(),
    started_at: iso(t.startedAt),
    completed_at: iso(t.completedAt),
    estimate_minutes: t.estimateMinutes ?? null,
    items: t.items ?? [],
    series_id: t.seriesId ?? null,
    spawned_next: !!t.spawnedNext,
  };
}

export function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind as Task["kind"],
    priority: r.priority as Task["priority"],
    repeats: r.repeats,
    startDate: new Date(r.start_at),
    endDate: new Date(r.end_at),
    startedAt: ms(r.started_at),
    completedAt: ms(r.completed_at),
    estimateMinutes: r.estimate_minutes ?? undefined,
    items: r.items ?? [],
    seriesId: r.series_id ?? undefined,
    spawnedNext: r.spawned_next,
  };
}

// Fingerprint of everything that syncs. Two tasks with the same signature are
// the same as far as the server is concerned.
export function syncSig(t: Task): string {
  return JSON.stringify(taskToRow(t));
}

// Keep this device's notification bookkeeping when a remote copy replaces a
// local task.
export function mergeLocalOnly(remote: Task, local?: Task): Task {
  if (!local) return remote;
  const merged: Task = { ...remote };
  for (const k of LOCAL_ONLY_FIELDS) {
    if (local[k] !== undefined) (merged as any)[k] = local[k];
  }
  return merged;
}

export type HistoryRow = { day: string; total: number; done: number; goal?: number };

export const historyToRows = (h: History, days: string[]): HistoryRow[] =>
  days.filter((d) => h[d]).map((day) => ({ day, ...h[day] }));
