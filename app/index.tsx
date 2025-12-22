import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../assets/colors/colors";
import AddTaskModal from "./components/AddTaskModal";
import ConfirmModal from "./components/ConfirmModal";
import HelpHomeScreenModal from "./components/HelpHomeScreenModal";

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

  return (
    <SafeAreaView
      style={{
        flex: 1,
        padding: 20,
        backgroundColor: colors.background,
        alignItems: "center",
      }}
    >
      <View style={{ paddingBottom: 20, paddingTop: 10 }}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color: colors.textPrimary,
          }}
        >
          LockdIn
        </Text>
        <Text
          style={{
            fontSize: 22,
            marginTop: 10,
            color: colors.textMuted,
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          Tasks
        </Text>
      </View>
      <View
        style={{
          flex: 1,
          marginHorizontal: 20,
          borderRadius: 20,
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: colors.border,
          justifyContent: "center",
          alignItems: "center",
          width: "90%",
        }}
      >
        {isAddCard ? (
          <TouchableOpacity onPress={() => setIsModalVisible(true)}>
            <Ionicons name="add" size={48} color={colors.accent} />
          </TouchableOpacity>
        ) : (
          <>
            {(() => {
              const task = tasks[currentIndex];
              const nowMs = now;

              const startMs = new Date(task.startDate).setSeconds(0, 0);
              const endMs = new Date(task.endDate).setSeconds(0, 0);

              let label = "";
              let timeMs = 0;
              let isOverdue = false;

              if (task.completedAt && task.startedAt) {
                label = "Time spent";
                timeMs = Math.max(0, task.completedAt - task.startedAt);
              } else if (!task.startedAt && nowMs < startMs) {
                label = "Starts in";
                timeMs = Math.max(0, startMs - nowMs);
              } else {
                if (nowMs < endMs) {
                  label = "Time remaining";
                  timeMs = Math.max(0, endMs - nowMs);
                } else {
                  label = "Deadline passed by";
                  timeMs = Math.max(0, nowMs - endMs);
                  isOverdue = true;
                }
              }

              return (
                <>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 50,
                      padding: 20,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    {task.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 20,
                      fontWeight: "bold",
                      textAlign: "center",
                      paddingBottom: 10,
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    style={{
                      fontVariant: ["tabular-nums"],
                      fontSize: 40,
                      color: isOverdue ? "#ff5a5a" : colors.textPrimary,
                    }}
                  >
                    {formatMs(timeMs)}
                  </Text>
                  {!task.startedAt && !task.completedAt && (
                    <TouchableOpacity
                      style={styles.startButton}
                      onPress={onStartTask}
                    >
                      <Text style={styles.startButtonText}>Start Task</Text>
                    </TouchableOpacity>
                  )}

                  {task.startedAt && !task.completedAt && (
                    <TouchableOpacity
                      style={[
                        styles.startButton,
                        { backgroundColor: "#ff5a5a" },
                      ]}
                      onPress={() => setConfirmEndVisible(true)}
                    >
                      <Text style={styles.startButtonText}>End Task</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </>
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          maxWidth: 360,
          marginTop: 16,
          paddingHorizontal: 20,
        }}
      >
        <TouchableOpacity onPress={goLeft}>
          <Ionicons
            name="arrow-back-outline"
            size={48}
            color={colors.textPrimary}
          />
        </TouchableOpacity>

        <Text style={{ color: colors.textMuted }}>
          {currentIndex + 1} / {totalTasks}
        </Text>

        <TouchableOpacity onPress={goRight}>
          <Ionicons
            name="arrow-forward-outline"
            size={48}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "50%",
          maxWidth: 260,
          marginTop: 16,
        }}
      >
        <TouchableOpacity onPress={onEdit}>
          <Ionicons
            name="pencil-outline"
            size={32}
            color={colors.textPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            if (isAddCard || tasks.length === 0) return;
            setConfirmDeleteVisible(true);
          }}
        >
          <Ionicons name="trash-outline" size={32} color={colors.textPrimary} />
        </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  startButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },

  startButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
