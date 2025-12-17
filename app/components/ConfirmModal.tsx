import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../assets/colors/colors";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onConfirm} style={styles.confirmBtn}>
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
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
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: colors.textMuted,
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,

  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#292626ff",
    borderRadius: 10,
  },
  cancelText: {
    color: colors.textMuted,
    fontWeight: "700",
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#ff5a5a",
    borderRadius: 10,
  },
  confirmText: {
    color: "#fff",
    fontWeight: "700",
  },
});
