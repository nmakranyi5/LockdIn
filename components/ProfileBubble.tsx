import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";
import AvatarView from "./AvatarView";

type ProfileBubbleProps = {
  avatar: string;
  streak: number;
  // Today's tasks are all done: the bubble is lit.
  lit: boolean;
  onPress: () => void;
};

// One bubble for the profile: avatar on the left, streak on the right.
export default function ProfileBubble({
  avatar,
  streak,
  lit,
  onPress,
}: ProfileBubbleProps) {
  const active = streak > 0;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Profile, ${streak} day streak`}
      style={[styles.bubble, lit && styles.bubbleLit]}
    >
      <View style={styles.avatar}>
        <AvatarView avatar={avatar} size={32} fontSize={18} />
      </View>
      <View style={styles.streak}>
        <Ionicons
          name={active ? "flame" : "flame-outline"}
          size={16}
          color={active ? colors.streak : colors.textMuted}
        />
        <Text
          numberOfLines={1}
          style={[styles.count, !active && { color: colors.textMuted }]}
        >
          {streak}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bubble: {
    // Yields space to the title on very narrow screens / large text.
    flexShrink: 1,
    minWidth: 0,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    padding: 3,
    paddingRight: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleLit: { backgroundColor: colors.streakSoft, borderColor: colors.streak },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  streak: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 3 },
  count: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "800",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
});
