import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../assets/colors/colors";
import Button from "./ui/Button";
import ModalCard from "./ui/ModalCard";
import { levelFromXp, xpForLevel } from "./xp";

const SEEN_KEY = "@lockdin_level_seen";

// Tells you when you reach a new level, once. The level you had already
// reached is remembered per account, so signing in on a new phone, or syncing
// older progress, doesn't replay old celebrations.
export function useLevelUp(level: number, userId: string | null, enabled: boolean) {
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const [current, setCurrent] = useState(level);
  useEffect(() => setCurrent(level), [level]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      let seen: { userId: string | null; level: number } | null = null;
      try {
        const raw = await AsyncStorage.getItem(SEEN_KEY);
        seen = raw ? JSON.parse(raw) : null;
      } catch {}
      if (cancelled) return;
      const remember = () =>
        AsyncStorage.setItem(SEEN_KEY, JSON.stringify({ userId, level })).catch(() => {});
      if (!seen || seen.userId !== userId || level < seen.level) {
        // First run for this account (or progress went down): start quietly.
        remember();
        setCelebrate(null);
      } else if (level > seen.level) {
        setCelebrate(level);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [level, userId, enabled]);

  const dismiss = useCallback(() => {
    AsyncStorage.setItem(SEEN_KEY, JSON.stringify({ userId, level: current })).catch(() => {});
    setCelebrate(null);
  }, [userId, current]);

  return { celebrate, dismiss };
}

type LevelUpModalProps = {
  level: number | null;
  onClose: () => void;
};

export default function LevelUpModal({ level, onClose }: LevelUpModalProps) {
  const info = levelFromXp(level ? xpForLevel(level) : 0);
  return (
    <ModalCard
      visible={level !== null}
      maxWidth={360}
      footer={<Button label="Nice!" onPress={onClose} />}
    >
      <View style={styles.center}>
        <View style={styles.badge}>
          <Ionicons name="star" size={36} color={colors.warning} />
        </View>
        <Text style={styles.kicker}>Level up!</Text>
        <Text style={styles.level}>Level {level}</Text>
        <Text style={styles.title}>{info.title}</Text>
        <Text style={styles.sub}>
          Keep finishing your tasks, and keep your streak alive for bonus XP.
        </Text>
      </View>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: 4, paddingVertical: 8 },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warningSoft,
    marginBottom: 8,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.warning,
  },
  level: { fontSize: 40, fontWeight: "800", letterSpacing: -1, color: colors.textPrimary },
  title: { fontSize: 18, fontWeight: "600", color: colors.textLabel },
  sub: { marginTop: 10, fontSize: 14, lineHeight: 20, textAlign: "center", color: colors.textMuted },
});
