import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import { fromKey } from "./streak";
import { Recap } from "./recap";
import { priorityMeta } from "./taskMeta";
import Button from "./ui/Button";
import ModalCard from "./ui/ModalCard";

type RecapModalProps = {
  visible: boolean;
  recap: Recap;
  onClose: () => void;
};

const SHOWN = 5;

// A morning look back at yesterday, and a glance at today.
export default function RecapModal({ visible, recap, onClose }: RecapModalProps) {
  const y = recap.yesterday;
  const when = fromKey(recap.yesterdayKey).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const rows = [
    ...y.done.map((t) => ({ id: t.id, title: t.title, ok: true })),
    ...y.notDone.map((t) => ({ id: t.id, title: t.title, ok: false })),
  ];
  const more = rows.length - SHOWN;
  const status =
    y.kept === null
      ? { text: "Nothing was scheduled", color: colors.textMuted, icon: "remove-circle-outline" as const }
      : y.kept
      ? { text: y.goal > 0 ? "Goal reached, streak kept" : "All done, streak kept", color: colors.success, icon: "checkmark-circle" as const }
      : { text: "Goal missed", color: colors.danger, icon: "close-circle" as const };

  return (
    <ModalCard
      visible={visible}
      title="Yesterday's recap"
      maxWidth={440}
      footer={<Button label="Let's go" onPress={onClose} />}
    >
      <Text style={styles.when}>{when}</Text>

      <View style={styles.summary}>
        <View style={styles.big}>
          <Text style={styles.bigNumber}>
            {y.done.length}
            <Text style={styles.bigOf}>/{y.total}</Text>
          </Text>
          <Text style={styles.bigLabel}>tasks done</Text>
        </View>
        <View style={styles.side}>
          <View style={styles.statusRow}>
            <Ionicons name={status.icon} size={18} color={status.color} />
            <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>
          </View>
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: colors.streakSoft }]}>
              <Ionicons name="flame" size={14} color={colors.streak} />
              <Text style={[styles.chipText, { color: colors.streak }]}>
                {recap.streak} day{recap.streak === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.warningSoft }]}>
              <Ionicons name="star" size={14} color={colors.warning} />
              <Text style={[styles.chipText, { color: colors.warning }]}>+{y.xp} XP</Text>
            </View>
          </View>
        </View>
      </View>

      {rows.length > 0 && (
        <View style={styles.list}>
          {rows.slice(0, SHOWN).map((r) => (
            <View key={r.id} style={styles.row}>
              <Ionicons
                name={r.ok ? "checkmark-circle" : "close-circle"}
                size={18}
                color={r.ok ? colors.success : colors.danger}
              />
              <Text style={[styles.rowText, !r.ok && { color: colors.textMuted }]} numberOfLines={1}>
                {r.title}
              </Text>
            </View>
          ))}
          {more > 0 && <Text style={styles.more}>+{more} more</Text>}
        </View>
      )}
      {y.notDone.length > 0 && (
        <Text style={styles.hint}>
          Missed tasks stay on their day. Open it and tap Reschedule to move one to today.
        </Text>
      )}

      <View style={styles.waterRow}>
        <Ionicons name="water" size={18} color={colors.highlight} />
        <Text style={styles.waterText}>
          {y.water.glasses} / {y.water.goal} glasses of water
        </Text>
        {y.water.glasses >= y.water.goal && <Ionicons name="checkmark" size={16} color={colors.success} />}
      </View>

      <View style={styles.divider} />

      <Text style={styles.section}>Today</Text>
      <Text style={styles.todaySub}>
        {recap.today.total === 0
          ? "Nothing planned yet."
          : `${recap.today.total} task${recap.today.total === 1 ? "" : "s"} · ${recap.today.goalText}`}
      </Text>
      {recap.today.tasks.slice(0, SHOWN).map((t) => (
        <View key={t.id} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: priorityMeta(t.priority).color ?? colors.accent }]} />
          <Text style={styles.rowText} numberOfLines={1}>
            {t.title}
          </Text>
          <Text style={styles.time}>{t.time}</Text>
        </View>
      ))}
      {recap.today.total > SHOWN && <Text style={styles.more}>+{recap.today.total - SHOWN} more</Text>}
      {recap.today.total === 0 && (
        <Text style={styles.hint}>Add a task to start your day and keep your streak going.</Text>
      )}
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  when: { fontSize: 14, color: colors.textMuted, marginBottom: 12 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  big: { alignItems: "center", minWidth: 76 },
  bigNumber: { fontSize: 36, fontWeight: "800", color: colors.textPrimary },
  bigOf: { fontSize: 22, color: colors.textMuted },
  bigLabel: { fontSize: 12, color: colors.textMuted, marginTop: -2 },
  side: { flex: 1, minWidth: 0, gap: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  status: { flexShrink: 1, fontSize: 14, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  list: { marginTop: 14, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  rowText: { flex: 1, minWidth: 0, fontSize: 15, color: colors.textPrimary },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 5 },
  time: { fontSize: 13, color: colors.textMuted },
  more: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  hint: { fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: 10 },
  waterRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  waterText: { fontSize: 14, color: colors.textLabel },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 18 },
  section: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  todaySub: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginTop: 4, marginBottom: 8 },
});
