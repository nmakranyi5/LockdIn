import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import { formatClock, formatMs, getTaskState, Task } from "./taskState";

type TaskCardProps = {
  task: Task;
  now: number;
  onPress: () => void;
  onStart: () => void;
  onEnd: () => void;
  onReschedule: () => void;
  onDelete: () => void;
};

export default function TaskCard({
  task,
  now,
  onPress,
  onStart,
  onEnd,
  onReschedule,
  onDelete,
}: TaskCardProps) {
  const s = getTaskState(task, now);
  const started = !!task.startedAt;
  const completed = !!task.completedAt;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, s.isDone && styles.cardDone]}
    >
      <View style={styles.topRow}>
        <Text style={styles.range}>
          {formatClock(task.startDate)} – {formatClock(task.endDate)}
        </Text>
        <View style={styles.topRight}>
          <View style={[styles.pill, { backgroundColor: s.status.bg }]}>
            <View style={[styles.dot, { backgroundColor: s.status.color }]} />
            <Text style={[styles.pillText, { color: s.status.color }]}>
              {s.status.text}
            </Text>
          </View>
          <TouchableOpacity hitSlop={10} onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <Text
        style={[styles.title, s.isDone && styles.titleDone]}
        numberOfLines={2}
      >
        {task.title || "Untitled task"}
      </Text>

      <View style={styles.bottomRow}>
        <View style={styles.timerWrap}>
          <Text style={styles.timerLabel}>{s.label}</Text>
          <Text
            style={[styles.timer, s.isOverdue && { color: colors.danger }]}
          >
            {formatMs(s.timeMs)}
          </Text>
        </View>

        {!started && !completed && (
          <ActionButton
            label="Start"
            icon="play"
            bg={colors.accent}
            onPress={onStart}
          />
        )}
        {started && !completed && (
          <ActionButton
            label="End"
            icon="stop"
            bg={colors.danger}
            onPress={onEnd}
          />
        )}
        {completed && (
          <ActionButton
            label="Reschedule"
            icon="refresh"
            bg={colors.surfaceRaised}
            fg={colors.textLabel}
            onPress={onReschedule}
          />
        )}
      </View>

      {s.progress !== null && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${s.progress * 100}%`,
                backgroundColor: s.isOverdue ? colors.danger : colors.accent,
              },
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  icon,
  bg,
  fg = "#fff",
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  bg: string;
  fg?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.action, { backgroundColor: bg }]}
    >
      <Ionicons name={icon} size={14} color={fg} />
      <Text style={[styles.actionText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    overflow: "hidden",
  },
  cardDone: { opacity: 0.7 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  range: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: "700" },
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  titleDone: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  timerWrap: { flexShrink: 1 },
  timerLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  timer: {
    fontSize: 30,
    fontWeight: "300",
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
    color: colors.textPrimary,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  actionText: { fontSize: 14, fontWeight: "700" },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: colors.surfaceRaised,
  },
  fill: { height: "100%" },
});
