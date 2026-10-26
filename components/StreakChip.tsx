import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors, radius } from "../assets/colors/colors";

type StreakChipProps = {
  count: number;
  // Today's tasks are all done: the flame is lit.
  lit: boolean;
  onPress: () => void;
};

export default function StreakChip({ count, lit, onPress }: StreakChipProps) {
  const active = count > 0;
  const tint = active ? colors.streak : colors.textMuted;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count} day streak`}
      style={[
        styles.chip,
        { backgroundColor: lit ? colors.streakSoft : colors.surface },
        lit && { borderColor: colors.streak },
      ]}
    >
      <Ionicons name={active ? "flame" : "flame-outline"} size={18} color={tint} />
      <Text style={[styles.text, { color: active ? colors.textPrimary : colors.textMuted }]}>
        {count}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
