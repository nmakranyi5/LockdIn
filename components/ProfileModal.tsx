import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors, radius } from "../assets/colors/colors";
import { addDays } from "./taskState";
import { dayKey, DayStatus, fromKey, MILESTONES, StreakStats } from "./streak";
import AvatarView from "./AvatarView";
import AvatarModal from "./AvatarModal";
import GoalModal from "./GoalModal";
import { allTasksBonus, goalBonus, goalLabel } from "./goals";
import IconButton from "./ui/IconButton";
import { MAX_STREAK_BONUS_DAYS, STREAK_BONUS_PER_DAY, XpSummary } from "./xp";
import { Profile } from "./useProfile";

type ProfileModalProps = {
  visible: boolean;
  onClose: () => void;
  profile: Profile;
  onChange: (p: Profile) => void;
  stats: StreakStats;
  xp: XpSummary;
  todayKey: string;
  // Daily goal: tasks to finish per day (0 = all), a change waiting for
  // tomorrow, and how today is going.
  goal: {
    current: number;
    pending: number | null;
    doneToday: number;
    totalToday: number;
  };
  onChangeGoal: (goal: number) => void;
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

export default function ProfileModal(props: ProfileModalProps) {
  return (
    <Modal
      animationType="slide"
      visible={props.visible}
      onRequestClose={props.onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaProvider>
        <ProfileContent {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function ProfileContent({
  onClose,
  profile,
  onChange,
  stats,
  xp,
  todayKey,
  goal,
  onChangeGoal,
}: ProfileModalProps) {
  const insets = useSafeAreaInsets();
  const [goalOpen, setGoalOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  // Calendar: WEEKS rows, Monday first, ending with the current week.
  const today = fromKey(todayKey);
  const mondayOffset = (today.getDay() + 6) % 7;
  const gridStart = addDays(today, -mondayOffset - (WEEKS - 1) * 7);
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(gridStart, i));

  const weekRate =
    stats.weekTotal > 0 ? Math.round((stats.weekDone / stats.weekTotal) * 100) : null;

  const left = Math.max(0, goal.current - goal.doneToday);
  const heroLine =
    stats.today === "complete"
      ? goal.current > 0
        ? "Today's goal is done. Nice work."
        : "Today's done. Nice work."
      : stats.today === "pending"
      ? goal.current > 0
        ? `Finish ${left} more task${left === 1 ? "" : "s"} today to extend your streak.`
        : "Finish today's tasks to extend your streak."
      : stats.current > 0
      ? goal.current > 0
        ? `Add and finish ${goal.current} task${goal.current === 1 ? "" : "s"} today to keep it going.`
        : "Add a task today to keep it going."
      : goal.current > 0
      ? `Finish at least ${goal.current} task${goal.current === 1 ? "" : "s"} in a day to start a streak.`
      : "Complete all of a day's tasks to start a streak.";

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
        <View style={styles.column}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
            <IconButton name="close" label="Close" size={18} onPress={onClose} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.identity}>
              <View style={styles.identityRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Change avatar"
                  onPress={() => setAvatarOpen(true)}
                >
                  <View style={styles.avatar}>
                    <AvatarView avatar={profile.avatar} size={60} fontSize={32} />
                  </View>
                  <View style={styles.avatarEdit}>
                    <Ionicons name="pencil" size={11} color="#fff" />
                  </View>
                </TouchableOpacity>
                <TextInput
                  value={profile.name}
                  onChangeText={(name) => onChange({ ...profile, name })}
                  placeholder="Your name"
                  placeholderTextColor={colors.textMuted}
                  maxLength={24}
                  style={styles.name}
                />
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

            <View style={styles.goalCard}>
              <View style={styles.goalTop}>
                <View style={styles.goalBadge}>
                  <Ionicons name="flag" size={18} color={colors.accent} />
                </View>
                <View style={styles.levelText}>
                  <Text style={styles.levelSub}>Daily goal</Text>
                  <Text style={styles.goalTitle}>{goalLabel(goal.current)}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Change daily goal"
                  style={styles.goalChange}
                  onPress={() => setGoalOpen(true)}
                >
                  <Text style={styles.goalChangeText}>Change</Text>
                </TouchableOpacity>
              </View>
              {goal.current > 0 ? (
                <>
                  <View style={styles.xpTrack}>
                    <View
                      style={[
                        styles.goalFill,
                        { width: `${Math.min(100, Math.round((goal.doneToday / goal.current) * 100))}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.xpMeta}>
                    <Text style={styles.xpMetaText}>
                      Today: {Math.min(goal.doneToday, goal.current)} / {goal.current}
                      {goal.doneToday >= goal.current ? " ✓ goal reached" : ""}
                    </Text>
                    <Text style={styles.xpMetaText}>
                      ×{goalBonus(goal.current).toFixed(2)} XP bonus
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.bonus}>
                  Today: {goal.doneToday} of {goal.totalToday} task{goal.totalToday === 1 ? "" : "s"} done.
                  {goal.totalToday > 1
                    ? ` Finish them all for ×${allTasksBonus(goal.totalToday).toFixed(2)} XP.`
                    : ""}
                </Text>
              )}
              {goal.pending !== null && goal.pending !== goal.current && (
                <Text style={styles.bonus}>Tomorrow: {goalLabel(goal.pending)}</Text>
              )}
            </View>

            <View style={styles.levelCard} accessibilityLabel={`Level ${xp.level}, ${xp.total} XP`}>
              <View style={styles.levelTop}>
                <View style={styles.levelBadge}>
                  <Ionicons name="star" size={20} color={colors.warning} />
                </View>
                <View style={styles.levelText}>
                  <Text style={styles.levelTitle}>
                    Level {xp.level} · {xp.title}
                  </Text>
                  <Text style={styles.levelSub}>{xp.total.toLocaleString()} XP total</Text>
                </View>
                <View style={styles.todayXp}>
                  <Text style={styles.todayXpNum}>+{xp.today.xp}</Text>
                  <Text style={styles.todayXpLabel}>today</Text>
                </View>
              </View>
              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${Math.round(xp.progress * 100)}%` }]} />
              </View>
              <View style={styles.xpMeta}>
                <Text style={styles.xpMetaText}>
                  {xp.xpIntoLevel.toLocaleString()} / {xp.xpForNext.toLocaleString()} XP
                </Text>
                <Text style={styles.xpMetaText}>
                  {xp.toNext.toLocaleString()} to level {xp.level + 1}
                </Text>
              </View>
              <Text style={styles.bonus}>
                {xp.today.streakBefore > 0
                  ? `🔥 ×${xp.today.multiplier.toFixed(2)} streak bonus on today's XP`
                  : `Build a streak for bonus XP: +${Math.round(STREAK_BONUS_PER_DAY * 100)}% per day, up to ×${(1 + STREAK_BONUS_PER_DAY * MAX_STREAK_BONUS_DAYS).toFixed(1)}.`}
              </Text>
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
      <AvatarModal
        visible={avatarOpen}
        avatar={profile.avatar}
        onSelect={(avatar) => onChange({ ...profile, avatar })}
        onClose={() => setAvatarOpen(false)}
      />
      <GoalModal
        visible={goalOpen}
        current={goal.current}
        pending={goal.pending}
        onSave={onChangeGoal}
        onClose={() => setGoalOpen(false)}
      />
    </View>
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

  identity: { gap: 12, paddingTop: 4 },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    paddingVertical: 6,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  avatarEdit: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },

  hero: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroNumber: {
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: -2,
    color: colors.textPrimary,
    lineHeight: 62,
  },
  heroLabel: { fontSize: 16, fontWeight: "600", color: colors.textMuted },
  heroHint: { marginTop: 10, fontSize: 14, color: colors.textMuted, textAlign: "center" },

  goalCard: {
    gap: 10,
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  goalBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  goalTitle: { fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginTop: 1 },
  goalChange: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  goalChangeText: { fontSize: 14, fontWeight: "700", color: colors.accent },
  goalFill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
  levelCard: {
    gap: 10,
    padding: 16,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  levelBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warningSoft,
  },
  levelText: { flex: 1, minWidth: 0 },
  levelTitle: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  levelSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  todayXp: { alignItems: "flex-end" },
  todayXpNum: { fontSize: 20, fontWeight: "800", color: colors.success },
  todayXpLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceRaised, overflow: "hidden" },
  xpFill: { height: "100%", borderRadius: 4, backgroundColor: colors.warning },
  xpMeta: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  xpMetaText: { flexShrink: 1, fontSize: 12, color: colors.textMuted },
  bonus: { fontSize: 13, lineHeight: 18, color: colors.textLabel },
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
