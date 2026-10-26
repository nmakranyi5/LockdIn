import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { friendlyError } from "../sync/errors";
import { fetchOverview, Overview, publishStreak } from "./api";

const POLL_MS = 60_000;
const REPUBLISH_MS = 6 * 60 * 60 * 1000;

type StreakInput = {
  current: number;
  longest: number;
  today: "none" | "pending" | "complete";
};

// Friends data for the signed-in user, kept fresh while the app is open.
export function useFriends(userId: string | null, todayKey: string) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const todayRef = useRef(todayKey);
  todayRef.current = todayKey;

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setOverview(await fetchOverview(todayRef.current));
      setError(null);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setOverview(null);
      return;
    }
    refresh();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    const poll = setInterval(() => {
      if (AppState.currentState === "active") refresh();
    }, POLL_MS);
    return () => {
      sub.remove();
      clearInterval(poll);
    };
  }, [userId, refresh]);

  return { overview, loading, error, refresh };
}

// Tell the server this person's streak so friends can see it. Only streak
// numbers and today's status are sent, never anything about the tasks.
export function usePublishStreak(
  userId: string | null,
  // Wait for the first sync so a new device doesn't publish an empty streak.
  enabled: boolean,
  todayKey: string,
  s: StreakInput
) {
  const lastSig = useRef<string | null>(null);
  const lastAt = useRef(0);
  const latest = useRef({ s, todayKey });
  latest.current = { s, todayKey };

  const publish = useCallback(async () => {
    if (!userId) return;
    const { s: cur, todayKey: day } = latest.current;
    try {
      await publishStreak(userId, { ...cur, todayKey: day });
      lastSig.current = JSON.stringify([cur, day]);
      lastAt.current = Date.now();
    } catch (e) {
      console.log("Could not publish streak", e);
    }
  }, [userId]);

  const sig = JSON.stringify([s, todayKey]);
  useEffect(() => {
    if (!userId || !enabled) return;
    if (sig === lastSig.current && Date.now() - lastAt.current < REPUBLISH_MS) return;
    const t = setTimeout(publish, 2000);
    return () => clearTimeout(t);
  }, [userId, enabled, sig, publish]);

  // Publishing also refreshes the "still active" clock, so do it now and then.
  useEffect(() => {
    if (!userId || !enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() - lastAt.current > REPUBLISH_MS) publish();
    });
    return () => sub.remove();
  }, [userId, enabled, publish]);
}
