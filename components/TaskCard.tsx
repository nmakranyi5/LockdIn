import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import { kindMeta, priorityMeta, repeatLabel } from "./taskMeta";
import {
  formatClock,
  formatMs,
  getTaskState,
  humanDuration,
  kindOf,
  priorityOf,
  repeatOf,
  Task,
} from "./taskState";

type TaskCardProps = {
  task: Task;
  now: number;
  onPress: () => void;
  onStart: () => void;
  onEnd: () => void;
  onDone: () => void;
  onToggleItem: (itemId: string) => void;
  onReschedule: () => void;
  onDelete: () => void;
  // XP this task earned (shown once it is completed).
  xp?: number;
};

export default function TaskCard({
  task,
  now,
  onPress,
  onStart,
  onEnd,
  onDone,
  onToggleItem,
  onReschedule,
  onDelete,
  xp,
}: TaskCardProps) {
  const s = getTaskState(task, now);
  const kind = kindOf(task);
  const priority = priorityOf(task);
  const repeat = repeatOf(task);
  const pMeta = priorityMeta(priority);
  const kMeta = kindMeta(kind);
  const items = task.items ?? [];
  const checked = items.filter((i) => i.done).length;
  const started = !!task.startedAt;
  const completed = !!task.completedAt;
  const showAccent = priority !== "normal";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={completed}
      style={[styles.card, s.isDone && styles.cardDone]}
    >
      {showAccent && (
        <View style={[styles.accent, { backgroundColor: pMeta.color }]} />
      )}

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
          {!s.isDone && (
            <TouchableOpacity
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Delete task"
              onPress={onDelete}
            >
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text
        style={[styles.title, s.isDone && styles.titleDone]}
        numberOfLines={2}
      >
        {task.title || "Untitled task"}
      </Text>

      <View style={styles.tags}>
        <Tag
          icon={kMeta.icon}
          text={
            kind === "checklist" && items.length > 0
              ? `${checked}/${items.length}`
              : kMeta.label
          }
        />
        {kind === "timer" && !!task.estimateMinutes && (
          <Tag
            icon="hourglass-outline"
            text={`Est. ${humanDuration(task.estimateMinutes * 60_000)}`}
          />
        )}
        {completed && !!xp && <Tag icon="star" text={`+${xp} XP`} color={colors.warning} />}
        {priority !== "normal" && (
          <Tag icon={pMeta.icon} text={pMeta.label} color={pMeta.color} />
        )}
        {repeat !== "none" && <Tag icon="repeat" text={repeatLabel(repeat)} />}
      </View>

      {kind === "checklist" && items.length > 0 && (
        <View style={styles.items}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              disabled={completed}
              style={styles.itemRow}
              onPress={() => onToggleItem(item.id)}
            >
              <Ionicons
                name={item.done ? "checkbox" : "square-outline"}
                size={22}
                color={item.done ? colors.success : colors.textMuted}
              />
              <Text
                style={[styles.itemText, item.done && styles.itemTextDone]}
                numberOfLines={2}
              >
                {item.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.bottomRow}>
        <View style={styles.timerWrap}>
          <Text style={styles.timerLabel}>{s.label}</Text>
          <Text
            style={[
              styles.timer,
              s.isOvertime && { color: colors.warning },
              s.isOverdue && { color: colors.danger },
            ]}
          >
            {s.valueText ?? formatMs(s.timeMs)}
          </Text>
        </View>

        {kind === "timer" && !started && !completed && (
          <ActionButton label="Start" icon="play" bg={colors.accent} onPress={onStart} />
        )}
        {kind === "timer" && started && !completed && (
          <ActionButton label="End" icon="stop" bg={colors.danger} onPress={onEnd} />
        )}
        {kind === "oneshot" && !completed && (
          <ActionButton label="Done" icon="checkmark" bg={colors.success} onPress={onDone} />
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
                backgroundColor:
                  kind === "checklist"
                    ? colors.success
                    : s.isOverdue
                    ? colors.danger
                    : s.isOvertime
                    ? colors.warning
                    : colors.accent,
              },
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

function Tag({
  icon,
  text,
  color = colors.textMuted,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
  color?: string;
}) {
  return (
    <View style={styles.tag}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[styles.tagText, { color }]}>{text}</Text>
    </View>
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
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
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
  titleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  tagText: { fontSize: 12, fontWeight: "600" },
  items: { gap: 4 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  itemText: { flex: 1, fontSize: 16, color: colors.textPrimary },
  itemTextDone: { color: colors.textMuted, textDecorationLine: "line-through" },
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
