import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../assets/colors/colors";
import AddTaskModal from './components/AddTaskModal';

export default function Index() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);

  const onModalClose = () => {
    setIsModalVisible(false);
  };

  const handleSaveTask = (task: any) => {
    setTasks((prev) => [...tasks, task]);
  };


  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: colors.background, alignItems: "center" }}>

      <Text style={{ fontSize: 32, fontWeight: "bold", color: colors.textPrimary}}>LockdIn</Text>
      <Text style={{ fontSize: 22, marginTop: 10, color: colors.textMuted }}>Tasks</Text>
      <View style={{ width: "100%", marginTop: 20, alignItems: "center" }}>
        {tasks.map((task, index) => (
          <View
            key={index}
            style={{
              marginTop: 30,
              height: 160,
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
            <Text style={{ color: colors.textPrimary, fontSize: 18 }}>
              {task.title}
            </Text>
          </View>
        ))}
      </View>


      <TouchableOpacity
        onPress={() => setIsModalVisible(true)}
        style={{
          marginTop: 30,
          height: 160,
          width: 300,
          borderWidth: 2,
          borderColor: colors.border,
          borderRadius: 20,
          borderStyle: "dashed",
          backgroundColor: colors.card,
          justifyContent: "center",
          alignItems: "center",
        }}>
        <Ionicons name="add" size={48} color={colors.accent} /> 
      </TouchableOpacity>
      <AddTaskModal isVisible={isModalVisible} onClose={onModalClose} onSave={handleSaveTask} ></AddTaskModal>
    </SafeAreaView>
  );
}
