import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import { addDays, isSameDay, startOfDay } from "./taskState";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import ModalCard from "./ui/ModalCard";

type CalendarModalProps = {
  visible: boolean;
  selected: Date;
  hasTasks: (d: Date) => boolean;
  onSelect: (d: Date) => void;
  onClose: () => void;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// A month grid (Monday first) for picking a day to jump to.
export default function CalendarModal({
  visible,
  selected,
  hasTasks,
  onSelect,
  onClose,
}: CalendarModalProps) {
  const [month, setMonth] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));
  useEffect(() => {
    if (visible) setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [visible, selected]);

  const today = startOfDay(new Date());
  const lead = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const rows = Math.ceil((lead + daysInMonth) / 7);
  const gridStart = addDays(month, -lead);
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  const pick = (d: Date) => {
    onSelect(d);
    onClose();
  };

  return (
    <ModalCard
      visible={visible}
      title="Pick a day"
      maxWidth={400}
      headerRight={<IconButton name="close" label="Close" size={18} onPress={onClose} />}
      footer={<Button label="Today" variant="secondary" onPress={() => pick(today)} />}
    >
      <View style={styles.monthRow}>
        <IconButton name="chevron-back" label="Previous month" size={16} onPress={() => shift(-1)} />
        <Text style={styles.month} accessibilityRole="header">
          {month.toLocaleDateString([], { month: "long", year: "numeric" })}
        </Text>
        <IconButton name="chevron-forward" label="Next month" size={16} onPress={() => shift(1)} />
      </View>

      <View style={styles.grid}>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={styles.weekday}>
              {w}
            </Text>
          ))}
        </View>
        {Array.from({ length: rows }, (_, row) => (
          <View key={row} style={styles.weekRow}>
            {Array.from({ length: 7 }, (_, col) => {
              const d = addDays(gridStart, row * 7 + col);
              if (d.getMonth() !== month.getMonth()) return <View key={col} style={styles.cell} />;
              const active = isSameDay(d, selected);
              const isToday = isSameDay(d, today);
              return (
                <TouchableOpacity
                  key={col}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={d.toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  onPress={() => pick(d)}
                  style={[
                    styles.cell,
                    styles.day,
                    active && styles.dayActive,
                    isToday && !active && styles.dayToday,
                  ]}
                >
                  <Text style={[styles.dayText, active && styles.dayTextActive]}>{d.getDate()}</Text>
                  <View
                    style={[
                      styles.marker,
                      hasTasks(d) && { backgroundColor: active ? "#fff" : colors.accent },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  month: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  grid: { gap: 6, marginTop: 14 },
  weekRow: { flexDirection: "row", gap: 6 },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  cell: { flex: 1, aspectRatio: 1 },
  day: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  dayActive: { backgroundColor: colors.accent },
  dayToday: { borderWidth: 1.5, borderColor: colors.accent },
  dayText: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  dayTextActive: { color: "#fff" },
  marker: { width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: "transparent" },
});
