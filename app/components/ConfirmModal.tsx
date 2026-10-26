import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../assets/colors/colors";
import Button from "../../components/ui/Button";
import ModalCard from "../../components/ui/ModalCard";

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: "danger" | "primary";
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  confirmVariant = "danger",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <ModalCard
      visible={visible}
      title={title}
      maxWidth={380}
      footer={
        <View style={styles.actions}>
          <Button
            label={cancelText}
            variant="secondary"
            onPress={onCancel}
            style={styles.action}
          />
          <Button
            label={confirmText}
            variant={confirmVariant}
            onPress={onConfirm}
            style={styles.action}
          />
        </View>
      }
    >
      <Text style={styles.message}>{message}</Text>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 16, lineHeight: 23, color: colors.textMuted },
  actions: { flexDirection: "row", gap: 12 },
  action: { flex: 1 },
});
