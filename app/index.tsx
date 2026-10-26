import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../assets/colors/colors";
import DayStrip from "../components/DayStrip";
import * as Notifications from "../components/notifications";
import {
  cancelTaskNotifications,
  scheduleDeadlineNotification,
  scheduleTaskNotifications,
} from "../components/scheduleTask";
import TaskCard from "../components/TaskCard";
import { priorityRank } from "../components/taskMeta";
import {
  addDays,
  ChecklistItem,
  getTaskState,
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
import SettingsModal from "./components/SettingsModal";

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
};

export default function Index() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
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

    const fields = {
      title: input.title,
      startDate: sched.startDate,
      endDate: sched.endDate,
      repeats: input.repeats,
      kind: input.kind,
      priority: input.priority,
      items: input.items,
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
    updateTask(id, { startedAt: Date.now() });
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
      id: newId(),
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

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
      <View style={styles.topBar}>
        <IconButton
          name="help-outline"
          onPress={() => setIsHelpModalVisible(true)}
        />
        <Text style={styles.brandName}>LockdIn</Text>
        <IconButton
          name="settings-outline"
          onPress={() => setIsSettingsModalVisible(true)}
        />
      </View>

      <View style={styles.dayHeader}>
        <IconButton
          name="chevron-back"
          size={18}
          onPress={() => setSelectedDay((d) => addDays(d, -1))}
        />
        <View style={styles.dayTitleWrap}>
          <Text style={styles.dayTitle}>{dayTitle()}</Text>
          <Text style={styles.daySub}>{daySubtitle()}</Text>
        </View>
        <IconButton
          name="chevron-forward"
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

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
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
        title="End Task?"
        message="Are you sure that the task is done? Be honest. 🙏"
        confirmText="End Task"
        onCancel={() => setEndId(null)}
        onConfirm={() => {
          if (endId !== null) completeTask(endId);
          setEndId(null);
        }}
      />

      <HelpHomeScreenModal
        isVisible={isHelpModalVisible}
        onClose={handleCloseHelp}
      />

      <SettingsModal
        isVisible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
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
  brandName: {
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
