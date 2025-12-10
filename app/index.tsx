import { Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: "#64a5e1ff", alignItems: "center" }}>

      <Text style={{ fontSize: 32, fontWeight: "bold"}}>LockdIn 🔒</Text>
      <Text style={{ fontSize: 22, marginTop: 10 }}>Tasks</Text>

      <TouchableOpacity /* styles */>
        <Text style={{ fontSize: 22, marginTop: 10 }}>+</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}
