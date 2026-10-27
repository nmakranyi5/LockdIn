import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../assets/colors/colors";
import AuthScreen from "../components/auth/AuthScreen";
import { useAuth } from "../components/auth/AuthProvider";
import CheckInModal from "../components/CheckInModal";
import CompleteConfirmModal from "../components/CompleteConfirmModal";
import CompletionModal, { CompletionData } from "../components/CompletionModal";
import DayStrip from "../components/DayStrip";
import { setNudgesEnabled } from "../components/friends/api";
import FriendsModal from "../components/friends/FriendsModal";
import { useFriends, usePublishStreak } from "../components/friends/useFriends";
import { usePush } from "../components/friends/usePush";
import LevelUpModal, { useLevelUp } from "../components/LevelUpModal";
import ProfileModal from "../components/ProfileModal";
import ProfileBubble from "../components/ProfileBubble";
import { dayKey } from "../components/streak";
import { goalBonus, pendingGoal } from "../components/goals";
import { BASE_XP, DAILY_TASK_CAP, levelFromXp, XpSummary } from "../components/xp";
import { useSync } from "../components/sync/useSync";
import { useProfile } from "../components/useProfile";
import * as Notifications from "../components/notifications";
import {
  cancelTaskNotifications,
  scheduleCheckInNotifications,
  scheduleDeadlineNotification,
  scheduleTaskNotifications,
} from "../components/scheduleTask";
import TaskCard from "../components/TaskCard";
import { priorityRank } from "../components/taskMeta";
import {
  addDays,
  ChecklistItem,
  CHECK_IN_INTERVAL_MIN,
  getTaskState,
  humanDuration,
  isCheckInDue,
  isEarlyFinish,
  isSameDay,
  kindOf,
  newId,
  nextOccurrence,
  priorityOf,
  repeatOf,
  seriesKey,
  startOfDay,
  Task,
} from "../components/taskState";
import DeleteRepeatModal from "../components/DeleteRepeatModal";
import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import AddTaskModal from "./components/AddTaskModal";
import ConfirmModal from "./components/ConfirmModal";
import HelpHomeScreenModal from "./components/HelpHomeScreenModal";
import SettingsModal, { AccountInfo } from "./components/SettingsModal";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type TaskInput = {
  title: string;
  startDate: Date;
  endDate: Date;
  repeats: string;
  kind: Task["kind"];
  priority: Task["priority"];
  items: ChecklistItem[];
  estimateMinutes?: number;
};

// Signed-out visitors see the sign-in screen. Without Supabase credentials the
// app skips it and runs purely on-device.
export default function Index() {
  const auth = useAuth();
  if (auth.configured && auth.loading) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }
  if (auth.configured && !auth.session) return <AuthScreen />;
  return (
    <Home
      userId={auth.session?.user.id ?? null}
      email={auth.session?.user.email ?? null}
    />
  );
}

