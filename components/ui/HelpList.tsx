import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../assets/colors/colors";

export default function HelpList({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((text, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{i + 1}</Text>
          </View>
          <Text style={styles.text}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  badgeText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  text: { flex: 1, color: colors.textMuted, fontSize: 16, lineHeight: 23 },
});
