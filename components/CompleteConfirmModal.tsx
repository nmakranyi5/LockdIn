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
  // Set when finishing this task reaches the day's goal (the bonus applies).
  goalBonus?: number;
  // Finishing now would be late: the XP is already reduced by this much.
  late?: { start: boolean; finish: boolean };
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
  goalBonus,
  late,
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
      {late && (late.start || late.finish) && (
        <View style={styles.late} accessibilityLabel="Late, so less XP">
          <Ionicons name="time-outline" size={16} color={colors.danger} />
          <Text style={styles.lateText}>
            {late.start && late.finish
              ? "Started and finished late: −50% XP"
              : late.start
              ? "Started late: −25% XP"
              : "Past the deadline: −25% XP"}
          </Text>
        </View>
      )}
      {goalBonus !== undefined && goalBonus > 1 && (
        <View style={styles.goal} accessibilityLabel="This reaches your daily goal">
          <Ionicons name="flag" size={16} color={colors.accent} />
          <Text style={styles.goalText}>
            This reaches your daily goal! ×{goalBonus.toFixed(2)} XP on all of today’s tasks
          </Text>
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
  late: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  lateText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "600", lineHeight: 18, color: colors.danger },
  goal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
  },
  goalText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "600", lineHeight: 18, color: colors.accent },
  actions: { flexDirection: "row", gap: 12 },
  action: { flex: 1 },
});