function Home({ userId, email }: { userId: string | null; email: string | null }) {
  const auth = useAuth();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [isFriendsVisible, setIsFriendsVisible] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // A task the person has said they finished, awaiting confirmation. `itemId`
  // is the checklist item whose tick would complete the whole list.
  const [finishing, setFinishing] = useState<{ id: string; itemId?: string } | null>(null);
  // Confirmed: waiting for the update to land so we can show what was earned.
  const [pending, setPending] = useState<{ id: string; title: string; before: XpSummary } | null>(null);
  const [completion, setCompletion] = useState<CompletionData | null>(null);
  const spawning = useRef(new Set<string>());

  const TASKS_KEY = "@lockdin_tasks";

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const findTask = (id: string | null) =>
    id ? tasks.find((t) => t.id === id) : undefined;

  const updateTask = (id: string, patch: Partial<Task>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const handleSaveTask = async (input: TaskInput) => {
    const old = findTask(editingId);
    if (old) cancelTaskNotifications(old);

    // A task that is mid-run keeps running when it is edited; a finished one
    // is being rescheduled and starts fresh.
    const keepRunning = !!old && !!old.startedAt && !old.completedAt;
    const sched = await scheduleTaskNotifications(input, keepRunning);
    const estimateMinutes =
      input.kind === "timer" ? input.estimateMinutes : undefined;
    // A running task keeps its start, so line its check-ins up with the
    // (possibly new) estimate.
    const checkIns =
      keepRunning && estimateMinutes && old?.startedAt
        ? await scheduleCheckInNotifications({ title: input.title, estimateMinutes }, old.startedAt)
        : undefined;

    const fields = {
      title: input.title,
      startDate: sched.startDate,
      endDate: sched.endDate,
      repeats: input.repeats,
      kind: input.kind,
      priority: input.priority,
      items: input.items,
      estimateMinutes,
      checkInNotificationIds: checkIns,
      nextCheckInAt: undefined,
      startNotificationId: sched.startNotificationId,
      deadlineNotificationId: sched.deadlineNotificationId,
      reminderNotificationId: undefined,
      reminderNotificationIds: sched.reminderNotificationIds,
    };

    if (old) {
      updateTask(old.id, {
        ...fields,
        startedAt: keepRunning ? old.startedAt : null,
        completedAt: null,
      });
      setEditingId(null);
    } else {
      setTasks((prev) => [
        ...prev,
        {
          id: newId(),
          ...fields,
          startedAt: null,
          completedAt: null,
          spawnedNext: false,
        },
      ]);
    }
    setSelectedDay(startOfDay(sched.startDate));
  };

  const onEdit = (id: string) => {
    setEditingId(id);
    setIsModalVisible(true);
  };

  const onDelete = (id: string, scope: "one" | "all" = "one") => {
    const task = findTask(id);
    if (!task) return;

    if (scope === "all") {
      const key = seriesKey(task);
      tasks
        .filter((t) => seriesKey(t) === key)
        .forEach((t) => cancelTaskNotifications(t));
      setTasks((prev) => prev.filter((t) => seriesKey(t) !== key));
      return;
    }

    cancelTaskNotifications(task);
    if (repeatOf(task) !== "none" && !task.spawnedNext) {
      // Keep the series going: line up the next occurrence as this one goes.
      spawnNext(task, true);
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const onStartTask = (id: string) => {
    const task = findTask(id);
    if (!task || task.startedAt) return;
    cancelTaskNotifications(task, "start", "reminders");
    const startedAt = Date.now();
    updateTask(id, { startedAt });
    if (task.estimateMinutes) {
      scheduleCheckInNotifications(task, startedAt).then((ids) =>
        updateTask(id, { checkInNotificationIds: ids })
      );
    }
  };

  const completeTask = (id: string, patch: Partial<Task> = {}) => {
    const task = findTask(id);
    if (!task || task.completedAt) return;
    // Cancel everything, including a start alert that hasn't fired yet.
    cancelTaskNotifications(task);
    updateTask(id, {
      ...patch,
      completedAt: Date.now(),
      startedAt: task.startedAt ?? Date.now(),
    });
  };

  const toggleItem = (id: string, itemId: string) => {
    const task = findTask(id);
    if (!task) return;
    const completesList =
      !task.completedAt &&
      (task.items ?? []).every((i) => (i.id === itemId ? !i.done : i.done)) &&
      (task.items ?? []).some((i) => i.id === itemId && !i.done);
    if (completesList) {
      // Don't tick it yet: confirm first, and tick it only if they say yes.
      setFinishing({ id, itemId });
      return;
    }
    const items = (task.items ?? []).map((i) =>
      i.id === itemId ? { ...i, done: !i.done } : i
    );
    if (items.length > 0 && items.every((i) => i.done)) {
      completeTask(id, { items });
    } else {
      // Unticking an item reopens a completed checklist.
      updateTask(id, { items, ...(task.completedAt ? { completedAt: null } : {}) });
      if (task.completedAt) {
        scheduleDeadlineNotification(task).then((deadlineNotificationId) =>
          updateTask(id, { deadlineNotificationId })
        );
      }
    }
  };

  const handleCloseHelp = async () => {
    try {
      await AsyncStorage.setItem("hasSeenHelp", "true");
      setIsHelpModalVisible(false);
    } catch (e) {
      console.log("Error saving help modal flag", e);
    }
  };

  useEffect(() => {
    (async () => {
      // Android 13+ only shows the permission prompt once a channel exists.
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Task alerts",
          importance: Notifications.AndroidImportance.MAX,
        });
      }
      await Notifications.requestPermissionsAsync();
    })();
  }, []);

  useEffect(() => {
    const loadTasks = async () => {
      const saved = await AsyncStorage.getItem(TASKS_KEY);
      if (saved) {
        const parsed: Task[] = JSON.parse(saved).map((t: any) => ({
          ...t,
          id: t.id ?? newId(),
          startDate: new Date(t.startDate),
          endDate: new Date(t.endDate),
        }));

        setTasks(parsed);
      }
      setLoaded(true);
    };
    loadTasks();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [tasks, loaded]);

  const spawnNext = async (task: Task, removeSource = false) => {
    spawning.current.add(task.id);
    const occurrence = nextOccurrence(task, Date.now());
    if (!occurrence) {
      if (removeSource) setTasks((prev) => prev.filter((t) => t.id !== task.id));
      else updateTask(task.id, { spawnedNext: true });
      return;
    }
    const sched = await scheduleTaskNotifications({ ...task, ...occurrence });
    const next: Task = {
      ...task,
      // Deterministic so two devices spawning the same occurrence agree on it
      // instead of creating duplicates.
      id: `${seriesKey(task)}@${sched.startDate.getTime()}`,
      seriesId: seriesKey(task),
      startDate: sched.startDate,
      endDate: sched.endDate,
      startNotificationId: sched.startNotificationId,
      deadlineNotificationId: sched.deadlineNotificationId,
      reminderNotificationId: undefined,
      reminderNotificationIds: sched.reminderNotificationIds,
      startedAt: null,
      completedAt: null,
      spawnedNext: false,
      checkInNotificationIds: undefined,
      nextCheckInAt: undefined,
      items: task.items?.map((i) => ({ ...i, done: false })),
    };
    setTasks((prev) => {
      // The source task may have been deleted while this was scheduling.
      if (!prev.some((t) => t.id === task.id)) {
        cancelTaskNotifications(next);
        return prev;
      }
      return [
        ...(removeSource
          ? prev.filter((t) => t.id !== task.id)
          : prev.map((t) =>
              t.id === task.id
                ? { ...t, seriesId: seriesKey(task), spawnedNext: true }
                : t
            )),
        next,
      ];
    });
  };

  // Repeating tasks: once an occurrence has started (or been completed), line
  // up the next one so it shows on its day.
  const minuteBucket = Math.floor(now / 60_000);
  useEffect(() => {
    if (!loaded) return;
    tasks.forEach((task) => {
      if (repeatOf(task) === "none" || task.spawnedNext) return;
      if (spawning.current.has(task.id)) return;
      const startMs = new Date(task.startDate).getTime();
      if (!task.completedAt && Date.now() < startMs) return;
      spawnNext(task);
    });
  }, [tasks, loaded, minuteBucket]);

  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasSeenHelp = await AsyncStorage.getItem("hasSeenHelp");

        if (!hasSeenHelp) {
          setIsHelpModalVisible(true);
        }
      } catch (e) {
        console.log("Error checking help modal flag", e);
      }
    };

    checkFirstLaunch();
  }, []);

  const deleteTask = findTask(deleteId);
  const deleteIsRepeating = !!deleteTask && repeatOf(deleteTask) !== "none";
  const deleteSeriesCount = deleteTask
    ? tasks.filter((t) => seriesKey(t) === seriesKey(deleteTask)).length
    : 0;

  const {
    profile,
    setProfile,
    history,
    setHistory,
    xpLedger,
    setXpLedger,
    stats,
    xp,
    goalFor,
    changeGoal,
    todayKey,
    loaded: profileLoaded,
  } = useProfile(tasks, loaded, now);

  const sync = useSync({
    userId,
    ready: loaded && profileLoaded,
    tasks,
    setTasks,
    profile,
    setProfile,
    history,
    setHistory,
    xpLedger,
    setXpLedger,
  });

  const social = auth.configured && !!userId;
  const friends = useFriends(social ? userId : null, todayKey);
  usePublishStreak(
    social ? userId : null,
    sync.lastSyncedAt !== null,
    todayKey,
    { current: stats.current, longest: stats.longest, today: stats.today }
  );
  const push = usePush(social ? userId : null, () => setIsFriendsVisible(true));
  const incomingRequests = friends.overview?.incoming.length ?? 0;

  const account: AccountInfo | undefined =
    auth.configured && userId
      ? {
          email,
          status: sync.status,
          lastSyncedAt: sync.lastSyncedAt,
          error: sync.error,
          pending: sync.pending,
          onSyncNow: () => {
            sync.syncNow();
          },
          nudgesEnabled: friends.overview?.me.nudges_enabled ?? true,
          onToggleNudges: async (enabled: boolean) => {
            if (!userId) return;
            await setNudgesEnabled(userId, enabled);
            await friends.refresh();
          },
          onSignOut: async () => {
            // Stop this phone getting the account's notifications, push
            // whatever we can, then forget this device's copy so the next
            // person to sign in doesn't inherit it.
            await push.unregister();
            await sync.syncNow();
            await sync.wipeLocal();
            await auth.signOut();
          },
          onDeleteAccount: async () => {
            await push.unregister();
            const r = await auth.deleteAccount();
            if (r.error) return r.error;
            await sync.wipeLocal();
            await auth.signOut();
            return undefined;
          },
        }
      : undefined;

  const finishTask = findTask(finishing?.id ?? null);
  const finishKind = finishTask ? kindOf(finishTask) : null;
  const finishesEarly = !!finishTask && finishKind === "timer" && isEarlyFinish(finishTask, now);
  const finishXp = finishTask ? xp.gainIfCompleted(finishTask) : 0;
  const finishReachesGoal = !!finishTask && xp.wouldReachGoal(finishTask);
  const finishGoalBonus = finishTask
    ? goalBonus(goalFor(dayKey(new Date(finishTask.startDate))))
    : 1;

  const anyModalOpen =
    isModalVisible ||
    isHelpModalVisible ||
    isSettingsModalVisible ||
    isProfileVisible ||
    isFriendsVisible ||
    deleteId !== null ||
    finishing !== null ||
    pending !== null ||
    completion !== null;
  // Level-up celebration: only once progress has loaded, and after the first
  // sync when signed in so older progress isn't mistaken for a new level.
  const levelUp = useLevelUp(
    xp.level,
    userId,
    profileLoaded && (!social || sync.lastSyncedAt !== null)
  );
  const todayGoal = goalFor(todayKey);
  const todayTasks = tasks.filter((t) => dayKey(new Date(t.startDate)) === todayKey);
  const goalProgress = {
    current: todayGoal,
    pending: pendingGoal(profile.goalSchedule, todayKey)?.goal ?? null,
    doneToday: todayTasks.filter((t) => !!t.completedAt).length,
    totalToday: todayTasks.length,
  };
  const selectedKey = dayKey(selectedDay);
  const selectedGoal = goalFor(selectedKey);
  const dayXpInfo = xp.forDay(selectedKey);
  // A finished day's XP is frozen: show what it actually earned.
  const dayClosed = xp.isClosed(selectedKey);
  const dayEarned = dayClosed ? xpLedger[selectedKey] ?? 0 : dayXpInfo.total;

  // Only one prompt at a time, and never stacked on top of another dialog.
  const checkInTask = anyModalOpen
    ? undefined
    : tasks.find((t) => isCheckInDue(t, now));

  // Once a confirmed completion has landed, work out what it earned.
  useEffect(() => {
    if (!pending) return;
    const task = tasks.find((t) => t.id === pending.id);
    if (!task?.completedAt) {
      // Never leave the app stuck waiting (e.g. if the task was deleted).
      const giveUp = setTimeout(() => setPending(null), 4000);
      return () => clearTimeout(giveUp);
    }
    const key = dayKey(new Date(task.startDate));
    const day = xp.forDay(key);
    const gained = Math.max(0, xp.total - pending.before.total);
    const closed = xp.isClosed(key);
    const note =
      gained > 0
        ? undefined
        : closed
        ? "That day has already been counted, so this one earns no XP."
        : day.perTask.size >= DAILY_TASK_CAP && !day.perTask.has(task.id)
        ? `Your ${DAILY_TASK_CAP} best tasks of the day already count. Nice work anyway!`
        : "No XP for this one.";
    const before = levelFromXp(pending.before.total);
    const after = levelFromXp(xp.total);
    if (after.level > before.level) levelUp.markSeen(after.level);
    setCompletion({
      title: pending.title,
      gained,
      basePoints: BASE_XP[priorityOf(task)],
      multiplier: day.multiplier,
      note,
      before,
      after,
      streakMultiplier: day.streakMultiplier,
      goalBonus: day.goalBonus,
      // Reaching the goal is a moment of its own; with "all tasks" it is
      // simply finishing the last task of the day.
      goalReached: day.goalMet && !pending.before.forDay(key).goalMet,
      dayDone:
        todayGoal === 0 &&
        stats.today === "complete" &&
        isSameDay(new Date(task.startDate), new Date()),
      streak: stats.current,
    });
    setPending(null);
  }, [pending, tasks]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = startOfDay(new Date(now));
  const isPast = selectedDay.getTime() < today.getTime();

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((task) => isSameDay(new Date(task.startDate), selectedDay))
        .sort((a, b) => {
          // Open tasks first, then by priority, then by start time.
          const done = Number(!!a.completedAt) - Number(!!b.completedAt);
          if (done) return done;
          const pr = priorityRank[priorityOf(b)] - priorityRank[priorityOf(a)];
          if (pr) return pr;
          return (
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );
        }),
    [tasks, selectedDay]
  );

  const doneCount = dayTasks.filter(
    (task) => getTaskState(task, now).isDone
  ).length;

  const hasTasks = (d: Date) =>
    tasks.some((t) => isSameDay(new Date(t.startDate), d));

  const dayTitle = () => {
    const diff = Math.round(
      (selectedDay.getTime() - today.getTime()) / 86_400_000
    );
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return selectedDay.toLocaleDateString([], { weekday: "long" });
  };

  const daySubtitle = () => {
    const date = selectedDay.toLocaleDateString([], {
      month: "long",
      day: "numeric",
      year: selectedDay.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
    if (dayTasks.length === 0) return date;
    const earned = dayEarned > 0 ? ` · +${dayEarned} XP` : "";
    const progress =
      selectedGoal > 0
        ? doneCount >= selectedGoal
          ? "goal reached"
          : `${doneCount}/${selectedGoal} toward goal`
        : `${doneCount}/${dayTasks.length} done`;
    return `${date} · ${progress}${earned}`;
  };

  const openAdd = () => {
    setEditingId(null);
    setIsModalVisible(true);
  };

  // On short screens (landscape phones) the day header scrolls with the list
  // so the tasks get the room.
  const { height: windowHeight } = useWindowDimensions();
  // Decided after mount so the static web pre-render (height 0) matches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const compact = mounted && windowHeight < 600;

  const dayHeader = (
    <>
      <View style={styles.dayHeader}>
        <IconButton
          name="chevron-back"
          label="Previous day"
          size={18}
          onPress={() => setSelectedDay((d) => addDays(d, -1))}
        />
        <View style={styles.dayTitleWrap}>
          <Text style={styles.dayTitle} numberOfLines={1} adjustsFontSizeToFit>
            {dayTitle()}
          </Text>
          <Text style={styles.daySub} numberOfLines={2}>
            {daySubtitle()}
          </Text>
        </View>
        <IconButton
          name="chevron-forward"
          label="Next day"
          size={18}
          onPress={() => setSelectedDay((d) => addDays(d, 1))}
        />
      </View>

      <DayStrip
        selected={selectedDay}
        onSelect={setSelectedDay}
        hasTasks={hasTasks}
      />

      {!isSameDay(selectedDay, today) && (
        <TouchableOpacity
          style={styles.jump}
          onPress={() => setSelectedDay(today)}
        >
          <Ionicons name="return-down-back" size={14} color={colors.accent} />
          <Text style={styles.jumpText}>Back to today</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
      <View style={styles.topBar}>
        <View style={[styles.topSide, { alignItems: "flex-start" }]}>
          <IconButton
            name="settings-outline"
            label="Settings"
            size={18}
            onPress={() => setIsSettingsModalVisible(true)}
          />
        </View>
        <Text style={styles.brandName} numberOfLines={1}>
          LockdIn
        </Text>
        <View style={[styles.topSide, styles.topRight]}>
          <ProfileBubble
            avatar={profile.avatar}
            streak={stats.current}
            lit={stats.today === "complete"}
            onPress={() => setIsProfileVisible(true)}
          />
        </View>
      </View>

      {!compact && dayHeader}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {compact && dayHeader}
        {isSameDay(selectedDay, today) &&
          dayTasks.length > 0 &&
          stats.today === "complete" && (
            <View style={styles.banner}>
              <Ionicons name="flame" size={22} color={colors.streak} />
              <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>
                  {todayGoal > 0 ? "Daily goal reached" : "All done for today"}
                </Text>
                <Text style={styles.bannerSub}>
                  {stats.current} day{stats.current === 1 ? "" : "s"} streak · +{xp.today.xp} XP
                  {xp.today.multiplier > 1 ? ` (×${xp.today.multiplier.toFixed(2)})` : ""}
                </Text>
              </View>
            </View>
          )}

        {dayTasks.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Ionicons name="calendar-outline" size={32} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>
              {isPast ? "Nothing was scheduled" : "A clear day"}
            </Text>
            <Text style={styles.emptySub}>
              {isPast
                ? "There were no tasks on this day."
                : "Add a task and lock in."}
            </Text>
          </View>
        ) : (
          dayTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              now={now}
              onPress={() => onEdit(task.id)}
              onStart={() => onStartTask(task.id)}
              onEnd={() => setFinishing({ id: task.id })}
              onDone={() => setFinishing({ id: task.id })}
              onToggleItem={(itemId) => toggleItem(task.id, itemId)}
              onReschedule={() => onEdit(task.id)}
              onDelete={() => setDeleteId(task.id)}
              xp={dayClosed ? undefined : dayXpInfo.perTask.get(task.id)}
            />
          ))
        )}
      </ScrollView>

      {(!isPast || social) && (
        <View style={styles.addBar}>
          {!isPast && (
            <Button
              label="Add task"
              icon={<Ionicons name="add" size={20} color="#fff" />}
              onPress={openAdd}
              style={styles.addButton}
            />
          )}
          {social && (
            <View>
              <IconButton
                name="people"
                label="Friends"
                size={22}
                background={colors.surface}
                onPress={() => setIsFriendsVisible(true)}
              />
              {incomingRequests > 0 && (
                <View style={styles.badge} pointerEvents="none">
                  <Text style={styles.badgeText}>{incomingRequests > 9 ? "9+" : incomingRequests}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <AddTaskModal
        isVisible={isModalVisible}
        onClose={() => {
          setIsModalVisible(false);
          setTimeout(() => {
            setEditingId(null);
          }, 0);
        }}
        initialTask={findTask(editingId) ?? null}
        defaultDate={selectedDay}
        onSave={handleSaveTask}
      />

      <ConfirmModal
        visible={deleteId !== null && !deleteIsRepeating}
        title="Delete Task?"
        message="This action cannot be undone."
        confirmText="Delete"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId !== null) onDelete(deleteId);
          setDeleteId(null);
        }}
      />

      <DeleteRepeatModal
        visible={deleteId !== null && deleteIsRepeating}
        repeat={deleteTask ? repeatOf(deleteTask) : "none"}
        count={deleteSeriesCount}
        onCancel={() => setDeleteId(null)}
        onDeleteOne={() => {
          if (deleteId !== null) onDelete(deleteId, "one");
          setDeleteId(null);
        }}
        onDeleteAll={() => {
          if (deleteId !== null) onDelete(deleteId, "all");
          setDeleteId(null);
        }}
      />

      <CompleteConfirmModal
        visible={finishing !== null}
        title={
          finishesEarly
            ? "Finished early?"
            : finishKind === "timer"
            ? "End Task?"
            : finishKind === "checklist"
            ? "Complete checklist?"
            : "Mark as done?"
        }
        message={
          finishesEarly && finishTask?.startedAt && finishTask.estimateMinutes
            ? `You've worked ${humanDuration(
                now - finishTask.startedAt
              )} of your ${humanDuration(
                finishTask.estimateMinutes * 60_000
              )} estimate. Did you really finish the task?`
            : finishKind === "checklist"
            ? "Every item is ticked. Is the whole list really done?"
            : "Are you sure that the task is done? Be honest. 🙏"
        }
        confirmText={
          finishesEarly || finishKind !== "timer"
            ? finishKind === "checklist"
              ? "Yes, complete it"
              : "Yes, it's done"
            : "End Task"
        }
        cancelText={finishesEarly || finishKind !== "timer" ? "Not yet" : "Cancel"}
        xp={finishXp}
        goalBonus={finishReachesGoal ? finishGoalBonus : undefined}
        onCancel={() => setFinishing(null)}
        onConfirm={() => {
          const f = finishing;
          if (!f || !finishTask) return setFinishing(null);
          setPending({ id: finishTask.id, title: finishTask.title, before: xp });
          if (f.itemId) {
            // Tick the item that finishes the list, together with completing it.
            const items = (finishTask.items ?? []).map((i) =>
              i.id === f.itemId ? { ...i, done: true } : i
            );
            completeTask(finishTask.id, { items });
          } else {
            completeTask(finishTask.id);
          }
          setFinishing(null);
        }}
      />

      <CompletionModal data={completion} onClose={() => setCompletion(null)} />

      <LevelUpModal
        level={anyModalOpen || checkInTask ? null : levelUp.celebrate}
        onClose={levelUp.dismiss}
      />

      <CheckInModal
        task={checkInTask}
        now={now}
        onStillWorking={() => {
          if (checkInTask)
            updateTask(checkInTask.id, {
              nextCheckInAt: Date.now() + CHECK_IN_INTERVAL_MIN * 60_000,
            });
        }}
        onDone={() => {
          if (checkInTask) setFinishing({ id: checkInTask.id });
        }}
      />

      <HelpHomeScreenModal
        isVisible={isHelpModalVisible}
        onClose={handleCloseHelp}
      />

      <SettingsModal
        isVisible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
        account={account}
        localOnly={!auth.configured}
      />

      {social && (
        <FriendsModal
          visible={isFriendsVisible}
          onClose={() => {
            setIsFriendsVisible(false);
            friends.refresh();
          }}
          overview={friends.overview}
          loading={friends.loading}
          error={friends.error}
          onRefresh={friends.refresh}
          me={{ avatar: profile.avatar, streak: stats.current, today: stats.today }}
        />
      )}

      <ProfileModal
        visible={isProfileVisible}
        onClose={() => setIsProfileVisible(false)}
        profile={profile}
        onChange={setProfile}
        stats={stats}
        xp={xp}
        todayKey={todayKey}
        goal={goalProgress}
        onChangeGoal={changeGoal}
      />

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: 560,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.streakSoft,
    borderWidth: 1,
    borderColor: colors.streak,
  },
  bannerTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  bannerSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  // Both sides take equal space so the title sits dead centre.
  topSide: { flex: 1, minWidth: 0 },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  brandName: {
    flexShrink: 1,
    textAlign: "center",
    marginHorizontal: 8,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 16,
  },
  // Takes whatever room the arrows leave, so a longer subtitle wraps instead of
  // pushing the buttons off-screen.
  dayTitleWrap: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 8 },
  dayTitle: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.textPrimary,
  },
  daySub: { fontSize: 14, color: colors.textMuted, marginTop: 2, textAlign: "center" },
  jump: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  jumpText: { fontSize: 13, fontWeight: "600", color: colors.accent },
  list: { flex: 1, marginTop: 16 },
  listContent: { gap: 12, paddingBottom: 16, flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 40,
  },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  emptySub: { fontSize: 15, color: colors.textMuted },
  addBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 8,
    paddingTop: 4,
  },
  addButton: { flex: 1, minWidth: 0 },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },
});
