import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../assets/colors/colors";
import AddTaskModal from "./components/AddTaskModal";

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
    notificationId?: string;
    startedAt?: number | null;
    completedAt?: number | null;
  };

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const TASKS_KEY = "@lockdin_tasks";
  const INDEX_KEY = "@lockdin_current_index";

  const totalTasks = tasks.length + 1;
  const isAddCard = currentIndex === tasks.length;
  const BUFFER_MS = 60_000;

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const getRemainingMs = (startDate: Date) =>
    Math.max(0, startDate.getTime() - now);

  const formatMs = (ms: number) => {
    const total = Math.floor(ms / 1000);
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

  const roundUpToNextMinute = (date: Date) => {
    const d = new Date(date);
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    return d;
  };

  const handleSaveTask = async (task: Task) => {
    const now = new Date();

    let fireDate = new Date(roundUpToNextMinute(task.startDate));

    const minAllowed = new Date(now.getTime() + BUFFER_MS);

    if (fireDate < minAllowed) {
      fireDate = minAllowed;
    }

    if (fireDate.getTime() - now.getTime() < BUFFER_MS) {
      fireDate = new Date(now.getTime() + BUFFER_MS);
    }

    if (editingIndex !== null) {
      const oldTask = tasks[editingIndex];

      if (oldTask.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(
          oldTask.notificationId
        );
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Time to start task!",
          body: task.title,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
        },
      });

      setTasks((prev) => {
        const updated = [...prev];
        updated[editingIndex] = {
          ...task,
          startDate: fireDate,
          notificationId,
        };
        return updated;
      });

      setEditingIndex(null);
      confirmEditPushNotification();
      return;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to start task!",
        body: task.title,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });

    setTasks((prev) => {
      setCurrentIndex(prev.length);
      confirmAddPushNotification();
      return [
        ...prev,
        {
          ...task,
          startDate: fireDate,
          notificationId,
        },
      ];
    });
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
    setTasks((prev) => {
      const taskToDelete = prev[currentIndex];

      if (taskToDelete?.notificationId) {
        Notifications.cancelScheduledNotificationAsync(
          taskToDelete.notificationId
        );
      }
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
      updated[currentIndex] = {
        ...updated[currentIndex],
        completedAt: Date.now(),
      };
      return updated;
    });
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
          marginTop: 20,
          height: 500,
          width: 300,
          borderWidth: 2,
          borderColor: colors.border,
          borderRadius: 20,
          borderStyle: "dashed",
          backgroundColor: colors.card,
          justifyContent: "center",
          alignItems: "center",
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

              const startMs = task.startDate.getTime();
              const endMs = task.endDate.getTime();

              let label = "";
              let timeMs = 0;
              let isOverdue = false;

              if (task.completedAt && task.startedAt) {
                label = "Time spent";
                timeMs = task.completedAt - task.startedAt;
              } else if (!task.startedAt && nowMs < startMs) {
                label = "Starts in";
                timeMs = startMs - nowMs;
              } else if (task.startedAt && nowMs < endMs) {
                label = "Time remaining";
                timeMs = endMs - nowMs;
              } else {
                label = "Overdue by";
                timeMs = nowMs - endMs;
                isOverdue = true;
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
                      onPress={onEndTask}
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
          width: 300,
          marginTop: 16,
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
          width: 200,
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

        <TouchableOpacity onPress={onDelete}>
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
