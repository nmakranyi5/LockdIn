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

export const AndroidImportance = { MAX: 5 } as const;

export async function setNotificationChannelAsync(_id: string, _channel: unknown) {}

// Push notifications aren't available in the browser.
export async function getPermissionsAsync() {
  return { granted: false, status: "undetermined" };
}
export async function getExpoPushTokenAsync(_opts?: unknown) {
  return { data: "" };
}
export async function getLastNotificationResponseAsync() {
  return null;
}
export function addNotificationResponseReceivedListener(_handler: unknown) {
  return { remove() {} };
}
