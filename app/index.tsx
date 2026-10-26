import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../assets/colors/colors";
import DayStrip from "../components/DayStrip";
import TaskCard from "../components/TaskCard";
import {
  addDays,
  getTaskState,
  isSameDay,
  startOfDay,
  Task,
} from "../components/taskState";
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

export default function Index() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [endIndex, setEndIndex] = useState<number | null>(null);

  const TASKS_KEY = "@lockdin_tasks";

  const normalizeStartTime = (selected: Date) => {
    const currentNow = new Date();
    const normalized = new Date(selected);

    normalized.setSeconds(0, 0);

    if (normalized.getTime() <= currentNow.getTime()) {
      normalized.setMinutes(normalized.getMinutes() + 1);
    }

    return normalized;
  };

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const handleSaveTask = async (task: Task) => {
    if (editingIndex !== null) {
      const oldTask = tasks[editingIndex];
      if (oldTask.startNotificationId)
        await Notifications.cancelScheduledNotificationAsync(
          oldTask.startNotificationId
        );
      if (oldTask.deadlineNotificationId)
        await Notifications.cancelScheduledNotificationAsync(
          oldTask.deadlineNotificationId
        );
      if (oldTask.reminderNotificationId)
        await Notifications.cancelScheduledNotificationAsync(
          oldTask.reminderNotificationId
        );
    }
    const fireDate = normalizeStartTime(task.startDate);
    const startMs = fireDate.getTime();
    let deadlineFireDate = new Date(task.endDate);
    deadlineFireDate.setSeconds(0, 0);
    deadlineFireDate.setMilliseconds(0);

    const nowMs = Date.now();
    const secondsUntilStart = (startMs - nowMs) / 1000;
    const secondsUntilFirstReminder = secondsUntilStart + 60;

    if (deadlineFireDate.getTime() <= fireDate.getTime()) {
      deadlineFireDate = new Date(fireDate.getTime() + 60_000);
    }

    const startNotificationId = await Notifications.scheduleNotificationAsync({
      content: { title: "Time to start task!", body: task.title },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });

    const deadlineNotificationId =
      await Notifications.scheduleNotificationAsync({
        content: { title: "Task deadline reached!", body: task.title },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: deadlineFireDate,
        },
      });

    const reminderNotificationId =
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Hey! Start your task!",
          body: `You are overdue to start: ${task.title}`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(60, Math.floor(secondsUntilFirstReminder)),
          repeats: true,
        },
      });

    const updatedTask = {
      ...task,
      startDate: fireDate,
      endDate: deadlineFireDate,
      startNotificationId,
      deadlineNotificationId,
      reminderNotificationId,
      startedAt: null,
      completedAt: null,
    };

    if (editingIndex !== null) {
      setTasks((prev) => {
        const updated = [...prev];
        updated[editingIndex] = updatedTask;
        return updated;
      });
      setEditingIndex(null);
      confirmEditPushNotification();
    } else {
      setTasks((prev) => [...prev, updatedTask]);
      confirmAddPushNotification();
    }
  
    setSelectedDay(startOfDay(fireDate));
  };
  const onEdit = (index: number) => {
    setEditingIndex(index);
    setIsModalVisible(true);
  };

  const cancelNotifications = (task?: Task, ...kinds: (keyof Task)[]) => {
    kinds.forEach((k) => {
      const id = task?.[k];
      if (typeof id === "string") {
        Notifications.cancelScheduledNotificationAsync(id);
      }
    });
  };

  const onDelete = (index: number) => {
    const task = tasks[index];
    if (!task) return;
    cancelNotifications(
      task,
      "startNotificationId",
      "deadlineNotificationId",
      "reminderNotificationId"
    );
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const onStartTask = (index: number) => {
    const task = tasks[index];
    if (!task || task.startedAt) return;
    cancelNotifications(task, "startNotificationId", "reminderNotificationId");
    setTasks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], startedAt: Date.now() };
      return updated;
    });
  };

  const onEndTask = (index: number) => {
    const task = tasks[index];
    if (!task) return;
    cancelNotifications(task, "deadlineNotificationId", "reminderNotificationId");
    setTasks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], completedAt: Date.now() };
      return updated;
    });
  };

  const handleCloseHelp = async () => {
    try {
      await AsyncStorage.setItem("hasSeenHelp", "true");
      setIsHelpModalVisible(false);
    } catch (e) {
      console.log("Error saving help modal flag", e);
    }
  };

  async function confirmAddPushNotification() {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Task Added!",
        body: "Successfully added task!",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });
  }

  async function confirmEditPushNotification() {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Task Edited!",
        body: "Successfully edited task!",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });
  }

  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  useEffect(() => {
    const loadTasks = async () => {
      const saved = await AsyncStorage.getItem(TASKS_KEY);
      if (saved) {
        const parsed: Task[] = JSON.parse(saved).map((t: any) => ({
          ...t,
          startDate: new Date(t.startDate),
          endDate: new Date(t.endDate),
        }));

        setTasks(parsed);
      }
    };
    loadTasks();
  }, []);

  useEffect(() => {
    const saveTasks = async () => {
      await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    };
    saveTasks();
  }, [tasks]);

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

  const today = startOfDay(new Date(now));
  const isPast = selectedDay.getTime() < today.getTime();

  const dayTasks = useMemo(
    () =>
      tasks
        .map((task, index) => ({ task, index }))
        .filter(({ task }) => isSameDay(new Date(task.startDate), selectedDay))
        .sort(
          (a, b) =>
            new Date(a.task.startDate).getTime() -
            new Date(b.task.startDate).getTime()
        ),
    [tasks, selectedDay]
  );

  const doneCount = dayTasks.filter(
    ({ task }) => getTaskState(task, now).isDone
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
    setEditingIndex(null);
    setIsModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.screen}>
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
          dayTasks.map(({ task, index }) => (
            <TaskCard
              key={`${index}-${task.title}-${new Date(task.startDate).getTime()}`}
              task={task}
              now={now}
              onPress={() => onEdit(index)}
              onStart={() => onStartTask(index)}
              onEnd={() => setEndIndex(index)}
              onReschedule={() => onEdit(index)}
              onDelete={() => setDeleteIndex(index)}
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
            setEditingIndex(null);
          }, 0);
        }}
        initialTask={editingIndex !== null ? tasks[editingIndex] : null}
        defaultDate={selectedDay}
        onSave={handleSaveTask}
      />

      <ConfirmModal
        visible={deleteIndex !== null}
        title="Delete Task?"
        message="This action cannot be undone."
        confirmText="Delete"
        onCancel={() => setDeleteIndex(null)}
        onConfirm={() => {
          if (deleteIndex !== null) onDelete(deleteIndex);
          setDeleteIndex(null);
        }}
      />

      <ConfirmModal
        visible={endIndex !== null}
        title="End Task?"
        message="Are you sure that the task is done? Be honest. 🙏"
        confirmText="End Task"
        onCancel={() => setEndIndex(null)}
        onConfirm={() => {
          if (endIndex !== null) onEndTask(endIndex);
          setEndIndex(null);
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
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
