import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../assets/colors/colors";

type TimerModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onResume?: () => void;
  onComplete?: () => void;
};

export default function TimerModal({
  isVisible,
  onClose,
  onResume,
  onComplete,
}: TimerModalProps) {
  return (
    <Modal animationType="fade" transparent visible={isVisible}>
      <View style={styles.backdrop}>
        <View style={styles.popup}>
          <Text style={styles.title}>Pause Task</Text>
          <TouchableOpacity onPress={onResume} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onComplete} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Complete Task</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    marginTop: 12,
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
});
