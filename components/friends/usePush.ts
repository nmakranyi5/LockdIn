import Constants from "expo-constants";
import * as Device from "expo-device";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "../notifications";
import { registerPushToken, unregisterPushToken } from "./api";

type PushType = "nudge" | "friend_request" | "friend_accepted";
const OPENS_FRIENDS: string[] = ["nudge", "friend_request", "friend_accepted"] satisfies PushType[];

// Registers this phone for push notifications (nudges, friend requests) and
// opens the friends screen when one is tapped.
export function usePush(userId: string | null, onOpenFriends: () => void) {
  const token = useRef<string | null>(null);
  const open = useRef(onOpenFriends);
  open.current = onOpenFriends;

  useEffect(() => {
    if (!userId || Platform.OS === "web") return;
    let cancelled = false;
    (async () => {
      // Simulators can't receive remote notifications.
      if (!Device.isDevice) return;
      let { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
      if (status !== "granted") return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      if (cancelled) return;
      token.current = data;
      await registerPushToken(data, Platform.OS);
    })().catch((e) => console.log("Push registration failed", e));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const handle = (r: { notification: { request: { content: { data?: any } } } } | null) => {
      const type = r?.notification.request.content.data?.type;
      if (type && OPENS_FRIENDS.includes(type)) open.current();
    };
    Notifications.getLastNotificationResponseAsync?.().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);

  // Stop this phone getting the previous account's notifications. Call while
  // still signed in.
  const unregister = useCallback(async () => {
    if (!token.current) return;
    try {
      await unregisterPushToken(token.current);
    } catch (e) {
      console.log("Could not unregister push token", e);
    }
    token.current = null;
  }, []);

  return { unregister };
}
