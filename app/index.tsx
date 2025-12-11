import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../assets/colors/colors";

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: colors.background, alignItems: "center" }}>

      <Text style={{ fontSize: 32, fontWeight: "bold", color: colors.textPrimary}}>LockdIn</Text>
      <Text style={{ fontSize: 22, marginTop: 10, color: colors.textMuted }}>Tasks</Text>

      <TouchableOpacity style={{
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

    </SafeAreaView>
  );
}
