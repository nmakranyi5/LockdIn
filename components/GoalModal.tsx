import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import { ALL_TASKS, goalBonus, goalLabel, goalShort, MAX_GOAL } from "./goals";
import Button from "./ui/Button";
import Chips from "./ui/Chips";
import ModalCard from "./ui/ModalCard";

type GoalModalProps = {
  visible: boolean;
  // The goal in force today, and a change that is waiting for tomorrow (if any).
  current: number;
  pending: number | null;
  onSave: (goal: number) => void;
  onClose: () => void;
};

const OPTIONS = [...Array.from({ length: MAX_GOAL }, (_, i) => i + 1), ALL_TASKS].map((g) => ({
  value: String(g),
  label: g === ALL_TASKS ? "All tasks" : goalShort(g),
}));

export default function GoalModal({ visible, current, pending, onSave, onClose }: GoalModalProps) {
  const upcoming = pending ?? current;
  const [choice, setChoice] = useState(upcoming);
  useEffect(() => {
    if (visible) setChoice(upcoming);
  }, [visible, upcoming]);

  const unchanged = choice === upcoming;
  const bonus = goalBonus(choice);

  return (
    <ModalCard
      visible={visible}
      title="Daily goal"
      maxWidth={400}
      footer={
        <>
          <Button
            label={unchanged ? "Done" : choice === current ? "Keep current goal" : "Save goal"}
            onPress={() => {
              if (!unchanged) onSave(choice);
              onClose();
            }}
          />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </>
      }
    >
      <Text style={styles.lead}>
        How many tasks do you need to finish in a day to keep your streak?
      </Text>

      <View style={styles.chips}>
        <Chips
          options={OPTIONS}
          value={String(choice)}
          onChange={(v) => setChoice(Number(v))}
        />
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{goalLabel(choice)}</Text>
        {choice > 0 ? (
          <View style={styles.bonusRow}>
            <Ionicons name="flag" size={15} color={colors.warning} />
            <Text style={styles.bonusText}>
              ×{bonus.toFixed(2)} XP on every task, on days you reach it
            </Text>
          </View>
        ) : (
          <Text style={styles.muted}>
            Every task you schedule that day must be done. The bonus grows with the number of tasks
            that day: ×1.10 for each extra task, up to 10. Finish all 5 and every task earns ×1.40.
          </Text>
        )}
      </View>

      <Text style={styles.note}>
        {pending !== null && pending !== current
          ? `Starts tomorrow: ${goalLabel(pending)}. Today stays ${goalLabel(current)}.`
          : "A new goal starts tomorrow, so today's goal stays as it is."}
      </Text>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 15, lineHeight: 22, color: colors.textMuted },
  chips: { marginTop: 16 },
  summary: {
    gap: 6,
    marginTop: 18,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  bonusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bonusText: { flexShrink: 1, fontSize: 14, fontWeight: "600", color: colors.warning },
  muted: { fontSize: 13, lineHeight: 19, color: colors.textMuted },
  note: { marginTop: 12, fontSize: 12, lineHeight: 18, color: colors.textMuted },
});
