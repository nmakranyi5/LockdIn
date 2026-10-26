import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import { addDays, isSameDay, startOfDay } from "./taskState";

type DayStripProps = {
  selected: Date;
  onSelect: (d: Date) => void;
  hasTasks: (d: Date) => boolean;
};

export default function DayStrip({ selected, onSelect, hasTasks }: DayStripProps) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(selected, i - 3));

  return (
    <View style={styles.row}>
      {days.map((d) => {
        const active = isSameDay(d, selected);
        const isToday = isSameDay(d, today);
        return (
          <TouchableOpacity
            key={d.toDateString()}
            activeOpacity={0.8}
            onPress={() => onSelect(d)}
            style={[styles.day, active && styles.dayActive]}
          >
            <Text style={[styles.weekday, active && styles.textActive]}>
              {d.toLocaleDateString([], { weekday: "short" }).toUpperCase()}
            </Text>
            <Text
              style={[
                styles.date,
                isToday && !active && { color: colors.accent },
                active && styles.textActive,
              ]}
            >
              {d.getDate()}
            </Text>
            <View
              style={[
                styles.marker,
                hasTasks(d) && {
                  backgroundColor: active ? "#fff" : colors.accent,
                },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  day: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  dayActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  weekday: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  date: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  textActive: { color: "#fff" },
  marker: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "transparent",
  },
});
