import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import Button from "./ui/Button";
import ModalCard from "./ui/ModalCard";
import { levelFromXp } from "./xp";

type LevelInfo = ReturnType<typeof levelFromXp>;

export type CompletionData = {
  title: string;
  // Net XP gained (0 when the day is closed or capped).
  gained: number;
  basePoints: number;
  multiplier: number;
  // Why nothing was earned, when gained is 0.
  note?: string;
  before: LevelInfo;
  after: LevelInfo;
  // That was the last open task today.
  dayDone: boolean;
  streak: number;
};

type CompletionModalProps = {
  data: CompletionData | null;
  onClose: () => void;
};

const native = Platform.OS !== "web";

// Shown after you confirm a task is done: an animated check, the XP you
// earned counting up, and your level bar filling (rolling over into the next
// level when you cross one).
export default function CompletionModal({ data, onClose }: CompletionModalProps) {
  return (
    <ModalCard
      visible={!!data}
      maxWidth={380}
      footer={<Button label="Continue" onPress={onClose} />}
    >
      {data && <Content data={data} />}
    </ModalCard>
  );
}

function Content({ data }: { data: CompletionData }) {
  const { before, after, gained } = data;
  const leveledUp = after.level > before.level;

  const pop = useRef(new Animated.Value(0)).current; // the checkmark
  const ring = useRef(new Animated.Value(0)).current; // pulse behind it
  const rise = useRef(new Animated.Value(0)).current; // text fades in
  const bar = useRef(new Animated.Value(before.progress)).current;
  const badge = useRef(new Animated.Value(0)).current; // "Level up!"
  const [xpShown, setXpShown] = useState(0);
  // The level shown on the bar; moves on to the new level after a level-up.
  const [shown, setShown] = useState<LevelInfo>(before);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    const finish = () => {
      pop.setValue(1);
      ring.setValue(1);
      rise.setValue(1);
      badge.setValue(leveledUp ? 1 : 0);
      bar.setValue(after.progress);
      setShown(after);
      setXpShown(gained);
    };
    if (reduceMotion) return finish();

    // Staying inside a level: the label can show the new numbers straight away
    // while the bar fills. (A level-up switches over after the bar rolls over.)
    if (!leveledUp) setShown(after);

    const counter = new Animated.Value(0);
    const id = counter.addListener(({ value }) => setXpShown(Math.round(value)));
    const t = (v: Animated.Value, to: number, ms: number, delay = 0) =>
      Animated.timing(v, {
        toValue: to,
        duration: ms,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: native,
      });
    // The bar's width can't use the native driver.
    const tBar = (to: number, ms: number) =>
      Animated.timing(bar, {
        toValue: to,
        duration: ms,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });

    // Crossing a level: fill to the top, flash the badge, then roll over.
    const barAnim = leveledUp
      ? Animated.sequence([
          tBar(1, 500),
          t(badge, 1, 220),
          Animated.delay(120),
        ])
      : tBar(after.progress, 650);

    // The check pops in while the numbers start almost immediately behind it,
    // so the whole thing lands in about two seconds.
    const run = Animated.parallel([
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: 6, tension: 160, useNativeDriver: native }),
        t(ring, 1, 600),
        t(rise, 1, 300, 120),
      ]),
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(counter, {
            toValue: gained,
            duration: gained > 0 ? 700 : 1,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          barAnim,
        ]),
      ]),
    ]);

    // After filling to 100%, roll over to the new level's bar.
    let rollover: Animated.CompositeAnimation | null = null;
    run.start(({ finished }) => {
      if (!finished) return;
      if (leveledUp) {
        setShown(after);
        bar.setValue(0);
        rollover = tBar(after.progress, 550);
        rollover.start();
      }
    });

    return () => {
      run.stop();
      rollover?.stop();
      counter.removeListener(id);
    };
  }, [reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  const width = bar.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <View style={styles.checkWrap}>
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: ring.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.5, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.7] }) }],
            },
          ]}
        />
        <Animated.View
          accessibilityLabel="Task complete"
          style={[styles.check, { transform: [{ scale: pop }] }]}
        >
          <Ionicons name="checkmark" size={54} color="#052e1c" />
        </Animated.View>
      </View>

      <Animated.View style={[styles.body, { opacity: rise }]}>
        <Text style={styles.kicker}>Task complete!</Text>
        <Text style={styles.taskTitle} numberOfLines={2}>
          {data.title || "Untitled task"}
        </Text>

        <View style={styles.xpRow}>
          <Ionicons name="star" size={26} color={colors.warning} />
          <Text style={styles.xp} accessibilityLabel={`${gained} XP gained`}>
            +{xpShown} XP
          </Text>
        </View>

        {gained > 0 ? (
          data.multiplier > 1 && (
            <View style={styles.bonusPill}>
              <Text style={styles.bonusText}>
                {data.basePoints} XP × {data.multiplier.toFixed(2)} streak bonus
              </Text>
            </View>
          )
        ) : (
          <Text style={styles.note}>{data.note ?? "No XP for this one."}</Text>
        )}

        <View style={styles.levelBlock}>
          <View style={styles.levelHead}>
            <Text style={styles.levelName}>
              Level {shown.level} · {shown.title}
            </Text>
            {leveledUp && (
              <Animated.View
                style={[styles.levelUp, { opacity: badge, transform: [{ scale: badge }] }]}
                pointerEvents="none"
              >
                <Text style={styles.levelUpText}>LEVEL UP!</Text>
              </Animated.View>
            )}
          </View>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width }]} />
          </View>
          <View style={styles.levelMeta}>
            <Text style={styles.metaText}>
              {shown.xpIntoLevel.toLocaleString()} / {shown.xpForNext.toLocaleString()} XP
            </Text>
            <Text style={styles.metaText}>
              {shown.toNext.toLocaleString()} to level {shown.level + 1}
            </Text>
          </View>
        </View>

        {data.dayDone && (
          <Text style={styles.dayDone}>
            🔥 All done for today · {data.streak} day{data.streak === 1 ? "" : "s"} streak
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", gap: 14, paddingVertical: 4 },
  checkWrap: { width: 112, height: 112, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
  },
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
  },
  body: { alignSelf: "stretch", alignItems: "center", gap: 8 },
  kicker: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4, color: colors.textPrimary },
  taskTitle: { fontSize: 15, color: colors.textMuted, textAlign: "center" },
  xpRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  xp: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.success,
    fontVariant: ["tabular-nums"],
  },
  bonusPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.streakSoft,
  },
  bonusText: { fontSize: 13, fontWeight: "700", color: colors.streak },
  note: { fontSize: 14, lineHeight: 20, textAlign: "center", color: colors.textMuted },
  levelBlock: {
    alignSelf: "stretch",
    gap: 8,
    marginTop: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  levelName: { flexShrink: 1, fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  levelUp: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
  },
  levelUpText: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: colors.warning },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceRaised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5, backgroundColor: colors.warning },
  levelMeta: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  metaText: { flexShrink: 1, fontSize: 12, color: colors.textMuted },
  dayDone: { marginTop: 6, fontSize: 14, fontWeight: "700", color: colors.streak, textAlign: "center" },
});
