import * as Notifications from "./notifications";
import { kindOf, Task } from "./taskState";

type Schedulable = Pick<Task, "title" | "startDate" | "endDate" | "kind">;

export const normalizeStartTime = (selected: Date) => {
  const normalized = new Date(selected);
  normalized.setSeconds(0, 0);
  if (normalized.getTime() <= Date.now()) {
    normalized.setMinutes(normalized.getMinutes() + 1);
  }
  return normalized;
};

// Schedules the start / deadline / "overdue to start" notifications and
// returns the normalized dates alongside their ids. Pass `started` for tasks
// that are already running so the start nags are skipped.
export async function scheduleTaskNotifications(
  task: Schedulable,
  started = false
) {
  const startDate = normalizeStartTime(task.startDate);
  let endDate = new Date(task.endDate);
  endDate.setSeconds(0, 0);
  if (endDate.getTime() <= startDate.getTime()) {
    endDate = new Date(startDate.getTime() + 60_000);
  }

  const ids: Pick<
    Task,
    "startNotificationId" | "deadlineNotificationId" | "reminderNotificationId"
  > = {};

  if (!started) {
    ids.startNotificationId = await Notifications.scheduleNotificationAsync({
      content: { title: "Time to start task!", body: task.title },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: startDate,
      },
    });

    // Only timer tasks have a "start" action to nag about.
    if (kindOf(task as Task) === "timer") {
      const secondsUntilStart = (startDate.getTime() - Date.now()) / 1000;
      ids.reminderNotificationId = await Notifications.scheduleNotificationAsync(
        {
          content: {
            title: "Hey! Start your task!",
            body: `You are overdue to start: ${task.title}`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(60, Math.floor(secondsUntilStart + 60)),
            repeats: true,
          },
        }
      );
    }
  }

  ids.deadlineNotificationId = await Notifications.scheduleNotificationAsync({
    content: { title: "Task deadline reached!", body: task.title },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: endDate,
    },
  });

  return { startDate, endDate, ...ids };
}

export function cancelTaskNotifications(
  task: Task | undefined,
  ...kinds: ("startNotificationId" | "deadlineNotificationId" | "reminderNotificationId")[]
) {
  const all = kinds.length
    ? kinds
    : (["startNotificationId", "deadlineNotificationId", "reminderNotificationId"] as const);
  all.forEach((k) => {
    const id = task?.[k];
    if (id) Notifications.cancelScheduledNotificationAsync(id);
  });
}
