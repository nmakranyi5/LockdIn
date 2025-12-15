import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../assets/colors/colors";
import AddTaskModal from "./components/AddTaskModal";

useEffect(() => {Notifications.requestPermissionsAsync();}, []);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

Notifications.scheduleNotificationAsync({
  content: {
    title: 'Look at that notification',
    body: "I'm so proud of myself!",
  },
  trigger: null,
});

export default function Index() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const TASKS_KEY = "@lockdin_tasks";
  const INDEX_KEY = "@lockdin_current_index";

  const totalTasks = tasks.length + 1;
  const isAddCard = currentIndex === tasks.length;

  const handleSaveTask = (task: any) => {
    setTasks((prev) => {
      if (editingIndex === null) {
        setCurrentIndex(prev.length);
        return [...prev, task];
      } else {
        const updated = [...prev];
        updated[editingIndex] = task;
        return updated;
      }
    });

    setEditingIndex(null);
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
      const newTasks = prev.filter((_, index) => index !== currentIndex);
      if (newTasks.length === 0) {
        setCurrentIndex(0);
      } else if (currentIndex >= newTasks.length) {
        setCurrentIndex(newTasks.length - 1);
      }
      return newTasks;
    });
  };

  useEffect(() => {
    const loadTasks = async () => {
      const saved = await AsyncStorage.getItem(TASKS_KEY);
      if (saved) {
        setTasks(JSON.parse(saved));
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
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 20,
                padding: 20,
                fontWeight: "bold",
                textAlign: "center",
              }}
            >
              {tasks[currentIndex].title}
            </Text>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 18,
                justifyContent: "space-between",
              }}
            >
              {tasks[currentIndex].startDate} • {tasks[currentIndex].startTime}
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 18 }}>
              {tasks[currentIndex].endDate} • {tasks[currentIndex].endTime}
            </Text>
            <Text style={{ color: colors.textPrimary, fontSize: 18 }}>
              {tasks[currentIndex].repeats}
            </Text>
            <TouchableOpacity style={styles.startButton}>
              <Text style={styles.startButtonText}>Start Timer</Text>
            </TouchableOpacity>
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
