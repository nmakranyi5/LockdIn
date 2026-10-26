import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors, radius } from "../../assets/colors/colors";
import ConfirmModal from "../../app/components/ConfirmModal";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import {
  FriendRequest,
  FriendUser,
  Overview,
  removeFriend,
  requestMessage,
  respondToRequest,
  sendFriendRequest,
  sendNudge,
  setUsername,
  TodayStatus,
  USERNAME_RE,
  normalizeUsername,
  usernameMessage,
} from "./api";

type Me = { avatar: string; streak: number; today: "none" | "pending" | "complete" };

type FriendsModalProps = {
  visible: boolean;
  onClose: () => void;
  overview: Overview | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
  me: Me;
};

export default function FriendsModal(props: FriendsModalProps) {
  return (
    <Modal
      animationType="slide"
      visible={props.visible}
      onRequestClose={props.onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaProvider>
        <FriendsContent {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

const todayLabel: Record<TodayStatus, { text: string; color: string }> = {
  complete: { text: "All done today", color: colors.success },
  pending: { text: "In progress", color: colors.accent },
  none: { text: "No tasks today", color: colors.textMuted },
  unknown: { text: "Not seen today", color: colors.textMuted },
};

type Flash = { ok: boolean; text: string } | null;

function FriendsContent({ onClose, overview, loading, error, onRefresh, me }: FriendsModalProps) {
  const insets = useSafeAreaInsets();
  // On very narrow phones the rank moves inline and the avatar shrinks so
  // long usernames, big streaks and the buttons all still fit.
  const compact = useWindowDimensions().width < 360;
  const [flash, setFlash] = useState<Flash>(null);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<FriendUser | null>(null);

  const myName = overview?.me.username ?? null;
  const needsName = !!overview && !myName;

  // Refresh while the screen is open so a friend's progress shows up promptly.
  useEffect(() => {
    onRefresh();
    const t = setInterval(() => onRefresh(), 20_000);
    return () => clearInterval(t);
  }, [onRefresh]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(t);
  }, [flash]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      setFlash({ ok: false, text: e?.message ?? "Something went wrong." });
    } finally {
      setBusy(null);
    }
  };

  const saveName = () =>
    run("name", async () => {
      const wanted = normalizeUsername(nameInput);
      if (!USERNAME_RE.test(wanted)) return setNameError(usernameMessage.invalid);
      const r = await setUsername(wanted);
      if (r !== "ok") return setNameError(usernameMessage[r]);
      setNameError(null);
      setEditingName(false);
      await onRefresh();
    });

  const add = () =>
    run("add", async () => {
      const wanted = normalizeUsername(adding);
      if (!wanted) return;
      if (!USERNAME_RE.test(wanted)) return setFlash({ ok: false, text: requestMessage.not_found.text(wanted) });
      const r = await sendFriendRequest(wanted);
      const m = requestMessage[r];
      setFlash({ ok: m.ok, text: m.text(wanted) });
      if (m.ok) setAdding("");
      await onRefresh();
    });

  const respond = (req: FriendRequest, accept: boolean) =>
    run(req.id, async () => {
      await respondToRequest(req.id, accept);
      setFlash({
        ok: true,
        text: accept ? `You and @${req.username} are now friends!` : `Declined @${req.username}.`,
      });
      await onRefresh();
    });

  const cancel = (req: FriendRequest) =>
    run(req.id, async () => {
      await removeFriend(req.user_id);
      await onRefresh();
    });

  const nudge = (f: FriendUser) =>
    run(f.user_id, async () => {
      const r = await sendNudge(f.user_id);
      setFlash({
        ok: r === "sent",
        text:
          r === "sent"
            ? `Nudge sent to @${f.username} 👋`
            : r === "already_nudged"
            ? `You already nudged @${f.username} today.`
            : r === "already_done"
            ? `@${f.username} already finished today. 🎉`
            : "You're not friends with them any more.",
      });
      await onRefresh();
    });

  // Leaderboard: me plus friends, best streak first, ties share a rank.
  const board = useMemo(() => {
    if (!overview) return [];
    const rows = [
      {
        key: "me",
        isMe: true as const,
        username: myName ?? "you",
        avatar: me.avatar,
        streak: me.streak,
        today: me.today as TodayStatus,
        friend: undefined as FriendUser | undefined,
      },
      ...overview.friends.map((f) => ({
        key: f.user_id,
        isMe: false as const,
        username: f.username,
        avatar: f.avatar,
        streak: f.streak,
        today: f.today,
        friend: f as FriendUser | undefined,
      })),
    ].sort((a, b) => b.streak - a.streak || a.username.localeCompare(b.username));
    let rank = 0;
    let prev = -1;
    return rows.map((r, i) => {
      if (r.streak !== prev) rank = i + 1;
      prev = r.streak;
      return { ...r, rank };
    });
  }, [overview, me, myName]);

  // Nudge + remove buttons for a friend's row (your own row has none).
  const actionsFor = (r: (typeof board)[number]) =>
    r.friend ? (
      <View style={[styles.actions, compact && styles.actionsCompact]}>
        {r.friend.today !== "complete" && (
          <IconButton
            name={r.friend.nudged_recently ? "notifications" : "notifications-outline"}
            label={`Nudge ${r.username}`}
            size={16}
            disabled={r.friend.nudged_recently || busy === r.friend.user_id}
            color={r.friend.nudged_recently ? colors.textMuted : colors.accent}
            background={r.friend.nudged_recently ? colors.surface : colors.accentSoft}
            onPress={() => nudge(r.friend!)}
          />
        )}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Remove ${r.username}`}
          hitSlop={8}
          onPress={() => setRemoving(r.friend!)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    ) : null;

  const hasFriends = (overview?.friends.length ?? 0) > 0;

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
          <Text style={styles.title}>Friends</Text>
          <IconButton name="close" label="Close" size={18} onPress={onClose} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={() => onRefresh()} tintColor={colors.accent} />
          }
        >
          {flash && (
            <View style={[styles.flash, flash.ok ? styles.flashOk : styles.flashBad]} accessibilityRole="alert">
              <Ionicons
                name={flash.ok ? "checkmark-circle" : "alert-circle"}
                size={18}
                color={flash.ok ? colors.success : colors.danger}
              />
              <Text style={styles.flashText}>{flash.text}</Text>
            </View>
          )}

          {error && !overview && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Couldn’t load your friends</Text>
              <Text style={styles.muted}>{error}</Text>
              <Button label="Try again" variant="secondary" onPress={() => onRefresh()} />
            </View>
          )}

          {!overview && !error && <Text style={styles.muted}>Loading…</Text>}

          {(needsName || editingName) && overview && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{needsName ? "Choose a username" : "Change username"}</Text>
              <Text style={styles.muted}>
                Friends add you with it. Use 3–20 letters, numbers or underscores.
              </Text>
              <View style={styles.inputRow}>
                <Text style={styles.at}>@</Text>
                <TextInput
                  value={nameInput}
                  onChangeText={(t) => {
                    setNameInput(t.replace(/[^a-zA-Z0-9_]/g, ""));
                    setNameError(null);
                  }}
                  placeholder="your_username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  onSubmitEditing={saveName}
                  style={styles.input}
                />
              </View>
              {nameError && <Text style={styles.error}>{nameError}</Text>}
              <Button
                label={busy === "name" ? "Saving…" : "Save username"}
                onPress={busy === "name" ? () => {} : saveName}
              />
              {!needsName && (
                <Button
                  label="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setEditingName(false);
                    setNameError(null);
                  }}
                />
              )}
            </View>
          )}

          {overview && !needsName && !editingName && (
            <>
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Change username"
                style={styles.identity}
                onPress={() => {
                  setNameInput(myName ?? "");
                  setEditingName(true);
                }}
              >
                <View style={styles.identityText}>
                  <Text style={styles.muted}>Your username</Text>
                  <Text style={styles.handle} numberOfLines={1}>
                    @{myName}
                  </Text>
                </View>
                <Ionicons name="create-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.section}>Add a friend</Text>
              <View style={styles.addRow}>
                <View style={[styles.inputRow, styles.addInput]}>
                  <Text style={styles.at}>@</Text>
                  <TextInput
                    value={adding}
                    onChangeText={(t) => setAdding(t.replace(/[^a-zA-Z0-9_@]/g, ""))}
                    placeholder="their_username"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={21}
                    onSubmitEditing={add}
                    style={styles.input}
                  />
                </View>
                <Button
                  label={busy === "add" ? "…" : "Add"}
                  onPress={busy === "add" ? () => {} : add}
                  style={styles.addButton}
                />
              </View>

              {overview.incoming.length > 0 && (
                <>
                  <Text style={styles.section}>Requests · {overview.incoming.length}</Text>
                  {overview.incoming.map((r) => (
                    <View key={r.id} style={styles.row}>
                      <Avatar emoji={r.avatar} />
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          @{r.username}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          wants to be friends
                        </Text>
                      </View>
                      <IconButton
                        name="checkmark"
                        label={`Accept ${r.username}`}
                        size={18}
                        color={colors.success}
                        background={colors.successSoft}
                        disabled={busy === r.id}
                        onPress={() => respond(r, true)}
                      />
                      <IconButton
                        name="close"
                        label={`Decline ${r.username}`}
                        size={18}
                        disabled={busy === r.id}
                        onPress={() => respond(r, false)}
                      />
                    </View>
                  ))}
                </>
              )}

              {overview.outgoing.length > 0 && (
                <>
                  <Text style={styles.section}>Sent</Text>
                  {overview.outgoing.map((r) => (
                    <View key={r.id} style={styles.row}>
                      <Avatar emoji={r.avatar} />
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          @{r.username}
                        </Text>
                        <Text style={styles.rowSub}>Waiting for them to accept</Text>
                      </View>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Cancel request to ${r.username}`}
                        hitSlop={8}
                        disabled={busy === r.id}
                        onPress={() => cancel(r)}
                      >
                        <Text style={styles.link}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              <Text style={styles.section}>Leaderboard</Text>
              {!hasFriends && (
                <View style={styles.empty}>
                  <View style={styles.emptyCircle}>
                    <Ionicons name="people-outline" size={30} color={colors.accent} />
                  </View>
                  <Text style={styles.cardTitle}>Better together</Text>
                  <Text style={[styles.muted, { textAlign: "center" }]}>
                    Add a friend by username. You’ll see each other’s streaks and can nudge each other
                    to finish the day.
                  </Text>
                </View>
              )}

              {board.map((r) => (
                <View key={r.key} style={[styles.row, r.isMe && styles.rowMe]}>
                  {!compact && <Text style={styles.rank}>{medal(r.rank)}</Text>}
                  <Avatar emoji={r.avatar} small={compact} />
                  <View style={styles.rowText}>
                    <View style={styles.nameLine}>
                      {compact && <Text style={styles.rankInline}>{medal(r.rank)}</Text>}
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {r.isMe ? "You" : `@${r.username}`}
                      </Text>
                    </View>
                    <View style={styles.subLine}>
                      <View style={[styles.dot, { backgroundColor: todayLabel[r.today].color }]} />
                      <Text style={[styles.rowSub, { color: todayLabel[r.today].color }]} numberOfLines={1}>
                        {todayLabel[r.today].text}
                      </Text>
                    </View>
                    {r.friend && r.friend.shared_streak > 0 && (
                      <Text style={styles.together} numberOfLines={1}>
                        🔥 {r.friend.shared_streak} day{r.friend.shared_streak === 1 ? "" : "s"} together
                      </Text>
                    )}
                    {compact && actionsFor(r)}
                  </View>
                  <View style={styles.streak}>
                    <Ionicons
                      name={r.streak > 0 ? "flame" : "flame-outline"}
                      size={18}
                      color={r.streak > 0 ? colors.streak : colors.textMuted}
                    />
                    <Text style={styles.streakNum}>{r.streak}</Text>
                  </View>
                  {!compact && actionsFor(r)}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>

      <ConfirmModal
        visible={!!removing}
        title="Remove friend?"
        message={`You and @${removing?.username ?? ""} will no longer see each other's streaks. You can add them again later.`}
        confirmText="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const f = removing;
          setRemoving(null);
          if (f)
            run(f.user_id, async () => {
              await removeFriend(f.user_id);
              await onRefresh();
            });
        }}
      />
    </View>
  );
}

const medal = (rank: number) =>
  rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;

function Avatar({ emoji, small }: { emoji: string; small?: boolean }) {
  return (
    <View style={[styles.avatar, small && styles.avatarSmall]}>
      <Text style={[styles.avatarText, small && { fontSize: 17 }]}>{emoji}</Text>
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
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, color: colors.textPrimary },
  content: { paddingBottom: 32, gap: 10 },
  muted: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  error: { fontSize: 14, color: colors.danger },
  link: { fontSize: 14, fontWeight: "700", color: colors.accent },
  section: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  flash: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  flashOk: { backgroundColor: colors.successSoft, borderColor: colors.success },
  flashBad: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  flashText: { flex: 1, minWidth: 0, fontSize: 14, color: colors.textPrimary },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  identityText: { flex: 1, minWidth: 0 },
  handle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  at: { fontSize: 16, color: colors.textMuted, marginRight: 4 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 50,
    fontSize: 16,
    color: colors.textPrimary,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
  },
  addRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  addInput: { flex: 1, minWidth: 0 },
  addButton: { paddingHorizontal: 20, paddingVertical: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMe: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  subLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowTitle: { flexShrink: 1, fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  rowSub: { flexShrink: 1, fontSize: 13, color: colors.textMuted },
  together: { fontSize: 12, fontWeight: "600", color: colors.streak },
  dot: { width: 7, height: 7, borderRadius: 4 },
  rank: { width: 26, textAlign: "center", fontSize: 16, fontWeight: "800", color: colors.textMuted },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  avatarSmall: { width: 32, height: 32, borderRadius: 16 },
  avatarText: { fontSize: 20 },
  rankInline: { fontSize: 14, fontWeight: "800", color: colors.textMuted },
  streak: { flexDirection: "row", alignItems: "center", gap: 3 },
  streakNum: { fontSize: 17, fontWeight: "800", color: colors.textPrimary, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionsCompact: { marginTop: 6 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 20, paddingHorizontal: 8 },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    marginBottom: 4,
  },
});
