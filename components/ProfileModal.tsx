import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius } from "../assets/colors/colors";
import { addDays } from "./taskState";
import { dayKey, DayStatus, fromKey, MILESTONES, StreakStats } from "./streak";
import IconButton from "./ui/IconButton";
import { AVATARS, Profile } from "./useProfile";

type ProfileModalProps = {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
  onChange: (p: Profile) => void;
  stats: StreakStats;
  todayKey: string;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKS = 5;

const cellStyle: Record<DayStatus, { bg: string; border: string; text: string }> = {
  complete: { bg: colors.success, border: colors.success, text: "#06281c" },
  missed: { bg: colors.dangerSoft, border: colors.danger, text: colors.danger },
  pending: { bg: colors.accentSoft, border: colors.accent, text: colors.accent },
  empty: { bg: colors.surface, border: colors.border, text: colors.textMuted },
  future: { bg: "transparent", border: colors.border, text: colors.border },
};

export default function ProfileModal({
  visible,
  onClose,
  profile,
  onChange,
  stats,
  todayKey,
}: ProfileModalProps) {
  // Calendar: WEEKS rows, Monday first, ending with the current week.
  const today = fromKey(todayKey);
  const mondayOffset = (today.getDay() + 6) % 7;
  const gridStart = addDays(today, -mondayOffset - (WEEKS - 1) * 7);
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(gridStart, i));

  const weekRate =
    stats.weekTotal > 0 ? Math.round((stats.weekDone / stats.weekTotal) * 100) : null;

  const heroLine =
    stats.today === "complete"
      ? "Today's done. Nice work."
      : stats.today === "pending"
      ? "Finish today's tasks to extend your streak."
      : stats.current > 0
      ? "Add a task today to keep it going."
      : "Complete all of a day's tasks to start a streak.";

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.column}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
            <IconButton name="close" size={18} onPress={onClose} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profile.avatar}</Text>
              </View>
              <TextInput
                value={profile.name}
                onChangeText={(name) => onChange({ ...profile, name })}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                maxLength={24}
                style={styles.name}
              />
              <View style={styles.avatarRow}>
                {AVATARS.map((a) => (
                  <TouchableOpacity
                    key={a}
                    activeOpacity={0.8}
                    onPress={() => onChange({ ...profile, avatar: a })}
                    style={[styles.avatarChoice, a === profile.avatar && styles.avatarChoiceActive]}
                  >
                    <Text style={styles.avatarChoiceText}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.hero}>
              <Ionicons
                name={stats.current > 0 ? "flame" : "flame-outline"}
                size={44}
                color={stats.current > 0 ? colors.streak : colors.textMuted}
              />
              <Text style={styles.heroNumber}>{stats.current}</Text>
              <Text style={styles.heroLabel}>
                day{stats.current === 1 ? "" : "s"} streak
              </Text>
              <Text style={styles.heroHint}>{heroLine}</Text>
            </View>

            <View style={styles.statsRow}>
              <Stat label="Longest" value={`${stats.longest}`} />
              <Stat label="Completed" value={`${stats.totalCompleted}`} />
              <Stat label="This week" value={weekRate === null ? "–" : `${weekRate}%`} />
            </View>

            <Text style={styles.section}>Last {WEEKS} weeks</Text>
            <View style={styles.calendar}>
              <View style={styles.weekRow}>
                {WEEKDAYS.map((w, i) => (
                  <Text key={i} style={styles.weekday}>
                    {w}
                  </Text>
                ))}
              </View>
              {Array.from({ length: WEEKS }, (_, row) => (
                <View key={row} style={styles.weekRow}>
                  {cells.slice(row * 7, row * 7 + 7).map((d) => {
                    const key = dayKey(d);
                    const status = stats.statusOf(key);
                    const c = cellStyle[status];
                    return (
                      <View
                        key={key}
                        style={[
                          styles.cell,
                          { backgroundColor: c.bg, borderColor: c.border },
                          key === todayKey && styles.cellToday,
                        ]}
                      >
                        <Text style={[styles.cellText, { color: c.text }]}>
                          {d.getDate()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
              <View style={styles.legend}>
                <Legend color={colors.success} label="All done" />
                <Legend color={colors.danger} label="Missed" />
                <Legend color={colors.accent} label="In progress" />
              </View>
            </View>

            <Text style={styles.section}>Milestones</Text>
            <View style={styles.badges}>
              {MILESTONES.map((n) => {
                const earned = stats.longest >= n;
                return (
                  <View key={n} style={[styles.badge, earned && styles.badgeEarned]}>
                    <Ionicons
                      name={earned ? "flame" : "lock-closed"}
                      size={20}
                      color={earned ? colors.streak : colors.textMuted}
                    />
                    <Text style={[styles.badgeNumber, !earned && { color: colors.textMuted }]}>
                      {n}
                    </Text>
                    <Text style={styles.badgeLabel}>days</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: "center" },
  column: { flex: 1, width: "100%", maxWidth: 560, paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  content: { paddingBottom: 32, gap: 16 },

  identity: { alignItems: "center", gap: 12, paddingTop: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 44 },
  name: {
    minWidth: 180,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    paddingVertical: 6,
    ...({ outlineStyle: "none" } as object),
  },
  avatarRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  avatarChoice: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarChoiceActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  avatarChoiceText: { fontSize: 22 },

  hero: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroNumber: {
    fontSize: 64,
    fontWeight: "800",
    letterSpacing: -2,
    color: colors.textPrimary,
    lineHeight: 70,
  },
  heroLabel: { fontSize: 16, fontWeight: "600", color: colors.textMuted },
  heroHint: { marginTop: 10, fontSize: 14, color: colors.textMuted, textAlign: "center" },

  statsRow: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  statLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, marginTop: 2 },

  section: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  calendar: {
    gap: 6,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekRow: { flexDirection: "row", gap: 6 },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cellToday: { borderWidth: 2 },
  cellText: { fontSize: 12, fontWeight: "700" },
  legend: { flexDirection: "row", gap: 16, marginTop: 8, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: colors.textMuted },

  badges: { flexDirection: "row", gap: 8 },
  badge: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeEarned: { backgroundColor: colors.streakSoft, borderColor: colors.streak },
  badgeNumber: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  badgeLabel: { fontSize: 11, color: colors.textMuted },
});
