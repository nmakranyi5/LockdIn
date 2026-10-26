import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { cancelTaskNotifications, scheduleCheckInNotifications, scheduleTaskNotifications } from "../scheduleTask";
import { History } from "../streak";
import { Task } from "../taskState";
import { XpLedger } from "../xp";
import { AVATARS, DEFAULT_PROFILE, Profile } from "../useProfile";
import { supabase } from "./client";
import {
  applyRemote,
  pullHistory,
  pullProfile,
  pullXp,
  pullTasks,
  pushDeletes,
  pushHistory,
  pushProfile,
  pushTasks,
  pushXp,
} from "./engine";
import { friendlyError } from "./errors";
import { historyToRows, syncSig } from "./mapping";

const META_KEY = "@lockdin_sync_meta";
const DEBOUNCE_MS = 1500;
const POLL_MS = 60_000;

// Bookkeeping about what the server has seen. Lives only on this device.
type Meta = {
  userId: string | null;
  cursor: string | null;
  sigs: Record<string, string>; // id -> signature last seen/synced
  dirty: string[]; // tasks changed locally, not yet pushed
  tombstones: string[]; // tasks deleted locally, not yet pushed
  profileSig: string | null;
  profileDirty: boolean;
  profilePulled: boolean;
  historySynced: string[];
  xpSynced: string[];
};

const emptyMeta = (userId: string | null = null): Meta => ({
  userId,
  cursor: null,
  sigs: {},
  dirty: [],
  tombstones: [],
  profileSig: null,
  profileDirty: false,
  profilePulled: false,
  historySynced: [],
  xpSynced: [],
});

export type SyncStatus = "off" | "idle" | "syncing" | "error";

type Options = {
  userId: string | null;
  // Local storage has finished loading.
  ready: boolean;
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  profile: Profile;
  setProfile: Dispatch<SetStateAction<Profile>>;
  history: History;
  setHistory: Dispatch<SetStateAction<History>>;
  xpLedger: XpLedger;
  setXpLedger: Dispatch<SetStateAction<XpLedger>>;
};

const profileSig = (p: Profile) => JSON.stringify([p.name, p.avatar]);

