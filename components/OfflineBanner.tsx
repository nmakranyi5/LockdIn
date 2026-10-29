import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../assets/colors/colors";

type OfflineBannerProps = {
  retrying: boolean;
  onRetry: () => void;
};

// Shown when the server can't be reached. The app keeps working from what is
// saved on the device, and catches up by itself when the connection returns.
export default function OfflineBanner({ retrying, onRetry }: OfflineBannerProps) {
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} />
      <View style={styles.text}>
        <Text style={styles.title}>You're offline</Text>
        <Text style={styles.sub}>Changes are saved on this device and sync when you're back.</Text>
      </View>
      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Try to reconnect"
        disabled={retrying}
        onPress={onRetry}
        style={[styles.button, retrying && { opacity: 0.6 }]}
      >
        <Text style={styles.buttonText}>{retrying ? "Trying…" : "Try again"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginBottom: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  sub: { fontSize: 12, lineHeight: 16, color: colors.textLabel, marginTop: 1 },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.warning,
  },
  buttonText: { fontSize: 13, fontWeight: "700", color: "#1a1204" },
});
