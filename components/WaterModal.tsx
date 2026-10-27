import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import { fromKey } from "./streak";
import Button from "./ui/Button";
import ModalCard from "./ui/ModalCard";
import { glassesOn, lastDays, MAX_WATER_GOAL, MIN_WATER_GOAL, WaterLog } from "./water";

type WaterModalProps = {
  visible: boolean;
  goal: number;
  log: WaterLog;
  todayKey: string;
  onChangeGoal: (goal: number) => void;
  onClose: () => void;
};

const BAR_H = 90;

// The daily target and the last week of glasses.
export default function WaterModal({ visible, goal, log, todayKey, onChangeGoal, onClose }: WaterModalProps) {
  const days = lastDays(todayKey, 7);
  const most = Math.max(goal, ...days.map((d) => glassesOn(log, d)));
  return (
    <ModalCard
      visible={visible}
      title="Water"
      maxWidth={400}
      footer={<Button label="Done" onPress={onClose} />}
    >
      <Text style={styles.label}>Daily target</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.step, goal <= MIN_WATER_GOAL && styles.disabled]}
          disabled={goal <= MIN_WATER_GOAL}
          accessibilityRole="button"
          accessibilityLabel="Lower the target"
          onPress={() => onChangeGoal(goal - 1)}
        >
          <Ionicons name="remove" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.goalWrap}>
          <Text style={styles.goal} accessibilityLabel={`Target ${goal} glasses`}>
            {goal}
          </Text>
          <Text style={styles.goalUnit}>glasses a day</Text>
        </View>
        <TouchableOpacity
          style={[styles.step, goal >= MAX_WATER_GOAL && styles.disabled]}
          disabled={goal >= MAX_WATER_GOAL}
          accessibilityRole="button"
          accessibilityLabel="Raise the target"
          onPress={() => onChangeGoal(goal + 1)}
        >
          <Ionicons name="add" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Last 7 days</Text>
      <View style={styles.chart}>
        {days.map((d) => {
          const n = glassesOn(log, d);
          const met = n >= goal;
          return (
            <View key={d} style={styles.col}>
              <Text style={styles.value}>{n}</Text>
              <View style={styles.barBox}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(n > 0 ? 4 : 0, Math.round((n / most) * BAR_H)),
                      backgroundColor: met ? colors.success : colors.highlight,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.day, d === todayKey && { color: colors.highlight }]}>
                {fromKey(d).toLocaleDateString([], { weekday: "short" }).slice(0, 2)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>Green days reached the target. Your water doesn't affect streaks or XP.</Text>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 10,
  },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  step: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  disabled: { opacity: 0.35 },
  goalWrap: { alignItems: "center" },
  goal: { fontSize: 36, fontWeight: "800", color: colors.textPrimary },
  goalUnit: { fontSize: 13, color: colors.textMuted },
  chart: {
    flexDirection: "row",
    gap: 6,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  col: { flex: 1, alignItems: "center", gap: 6 },
  value: { fontSize: 12, fontWeight: "700", color: colors.textLabel },
  barBox: { height: BAR_H, justifyContent: "flex-end", width: "100%", alignItems: "center" },
  bar: { width: "70%", borderRadius: 6 },
  day: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  note: { marginTop: 12, fontSize: 13, lineHeight: 18, color: colors.textMuted },
});
