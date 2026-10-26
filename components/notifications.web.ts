// expo-notifications can't schedule local notifications in the browser, so on
// web these are no-ops that keep the same call shape as the native module.
export const SchedulableTriggerInputTypes = {
  DATE: "date",
  TIME_INTERVAL: "timeInterval",
} as const;

export function setNotificationHandler(_handler: unknown) {}

export async function requestPermissionsAsync() {
  return { granted: false, status: "undetermined" };
}

export async function scheduleNotificationAsync(_request: unknown) {
  return "web-noop";
}

export async function cancelScheduledNotificationAsync(_id: string) {}
