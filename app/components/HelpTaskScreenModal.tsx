import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { colors } from "../../assets/colors/colors";

type HelpModalProps = {
  isVisible: boolean;
  onClose: () => void;
};

export default function HelpTaskScreenModal({
  isVisible,
  onClose,
}: HelpModalProps) {
  return (
    <Modal animationType="fade" transparent visible={isVisible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.backdrop}>
          <View style={styles.popup}>
            <View style={styles.header}>
              <Text style={styles.title}>Tasks</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.text}>Here, you can manage a task.</Text>
              <Text style={styles.text}>First, input a name for the task.</Text>
              <Text style={styles.text}>
                Next, set the start date and time using the pickers.
              </Text>
              <Text style={styles.text}>
                Then, set the deadline date and time with the pickers.
              </Text>
              <Text style={styles.text}>
                Finally, hit the save button to finish managing the task.
              </Text>
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={onClose}>
              <Text style={styles.saveButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  popup: {
    width: "90%",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    maxWidth: 560,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    color: colors.textLabel,
    marginBottom: 6,
    marginTop: 8,
    fontWeight: "bold",
  },
  inputBox: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    justifyContent: "center",
    marginBottom: 20,
  },
  body: {
    marginTop: 20,
    gap: 8,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  input: {
    height: 40,
    color: colors.textPrimary,
    outlineColor: "transparent",
    outlineWidth: 0,
  },
  text: {
    color: "#B5B5B8",
    fontSize: 20,
    fontWeight: "400",
    lineHeight: 22,
    marginBottom: 10,
  },
});
