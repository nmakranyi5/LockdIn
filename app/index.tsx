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
import DayStrip from "../components/DayStrip";
import ProfileModal from "../components/ProfileModal";
import ProfileBubble from "../components/ProfileBubble";
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [endId, setEndId] = useState<string | null>(null);
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
    stats,
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
  });

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
          onSignOut: async () => {
            // Push whatever we can, then forget this device's copy so the next
            // person to sign in doesn't inherit it.
            await sync.syncNow();
            await sync.wipeLocal();
            await auth.signOut();
          },
          onDeleteAccount: async () => {
            const r = await auth.deleteAccount();
            if (r.error) return r.error;
            await sync.wipeLocal();
            await auth.signOut();
            return undefined;
          },
        }
      : undefined;

  const endTask = findTask(endId);
  const endsEarly = !!endTask && isEarlyFinish(endTask, now);

  const anyModalOpen =
    isModalVisible ||
    isHelpModalVisible ||
    isSettingsModalVisible ||
    isProfileVisible ||
    deleteId !== null ||
    endId !== null;
  // Only one prompt at a time, and never stacked on top of another dialog.
  const checkInTask = anyModalOpen
    ? undefined
    : tasks.find((t) => isCheckInDue(t, now));

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
    return `${date} · ${doneCount}/${dayTasks.length} done`;
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
          <Text style={styles.dayTitle}>{dayTitle()}</Text>
          <Text style={styles.daySub}>{daySubtitle()}</Text>
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
                <Text style={styles.bannerTitle}>All done for today</Text>
                <Text style={styles.bannerSub}>
                  {stats.current} day{stats.current === 1 ? "" : "s"} streak
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
              onEnd={() => setEndId(task.id)}
              onDone={() => completeTask(task.id)}
              onToggleItem={(itemId) => toggleItem(task.id, itemId)}
              onReschedule={() => onEdit(task.id)}
              onDelete={() => setDeleteId(task.id)}
            />
          ))
        )}
      </ScrollView>

      {!isPast && (
        <View style={styles.addBar}>
          <Button
            label="Add task"
            icon={<Ionicons name="add" size={20} color="#fff" />}
            onPress={openAdd}
          />
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

      <ConfirmModal
        visible={endId !== null}
        title={endsEarly ? "Finished early?" : "End Task?"}
        message={
          endsEarly && endTask?.startedAt && endTask.estimateMinutes
            ? `You've worked ${humanDuration(
                now - endTask.startedAt
              )} of your ${humanDuration(
                endTask.estimateMinutes * 60_000
              )} estimate. Did you really finish the task?`
            : "Are you sure that the task is done? Be honest. 🙏"
        }
        confirmText={endsEarly ? "Yes, it's done" : "End Task"}
        cancelText={endsEarly ? "Not yet" : "Cancel"}
        confirmVariant={endsEarly ? "primary" : "danger"}
        onCancel={() => setEndId(null)}
        onConfirm={() => {
          if (endId !== null) completeTask(endId);
          setEndId(null);
        }}
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
          if (checkInTask) completeTask(checkInTask.id);
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
      />

      <ProfileModal
        visible={isProfileVisible}
        onClose={() => setIsProfileVisible(false)}
        profile={profile}
        onChange={setProfile}
        stats={stats}
        todayKey={todayKey}
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
  dayTitleWrap: { alignItems: "center" },
  dayTitle: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.textPrimary,
  },
  daySub: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
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
  addBar: { paddingBottom: 8, paddingTop: 4 },
});
