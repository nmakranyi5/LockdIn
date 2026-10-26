import { StyleSheet, Text } from "react-native";
import { colors } from "../../assets/colors/colors";
import Button from "../../components/ui/Button";
import ModalCard from "../../components/ui/ModalCard";

type SettingsModalProps = {
  isVisible: boolean;
  onClose: () => void;
};

export default function SettingsModal({
  isVisible,
  onClose,
}: SettingsModalProps) {
  return (
    <ModalCard
      visible={isVisible}
      title="Settings"
      footer={<Button label="Done" onPress={onClose} />}
    >
      <Text style={styles.text}>Hello there, this is in progress.</Text>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.textMuted, fontSize: 16, lineHeight: 23 },
});
