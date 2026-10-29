import { Platform } from "react-native";
import * as Notifications from "./notifications";
import { planNotifications, withinBudget } from "./notificationPlan";
import { Task } from "./taskState";

export { normalizeWindow } from "./notificationPlan";

// iOS keeps only the 64 soonest-firing local notifications and silently drops
// the rest, so the plan is trimmed to the soonest ones and topped up whenever
// the app is opened. Android has no such small limit.
const BUDGET = Platform.OS === "ios" ? 60 : 300;

let chain: Promise<void> = Promise.resolve();

// Makes the phone's pending notifications match the tasks: schedules what is
// missing or changed, and cancels what is no longer wanted (finished, started,
// deleted, edited, or left over from an older version of the app). Safe to call
// as often as needed; calls run one after another.
export function syncNotifications(tasks: Task[]): Promise<void> {
  chain = chain
    .then(() => run(tasks))
    .catch((e) => console.log("Could not update notifications", e));
  return chain;
}

async function run(tasks: Task[]) {
  const want = new Map(withinBudget(planNotifications(tasks), BUDGET).map((p) => [p.id, p]));
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const have = new Map(existing.map((n) => [n.identifier, n]));

  for (const [id] of have) {
    if (!want.has(id)) await Notifications.cancelScheduledNotificationAsync(id);
  }
  for (const p of want.values()) {
    const n = have.get(p.id);
    const same =
      !!n &&
      n.content.title === p.title &&
      n.content.body === p.body &&
      (n.content.data as { at?: number } | undefined)?.at === p.date.getTime();
    if (same) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: p.id,
      content: { title: p.title, body: p.body, data: { at: p.date.getTime() } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.date,
      },
    });
  }
}
