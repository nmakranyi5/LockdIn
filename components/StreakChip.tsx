import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors, radius } from "../assets/colors/colors";

type StreakChipProps = {
  count: number;
  // Today's tasks are all done: the flame is lit.
  lit: boolean;
  onPress: () => void;
  compact?: boolean;
};

export default function StreakChip({
  count,
  lit,
  onPress,
  compact,
}: StreakChipProps) {
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
        compact && styles.chipCompact,
        { backgroundColor: lit ? colors.streakSoft : colors.surface },
        lit && { borderColor: colors.streak },
      ]}
    >
      <Ionicons name={active ? "flame" : "flame-outline"} size={compact ? 16 : 18} color={tint} />
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          compact && styles.textCompact,
          { color: active ? colors.textPrimary : colors.textMuted },
        ]}
      >
        {count}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    // Yields space to the title on very narrow screens / large text.
    flexShrink: 1,
    minWidth: 0,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipCompact: { minHeight: 32, paddingHorizontal: 8, gap: 3 },
  textCompact: { fontSize: 14 },
  text: { flexShrink: 1, fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
