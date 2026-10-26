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

// Used when a finished task is reopened.
export async function scheduleDeadlineNotification(task: Task) {
  const end = new Date(task.endDate);
  end.setSeconds(0, 0);
  return isFuture(end)
    ? at("Task deadline reached!", task.title, end)
    : undefined;
}

type Kind = "start" | "deadline" | "reminders";

export function cancelTaskNotifications(task: Task | undefined, ...which: Kind[]) {
  if (!task) return;
  const kinds = which.length ? which : (["start", "deadline", "reminders"] as Kind[]);
  const ids: (string | undefined)[] = [];
  if (kinds.includes("start")) ids.push(task.startNotificationId);
  if (kinds.includes("deadline")) ids.push(task.deadlineNotificationId);
  if (kinds.includes("reminders")) {
    // reminderNotificationId is the old single repeating reminder.
    ids.push(task.reminderNotificationId, ...(task.reminderNotificationIds ?? []));
  }
  ids.forEach((id) => id && Notifications.cancelScheduledNotificationAsync(id));
}