// Offline-first sync between local state and Supabase. Local storage stays the
// source for the UI; this pushes local changes up and pulls remote ones down.
export function useSync(o: Options) {
  const {
    userId,
    ready,
    tasks,
    setTasks,
    profile,
    setProfile,
    history,
    setHistory,
    xpLedger,
    setXpLedger,
  } = o;

  const [status, setStatus] = useState<SyncStatus>(userId ? "idle" : "off");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [accountReady, setAccountReady] = useState(false);

  const metaRef = useRef<Meta>(emptyMeta());
  const tasksRef = useRef(tasks);
  const profileRef = useRef(profile);
  const historyRef = useRef(history);
  const xpRef = useRef(xpLedger);
  tasksRef.current = tasks;
  profileRef.current = profile;
  historyRef.current = history;
  xpRef.current = xpLedger;

  const accountReadyRef = useRef(false);
  accountReadyRef.current = accountReady;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = () =>
    AsyncStorage.setItem(META_KEY, JSON.stringify(metaRef.current)).catch(() => {});

  const countPending = () => {
    const m = metaRef.current;
    const unsyncedDays = Object.keys(historyRef.current).filter(
      (d) => !m.historySynced.includes(d)
    ).length;
    const unsyncedXp = Object.keys(xpRef.current).filter(
      (d) => xpRef.current[d] > 0 && !m.xpSynced.includes(d)
    ).length;
    setPending(
      m.dirty.length + m.tombstones.length + (m.profileDirty ? 1 : 0) + unsyncedDays + unsyncedXp
    );
  };

  // ---- load bookkeeping
  useEffect(() => {
    AsyncStorage.getItem(META_KEY)
      .then((raw) => {
        if (raw) metaRef.current = { ...emptyMeta(), ...JSON.parse(raw) };
      })
      .catch(() => {})
      .finally(() => setMetaLoaded(true));
  }, []);

  // Forget everything about the local copy (used on sign-out and when a
  // different account signs in on this device).
  const resetLocal = useCallback(
    (nextUserId: string | null) => {
      tasksRef.current.forEach((t) => cancelTaskNotifications(t));
      // Reset the bookkeeping first so clearing the lists isn't mistaken for
      // the user deleting everything.
      metaRef.current = emptyMeta(nextUserId);
      persist();
      setTasks([]);
      setHistory({});
      setXpLedger({});
      setProfile(DEFAULT_PROFILE);
      setPending(0);
    },
    [setTasks, setHistory, setXpLedger, setProfile]
  );

  // ---- which account owns the local data?
  useEffect(() => {
    if (!metaLoaded || !ready) return;
    if (!userId) {
      setAccountReady(false);
      setStatus("off");
      return;
    }
    const m = metaRef.current;
    // A different account signing in must not inherit (and upload) the
    // previous account's data. Data with no owner yet (the app was used before
    // accounts existed) is kept and uploaded on first sign-in.
    if (m.userId && m.userId !== userId) resetLocal(userId);
    else {
      m.userId = userId;
      persist();
    }
    setAccountReady(true);
    setStatus("idle");
  }, [userId, metaLoaded, ready, resetLocal]);

  // ---- sync
  const doSync = useCallback(async (uid: string) => {
    const client = supabase!;
    const m = metaRef.current;

    // 1. deletions
    const dels = [...m.tombstones];
    if (dels.length) {
      await pushDeletes(client, uid, dels);
      m.tombstones = m.tombstones.filter((id) => !dels.includes(id));
      persist();
    }

    // 2. changed tasks
    const ids = new Set(m.dirty);
    const snapshot = tasksRef.current.filter((t) => ids.has(t.id));
    if (snapshot.length) {
      await pushTasks(client, uid, snapshot);
      const pushed = new Map(snapshot.map((t) => [t.id, syncSig(t)]));
      // Keep anything edited again while the request was in flight.
      m.dirty = m.dirty.filter((id) => {
        const now = tasksRef.current.find((t) => t.id === id);
        return !!now && pushed.has(id) && syncSig(now) !== pushed.get(id);
      });
      persist();
    }

    // 3. finished days
    const unsynced = Object.keys(historyRef.current).filter((d) => !m.historySynced.includes(d));
    if (unsynced.length) {
      await pushHistory(client, uid, historyToRows(historyRef.current, unsynced));
      m.historySynced.push(...unsynced);
      persist();
    }

    // 3b. XP for finished days (days that earned nothing aren't worth uploading)
    const unsyncedXp = Object.keys(xpRef.current).filter(
      (d) => xpRef.current[d] > 0 && !m.xpSynced.includes(d)
    );
    if (unsyncedXp.length) {
      await pushXp(client, uid, xpRef.current, unsyncedXp);
      m.xpSynced.push(...unsyncedXp);
      persist();
    }

    // 4. profile (a name already stored in the account beats a blank local one)
    const local = profileRef.current;
    const adopt = (remote: Profile) => {
      m.profileSig = profileSig(remote);
      m.profileDirty = false;
      setProfile(remote);
    };
    if (!m.profilePulled) {
      const remote = await pullProfile(client, uid);
      if (remote && remote.name.trim()) adopt(remote);
      else if (local.name || local.avatar !== AVATARS[0]) m.profileDirty = true;
      m.profilePulled = true;
    }
    if (m.profileDirty) {
      const sent = profileSig(profileRef.current);
      await pushProfile(client, uid, profileRef.current);
      if (m.profileSig === sent) m.profileDirty = false;
    } else {
      const remote = await pullProfile(client, uid);
      if (remote && profileSig(remote) !== profileSig(profileRef.current)) adopt(remote);
    }
    persist();

    // 5. pull tasks
    const { rows, cursor } = await pullTasks(client, uid, m.cursor);
    const skip = new Set([...m.dirty, ...m.tombstones]);
    const preview = applyRemote(tasksRef.current, rows, skip);
    // Record what we're about to apply so it isn't mistaken for a local edit.
    for (const u of preview.upserted) m.sigs[u.task.id] = syncSig(u.task);
    for (const r of preview.removed) delete m.sigs[r.id];
    if (preview.upserted.length || preview.removed.length) {
      setTasks((prev) => applyRemote(prev, rows, skip).tasks);
    }
    m.cursor = cursor;
    persist();

    // 6. pull finished days (the first device to report a day wins)
    const remoteHistory = await pullHistory(client, uid);
    const remoteDays = Object.keys(remoteHistory);
    const differs = remoteDays.some((d) => {
      const l = historyRef.current[d];
      return !l || l.total !== remoteHistory[d].total || l.done !== remoteHistory[d].done;
    });
    if (differs) setHistory((prev) => ({ ...prev, ...remoteHistory }));
    for (const d of remoteDays) if (!m.historySynced.includes(d)) m.historySynced.push(d);
    persist();

    // 6b. pull XP (first device to report a day wins)
    const remoteXp = await pullXp(client, uid);
    const xpDays = Object.keys(remoteXp);
    if (xpDays.some((d) => xpRef.current[d] !== remoteXp[d])) {
      setXpLedger((prev) => ({ ...prev, ...remoteXp }));
    }
    for (const d of xpDays) if (!m.xpSynced.includes(d)) m.xpSynced.push(d);
    persist();

    // 7. line this device's local notifications up with what changed
    try {
      preview.removed.forEach((t) => cancelTaskNotifications(t));
      const updates = new Map<string, Partial<Task>>();
      for (const { task, previous } of preview.upserted) {
        if (previous) cancelTaskNotifications(previous);
        const cleared: Partial<Task> = {
          startNotificationId: undefined,
          deadlineNotificationId: undefined,
          reminderNotificationId: undefined,
          reminderNotificationIds: undefined,
          checkInNotificationIds: undefined,
          nextCheckInAt: undefined,
        };
        if (task.completedAt) {
          updates.set(task.id, cleared);
          continue;
        }
        const started = !!task.startedAt;
        const sched = await scheduleTaskNotifications(task, started);
        const checkIns =
          started && task.estimateMinutes
            ? await scheduleCheckInNotifications(task, task.startedAt!)
            : undefined;
        updates.set(task.id, {
          ...cleared,
          startNotificationId: sched.startNotificationId,
          deadlineNotificationId: sched.deadlineNotificationId,
          reminderNotificationIds: sched.reminderNotificationIds,
          checkInNotificationIds: checkIns,
        });
      }
      if (updates.size) {
        setTasks((prev) => prev.map((t) => (updates.has(t.id) ? { ...t, ...updates.get(t.id) } : t)));
      }
    } catch (e) {
      console.log("Could not update local notifications after sync", e);
    }
  }, [setTasks, setHistory, setXpLedger, setProfile]);

  const syncNow = useCallback(async (): Promise<void> => {
    const uid = userIdRef.current;
    if (!supabase || !uid || !accountReadyRef.current) return;
    if (running.current) {
      again.current = true;
      return running.current;
    }
    const run = (async () => {
      setStatus("syncing");
      try {
        await doSync(uid);
        setError(null);
        setStatus("idle");
        setLastSyncedAt(Date.now());
      } catch (e: any) {
        setStatus("error");
        setError(friendlyError(e));
      } finally {
        running.current = null;
        countPending();
        if (again.current) {
          again.current = false;
          syncNow();
        }
      }
    })();
    running.current = run;
    return run;
  }, [doSync]);

  const scheduleSync = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => syncNow(), DEBOUNCE_MS);
  }, [syncNow]);

  // ---- notice local changes
  useEffect(() => {
    if (!accountReady) return;
    const m = metaRef.current;
    const seen = new Set<string>();
    let changed = false;

    for (const t of tasks) {
      seen.add(t.id);
      const sig = syncSig(t);
      if (m.sigs[t.id] !== sig) {
        m.sigs[t.id] = sig;
        if (!m.dirty.includes(t.id)) m.dirty.push(t.id);
        changed = true;
      }
    }
    for (const id of Object.keys(m.sigs)) {
      if (seen.has(id)) continue;
      delete m.sigs[id];
      m.dirty = m.dirty.filter((x) => x !== id);
      if (!m.tombstones.includes(id)) m.tombstones.push(id);
      changed = true;
    }
    if (changed) {
      persist();
      countPending();
      scheduleSync();
    }
  }, [tasks, accountReady, scheduleSync]);

  useEffect(() => {
    if (!accountReady) return;
    const m = metaRef.current;
    const sig = profileSig(profile);
    if (m.profileSig !== sig) {
      m.profileSig = sig;
      m.profileDirty = true;
      persist();
      countPending();
      scheduleSync();
    }
  }, [profile, accountReady, scheduleSync]);

  useEffect(() => {
    if (!accountReady) return;
    const m = metaRef.current;
    if (Object.keys(history).some((d) => !m.historySynced.includes(d))) {
      countPending();
      scheduleSync();
    }
  }, [history, accountReady, scheduleSync]);

  useEffect(() => {
    if (!accountReady) return;
    const m = metaRef.current;
    if (Object.keys(xpLedger).some((d) => xpLedger[d] > 0 && !m.xpSynced.includes(d))) {
      countPending();
      scheduleSync();
    }
  }, [xpLedger, accountReady, scheduleSync]);

  // ---- when to sync
  useEffect(() => {
    if (!accountReady) return;
    syncNow();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") syncNow();
    });
    const poll = setInterval(() => {
      if (AppState.currentState === "active") syncNow();
    }, POLL_MS);
    return () => {
      sub.remove();
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [accountReady, syncNow]);

  // Push what we can, then forget this device's copy. Call before signing out.
  const wipeLocal = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    resetLocal(null);
    setAccountReady(false);
  }, [resetLocal]);

  return { status, lastSyncedAt, error, pending, syncNow, wipeLocal };
}
