import * as Notifications from "./notifications";
import { kindOf, Task } from "./taskState";

type Schedulable = Pick<Task, "title" | "startDate" | "endDate" | "kind">;

// Follow-up nudges after the start time for a timer task that hasn't been
// started. Finite on purpose: they stop at the deadline.
const REMINDER_OFFSETS_MIN = [5, 15, 30, 60];

// A trigger date must be comfortably in the future to be schedulable.
const isFuture = (d: Date) => d.getTime() > Date.now() + 2000;

const at = (title: string, body: string, date: Date) =>
  Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
    },
  });

// Schedules the start / follow-up / deadline notifications. Dates are never
// moved: anything whose time has already passed is simply not scheduled.
// Pass `started` for tasks that are already running so start alerts are skipped.
export async function scheduleTaskNotifications(
  task: Schedulable,
  started = false
) {
  const startDate = new Date(task.startDate);
  startDate.setSeconds(0, 0);
  let endDate = new Date(task.endDate);
  endDate.setSeconds(0, 0);
  if (endDate.getTime() <= startDate.getTime()) {
    endDate = new Date(startDate.getTime() + 60_000);
  }

  const ids: Pick<
    Task,
    "startNotificationId" | "deadlineNotificationId" | "reminderNotificationIds"
  > = {};

  if (!started) {
    if (isFuture(startDate)) {
      ids.startNotificationId = await at(
        "Time to start task!",
        task.title,
        startDate
      );
    }

    // Only timer tasks have a "start" action to nudge about.
    if (kindOf(task as Task) === "timer") {
      const reminders: string[] = [];
      for (const minutes of REMINDER_OFFSETS_MIN) {
        const when = new Date(startDate.getTime() + minutes * 60_000);
        if (isFuture(when) && when.getTime() < endDate.getTime()) {
          reminders.push(
            await at(
              "Hey! Start your task!",
              `You are overdue to start: ${task.title}`,
              when
            )
          );
        }
      }
      if (reminders.length) ids.reminderNotificationIds = reminders;
    }
  }

  if (isFuture(endDate)) {
    ids.deadlineNotificationId = await at(
      "Task deadline reached!",
      task.title,
      endDate
    );
  }

  return { startDate, endDate, ...ids };
}

// When a running timer task passes its estimate: one nudge right at the
// estimate, then a few follow-ups in case the person forgot to stop it.
const CHECK_IN_OFFSETS_MIN = [0, 15, 30, 60];

export async function scheduleCheckInNotifications(
  task: Pick<Task, "title" | "estimateMinutes">,
  startedAt: number
) {
  if (!task.estimateMinutes) return undefined;
  const ids: string[] = [];
  for (const offset of CHECK_IN_OFFSETS_MIN) {
    const when = new Date(startedAt + (task.estimateMinutes + offset) * 60_000);
    if (!isFuture(when)) continue;
    ids.push(
      await at(
        offset === 0 ? "Your estimate is up" : "Still working?",
        offset === 0
          ? `"${task.title}": time's up on your estimate. Still working, or did you forget to stop the timer?`
          : `"${task.title}" is ${offset} min over your estimate. Still on it?`,
        when
      )
    );
  }
  return ids.length ? ids : undefined;
}

// Used when a finished task is reopened.
export async function scheduleDeadlineNotification(task: Task) {
  const end = new Date(task.endDate);
  end.setSeconds(0, 0);
  return isFuture(end)
    ? at("Task deadline reached!", task.title, end)
    : undefined;
}

type Kind = "start" | "deadline" | "reminders" | "checkins";

export function cancelTaskNotifications(task: Task | undefined, ...which: Kind[]) {
  if (!task) return;
  const kinds = which.length ? which : (["start", "deadline", "reminders", "checkins"] as Kind[]);
  const ids: (string | undefined)[] = [];
  if (kinds.includes("start")) ids.push(task.startNotificationId);
  if (kinds.includes("deadline")) ids.push(task.deadlineNotificationId);
  if (kinds.includes("reminders")) {
    // reminderNotificationId is the old single repeating reminder.
    ids.push(task.reminderNotificationId, ...(task.reminderNotificationIds ?? []));
  }
  if (kinds.includes("checkins")) ids.push(...(task.checkInNotificationIds ?? []));
  ids.forEach((id) => id && Notifications.cancelScheduledNotificationAsync(id));
}
