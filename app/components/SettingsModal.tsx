import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius } from "../../assets/colors/colors";
import Button from "../../components/ui/Button";
import ModalCard from "../../components/ui/ModalCard";
import HelpHomeScreenModal from "./HelpHomeScreenModal";

type SettingsModalProps = {
  isVisible: boolean;
  onClose: () => void;
};

export default function SettingsModal({
  isVisible,
  onClose,
}: SettingsModalProps) {
  const [helpVisible, setHelpVisible] = useState(false);

  return (
    <ModalCard
      visible={isVisible}
      title="Settings"
      footer={<Button label="Done" onPress={onClose} />}
      // Rendered inside this modal so iOS can present it on top.
      overlay={
        <HelpHomeScreenModal
          isVisible={helpVisible}
          onClose={() => setHelpVisible(false)}
        />
      }
    >
      <TouchableOpacity
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Help"
        style={styles.row}
        onPress={() => setHelpVisible(true)}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="help-circle-outline" size={22} color={colors.accent} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Help</Text>
          <Text style={styles.rowSub}>How LockdIn works</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={styles.caption}>More settings are on the way.</Text>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  caption: { marginTop: 16, fontSize: 13, color: colors.textMuted },
});
