import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import { MAX_GLASSES } from "./water";

type WaterCardProps = {
  glasses: number;
  goal: number;
  onAdd: () => void;
  onUndo: () => void;
  onOpen: () => void;
};

const SOFT = "rgba(92,225,230,0.14)";

// Today's glasses of water: tap + for each one, tap the card for the target and history.
export default function WaterCard({ glasses, goal, onAdd, onUndo, onOpen }: WaterCardProps) {
  const reached = glasses >= goal;
  const tint = reached ? colors.success : colors.highlight;
  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.info}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Water details and daily target"
        onPress={onOpen}
      >
        <View style={[styles.badge, { backgroundColor: reached ? colors.successSoft : SOFT }]}>
          <Ionicons name={reached ? "checkmark" : "water"} size={20} color={tint} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {reached ? "Water · goal reached" : "Water"}
          </Text>
          <Text style={[styles.count, reached && { color: colors.success }]} numberOfLines={1}>
            {glasses} / {goal} glasses
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.undo, glasses === 0 && styles.disabled]}
          disabled={glasses === 0}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Remove a glass of water"
          onPress={onUndo}
        >
          <Ionicons name="remove" size={20} color={colors.textLabel} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.add, { backgroundColor: tint }, glasses >= MAX_GLASSES && styles.disabled]}
          disabled={glasses >= MAX_GLASSES}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Add a glass of water"
          onPress={onAdd}
        >
          <Ionicons name="add" size={22} color="#06201f" />
        </TouchableOpacity>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { backgroundColor: tint, width: `${Math.min(100, Math.round((glasses / goal) * 100))}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    padding: 14,
    marginBottom: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: colors.textMuted },
  count: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },
  buttons: { flexDirection: "row", alignItems: "center", gap: 8 },
  undo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  add: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.35 },
  track: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
  },
  fill: { height: "100%", borderRadius: 3 },
});
