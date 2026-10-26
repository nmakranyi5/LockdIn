import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import Button from "./ui/Button";
import ModalCard from "./ui/ModalCard";

type CompleteConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  // XP finishing this task would earn right now (hidden when 0).
  xp: number;
  onConfirm: () => void;
  onCancel: () => void;
};

// "Are you sure it's done?", with a peek at the reward for being honest.
export default function CompleteConfirmModal({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  xp,
  onConfirm,
  onCancel,
}: CompleteConfirmModalProps) {
  return (
    <ModalCard
      visible={visible}
      title={title}
      maxWidth={380}
      footer={
        <View style={styles.actions}>
          <Button label={cancelText} variant="secondary" onPress={onCancel} style={styles.action} />
          <Button label={confirmText} variant="success" onPress={onConfirm} style={styles.action} />
        </View>
      }
    >
      <Text style={styles.message}>{message}</Text>
      {xp > 0 && (
        <View style={styles.reward} accessibilityLabel={`You will earn ${xp} XP`}>
          <Ionicons name="star" size={16} color={colors.warning} />
          <Text style={styles.rewardText}>You’ll earn +{xp} XP</Text>
        </View>
      )}
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 16, lineHeight: 23, color: colors.textMuted },
  reward: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
  },
  rewardText: { fontSize: 14, fontWeight: "700", color: colors.warning },
  actions: { flexDirection: "row", gap: 12 },
  action: { flex: 1 },
});
