import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../assets/colors/colors";
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
  type Task = {
    title: string;
    startDate: Date;
    endDate: Date;
    repeats?: string;
    startNotificationId?: string;
    deadlineNotificationId?: string;
    reminderNotificationId?: string;
    startedAt?: number | null;
    completedAt?: number | null;
  };

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [confirmEndVisible, setConfirmEndVisible] = useState(false);

  const TASKS_KEY = "@lockdin_tasks";
  const INDEX_KEY = "@lockdin_current_index";

  const totalTasks = tasks.length + 1;
  const isAddCard = currentIndex === tasks.length;
  const BUFFER_MS = 60_000;

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const formatMs = (ms: number) => {
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s
        .toString()
        .padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const normalizeStartTime = (selected: Date) => {
    const currentNow = new Date();
    const normalized = new Date(selected);

    normalized.setSeconds(0, 0);

    if (normalized.getTime() <= currentNow.getTime()) {
      normalized.setMinutes(normalized.getMinutes() + 1);
    }

    return normalized;
  };

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
      setCurrentIndex(tasks.length);
      confirmAddPushNotification();
    }
  };

  const goLeft = () => {
    setCurrentIndex((i) => (i - 1 + totalTasks) % totalTasks);
  };

  const goRight = () => {
    setCurrentIndex((i) => (i + 1) % totalTasks);
  };

  const onEdit = () => {
    if (isAddCard) return;
    setEditingIndex(currentIndex);
    setIsModalVisible(true);
  };

  const onDelete = () => {
    if (isAddCard) return;

    const taskToDelete = tasks[currentIndex];
    if (!taskToDelete) return;

    const {
      startNotificationId,
      deadlineNotificationId,
      reminderNotificationId,
    } = taskToDelete;

    if (startNotificationId) {
      Notifications.cancelScheduledNotificationAsync(startNotificationId);
    }
    if (deadlineNotificationId) {
      Notifications.cancelScheduledNotificationAsync(deadlineNotificationId);
    }
    if (reminderNotificationId) {
      Notifications.cancelScheduledNotificationAsync(reminderNotificationId);
    }

    setTasks((prev) => {
      const newTasks = prev.filter((_, index) => index !== currentIndex);

      if (newTasks.length === 0) {
        setCurrentIndex(0);
      } else if (currentIndex >= newTasks.length) {
        setCurrentIndex(newTasks.length - 1);
      }
      return newTasks;
    });
  };

  const onStartTask = () => {
    if (isAddCard) return;

    setTasks((prev) => {
      const updated = [...prev];
      const task = updated[currentIndex];

      if (task.startedAt) return prev;

      if (task?.startNotificationId) {
        Notifications.cancelScheduledNotificationAsync(
          task.startNotificationId
        );
      }

      if (task?.reminderNotificationId) {
        Notifications.cancelScheduledNotificationAsync(
          task.reminderNotificationId
        );
      }

      updated[currentIndex] = {
        ...task,
        startedAt: Date.now(),
      };

      return updated;
    });
  };

  const onEndTask = () => {
    setTasks((prev) => {
      const updated = [...prev];
      const task = updated[currentIndex];

      if (task?.deadlineNotificationId) {
        Notifications.cancelScheduledNotificationAsync(
          task.deadlineNotificationId
        );
      }

      if (task?.reminderNotificationId) {
        Notifications.cancelScheduledNotificationAsync(
          task.reminderNotificationId
        );
      }

      updated[currentIndex] = {
        ...updated[currentIndex],
        completedAt: Date.now(),
      };
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
    const loadIndex = async () => {
      const savedIndex = await AsyncStorage.getItem(INDEX_KEY);
      if (savedIndex !== null) {
        setCurrentIndex(Number(savedIndex));
      }
    };
    loadIndex();
  }, []);

  useEffect(() => {
    const saveIndex = async () => {
      await AsyncStorage.setItem(INDEX_KEY, currentIndex.toString());
    };
    saveIndex();
  }, [currentIndex]);

  useEffect(() => {
    if (currentIndex > tasks.length) {
      setCurrentIndex(tasks.length);
    }
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

  const formatWhen = (d: Date) =>
    new Date(d).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const renderTask = () => {
    const task = tasks[currentIndex];
    if (!task) return null;

    const nowMs = now;
    const startMs = new Date(task.startDate).setSeconds(0, 0);
    const endMs = new Date(task.endDate).setSeconds(0, 0);

    let label = "";
    let timeMs = 0;
    let isOverdue = false;
    let status = { text: "Upcoming", color: colors.accent, bg: colors.accentSoft };

    if (task.completedAt && task.startedAt) {
      label = "Time spent";
      timeMs = Math.max(0, task.completedAt - task.startedAt);
      status = { text: "Done", color: colors.success, bg: colors.successSoft };
    } else if (!task.startedAt && nowMs < startMs) {
      label = "Starts in";
      timeMs = Math.max(0, startMs - nowMs);
    } else if (nowMs < endMs) {
      label = "Time remaining";
      timeMs = Math.max(0, endMs - nowMs);
      status = task.startedAt
        ? { text: "In progress", color: colors.highlight, bg: colors.accentSoft }
        : { text: "Ready to start", color: colors.warning, bg: colors.accentSoft };
    } else {
      label = "Deadline passed by";
      timeMs = Math.max(0, nowMs - endMs);
      isOverdue = true;
      status = { text: "Overdue", color: colors.danger, bg: colors.dangerSoft };
    }

    const showProgress = !!task.startedAt && !task.completedAt;
    const progress = showProgress
      ? Math.min(1, Math.max(0, (nowMs - task.startedAt!) / Math.max(1, endMs - task.startedAt!)))
      : 0;

    return (
      <View style={styles.cardInner}>
        <View style={[styles.pill, { backgroundColor: status.bg }]}>
          <View style={[styles.pillDot, { backgroundColor: status.color }]} />
          <Text style={[styles.pillText, { color: status.color }]}>
            {status.text}
          </Text>
        </View>

        <Text style={styles.taskTitle} numberOfLines={3}>
          {task.title || "Untitled task"}
        </Text>

        <View style={styles.timerBlock}>
          <Text style={styles.timerLabel}>{label}</Text>
          <Text
            style={[styles.timer, isOverdue && { color: colors.danger }]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {formatMs(timeMs)}
          </Text>
        </View>

        {showProgress && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: isOverdue ? colors.danger : colors.accent,
                },
              ]}
            />
          </View>
        )}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Start</Text>
            <Text style={styles.metaValue}>{formatWhen(task.startDate)}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Deadline</Text>
            <Text style={styles.metaValue}>{formatWhen(task.endDate)}</Text>
          </View>
        </View>

        <View style={styles.cardAction}>
          {!task.startedAt && !task.completedAt && (
            <Button
              label="Start Task"
              icon={<Ionicons name="play" size={18} color="#fff" />}
              onPress={onStartTask}
            />
          )}
          {task.startedAt && !task.completedAt && (
            <Button
              label="End Task"
              variant="danger"
              icon={<Ionicons name="stop" size={18} color="#fff" />}
              onPress={() => setConfirmEndVisible(true)}
            />
          )}
          {task.completedAt && (
            <Button
              label="Reschedule Task"
              variant="secondary"
              icon={<Ionicons name="refresh" size={18} color={colors.textLabel} />}
              onPress={() => {
                setEditingIndex(currentIndex);
                setIsModalVisible(true);
              }}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <IconButton
          name="help-outline"
          onPress={() => setIsHelpModalVisible(true)}
        />
        <View style={styles.brand}>
          <Text style={styles.brandName}>LockdIn</Text>
          <Text style={styles.brandSub}>
            {tasks.length === 0
              ? "No tasks yet"
              : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
          </Text>
        </View>
        <IconButton
          name="settings-outline"
          onPress={() => setIsSettingsModalVisible(true)}
        />
      </View>

      <View style={styles.card}>
        {isAddCard ? (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.addCard}
            onPress={() => setIsModalVisible(true)}
          >
            <View style={styles.addCircle}>
              <Ionicons name="add" size={40} color={colors.accent} />
            </View>
            <Text style={styles.addTitle}>New task</Text>
            <Text style={styles.addSub}>Schedule something and lock in.</Text>
          </TouchableOpacity>
        ) : (
          renderTask()
        )}
      </View>

      <View style={styles.dots}>
        {Array.from({ length: totalTasks }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive,
              i === tasks.length && i !== currentIndex && styles.dotAdd,
            ]}
          />
        ))}
      </View>

      <View style={styles.bottomBar}>
        <IconButton name="chevron-back" size={26} onPress={goLeft} />

        <View style={styles.actions}>
          <IconButton
            name="pencil"
            size={20}
            disabled={isAddCard}
            onPress={onEdit}
          />
          <IconButton
            name="trash-outline"
            size={20}
            color={colors.danger}
            background={colors.dangerSoft}
            disabled={isAddCard || tasks.length === 0}
            onPress={() => {
              if (isAddCard || tasks.length === 0) return;
              setConfirmDeleteVisible(true);
            }}
          />
        </View>

        <IconButton name="chevron-forward" size={26} onPress={goRight} />
      </View>

      <AddTaskModal
        isVisible={isModalVisible}
        onClose={() => {
          setIsModalVisible(false);
          setTimeout(() => {
            setEditingIndex(null);
          }, 0);
        }}
        initialTask={editingIndex !== null ? tasks[editingIndex] : null}
        onSave={handleSaveTask}
      />

      <ConfirmModal
        visible={confirmDeleteVisible}
        title="Delete Task?"
        message="This action cannot be undone."
        confirmText="Delete"
        onCancel={() => setConfirmDeleteVisible(false)}
        onConfirm={() => {
          setConfirmDeleteVisible(false);
          onDelete();
        }}
      />

      <ConfirmModal
        visible={confirmEndVisible}
        title="End Task?"
        message="Are you sure that the task is done? Be honest. 🙏"
        confirmText="End Task"
        onCancel={() => setConfirmEndVisible(false)}
        onConfirm={() => {
          setConfirmEndVisible(false);
          onEndTask();
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
    paddingBottom: 12,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 20,
  },
  brand: { alignItems: "center" },
  brandName: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  brandSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  cardInner: { flex: 1, padding: 24, justifyContent: "space-between" },

  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },

  taskTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: colors.textPrimary,
  },

  timerBlock: { alignItems: "flex-start" },
  timerLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 4,
  },
  timer: {
    fontSize: 64,
    fontWeight: "200",
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },

  metaRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  metaItem: { flex: 1 },
  metaDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 4,
  },
  metaValue: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },

  cardAction: { minHeight: 54 },

  addCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  addCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  addTitle: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  addSub: { fontSize: 15, color: colors.textMuted },

  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    marginBottom: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
  },
  dotActive: { width: 20, backgroundColor: colors.accent },
  dotAdd: { backgroundColor: colors.textMuted },

  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: { flexDirection: "row", gap: 12 },
});
