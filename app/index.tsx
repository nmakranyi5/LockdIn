import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../assets/colors/colors";
import AddTaskModal from "./components/AddTaskModal";

export default function Index() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalTasks = tasks.length + 1;
  const isAddCard = currentIndex === tasks.length;

  const handleSaveTask = (task: any) => {
    setTasks(prev => {
      const newTasks = [...prev, task];
      setCurrentIndex(newTasks.length - 1);
      return newTasks;
    });
  };

  const goLeft = () => {
    setCurrentIndex(i => (i - 1 + totalTasks) % totalTasks);
  };

  const goRight = () => {
    setCurrentIndex(i => (i + 1) % totalTasks);
  };

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
        <Text style={{ fontSize: 32, fontWeight: "bold", color: colors.textPrimary }}>
          LockdIn
        </Text>
        <Text style={{ fontSize: 22, marginTop: 10, color: colors.textMuted, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
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

            <Text style={{ color: colors.textPrimary, fontSize: 18 }}>
              {tasks[currentIndex].frequency}
            </Text>
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
          <Ionicons name="arrow-back-outline" size={48} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={{ color: colors.textMuted }}>
          {isAddCard ? "+" : currentIndex + 1} / {totalTasks}
        </Text>

        <TouchableOpacity onPress={goRight}>
            <Ionicons name="arrow-forward-outline" size={48} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Modal */}
      <AddTaskModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSave={handleSaveTask}
      />
    </SafeAreaView>
  );
}
